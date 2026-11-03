// ext_bmp.cpp - BMP581: presion OSR 8x, temperatura 1x, modo normal a 110 Hz (tabla 7: maximo 140 Hz con esos OSR).
// 110 Hz y no 100: el hub lee a 104 Hz y asi casi nunca repite una muestra. IIR apagado por defecto: el EKF filtra.
#include "ext_bmp.h"
#include <Arduino.h>
#include <math.h>

static const uint8_t REG_STATUS = 0x28, REG_OSR = 0x36, REG_ODR = 0x37, REG_OSR_EFF = 0x38, REG_CMD = 0x7E;
static const uint8_t CHIP_ID = 0x50, CMD_RESET = 0xB6;
static const uint8_t STATUS_NVM_RDY = 0x02, STATUS_NVM_ERR = 0x04;
static const uint8_t OSR_CFG = 0x40 | (3 << 3);          // press_en, osr_p = 8x, osr_t = 1x
static const uint8_t ODR_CFG = (0x09 << 2) | 0x01;       // odr = 110.164 Hz, modo normal
static const uint32_t RESET_MS = 5;                      // tsoft_res = 2 ms
static const float P_MIN_PA = 20000.0f, P_MAX_PA = 115000.0f, T_MIN_C = -40.0f, T_MAX_C = 85.0f;
static const float P_BAD_PA = 100.0f;                    // a 130 m/s la presion cambia ~13 Pa entre muestras

Latest<ExtBarSample> g_ext_bar;
static ExtBmpStats   s_st;

static inline int32_t s24(const uint8_t *p) {
    return (int32_t)((uint32_t)p[0] << 8 | (uint32_t)p[1] << 16 | (uint32_t)p[2] << 24) >> 8;
}

bool extBmpConfigure(HubWriteFn wr, HubReadFn rd) {
    s_st.ok = false;
    s_st.step = "reset";
    wr(REG_CMD, CMD_RESET);
    vTaskDelay(pdMS_TO_TICKS(RESET_MS));
    s_st.step = "id";
    if (!rd(EXT_BMP_ID_REG, &s_st.chipId, 1) || s_st.chipId != CHIP_ID) return false;
    s_st.step = "estado";
    if (!rd(REG_STATUS, &s_st.status, 1) || !(s_st.status & STATUS_NVM_RDY) || (s_st.status & STATUS_NVM_ERR)) return false;
    s_st.step = "config";
    if (!wr(REG_OSR, OSR_CFG) || !wr(REG_ODR, ODR_CFG)) return false;
    s_st.step = "osr";
    if (!rd(REG_OSR_EFF, &s_st.effOsr, 1) || !(s_st.effOsr & 0x80)) return false;
    s_st.step = "ok";
    s_st.ok = true;
    return true;
}

void extBmpOnWord(const uint8_t *raw, int64_t t_us) {
    // El bus del hub puede corromper palabras (Hermes durante la TX): se descartan las imposibles y se publica la mediana de 3
    static float hist[3];
    static int64_t tPrev = 0;
    static uint8_t have = 0, idx = 0;
    const float temp = s24(raw) / 65536.0f, press = s24(raw + 3) / 64.0f;
    s_st.samples++;
    if (!(press >= P_MIN_PA && press <= P_MAX_PA && temp >= T_MIN_C && temp <= T_MAX_C)) { s_st.bad++; return; }
    hist[idx] = press;
    idx = (uint8_t)((idx + 1) % 3);
    if (have < 3) have++;
    const float a = hist[0], b = hist[1], c = hist[2];
    const float med = have < 3 ? press : (a > b ? (b > c ? b : (a > c ? c : a)) : (a > c ? a : (b > c ? c : b)));
    if (fabsf(press - med) > P_BAD_PA) s_st.bad++;

    ExtBarSample s;
    s.t_us = have < 3 ? t_us : tPrev;      // la mediana corresponde a la muestra anterior
    s.temp_c = temp;
    s.press_pa = med;
    tPrev = t_us;
    if (have == 3) g_ext_bar.set(s);
    s_st.press_pa = med; s_st.temp_c = temp;
}

void extBmpOnNack() { s_st.nacks++; }

ExtBmpStats extBmpStats() { return s_st; }
