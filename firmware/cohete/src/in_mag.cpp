// in_mag.cpp - QMC6309: sin pin de dato listo; se consulta DRDY (leer 0x09 lo limpia, y tambien OVFL).
#include "in_mag.h"
#include "in_i2c.h"
#include <math.h>

static const uint8_t ADDR = 0x7C, CHIP_ID = 0x90;
static const uint8_t REG_ID = 0x00, REG_DATA = 0x01, REG_STATUS = 0x09, REG_CTRL1 = 0x0A, REG_CTRL2 = 0x0B;
static const uint8_t ST_DRDY = 0x01, ST_OVFL = 0x02, SOFT_RST = 0x80;

static const uint8_t ODR_BITS = (MAG_ODR_HZ == 200) ? 4 : (MAG_ODR_HZ == 100) ? 3 : (MAG_ODR_HZ == 50) ? 2 : 1;
static const uint8_t RNG_BITS = (MAG_FS_G == 32) ? 0 : (MAG_FS_G == 16) ? 1 : 2;
static const uint8_t CTRL2    = (uint8_t)((ODR_BITS << 4) | (RNG_BITS << 2));   // set/reset activos
static const uint8_t CTRL1    = 0x41;                                           // OSR2=4, OSR1=8, modo normal
static const float   LSB_PER_G = 32000.0f / MAG_FS_G;

static MagStats s_st;
static int64_t  s_tLast = 0;
Latest<MagSample> g_mag;

bool magInit() {
    s_st.inits++;
    uint8_t id = 0;
    const bool read = i2cRead(ADDR, REG_ID, &id, 1);
    s_st.id = read ? id : 0xFF;                                                  // 0xFF: no responde
    if (!read || id != CHIP_ID) {
        i2cWrite(ADDR, REG_CTRL2, SOFT_RST);                                     // DEM: a veces arranca y queda asi; un reset puede sacarlo
        i2cWrite(ADDR, REG_CTRL2, 0x00);
        return false;
    }
    if (!i2cWrite(ADDR, REG_CTRL2, SOFT_RST)) return false;
    vTaskDelay(pdMS_TO_TICKS(10));
    if (!i2cWrite(ADDR, REG_CTRL2, 0x00)) return false;                         // SOFT_RST no se limpia solo
    if (!i2cWrite(ADDR, REG_CTRL2, CTRL2) || !i2cWrite(ADDR, REG_CTRL1, CTRL1)) return false;
    s_tLast = 0;
    return true;
}

bool magStep() {
    uint8_t st;
    if (!i2cRead(ADDR, REG_STATUS, &st, 1)) { s_st.errs++; return false; }
    if (!(st & ST_DRDY)) return true;
    const int64_t t = esp_timer_get_time();
    uint8_t d[6];
    if (!i2cRead(ADDR, REG_DATA, d, sizeof(d))) { s_st.errs++; return false; }

    rec::MagRec r;
    r.x = (int16_t)(d[0] | (d[1] << 8)); r.y = (int16_t)(d[2] | (d[3] << 8)); r.z = (int16_t)(d[4] | (d[5] << 8));
    r.flags = (st & ST_OVFL) ? rec::MF_OVFL : 0;
    r.fs_gauss = MAG_FS_G;
    bus_log(RING_I2C, rec::T_MAG, rec::S_IN_MAG, t, &r, sizeof(r));

    MagSample s;
    s.t_us = t; s.seq = s_st.samples + 1; s.raw[0] = r.x; s.raw[1] = r.y; s.raw[2] = r.z;
    s.lsb_per_gauss = LSB_PER_G; s.flags = r.flags;
    g_mag.set(s);

    if (s_tLast) { const uint32_t gap = (uint32_t)(t - s_tLast); if (gap > s_st.gapMaxUs) s_st.gapMaxUs = gap; }
    s_tLast = t;
    if (r.flags) s_st.ovfl++;
    s_st.samples++;
    s_st.normG = sqrtf((float)r.x * r.x + (float)r.y * r.y + (float)r.z * r.z) / LSB_PER_G;
    return true;
}

MagStats magStats() { return s_st; }
