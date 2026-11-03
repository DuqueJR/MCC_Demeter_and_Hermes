// in_imu.cpp - QMI8658C: FIFO (marca de agua 16) + INT en GPIO33, lectura bajo el mutex del bus SPI.
// SensorLib solo configura el chip. El FIFO se lee aqui: su readFromFifo() hace delay(1) en el handshake CTRL9 a 1 MHz
// y la lectura debe terminar antes de la siguiente muestra (datasheet 8.1); si no, esta se pierde (LOG0023: 2 de cada 18, ODR real 445 Hz).
#include "in_imu.h"
#include "imu_clock.h"
#include "boost_detect.h"
#include "logger.h"
#include "LoRaBoards.h"          // SDCardSPI, IMU_CS, IMU_INT
#include "SensorQMI8658.hpp"
#include <SPI.h>
#include <esp_timer.h>

static const uint16_t WTM        = IMU_WTM;  // muestras (pares acel+giro) para la interrupcion
static const uint16_t MAX_CHUNK  = 32;       // muestras por registro T_IMU (440 B < MAX_LEN)
static const uint32_t POLL_MS    = 100;      // sin interrupcion en este tiempo: se sondea el FIFO
static const uint16_t SAMPLE_B   = 12;       // ax ay az gx gy gz, int16 little endian
static const int64_t  CMD_TO_US  = 20000;    // limite de espera del handshake CTRL9

static const uint8_t REG_CTRL9 = 0x0A, REG_FIFO_CTRL = 0x14, REG_FIFO_COUNT = 0x15, REG_FIFO_DATA = 0x17, REG_STATUS_INT = 0x2D;
static const uint8_t CMD_ACK = 0x00, CMD_REQ_FIFO = 0x05, STATUS_CMD_DONE = 0x80;
static const uint8_t FIFO_CTRL_RUN = (uint8_t)((SensorQMI8658::FIFO_SAMPLES_128 << 2) | SensorQMI8658::FIFO_MODE_FIFO);

static SensorQMI8658 s_qmi;
alignas(4) static uint8_t s_fifo[128 * SAMPLE_B];
static ImuClock      s_clk(2230.0);
static TaskHandle_t  s_task = nullptr;
static ImuStats      s_st;
Latest<ImuSample>    g_imu;

// ---- ISR: marca de tiempo del flanco ----
static const uint32_t ISR_RING = 4;
static int64_t  s_isrT[ISR_RING];
static volatile uint32_t s_isrN = 0;
static void IRAM_ATTR imuIsr() {
    const int64_t t = esp_timer_get_time();
    const uint32_t n = s_isrN;
    s_isrT[n % ISR_RING] = t;
    __atomic_store_n(&s_isrN, n + 1, __ATOMIC_RELEASE);
    BaseType_t hp = pdFALSE;
    if (s_task) vTaskNotifyGiveFromISR(s_task, &hp);
    if (hp) portYIELD_FROM_ISR();
}

static SensorQMI8658::AccelRange accRange() {
    switch (IMU_ACC_FS_G) { case 2: return SensorQMI8658::ACC_RANGE_2G; case 4: return SensorQMI8658::ACC_RANGE_4G;
                            case 8: return SensorQMI8658::ACC_RANGE_8G; default: return SensorQMI8658::ACC_RANGE_16G; }
}
static SensorQMI8658::GyroRange gyrRange() {
    switch (IMU_GYR_FS_DPS) { case 16: return SensorQMI8658::GYR_RANGE_16DPS; case 32: return SensorQMI8658::GYR_RANGE_32DPS;
                              case 64: return SensorQMI8658::GYR_RANGE_64DPS; case 128: return SensorQMI8658::GYR_RANGE_128DPS;
                              case 256: return SensorQMI8658::GYR_RANGE_256DPS; case 512: return SensorQMI8658::GYR_RANGE_512DPS;
                              default: return SensorQMI8658::GYR_RANGE_1024DPS; }
}

// ---- Acceso directo al chip (dentro de una transaccion SPI y con g_sdBusMx tomado) ----
static inline void regRead(uint8_t reg, uint8_t *buf, uint32_t n) {
    digitalWrite(IMU_CS, LOW);
    SDCardSPI.transfer(reg | 0x80);
    SDCardSPI.transferBytes(nullptr, buf, n);
    digitalWrite(IMU_CS, HIGH);
}
static inline void regWrite(uint8_t reg, uint8_t val) {
    digitalWrite(IMU_CS, LOW);
    SDCardSPI.transfer(reg);
    SDCardSPI.transfer(val);
    digitalWrite(IMU_CS, HIGH);
}
static bool waitCmdDone(bool done) {
    const int64_t t0 = esp_timer_get_time();
    for (;;) {
        uint8_t st;
        regRead(REG_STATUS_INT, &st, 1);
        if (((st & STATUS_CMD_DONE) != 0) == done) return true;
        if (esp_timer_get_time() - t0 > CMD_TO_US) return false;
    }
}

// Vacia el FIFO en s_fifo y devuelve las muestras leidas. window_us = tiempo en modo lectura (el chip no acepta muestras).
static uint16_t fifoDrain(uint32_t &window_us) {
    window_us = 0;
    uint16_t cnt = 0;
    SDCardSPI.beginTransaction(SPISettings(IMU_SPI_HZ, MSBFIRST, SPI_MODE0));
    uint8_t c[2];
    regRead(REG_FIFO_COUNT, c, 2);                            // FIFO_SMPL_CNT y FIFO_STATUS (bits 1:0 = parte alta)
    uint32_t bytes = 2u * (((uint32_t)(c[1] & 0x03) << 8) | c[0]);
    if (bytes > sizeof(s_fifo)) bytes = sizeof(s_fifo);
    bytes -= bytes % SAMPLE_B;
    if (bytes) {
        const int64_t t0 = esp_timer_get_time();
        regWrite(REG_CTRL9, CMD_REQ_FIFO);
        bool ok = waitCmdDone(true);
        regWrite(REG_CTRL9, CMD_ACK);                         // necesario aunque el datasheet 5.9.3 diga que basta leer CmdDone: sin esto, 97 % de lotes basura (LOG0004)
        ok = waitCmdDone(false) && ok;
        if (ok) { regRead(REG_FIFO_DATA, s_fifo, bytes); cnt = (uint16_t)(bytes / SAMPLE_B); }
        else s_st.cmdFail++;
        regWrite(REG_FIFO_CTRL, FIFO_CTRL_RUN);               // limpia FIFO_rd_mode: el chip vuelve a llenar el FIFO
        window_us = (uint32_t)(esp_timer_get_time() - t0);
    }
    SDCardSPI.endTransaction();
    return cnt;
}

static bool configureImu() {
    if (!s_qmi.begin(SDCardSPI, IMU_CS)) return false;
    s_qmi.configAccelerometer(accRange(), SensorQMI8658::ACC_ODR_500Hz, SensorQMI8658::LPF_MODE_0);
    s_qmi.configGyroscope(gyrRange(), SensorQMI8658::GYR_ODR_448_4Hz, SensorQMI8658::LPF_MODE_0);
    if (!s_qmi.configFIFO(SensorQMI8658::FIFO_MODE_FIFO, SensorQMI8658::FIFO_SAMPLES_128,
                          SensorQMI8658::INTERRUPT_PIN_1, WTM)) return false;
    s_qmi.enableINT(SensorQMI8658::INTERRUPT_PIN_1, true);   // IMU_INT es un OR por diodos de INT1/INT2: ambos activos
    s_qmi.enableINT(SensorQMI8658::INTERRUPT_PIN_2, true);
    s_qmi.enableGyroscope();
    s_qmi.enableAccelerometer();
    return true;
}

static void imuTask(void *) {
    s_st.state = 1; s_st.msg = "esperando logger";
    for (uint32_t t0 = millis(); loggerStats().state < 2 && millis() - t0 < 20000; ) vTaskDelay(pdMS_TO_TICKS(50));

    xSemaphoreTake(g_sdBusMx, portMAX_DELAY);
    const bool ok = configureImu();
    uint32_t win = 0;
    if (ok) fifoDrain(win);                                   // vaciar lo acumulado para que la linea INT baje
    xSemaphoreGive(g_sdBusMx);
    if (!ok) { s_st.state = 3; s_st.msg = "QMI8658 no responde"; vTaskDelete(nullptr); }

    const float accLsb = 32768.0f / IMU_ACC_FS_G, gyrLsb = 32768.0f / IMU_GYR_FS_DPS;
    pinMode(IMU_INT, INPUT_PULLDOWN);
    s_task = xTaskGetCurrentTaskHandle();
    attachInterrupt(digitalPinToInterrupt(IMU_INT), imuIsr, RISING);
    s_st.state = 2; s_st.msg = "muestreando";

    uint64_t nTotal = 0, nEdgePrev = 0;                       // nTotal: indice real del chip (incluye muestras perdidas)
    int64_t  tEdgePrev = -1;
    uint32_t seenIsr = __atomic_load_n(&s_isrN, __ATOMIC_ACQUIRE);
    uint64_t readSum = 0, winSum = 0;
    for (;;) {
        const bool woke = ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(POLL_MS)) > 0;
        if (!woke) s_st.timeouts++;

        uint32_t isrN = __atomic_load_n(&s_isrN, __ATOMIC_ACQUIRE);
        int64_t tIsr = (isrN != seenIsr) ? s_isrT[(isrN - 1) % ISR_RING] : -1;
        const bool fromIsr = (tIsr >= 0);
        if (fromIsr) { s_st.isr += (isrN - seenIsr); seenIsr = isrN; }

        if (xSemaphoreTake(g_sdBusMx, pdMS_TO_TICKS(250)) != pdTRUE) { s_st.mutexFail++; continue; }
        const int64_t r0 = esp_timer_get_time();
        const uint16_t cnt = fifoDrain(win);
        const int64_t r1 = esp_timer_get_time();
        xSemaphoreGive(g_sdBusMx);

        const uint32_t dr = (uint32_t)(r1 - r0);
        if (dr > s_st.readMaxUs) s_st.readMaxUs = dr;
        if (win > s_st.windowMaxUs) s_st.windowMaxUs = win;
        readSum += dr; winSum += win; s_st.batches++;
        s_st.readAvgUs = (uint32_t)(readSum / s_st.batches);
        s_st.windowAvgUs = (uint32_t)(winSum / s_st.batches);
        if (cnt == 0) { s_st.empty++; continue; }
        if (!fromIsr) tIsr = r0;                              // lectura por sondeo: el instante no es el del flanco

        // El flanco ocurre cuando el nivel llega a WTM: corresponde a la muestra (n0 + WTM - 1).
        // Si el tiempo desde el flanco anterior implica mas muestras que las recibidas, las que faltan se perdieron:
        // el indice salta para que el reloj de muestras mida el periodo real y el EKF vea el hueco.
        bool rej = false;
        uint32_t lost = 0;
        if (fromIsr && cnt >= WTM) {
            uint64_t nEdge = nTotal + WTM - 1;
            if (tEdgePrev >= 0) {
                const uint64_t pred = nEdgePrev + (uint64_t)llround((double)(tIsr - tEdgePrev) / s_clk.periodUs());
                if (pred > nEdge) { lost = (uint32_t)(pred - nEdge); nEdge = pred; nTotal += lost; s_st.lost += lost; }
            }
            rej = !s_clk.update(nEdge, tIsr);
            tEdgePrev = tIsr; nEdgePrev = nEdge;
        }
        const uint64_t n0 = nTotal;
        const bool full = cnt >= 120;
        if (full) s_st.full++;

        for (uint16_t off = 0; off < cnt; off += MAX_CHUNK) {
            const uint16_t c = (cnt - off > MAX_CHUNK) ? MAX_CHUNK : (cnt - off);
            uint8_t buf[sizeof(rec::ImuRec) + 12 * MAX_CHUNK];
            rec::ImuRec h; memset(&h, 0, sizeof(h));
            h.n0 = (uint32_t)(n0 + off); h.cnt = c;
            h.flags = (uint8_t)((full ? rec::IF_FULL : 0) | (s_clk.valid() ? rec::IF_EST_OK : 0) | (fromIsr ? 0 : rec::IF_POLLED) |
                                (off ? rec::IF_CONT : 0) | (rej ? rec::IF_REJECT : 0) | ((lost && !off) ? rec::IF_GAP : 0));
            h.acc_fs_g = IMU_ACC_FS_G; h.gyr_fs_dps = IMU_GYR_FS_DPS;
            h.t_isr_us = tIsr; h.t_first_us = (int64_t)llround(s_clk.timeOf(n0 + off)); h.period_us = s_clk.periodUs();
            h.dev_ts = 0; h.read_us = dr > 65535 ? 65535 : (uint16_t)dr;
            memcpy(buf, &h, sizeof(h));
            memcpy(buf + sizeof(h), s_fifo + off * SAMPLE_B, SAMPLE_B * c);
            if (!bus_log(RING_IMU, rec::T_IMU, rec::S_IN_IMU, tIsr, buf, (uint16_t)(sizeof(h) + SAMPLE_B * c))) s_st.logDrops++;
        }

        for (uint16_t k = 0; k < cnt; k++) {                      // T-410: respaldo del LSM para BOOST, |a| de cada muestra
            int16_t a[3];
            memcpy(a, s_fifo + k * SAMPLE_B, 6);
            boostQmiSample((int64_t)llround(s_clk.timeOf(n0 + k)), a, accLsb);
        }

        ImuSample s; s.n = n0 + cnt - 1; s.t_us = (int64_t)llround(s_clk.timeOf(s.n));
        memcpy(s.a, s_fifo + (cnt - 1) * SAMPLE_B, 6);
        memcpy(s.g, s_fifo + (cnt - 1) * SAMPLE_B + 6, 6);
        s.acc_lsb_per_g = accLsb; s.gyr_lsb_per_dps = gyrLsb;
        g_imu.set(s);

        nTotal += cnt; s_st.samples += cnt;
        s_st.periodUs = s_clk.periodUs(); s_st.odrHz = s_clk.odrHz(); s_st.rmsUs = s_clk.rmsUs();
        s_st.estRejects = s_clk.rejects(); s_st.estResets = s_clk.resets();
    }
}

void imuBegin() {
    memset(&s_st, 0, sizeof(s_st)); s_st.msg = "sin iniciar";
    xTaskCreatePinnedToCore(imuTask, "imu", 6144, nullptr, 5, nullptr, 1);
}

ImuStats imuStats() { return s_st; }
