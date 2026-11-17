// ext_mmc.cpp - MMC5983MA. BW=01 (4 ms, 0.6 mG): la tabla del datasheet da 50 Hz maximo con BW=00 y 100 Hz con BW=01.
// SET cada 100 mediciones (1 s): recupera el sensor si un campo de mas de 10 G lo altero. Al iniciar se mide un par SET/RESET para
// conocer el offset del puente: H = (set - reset) / 2, offset = (set + reset) / 2. El registro lleva esas dos muestras con bandera.
#include "ext_mmc.h"
#include "in_i2c.h"
#include <math.h>

static const uint8_t ADDR = 0x30, PRODUCT_ID = 0x30;
static const uint8_t REG_DATA = 0x00, REG_STATUS = 0x08, REG_CTRL0 = 0x09, REG_CTRL1 = 0x0A, REG_CTRL2 = 0x0B, REG_ID = 0x2F;
static const uint8_t ST_MEAS_DONE = 0x01;
static const uint8_t CTRL0_TM_M = 0x01, CTRL0_SET = 0x08, CTRL0_RESET = 0x10, CTRL0_AUTO_SR = 0x20;
static const uint8_t CTRL1_SW_RST = 0x80, CTRL1_BW_4MS = 0x01;
static const uint8_t CTRL2_RUN = 0x80 | (3 << 4) | 0x08 | 5;   // En_prd_set, Prd_set = 100 mediciones, Cmm_en, Cm_freq = 100 Hz
static const uint32_t RESET_MS = 15;                           // arranque de 10 ms
static const uint32_t SR_SETTLE_MS = 1;                        // el pulso dura 500 ns
static const uint32_t CAL_MEAS_TIMEOUT_MS = 20;
static const int32_t  ZERO = 131072, FULL = 262143;
static const float    LSB_PER_G = 16384.0f;

Latest<ExtMagSample> g_ext_mag;
static ExtMmcStats s_st;
static int64_t     s_tLast = 0;

static void decode(const uint8_t *d, int32_t *c, bool &sat) {
    const int32_t x = ((int32_t)d[0] << 10) | ((int32_t)d[1] << 2) | (d[6] >> 6);
    const int32_t y = ((int32_t)d[2] << 10) | ((int32_t)d[3] << 2) | ((d[6] >> 4) & 3);
    const int32_t z = ((int32_t)d[4] << 10) | ((int32_t)d[5] << 2) | ((d[6] >> 2) & 3);
    sat = x == 0 || y == 0 || z == 0 || x == FULL || y == FULL || z == FULL;
    c[0] = x - ZERO; c[1] = y - ZERO; c[2] = z - ZERO;
}

static void logSample(int64_t t, const int32_t *c, uint8_t flags) {
    rec::ExtMmcRec r;
    r.x = c[0]; r.y = c[1]; r.z = c[2]; r.flags = flags; r.pad = 0;
    bus_log(RING_I2C, rec::T_EXT_MMC, rec::S_EX_MAG, t, &r, sizeof(r));
}

// Una medicion suelta tras un pulso SET o RESET
static bool measureAfter(uint8_t pulse, uint8_t flag, int32_t *c) {
    if (!i2cWrite(ADDR, REG_CTRL0, pulse)) return false;
    vTaskDelay(pdMS_TO_TICKS(SR_SETTLE_MS));
    if (!i2cWrite(ADDR, REG_STATUS, ST_MEAS_DONE) || !i2cWrite(ADDR, REG_CTRL0, CTRL0_TM_M)) return false;
    uint8_t st = 0;
    const uint32_t t0 = millis();
    while (!(st & ST_MEAS_DONE)) {
        if (millis() - t0 > CAL_MEAS_TIMEOUT_MS) return false;
        vTaskDelay(pdMS_TO_TICKS(1));
        if (!i2cRead(ADDR, REG_STATUS, &st, 1)) return false;
    }
    uint8_t d[7];
    bool sat;
    if (!i2cRead(ADDR, REG_DATA, d, sizeof(d))) return false;
    decode(d, c, sat);
    logSample(esp_timer_get_time(), c, (uint8_t)(flag | (sat ? rec::MMCF_SAT : 0)));
    return true;
}

bool extMmcInit() {
    s_st.inits++;
    if (!i2cRead(ADDR, REG_ID, &s_st.id, 1) || s_st.id != PRODUCT_ID) return false;
    if (!i2cWrite(ADDR, REG_CTRL1, CTRL1_SW_RST)) return false;
    vTaskDelay(pdMS_TO_TICKS(RESET_MS));
    if (!i2cWrite(ADDR, REG_CTRL1, CTRL1_BW_4MS)) return false;

    int32_t set[3], rst[3];
    if (!measureAfter(CTRL0_RESET, rec::MMCF_CAL_RESET, rst) || !measureAfter(CTRL0_SET, rec::MMCF_CAL_SET, set)) return false;
    float h2 = 0;
    for (int i = 0; i < 3; i++) {
        const float h = (set[i] - rst[i]) / 2.0f / LSB_PER_G;
        h2 += h * h;
        s_st.offsetMg[i] = (set[i] + rst[i]) / 2.0f / LSB_PER_G * 1000.0f;
    }
    s_st.fieldG = sqrtf(h2);

    if (!i2cWrite(ADDR, REG_CTRL0, CTRL0_AUTO_SR) || !i2cWrite(ADDR, REG_CTRL2, CTRL2_RUN)) return false;
    s_tLast = 0;
    return true;
}

bool extMmcStep() {
    uint8_t st;
    if (!i2cRead(ADDR, REG_STATUS, &st, 1)) { s_st.errs++; return false; }
    if (!(st & ST_MEAS_DONE)) return true;
    const int64_t t = esp_timer_get_time();
    uint8_t d[7];
    if (!i2cRead(ADDR, REG_DATA, d, sizeof(d))) { s_st.errs++; return false; }
    if (!i2cWrite(ADDR, REG_STATUS, ST_MEAS_DONE)) { s_st.errs++; return false; }   // sigue en 1 hasta limpiarlo o hasta la siguiente medicion

    ExtMagSample s;
    bool sat;
    decode(d, s.raw, sat);
    s.t_us = t; s.seq = s_st.samples + 1; s.lsb_per_gauss = LSB_PER_G; s.flags = sat ? rec::MMCF_SAT : 0;
    logSample(t, s.raw, s.flags);
    g_ext_mag.set(s);

    if (s_tLast) { const uint32_t gap = (uint32_t)(t - s_tLast); if (gap > s_st.gapMaxUs) s_st.gapMaxUs = gap; }
    s_tLast = t;
    if (sat) s_st.sat++;
    s_st.samples++;
    s_st.normG = sqrtf((float)s.raw[0] * s.raw[0] + (float)s.raw[1] * s.raw[1] + (float)s.raw[2] * s.raw[2]) / LSB_PER_G;
    return true;
}

ExtMmcStats extMmcStats() { return s_st; }
