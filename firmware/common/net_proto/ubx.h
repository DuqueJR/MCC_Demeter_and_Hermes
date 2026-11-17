// ubx.h - Protocolo UBX (u-blox): construccion de tramas, CFG-VALSET (M9/M10), parser y NAV-PVT.
// C++11 puro, sin dependencias de ESP32.
#pragma once
#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <stdlib.h>

namespace ubx {

// ---- construccion de tramas ----
inline uint16_t build(uint8_t *out, uint8_t cls, uint8_t id, const uint8_t *p, uint16_t n) {
    out[0] = 0xB5; out[1] = 0x62; out[2] = cls; out[3] = id; out[4] = (uint8_t)n; out[5] = (uint8_t)(n >> 8);
    if (n) memcpy(out + 6, p, n);
    uint8_t a = 0, b = 0;
    for (uint16_t i = 2; i < 6 + n; i++) { a = (uint8_t)(a + out[i]); b = (uint8_t)(b + a); }
    out[6 + n] = a; out[7 + n] = b;
    return (uint16_t)(n + 8);
}

// CFG-VALSET en la capa RAM (no persiste tras un corte de energia del receptor)
struct ValSet {
    uint8_t b[64]; uint16_t n;
    void init() { n = 0; b[n++] = 0; b[n++] = 0x01; b[n++] = 0; b[n++] = 0; }
    bool add(uint32_t key, uint32_t val) {
        const int sz = (int)((key >> 28) & 7);
        const int len = (sz <= 2) ? 1 : (sz == 3) ? 2 : (sz == 4) ? 4 : 8;
        if (n + 4 + len > (int)sizeof(b)) return false;
        for (int i = 0; i < 4; i++) b[n++] = (uint8_t)(key >> (8 * i));
        for (int i = 0; i < len; i++) b[n++] = (uint8_t)(val >> (8 * i));
        return true;
    }
    uint16_t frame(uint8_t *out) const { return build(out, 0x06, 0x8A, b, n); }
};

// Claves CFG (M9/M10)
static const uint32_t K_UART1_BAUD      = 0x40520001;
static const uint32_t K_UART1OUT_UBX    = 0x10740001;
static const uint32_t K_UART1OUT_NMEA   = 0x10740002;
static const uint32_t K_RATE_MEAS_MS    = 0x30210001;
static const uint32_t K_RATE_NAV        = 0x30210002;
static const uint32_t K_DYNMODEL        = 0x20110021;
static const uint32_t K_MSGOUT_PVT_U1   = 0x20910007;
// CFG-SIGNAL: constelaciones. Cambiarlas reinicia el subsistema GNSS del receptor.
static const uint32_t K_SIG_SBAS_ENA    = 0x10310020;
static const uint32_t K_SIG_BDS_ENA     = 0x10310022;
static const uint32_t K_SIG_QZSS_ENA    = 0x10310024;

// ---- parser ----
class Parser {
public:
    typedef void (*Cb)(void *ctx, uint8_t cls, uint8_t id, const uint8_t *p, uint16_t n);
    void init(Cb cb, void *ctx) { cb_ = cb; ctx_ = ctx; st_ = 0; frames = ckerr = bytes = toolong = 0; }
    void feed(const uint8_t *d, size_t n) { for (size_t i = 0; i < n; i++) byte(d[i]); }
    uint32_t frames = 0, ckerr = 0, bytes = 0, toolong = 0;

private:
    void byte(uint8_t c) {
        bytes++;
        switch (st_) {
        case 0: if (c == 0xB5) st_ = 1; break;
        case 1: st_ = (c == 0x62) ? 2 : (c == 0xB5 ? 1 : 0); break;
        case 2: cls_ = c; st_ = 3; break;
        case 3: id_ = c; st_ = 4; break;
        case 4: len_ = c; st_ = 5; break;
        case 5:
            len_ = (uint16_t)(len_ | (c << 8)); pos_ = 0;
            if (len_ > sizeof(pl_)) { toolong++; st_ = 0; } else st_ = len_ ? 6 : 7;
            break;
        case 6: pl_[pos_++] = c; if (pos_ >= len_) st_ = 7; break;
        case 7: ckA_ = c; st_ = 8; break;
        case 8: {
            uint8_t a = 0, b = 0;
            const uint8_t h[4] = {cls_, id_, (uint8_t)len_, (uint8_t)(len_ >> 8)};
            for (int i = 0; i < 4; i++) { a = (uint8_t)(a + h[i]); b = (uint8_t)(b + a); }
            for (uint16_t i = 0; i < len_; i++) { a = (uint8_t)(a + pl_[i]); b = (uint8_t)(b + a); }
            if (a == ckA_ && b == c) { frames++; if (cb_) cb_(ctx_, cls_, id_, pl_, len_); }
            else ckerr++;
            st_ = 0;
        } break;
        }
    }
    Cb cb_ = 0; void *ctx_ = 0;
    uint8_t st_ = 0, cls_ = 0, id_ = 0, ckA_ = 0;
    uint16_t len_ = 0, pos_ = 0;
    uint8_t pl_[400];
};

// ---- NAV-PVT (92 bytes) ----
struct NavPvt {
    uint32_t itow; uint16_t year; uint8_t month, day, hour, min, sec, valid;
    uint32_t tacc; int32_t nano; uint8_t fixType, flags, flags2, numSV;
    int32_t lon, lat, height, hMSL; uint32_t hAcc, vAcc;
    int32_t velN, velE, velD, gSpeed, headMot; uint32_t sAcc; uint16_t pDOP;
};
template <typename T> inline T rd(const uint8_t *p) { T v; memcpy(&v, p, sizeof(T)); return v; }

inline bool decodePvt(const uint8_t *p, uint16_t n, NavPvt &o) {
    if (n != 92) return false;
    o.itow = rd<uint32_t>(p + 0); o.year = rd<uint16_t>(p + 4);
    o.month = p[6]; o.day = p[7]; o.hour = p[8]; o.min = p[9]; o.sec = p[10]; o.valid = p[11];
    o.tacc = rd<uint32_t>(p + 12); o.nano = rd<int32_t>(p + 16);
    o.fixType = p[20]; o.flags = p[21]; o.flags2 = p[22]; o.numSV = p[23];
    o.lon = rd<int32_t>(p + 24); o.lat = rd<int32_t>(p + 28);
    o.height = rd<int32_t>(p + 32); o.hMSL = rd<int32_t>(p + 36);
    o.hAcc = rd<uint32_t>(p + 40); o.vAcc = rd<uint32_t>(p + 44);
    o.velN = rd<int32_t>(p + 48); o.velE = rd<int32_t>(p + 52); o.velD = rd<int32_t>(p + 56);
    o.gSpeed = rd<int32_t>(p + 60); o.headMot = rd<int32_t>(p + 64);
    o.sAcc = rd<uint32_t>(p + 68); o.pDOP = rd<uint16_t>(p + 76);
    return true;
}

// dias desde 1970-01-01 (algoritmo de H. Hinnant)
inline int64_t daysFromCivil(int y, int m, int d) {
    y -= (m <= 2);
    const int era = (y >= 0 ? y : y - 399) / 400;
    const int yoe = y - era * 400;
    const int mp = m + (m > 2 ? -3 : 9);
    const int doy = (153 * mp + 2) / 5 + d - 1;
    const int doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    return (int64_t)era * 146097 + doe - 719468;
}

// UTC de la epoca del PVT en microsegundos desde 1970
inline int64_t utcEpochUs(const NavPvt &v) {
    const int64_t days = daysFromCivil(v.year, v.month, v.day);
    const int64_t s = ((days * 24 + v.hour) * 60 + v.min) * 60 + v.sec;
    const int64_t us = (v.nano >= 0 ? (v.nano + 500) : (v.nano - 500)) / 1000;
    return s * 1000000LL + us;
}

// Criterio para anclar un flanco PPS: epoca en segundo entero, hora valida y precision suficiente.
// Devuelve true y el segundo UTC (epoch, s) que corresponde al flanco.
inline bool wholeSecondAnchor(const NavPvt &v, uint32_t max_tacc_ns, int64_t *utc_sec) {
    if ((v.itow % 1000) != 0) return false;
    if (!(v.valid & 0x02)) return false;                 // validTime
    if (v.fixType < 3 || v.fixType > 5) return false;
    if (v.tacc > max_tacc_ns) return false;
    const int64_t e = utcEpochUs(v);
    const int64_t sec = (e + 500000) / 1000000;
    if (llabs(e - sec * 1000000LL) > 1000) return false;  // la epoca debe caer a <1 ms del segundo
    *utc_sec = sec;
    return true;
}

} // namespace ubx
