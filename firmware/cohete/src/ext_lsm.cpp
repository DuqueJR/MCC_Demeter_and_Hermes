// ext_lsm.cpp - LSM6DSO32 por SPI por software, modo 3. El FIFO de 512 palabras guarda ~150 ms, por eso la tarea va a prioridad 4,
// debajo del QMI8658C (5): la ventana de lectura de este es critica y la del LSM no. Al log van las palabras crudas (tag + 6 bytes);
// tools/tblog.py las separa. Indice de muestra: un acelerometro por ranura; la marca del chip (cada 8 ranuras) delata lo perdido.
#include "ext_lsm.h"
#include "ext_bmp.h"
#include "imu_clock.h"
#include "boost_detect.h"
#include "ekf_task.h"
#include "logger.h"
#include <soc/gpio_reg.h>
#include <esp_timer.h>

static const uint8_t PIN_SCK = 48, PIN_MOSI = 3, PIN_MISO = 39, PIN_CS = 2, PIN_INT1 = 38;
static const uint32_t SCK_MASK = 1u << (PIN_SCK - 32), MISO_MASK = 1u << (PIN_MISO - 32);
static const uint32_t MOSI_MASK = 1u << PIN_MOSI, CS_MASK = 1u << PIN_CS;

// Banco principal
static const uint8_t REG_FUNC_CFG = 0x01, REG_FIFO_CTRL1 = 0x07, REG_FIFO_CTRL2 = 0x08, REG_FIFO_CTRL3 = 0x09, REG_FIFO_CTRL4 = 0x0A,
                     REG_INT1_CTRL = 0x0D, REG_WHO = 0x0F, REG_CTRL1_XL = 0x10, REG_CTRL2_G = 0x11, REG_CTRL3_C = 0x12, REG_CTRL4_C = 0x13,
                     REG_CTRL9_XL = 0x18, REG_CTRL10_C = 0x19, REG_STATUS_MASTER = 0x39, REG_FIFO_ST1 = 0x3A, REG_FREQ_FINE = 0x63, REG_FIFO_TAG = 0x78;
static const uint8_t WHO_VALUE = 0x6C;
static const uint8_t CTRL3_RESET = 0x01, CTRL3_RUN = 0x44;           // BDU, IF_INC
static const uint8_t CTRL4_RUN = 0x00;                               // sin I2C_disable: bus propio, SCK y MOSI solo se mueven con CS en bajo
static const uint8_t CTRL9_RUN = 0xE2;                               // DEN por defecto, I3C_disable
static const uint8_t CTRL10_RUN = 0x20;                              // TIMESTAMP_EN
static const uint8_t XL_RUN = 0x84, G_RUN = 0x8C;                    // 1.66 kHz, +-32 g; 1.66 kHz, +-2000 dps
static const uint8_t FIFO_BDR_RUN = 0x88;                            // acel y giro a 1667 Hz
static const uint8_t FIFO_CTRL4_BYPASS = 0x00, FIFO_CTRL4_RUN = 0x86; // marca cada 8 ranuras, modo continuo
static const uint8_t INT1_FIFO_TH = 0x08;
static const uint8_t ST2_OVR_LATCHED = 0x08;

// Banco del sensor hub
static const uint8_t REG_HUB_DATA = 0x02, REG_MASTER_CFG = 0x14, REG_SLV0_ADD = 0x15, REG_SLV0_SUB = 0x16, REG_SLV0_CFG = 0x17, REG_DATAWRITE = 0x21;
static const uint8_t FUNC_SHUB = 0x40, FUNC_MAIN = 0x00;
static const uint8_t MASTER_ON = 0x04, MASTER_PULLUP = 0x08, MASTER_WRITE_ONCE = 0x40, MASTER_RST = 0x80;
static const uint8_t SLV0_BATCH = 0x08;                              // al FIFO; SHUB_ODR = 00 (104 Hz)
static const uint8_t ST_WR_DONE = 0x80, ST_SLV0_NACK = 0x08, ST_ENDOP = 0x01;
static const uint32_t HUB_OP_TIMEOUT_MS = 100;                       // un ciclo del hub dura ~10 ms a 104 Hz

enum Tag : uint8_t { TAG_GYRO = 0x01, TAG_ACC = 0x02, TAG_TEMP = 0x03, TAG_TS = 0x04, TAG_CFG = 0x05, TAG_HUB0 = 0x0E, TAG_HUB_NACK = 0x19 };

static const uint16_t WTM_WORDS  = 32;      // ~9 ms de retardo, ~100 lotes/s
static const uint16_t FIFO_WORDS = 512;
static const uint16_t WORD_B     = 7;
static const uint16_t MAX_CHUNK  = 64;      // palabras por registro (448 B + cabeceras < MAX_LEN)
static const uint32_t POLL_MS    = 20;
static const double   PERIOD_US  = 600.0;
static const uint32_t TS_TICKS_PER_SLOT = 24;   // marca de 25 us, ranura de 600 us; ambas del mismo oscilador
static const int64_t  TS_LOST_MIN = 1;      // LOG 0041: la marca siempre cae igual en su ranura, asi que una sola ranura de mas ya es una perdida
static const uint8_t  ACC_FS_G = 32;
static const uint16_t GYR_FS_DPS = 2000;
static const float    ACC_LSB_PER_G = 1000.0f / 0.976f, GYR_LSB_PER_DPS = 1000.0f / 70.0f;   // tabla de sensibilidades, no 32768/FS

Latest<ImuSample> g_ext_imu;
static uint8_t     s_fifo[FIFO_WORDS * WORD_B];
static ImuClock    s_clk(PERIOD_US);
static TaskHandle_t s_task = nullptr;
static ExtLsmStats s_st;

// ---- ISR: marca de tiempo del flanco de la marca de agua ----
static volatile int64_t  s_isrT = 0;
static volatile uint32_t s_isrN = 0;
static void IRAM_ATTR lsmIsr() {
    s_isrT = esp_timer_get_time();
    s_isrN = s_isrN + 1;
    BaseType_t hp = pdFALSE;
    if (s_task) vTaskNotifyGiveFromISR(s_task, &hp);
    if (hp) portYIELD_FROM_ISR();
}

// ---- SPI por software, modo 3: el chip muestrea en el flanco de subida y entrega en el de bajada (SDO valido en 50 ns) ----
static inline void spin() { for (int i = 0; i < EXT_LSM_SPI_NOPS; i++) __asm__ __volatile__("nop"); }
static inline void csLow()  { REG_WRITE(GPIO_OUT_W1TC_REG, CS_MASK); spin(); }
static inline void csHigh() { spin(); REG_WRITE(GPIO_OUT_W1TS_REG, CS_MASK); spin(); }

static inline uint8_t xfer(uint8_t out) {
    uint8_t in = 0;
    for (int b = 7; b >= 0; b--) {
        REG_WRITE(GPIO_OUT1_W1TC_REG, SCK_MASK);
        REG_WRITE((out >> b) & 1 ? GPIO_OUT_W1TS_REG : GPIO_OUT_W1TC_REG, MOSI_MASK);
        spin();
        in = (uint8_t)((in << 1) | ((REG_READ(GPIO_IN1_REG) & MISO_MASK) ? 1 : 0));
        REG_WRITE(GPIO_OUT1_W1TS_REG, SCK_MASK);
        spin();
    }
    return in;
}

static void regRead(uint8_t reg, uint8_t *buf, uint32_t n) {
    csLow();
    xfer(reg | 0x80);
    for (uint32_t i = 0; i < n; i++) buf[i] = xfer(0);
    csHigh();
}
static uint8_t regRead1(uint8_t reg) { uint8_t v; regRead(reg, &v, 1); return v; }
static void regWrite(uint8_t reg, uint8_t val) {
    csLow();
    xfer(reg);
    xfer(val);
    csHigh();
}

// ---- Sensor hub: acceso al esclavo por los registros SLV0, disparado por el dato listo del acelerometro (debe estar encendido) ----
static void masterOff() {
    regWrite(REG_FUNC_CFG, FUNC_SHUB);
    regWrite(REG_MASTER_CFG, 0);
    regWrite(REG_FUNC_CFG, FUNC_MAIN);
    vTaskDelay(pdMS_TO_TICKS(1));                 // termina el ciclo en curso antes de reprogramar
}

// Datasheet, RST_MASTER_REGS: reinicia la logica del maestro y sus salidas; hay que escribir 1 y luego 0.
// Una operacion cortada a medias, o de antes de reiniciar el ESP32, no debe dejarlo trabado.
static void masterReset() {
    regWrite(REG_FUNC_CFG, FUNC_SHUB);
    regWrite(REG_MASTER_CFG, MASTER_RST);
    regWrite(REG_MASTER_CFG, 0);
    regWrite(REG_FUNC_CFG, FUNC_MAIN);
    vTaskDelay(pdMS_TO_TICKS(1));
}

// Toda operacion arranca igual: maestro reiniciado, acelerometro apagado hasta encender el maestro y pull-ups internas.
// Medido en hardware: asi el BMP581 responde en 5 ms, y con el acelerometro ya corriendo y sin pull-ups el maestro no hacia nada.
static void hubStart(uint8_t add, uint8_t sub, uint8_t cfg, uint8_t master, uint8_t data) {
    regWrite(REG_CTRL1_XL, 0);
    masterReset();
    regWrite(REG_FUNC_CFG, FUNC_SHUB);
    regWrite(REG_SLV0_ADD, add);
    regWrite(REG_SLV0_SUB, sub);
    regWrite(REG_SLV0_CFG, cfg);
    regWrite(REG_DATAWRITE, data);
    regWrite(REG_MASTER_CFG, master | MASTER_ON | MASTER_PULLUP);
    regWrite(REG_FUNC_CFG, FUNC_MAIN);
    regWrite(REG_CTRL1_XL, XL_RUN);
}

static uint8_t hubWait(uint8_t doneMask) {
    uint8_t st = 0;
    const uint32_t t0 = millis();
    while (!(st & (doneMask | ST_SLV0_NACK)) && millis() - t0 < HUB_OP_TIMEOUT_MS) {
        vTaskDelay(pdMS_TO_TICKS(2));
        st |= regRead1(REG_STATUS_MASTER);
    }
    s_st.hubSt = st;
    return st;
}

static bool hubWrite(uint8_t reg, uint8_t val) {
    hubStart(EXT_BMP_ADDR << 1, reg, 0, MASTER_WRITE_ONCE, val);
    const uint8_t st = hubWait(ST_WR_DONE);
    masterOff();
    return (st & ST_WR_DONE) && !(st & ST_SLV0_NACK);
}

static bool hubRead(uint8_t reg, uint8_t *buf, uint8_t n) {
    hubStart((EXT_BMP_ADDR << 1) | 1, reg, n, 0, 0);
    const uint8_t st = hubWait(ST_ENDOP);
    regWrite(REG_FUNC_CFG, FUNC_SHUB);
    regRead(REG_HUB_DATA, buf, n);
    regWrite(REG_FUNC_CFG, FUNC_MAIN);
    masterOff();
    return (st & ST_ENDOP) && !(st & ST_SLV0_NACK);
}

static void hubRun() {
    hubStart((EXT_BMP_ADDR << 1) | 1, EXT_BMP_DATA_REG, SLV0_BATCH | EXT_BMP_DATA_LEN, 0, 0);
}

// ---- Configuracion ----
static void measureSpi() {
    static const uint32_t READS = 1000, BITS_PER_READ = 16;
    uint32_t errs = 0;
    const int64_t t0 = esp_timer_get_time();
    for (uint32_t i = 0; i < READS; i++) if (regRead1(REG_WHO) != WHO_VALUE) errs++;
    const int64_t dt = esp_timer_get_time() - t0;
    s_st.whoErrs = errs;
    s_st.spiKhz = (uint32_t)(READS * BITS_PER_READ * 1000 / dt);
}

static void configure() {
    masterOff();                                          // AN5192: el maestro no debe estar activo durante el reset; el LSM no se apaga al reiniciar el ESP32
    regWrite(REG_CTRL3_C, CTRL3_RESET);
    vTaskDelay(pdMS_TO_TICKS(50));
    regWrite(REG_CTRL3_C, CTRL3_RUN);
    regWrite(REG_CTRL4_C, CTRL4_RUN);
    regWrite(REG_CTRL9_XL, CTRL9_RUN);
    regWrite(REG_CTRL10_C, CTRL10_RUN);
    regWrite(REG_FIFO_CTRL4, FIFO_CTRL4_BYPASS);
    regWrite(REG_CTRL1_XL, XL_RUN);
    regWrite(REG_CTRL2_G, G_RUN);
    vTaskDelay(pdMS_TO_TICKS(10));

    masterReset();
    s_st.hubOk = extBmpConfigure(hubWrite, hubRead) ? 1 : 0;   // sin BMP581 el IMU sigue; el BME280 queda de barometro
    if (s_st.hubOk) hubRun();
    s_st.freqFine = (int8_t)regRead1(REG_FREQ_FINE);

    regWrite(REG_FIFO_CTRL1, (uint8_t)WTM_WORDS);
    regWrite(REG_FIFO_CTRL2, 0);
    regWrite(REG_FIFO_CTRL3, FIFO_BDR_RUN);
    regWrite(REG_INT1_CTRL, INT1_FIFO_TH);
    regWrite(REG_FIFO_CTRL4, FIFO_CTRL4_RUN);
}

static uint16_t fifoDrain(bool &overrun) {
    uint8_t st[2];
    regRead(REG_FIFO_ST1, st, 2);
    overrun = (st[1] & ST2_OVR_LATCHED) != 0;
    uint32_t n = ((uint32_t)(st[1] & 0x03) << 8) | st[0];
    if (n > FIFO_WORDS) n = FIFO_WORDS;
    if (n) regRead(REG_FIFO_TAG, s_fifo, n * WORD_B);     // IF_INC: la direccion vuelve de 7Eh a 78h
    return (uint16_t)n;
}

static inline uint8_t wordTag(const uint8_t *w) { return w[0] >> 3; }

static void lsmTask(void *) {
    s_st.msg = "esperando logger";
    for (uint32_t t0 = millis(); loggerStats().state < 2 && millis() - t0 < 20000; ) vTaskDelay(pdMS_TO_TICKS(50));

    pinMode(PIN_CS, OUTPUT);   digitalWrite(PIN_CS, HIGH);
    pinMode(PIN_SCK, OUTPUT);  digitalWrite(PIN_SCK, HIGH);
    pinMode(PIN_MOSI, OUTPUT); digitalWrite(PIN_MOSI, LOW);
    pinMode(PIN_MISO, INPUT);
    pinMode(PIN_INT1, INPUT_PULLDOWN);

    // Mientras no responda se sigue intentando, para poder revisar el cableado con la placa encendida
    s_st.msg = "no responde";
    while ((s_st.who = regRead1(REG_WHO)) != WHO_VALUE) vTaskDelay(pdMS_TO_TICKS(1000));
    measureSpi();

    s_st.msg = "configurando";
    configure();
    bool ovr;
    fifoDrain(ovr);                                       // vaciar lo acumulado para que INT1 baje
    s_task = xTaskGetCurrentTaskHandle();
    attachInterrupt(digitalPinToInterrupt(PIN_INT1), lsmIsr, RISING);
    s_st.msg = "muestreando";

    uint64_t nNext = 0;                                   // indice de la siguiente ranura; incluye las perdidas
    int64_t  tsOff = 0;
    bool     tsInit = false;
    uint32_t seenIsr = s_isrN;
    uint64_t readSum = 0;
    for (;;) {
        ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(POLL_MS));
        const uint32_t isrN = s_isrN;
        const bool fromIsr = isrN != seenIsr;
        int64_t tEdge = fromIsr ? s_isrT : -1;
        if (fromIsr) { s_st.isr += isrN - seenIsr; seenIsr = isrN; }
        else s_st.polled++;

        const int64_t r0 = esp_timer_get_time();
        bool overrun = false;
        const uint16_t cnt = fifoDrain(overrun);
        const uint32_t dr = (uint32_t)(esp_timer_get_time() - r0);
        if (overrun) s_st.overruns++;
        if (cnt == 0) { s_st.empty++; continue; }
        if (!fromIsr) tEdge = r0;

        readSum += dr; s_st.batches++;
        s_st.readAvgUs = (uint32_t)(readSum / s_st.batches);
        if (dr > s_st.readMaxUs) s_st.readMaxUs = dr;

        // Primera pasada: la sobrescritura del FIFO quita lo mas viejo, asi que un hueco se nota en la primera marca del lote.
        uint32_t slots = 0, edgeSlot = 0, lost = 0;
        bool tsChecked = false;
        for (uint16_t i = 0; i < cnt; i++) {
            const uint8_t *w = s_fifo + i * WORD_B;
            const uint8_t tag = wordTag(w);
            if (i == WTM_WORDS - 1) edgeSlot = slots;
            if (tag == TAG_ACC) slots++;
            else if (tag == TAG_TS) {
                s_st.tsWords++;
                if (tsChecked) continue;
                tsChecked = true;
                uint32_t ts; memcpy(&ts, w + 1, 4);
                const int64_t here = (int64_t)(nNext + slots), bySlot = (int64_t)(ts / TS_TICKS_PER_SLOT);
                if (!tsInit) { tsOff = here - bySlot; tsInit = true; continue; }
                const int64_t diff = bySlot + tsOff - here;
                if (diff >= TS_LOST_MIN) lost = (uint32_t)diff;
                else tsOff -= diff;                       // cuadra la deriva lenta de la relacion marca/ranura
            }
        }
        nNext += lost;
        s_st.lost += lost;

        bool rej = false;
        if (fromIsr && cnt >= WTM_WORDS) rej = !s_clk.update(nNext + edgeSlot, tEdge);
        const double period = s_clk.periodUs();

        // Segunda pasada: registros y ultimas muestras
        uint64_t n = nNext;
        ImuSample s; memset(&s, 0, sizeof(s));
        bool haveA = false, haveG = false;
        for (uint16_t off = 0; off < cnt; off += MAX_CHUNK) {
            const uint16_t c = (cnt - off > MAX_CHUNK) ? MAX_CHUNK : (uint16_t)(cnt - off);
            rec::ExtLsmRec h; memset(&h, 0, sizeof(h));
            h.n0 = (uint32_t)n; h.cnt = c;
            h.flags = (uint8_t)((overrun ? rec::IF_FULL : 0) | (s_clk.valid() ? rec::IF_EST_OK : 0) | (fromIsr ? 0 : rec::IF_POLLED) |
                                (off ? rec::IF_CONT : 0) | (rej ? rec::IF_REJECT : 0) | ((lost && !off) ? rec::IF_GAP : 0));
            h.acc_fs_g = ACC_FS_G; h.gyr_fs_dps = GYR_FS_DPS;
            h.t_first_us = (int64_t)llround(s_clk.timeOf(n)); h.period_us = (float)period;
            h.read_us = dr > 65535 ? 65535 : (uint16_t)dr;

            for (uint16_t i = off; i < off + c; i++) {
                const uint8_t *w = s_fifo + i * WORD_B;
                switch (wordTag(w)) {
                    case TAG_ACC: { memcpy(s.a, w + 1, 6); haveA = true;
                                   const int64_t tn = (int64_t)llround(s_clk.timeOf(n));
                                   boostLsmSample(tn, s.a, ACC_LSB_PER_G);   // T-410: |a| de cada muestra
                                   ekfLsm(tn, s.a, s.g);                      // D-060: con el ultimo giro, como ekf.py
                                   n++; break; }
                    case TAG_GYRO: memcpy(s.g, w + 1, 6); haveG = true; break;
                    case TAG_HUB0: extBmpOnWord(w + 1, (int64_t)llround(s_clk.timeOf(n))); break;
                    case TAG_HUB_NACK: extBmpOnNack(); break;
                    case TAG_TS: case TAG_TEMP: case TAG_CFG: break;
                    default: s_st.badTags++; break;
                }
            }
            uint8_t buf[sizeof(h) + MAX_CHUNK * WORD_B];
            memcpy(buf, &h, sizeof(h));
            memcpy(buf + sizeof(h), s_fifo + off * WORD_B, c * WORD_B);
            if (!bus_log(RING_EXT, rec::T_EXT_LSM, rec::S_EX_IMU, tEdge, buf, (uint16_t)(sizeof(h) + c * WORD_B))) s_st.logDrops++;
        }
        nNext = n;
        s_st.samples += slots;

        if (haveA && haveG) {
            s.n = nNext - 1; s.t_us = (int64_t)llround(s_clk.timeOf(s.n));
            s.acc_lsb_per_g = ACC_LSB_PER_G; s.gyr_lsb_per_dps = GYR_LSB_PER_DPS;
            g_ext_imu.set(s);
        }
        s_st.odrHz = s_clk.odrHz(); s_st.rmsUs = s_clk.rmsUs();
        s_st.estRejects = s_clk.rejects(); s_st.estResets = s_clk.resets();
    }
}

void extLsmBegin() {
    memset(&s_st, 0, sizeof(s_st)); s_st.msg = "sin iniciar";
    xTaskCreatePinnedToCore(lsmTask, "ext_lsm", 6144, nullptr, 4, nullptr, 1);
}

ExtLsmStats extLsmStats() { return s_st; }
