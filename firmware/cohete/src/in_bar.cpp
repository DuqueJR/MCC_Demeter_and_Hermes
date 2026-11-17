// in_bar.cpp - BME280 en modo forzado: en modo normal el bit "measuring" solo baja 0.5 ms (t_sb) y consultando cada 2 ms
// se perderia el final de la medicion. Forzado da el instante exacto de inicio. Presion x8, temperatura x1, humedad x1, IIR apagado:
// la medicion dura 22 ms tipicos, 25.4 ms maximo (datasheet 9.1), unos 40 Hz.
#include "in_bar.h"
#include "in_i2c.h"
#include <string.h>

static const uint8_t ADDR_A = 0x77, ADDR_B = 0x76, CHIP_ID = 0x60;
static const uint8_t REG_CAL1 = 0x88, REG_ID = 0xD0, REG_RESET = 0xE0, REG_CAL2 = 0xE1, REG_CTRL_HUM = 0xF2, REG_STATUS = 0xF3,
                     REG_CTRL_MEAS = 0xF4, REG_CONFIG = 0xF5, REG_DATA = 0xF7;
static const uint8_t RESET_CMD = 0xB6, ST_MEASURING = 0x08;
static const uint8_t CTRL_HUM = 0x01;                  // humedad x1
static const uint8_t CTRL_MEAS_FORCED = 0x31;          // temperatura x1, presion x8, forzado
static const uint8_t CONFIG = 0x00;                    // IIR apagado

static const int64_t  MIN_WAIT_US  = 18000;            // antes de esto no vale la pena consultar
static const int64_t  TIMEOUT_US   = 100000;
static const int64_t  P_CENTER_US  = 11250;            // centro de la fase de presion: 1 + 2 + 16.5/2 ms (tipico)
static const int64_t  CAL_EVERY_US = 30000000;         // cada archivo debe poder interpretarse solo

static BarStats s_st;
static uint8_t  s_addr = ADDR_A;
static bool     s_measuring = false;
static int64_t  s_tTrig = 0, s_tCal = 0;
Latest<BarSample> g_bar;

static rec::BarCalRec s_cal;
static uint16_t dig_T1, dig_P1;
static int16_t  dig_T2, dig_T3, dig_P2, dig_P3, dig_P4, dig_P5, dig_P6, dig_P7, dig_P8, dig_P9, dig_H2, dig_H4, dig_H5;
static uint8_t  dig_H1, dig_H3;
static int8_t   dig_H6;

static void parseCal() {
    const uint8_t *a = s_cal.cal1, *b = s_cal.cal2;
    #define U16(i) ((uint16_t)(a[i] | (a[(i) + 1] << 8)))
    #define S16(i) ((int16_t)U16(i))
    dig_T1 = U16(0); dig_T2 = S16(2); dig_T3 = S16(4);
    dig_P1 = U16(6); dig_P2 = S16(8); dig_P3 = S16(10); dig_P4 = S16(12); dig_P5 = S16(14);
    dig_P6 = S16(16); dig_P7 = S16(18); dig_P8 = S16(20); dig_P9 = S16(22);
    #undef S16
    #undef U16
    dig_H1 = a[25];
    dig_H2 = (int16_t)(b[0] | (b[1] << 8));
    dig_H3 = b[2];
    dig_H4 = (int16_t)(((int16_t)(int8_t)b[3] << 4) | (b[4] & 0x0F));
    dig_H5 = (int16_t)(((int16_t)(int8_t)b[5] << 4) | (b[4] >> 4));
    dig_H6 = (int8_t)b[6];
}

// ---- Compensacion: datasheet 4.2.3 (rev. 1.1) ----
static int32_t t_fine;

static int32_t compT(int32_t adc_T) {                  // 0.01 C
    int32_t var1 = ((((adc_T >> 3) - ((int32_t)dig_T1 << 1))) * ((int32_t)dig_T2)) >> 11;
    int32_t var2 = (((((adc_T >> 4) - ((int32_t)dig_T1)) * ((adc_T >> 4) - ((int32_t)dig_T1))) >> 12) * ((int32_t)dig_T3)) >> 14;
    t_fine = var1 + var2;
    return (t_fine * 5 + 128) >> 8;
}

static uint32_t compP(int32_t adc_P) {                 // Q24.8 Pa
    int64_t var1 = ((int64_t)t_fine) - 128000;
    int64_t var2 = var1 * var1 * (int64_t)dig_P6;
    var2 = var2 + ((var1 * (int64_t)dig_P5) << 17);
    var2 = var2 + (((int64_t)dig_P4) << 35);
    var1 = ((var1 * var1 * (int64_t)dig_P3) >> 8) + ((var1 * (int64_t)dig_P2) << 12);
    var1 = (((((int64_t)1) << 47) + var1)) * ((int64_t)dig_P1) >> 33;
    if (var1 == 0) return 0;
    int64_t p = 1048576 - adc_P;
    p = (((p << 31) - var2) * 3125) / var1;
    var1 = (((int64_t)dig_P9) * (p >> 13) * (p >> 13)) >> 25;
    var2 = (((int64_t)dig_P8) * p) >> 19;
    p = ((p + var1 + var2) >> 8) + (((int64_t)dig_P7) << 4);
    return (uint32_t)p;
}

static uint32_t compH(int32_t adc_H) {                 // Q22.10 %RH
    int32_t v = t_fine - ((int32_t)76800);
    v = (((((adc_H << 14) - (((int32_t)dig_H4) << 20) - (((int32_t)dig_H5) * v)) + ((int32_t)16384)) >> 15) *
         (((((((v * ((int32_t)dig_H6)) >> 10) * (((v * ((int32_t)dig_H3)) >> 11) + ((int32_t)32768))) >> 10) + ((int32_t)2097152)) *
           ((int32_t)dig_H2) + 8192) >> 14));
    v = v - (((((v >> 15) * (v >> 15)) >> 7) * ((int32_t)dig_H1)) >> 4);
    v = v < 0 ? 0 : v;
    v = v > 419430400 ? 419430400 : v;
    return (uint32_t)(v >> 12);
}

// ---- Dispositivo ----
static bool trigger() {
    if (!i2cWrite(s_addr, REG_CTRL_MEAS, CTRL_MEAS_FORCED)) { s_st.errs++; return false; }
    s_tTrig = esp_timer_get_time();
    s_measuring = true;
    return true;
}

bool barInit() {
    s_st.inits++;
    uint8_t id = 0;
    s_addr = ADDR_A;
    if (!i2cRead(s_addr, REG_ID, &id, 1) || id != CHIP_ID) {
        s_addr = ADDR_B;
        if (!i2cRead(s_addr, REG_ID, &id, 1) || id != CHIP_ID) return false;
    }
    if (!i2cWrite(s_addr, REG_RESET, RESET_CMD)) return false;
    vTaskDelay(pdMS_TO_TICKS(10));                     // arranque 2 ms y copia de la calibracion
    memset(&s_cal, 0, sizeof(s_cal));
    if (!i2cRead(s_addr, REG_CAL1, s_cal.cal1, sizeof(s_cal.cal1))) return false;
    if (!i2cRead(s_addr, REG_CAL2, s_cal.cal2, sizeof(s_cal.cal2))) return false;
    s_cal.chip_id = id; s_cal.addr = s_addr;
    parseCal();
    // CTRL_HUM surte efecto al escribir CTRL_MEAS; CONFIG se escribe con el chip dormido (estado tras el reset).
    if (!i2cWrite(s_addr, REG_CTRL_HUM, CTRL_HUM) || !i2cWrite(s_addr, REG_CONFIG, CONFIG)) return false;
    s_st.addr = s_addr;
    s_measuring = false;
    s_tCal = 0;
    return true;
}

bool barStep() {
    if (!s_measuring) return trigger();
    const int64_t dt = esp_timer_get_time() - s_tTrig;
    if (dt < MIN_WAIT_US) return true;
    if (dt > TIMEOUT_US) { s_st.timeouts++; s_measuring = false; return false; }

    uint8_t st;
    if (!i2cRead(s_addr, REG_STATUS, &st, 1)) { s_st.errs++; return false; }
    if (st & ST_MEASURING) return true;
    const int64_t t = esp_timer_get_time();
    uint8_t d[8];
    if (!i2cRead(s_addr, REG_DATA, d, sizeof(d))) { s_st.errs++; return false; }

    rec::BarRec r;
    r.t_trig_us = s_tTrig;
    r.adc_p = ((uint32_t)d[0] << 12) | ((uint32_t)d[1] << 4) | (d[2] >> 4);
    r.adc_t = ((uint32_t)d[3] << 12) | ((uint32_t)d[4] << 4) | (d[5] >> 4);
    r.adc_h = (uint16_t)((d[6] << 8) | d[7]);
    r.pad = 0;
    r.temp_c = compT((int32_t)r.adc_t) / 100.0f;
    r.press_pa = compP((int32_t)r.adc_p) / 256.0f;
    r.hum_pct = compH((int32_t)r.adc_h) / 1024.0f;

    if (s_tCal == 0 || t - s_tCal >= CAL_EVERY_US) {
        s_tCal = t;
        bus_log(RING_I2C, rec::T_BARCAL, rec::S_IN_BAR, t, &s_cal, sizeof(s_cal));
    }
    bus_log(RING_I2C, rec::T_BAR, rec::S_IN_BAR, t, &r, sizeof(r));

    BarSample s;
    s.t_us = s_tTrig + P_CENTER_US; s.seq = s_st.samples + 1;
    s.press_pa = r.press_pa; s.temp_c = r.temp_c; s.hum_pct = r.hum_pct;
    g_bar.set(s);

    const uint32_t meas = (uint32_t)(t - s_tTrig);
    if (meas > s_st.measMaxUs) s_st.measMaxUs = meas;
    s_st.samples++;
    s_st.press_pa = r.press_pa; s_st.temp_c = r.temp_c; s_st.hum_pct = r.hum_pct;
    return trigger();
}

BarStats barStats() { return s_st; }
