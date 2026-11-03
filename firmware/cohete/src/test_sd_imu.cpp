#include "test_sd_imu.h"
#include "LoRaBoards.h"
#include <SD.h>
#include <SensorQMI8658.hpp>
#include "esp_timer.h"
#include "driver/gpio.h"

static const uint32_t SD_HZ       = 20000000;  // repetir tambien con 10 MHz y 4 MHz
static const size_t   BLOCK       = 4096;
static const uint32_t PHASE_MS    = 300000;
static const uint32_t PERIOD_MS   = 146;       // 4096 B / 146 ms ~ 28 KB/s
static const int      FLUSH_EVERY = 16;


static SemaphoreHandle_t s_bus;
static SensorQMI8658 qmi;
static File f;
static uint8_t blockBuf[BLOCK];
static volatile int s_phase = 0;   // 1 = 28 KB/s, 2 = maxima velocidad, 3 = terminado
static TaskHandle_t s_imuTaskH = nullptr;
static volatile uint32_t s_intCount = 0;
static volatile uint32_t s_rise = 0, s_fall = 0;
static IMUdata fa[128], fg[128];
static uint32_t f_reads = 0, f_samples = 0, f_maxBatch = 0, f_timeouts = 0, f_tsDelta = 0;
static uint32_t f_hiB = 0, f_hiA = 0;
static uint32_t g_samplesPh[4] = {0, 0, 0, 0};

struct Win {
    uint32_t imu_reads, imu_wait_max, imu_gap_max;
    uint32_t sd_writes, sd_bytes, sd_lat_max, sd_flush_max, gt20, gt50, gt100;
};
static Win win, tot;
static const uint32_t PREALLOC_MB = 32;   // 0 = sin prealocar
static Win phaseTot[3];
static portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;
static bool summaryDone = false;

static inline void mx(uint32_t &d, uint32_t v) { if (v > d) d = v; }

static void noteImu(uint32_t wait_us, uint32_t gap_us)
{
    portENTER_CRITICAL(&mux);
    win.imu_reads++;  tot.imu_reads++;
    mx(win.imu_wait_max, wait_us); mx(tot.imu_wait_max, wait_us);
    mx(win.imu_gap_max, gap_us);   mx(tot.imu_gap_max, gap_us);
    portEXIT_CRITICAL(&mux);
}

static void noteSd(uint32_t lat_us, uint32_t flush_us)
{
    portENTER_CRITICAL(&mux);
    Win *w[2] = { &win, &tot };
    for (int i = 0; i < 2; i++) {
        w[i]->sd_writes++;  w[i]->sd_bytes += BLOCK;
        mx(w[i]->sd_lat_max, lat_us);
        mx(w[i]->sd_flush_max, flush_us);
        if (lat_us > 20000)  w[i]->gt20++;
        if (lat_us > 50000)  w[i]->gt50++;
        if (lat_us > 100000) w[i]->gt100++;
    }
    portEXIT_CRITICAL(&mux);
}

static void IRAM_ATTR imuIsr()
{
    if (gpio_get_level((gpio_num_t)IMU_INT)) s_rise++; else s_fall++;
    s_intCount++;
    BaseType_t hp = pdFALSE;
    if (s_imuTaskH) vTaskNotifyGiveFromISR(s_imuTaskH, &hp);
    if (hp) portYIELD_FROM_ISR();
}

static void imuTask(void *)
{
    s_imuTaskH = xTaskGetCurrentTaskHandle();
    attachInterrupt(IMU_INT, imuIsr, RISING);   // registrada desde el nucleo 1

    uint32_t lastTs = 0;
    bool haveTs = false;
    int64_t lastOk = esp_timer_get_time();
    for (;;) {
        uint32_t notified = ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(100));  // respaldo: 100 ms
        int64_t t0 = esp_timer_get_time();
        xSemaphoreTake(s_bus, portMAX_DELAY);
        int64_t t1 = esp_timer_get_time();
        int lvB = digitalRead(IMU_INT);
        uint16_t n = qmi.readFromFifo(fa, 128, fg, 128);
        int lvA = digitalRead(IMU_INT);
        uint32_t ts = qmi.getTimestamp();
        xSemaphoreGive(s_bus);
        int64_t t2 = esp_timer_get_time();

        noteImu((uint32_t)(t1 - t0), (uint32_t)(t2 - lastOk));
        lastOk = t2;

        portENTER_CRITICAL(&mux);
        f_reads++;
        f_samples += n;
        g_samplesPh[s_phase < 4 ? s_phase : 3] += n;
        if (n > f_maxBatch) f_maxBatch = n;
        if (!notified) f_timeouts++;
        if (haveTs) f_tsDelta += (ts - lastTs) & 0xFFFFFF;
        f_hiB += lvB;  f_hiA += lvA;
        portEXIT_CRITICAL(&mux);
        lastTs = ts;
        haveTs = true;
    }
}

static void sdTask(void *)
{
    for (int i = 0; i < (int)BLOCK; i++) blockBuf[i] = (uint8_t)(i * 31 + 7);

    for (s_phase = 1; s_phase <= 2; s_phase = s_phase + 1) {
        uint32_t tEnd = millis() + PHASE_MS;
        uint32_t next = millis();
        int n = 0;
        while ((int32_t)(millis() - tEnd) < 0) {
            xSemaphoreTake(s_bus, portMAX_DELAY);
            int64_t t0 = esp_timer_get_time();
            f.write(blockBuf, BLOCK);
            uint32_t lat = (uint32_t)(esp_timer_get_time() - t0);
            xSemaphoreGive(s_bus);

            uint32_t fl = 0;
            if (++n % FLUSH_EVERY == 0) {
                xSemaphoreTake(s_bus, portMAX_DELAY);
                int64_t t1 = esp_timer_get_time();
                f.flush();
                fl = (uint32_t)(esp_timer_get_time() - t1);
                xSemaphoreGive(s_bus);
            }
            noteSd(lat, fl);

            if (s_phase == 1) {
                next += PERIOD_MS;
                int32_t d = (int32_t)(next - millis());
                if (d > 0) vTaskDelay(pdMS_TO_TICKS(d));
            } else {
                vTaskDelay(1);   // ceder CPU (evita el watchdog)
            }
        }
                portENTER_CRITICAL(&mux);
        phaseTot[s_phase] = tot;
        memset(&tot, 0, sizeof(tot));
        portEXIT_CRITICAL(&mux);
    }
    xSemaphoreTake(s_bus, portMAX_DELAY);
    f.close();
    xSemaphoreGive(s_bus);
    s_phase = 3;
    vTaskDelete(nullptr);
}

void testSdImuBegin()
{
    for (int i = 0; i < (int)BLOCK; i++) blockBuf[i] = (uint8_t)(i * 31 + 7);
    s_bus = xSemaphoreCreateMutex();

    pinMode(SDCARD_CS, OUTPUT);
    digitalWrite(SDCARD_CS, HIGH);

    if (!qmi.begin(SDCardSPI, IMU_CS)) {
        Serial.println("[test] QMI8658 FAIL"); return;
    }
    qmi.configAccelerometer(SensorQMI8658::ACC_RANGE_16G,
                            SensorQMI8658::ACC_ODR_500Hz, SensorQMI8658::LPF_MODE_0);
    qmi.configGyroscope(SensorQMI8658::GYR_RANGE_1024DPS,
                        SensorQMI8658::GYR_ODR_448_4Hz, SensorQMI8658::LPF_MODE_3);
    if (!qmi.configFIFO(SensorQMI8658::FIFO_MODE_FIFO,
                        SensorQMI8658::FIFO_SAMPLES_128,
                        SensorQMI8658::INTERRUPT_PIN_1,
                        16)) {                             // interrupcion cada 16 muestras
        Serial.println("[test] ERROR: configFIFO fallo");
        return;
    }
    qmi.enableINT(SensorQMI8658::INTERRUPT_PIN_1, true);
    qmi.enableINT(SensorQMI8658::INTERRUPT_PIN_2, true);
    qmi.enableGyroscope();
    qmi.enableAccelerometer();
    pinMode(IMU_INT, INPUT_PULLDOWN);

    uint8_t ctrl1, watermark, fifoCtrl;
    if (qmi.readFifoInterruptConfig(ctrl1, watermark, fifoCtrl)) {
        Serial.printf("[fifo-cfg] CTRL1=0x%02X FIFO_WTM_TH=%u FIFO_CTRL=0x%02X "
                      "INT1_route=%u INT1_enable=%u INT2_enable=%u\n",
                      ctrl1, watermark, fifoCtrl, (ctrl1 >> 2) & 1, (ctrl1 >> 3) & 1,
                      (ctrl1 >> 4) & 1);
    } else {
        Serial.println("[fifo-cfg] ERROR: no se pudieron leer registros de configuracion");
    }

    if (!SD.begin(SDCARD_CS, SDCardSPI, SD_HZ)) {
        Serial.println("[test] SD FAIL (tarjeta FAT32 insertida?)"); return;
    }
    Serial.printf("[test] SD OK, %llu MB, SPI %lu Hz\n",
                  SD.cardSize() / (1024 * 1024), (unsigned long)SD_HZ);

        SD.remove("/test_sd_imu.bin");
    if (PREALLOC_MB > 0) {
        Serial.println("[test] prealocando...");
        File p = SD.open("/test_sd_imu.bin", FILE_WRITE);
        for (uint32_t i = 0; i < PREALLOC_MB * 256; i++) p.write(blockBuf, BLOCK);
        p.close();
        f = SD.open("/test_sd_imu.bin", "r+");
        f.seek(0);
    } else {
        f = SD.open("/test_sd_imu.bin", FILE_WRITE);
    }
    if (!f) { Serial.println("[test] no se pudo abrir el archivo"); return; }

    xTaskCreatePinnedToCore(imuTask, "imu_t", 4096, nullptr, 5, nullptr, 1);
    xTaskCreatePinnedToCore(sdTask,  "sd_t",  8192, nullptr, 3, nullptr, 0);
    Serial.println("[test] en marcha: fase 1 (28 KB/s) y fase 2 (maxima)");
}

void testSdImuReport()
{
    Win w;
    portENTER_CRITICAL(&mux);
    w = win;  memset(&win, 0, sizeof(win));
    portEXIT_CRITICAL(&mux);

    if (s_phase >= 1 && s_phase <= 2) {
        Serial.printf("[t1] f%d sd: %lu wr %.1f KB/s lat_max %.1f ms flush_max %.1f ms "
                      ">20:%lu >50:%lu >100:%lu | imu: %lu rd wait_max %.1f ms gap_max %.1f ms\n",
                      s_phase, (unsigned long)w.sd_writes, w.sd_bytes / 1024.0,
                      w.sd_lat_max / 1000.0, w.sd_flush_max / 1000.0,
                      (unsigned long)w.gt20, (unsigned long)w.gt50, (unsigned long)w.gt100,
                      (unsigned long)w.imu_reads, w.imu_wait_max / 1000.0, w.imu_gap_max / 1000.0);
        uint32_t r, s, mb, to, td, ic;
        portENTER_CRITICAL(&mux);
        r = f_reads; s = f_samples; mb = f_maxBatch; to = f_timeouts; td = f_tsDelta; ic = s_intCount;
        f_reads = f_samples = f_maxBatch = f_timeouts = f_tsDelta = 0;
        s_intCount = 0;
        portEXIT_CRITICAL(&mux);
        Serial.printf("[fifo] int=%lu reads=%lu muestras=%lu lote_max=%lu timeouts=%lu ts/muestras=%.3f\n",
                      (unsigned long)ic, (unsigned long)r, (unsigned long)s, (unsigned long)mb,
                      (unsigned long)to, s ? (float)td / s : 0.0f);
        uint32_t rs, fl, hb, ha;
        portENTER_CRITICAL(&mux);
        rs = s_rise; fl = s_fall; hb = f_hiB; ha = f_hiA;
        s_rise = s_fall = 0; f_hiB = f_hiA = 0;
        portEXIT_CRITICAL(&mux);
        Serial.printf("[int ] subidas=%lu bajadas=%lu nivel_alto_antes=%lu nivel_alto_despues=%lu (de %lu lecturas)\n",
                      (unsigned long)rs, (unsigned long)fl, (unsigned long)hb, (unsigned long)ha, (unsigned long)r);
    } else if (s_phase == 3 && !summaryDone) {
        summaryDone = true;
        Serial.println("========== RESUMEN ==========");
        for (int p = 1; p <= 2; p++) {
            const Win &t = phaseTot[p];
            float need = (t.imu_wait_max / 1000.0f) * 0.4484f;
            Serial.printf("Fase %d  SD: wr=%lu lat_max=%.1f flush_max=%.1f ms >20:%lu >50:%lu >100:%lu\n",
                          p, (unsigned long)t.sd_writes, t.sd_lat_max / 1000.0, t.sd_flush_max / 1000.0,
                          (unsigned long)t.gt20, (unsigned long)t.gt50, (unsigned long)t.gt100);
            Serial.printf("        IMU: rd=%lu espera_max=%.1f ms  FIFO necesario ~%.0f/128\n",
                          (unsigned long)t.imu_reads, t.imu_wait_max / 1000.0, need);
            Serial.printf("        muestras=%lu en %lu s -> ODR efectivo ~%.1f Hz\n",
                          (unsigned long)g_samplesPh[p], (unsigned long)(PHASE_MS / 1000),
                          g_samplesPh[p] / (PHASE_MS / 1000.0f));
        }
    }
}