// cal_blob.h - Formato binario de la calibracion guardada en NVS (C++11 puro). Lo arma el cohete al calibrarse a bordo (cal_onboard) o
//   lo carga el PC por USB (estacion/cal_blob.py, desde el JSON de calib.py). Little endian, float32.
//   [ 'C' 'A' 'L' '1' | ver u8 | rocket u8 | largo u16 | utc_s u32 ]  12 B
//   secciones: [ id u8 | largo u8 | datos ]   1 LSM (15 f: R 9, sesgo 3, escala 3)   2 QMI (19 f: + ganancia del giro 3, retraso ms 1)
//                                             3 MMC (22 f: centro 3, A 9, R 9, radio 1)   4 QMC (igual)
//   [ crc32 u32 ] del blob entero menos el crc (CRC-32 de zlib)
#pragma once
#include <stdint.h>
#include <string.h>
#include <math.h>
#include "cal_core.h"

namespace calblob {

static const uint8_t  VER = 1;
static const uint16_t MAX = 512;
enum Seccion : uint8_t { S_LSM = 1, S_QMI = 2, S_MMC = 3, S_QMC = 4 };

struct Calibracion {
    bool     ok;                     // las cuatro secciones validas
    uint8_t  rocket;
    uint32_t utc_s, crc;
    cal::Imu lsm, qmi;
    double   qmi_ganancia[3], qmi_retraso_ms;
    cal::Mag mmc, qmc;
};

inline uint32_t crc32(const uint8_t *d, size_t n) {
    uint32_t c = 0xFFFFFFFFu;
    while (n--) { c ^= *d++; for (int k = 0; k < 8; k++) c = (c >> 1) ^ (0xEDB88320u & (0u - (c & 1u))); }
    return ~c;
}

struct Escritor {
    uint8_t *b; uint16_t n, cap; bool ok;
    Escritor(uint8_t *buf, uint16_t c) : b(buf), n(0), cap(c), ok(true) {}
    void u8(uint8_t v) { if (n + 1 > cap) { ok = false; return; } b[n++] = v; }
    void raw(const void *p, uint16_t k) { if (n + k > cap) { ok = false; return; } memcpy(b + n, p, k); n += k; }
    void f(double v) { const float x = (float)v; raw(&x, 4); }
    void m3(const double M[3][3]) { for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) f(M[i][j]); }
    void v3(const double v[3]) { for (int i = 0; i < 3; i++) f(v[i]); }
};

// Arma el blob. Devuelve el largo (0 si no cabe). Solo incluye las secciones de los sensores calibrados (ok).
inline uint16_t armar(const Calibracion &c, uint8_t *out, uint16_t cap) {
    Escritor w(out, cap);
    w.raw("CAL1", 4); w.u8(VER); w.u8(c.rocket); w.u8(0); w.u8(0); w.raw(&c.utc_s, 4);
    if (c.lsm.ok) { w.u8(S_LSM); w.u8(60); w.m3(c.lsm.R); w.v3(c.lsm.sesgo); w.v3(c.lsm.escala); }
    if (c.qmi.ok) { w.u8(S_QMI); w.u8(76); w.m3(c.qmi.R); w.v3(c.qmi.sesgo); w.v3(c.qmi.escala); w.v3(c.qmi_ganancia); w.f(c.qmi_retraso_ms); }
    const cal::Mag *ms[2] = {&c.mmc, &c.qmc};
    for (int k = 0; k < 2; k++) {
        if (!ms[k]->ok || !ms[k]->alineado) continue;
        w.u8(k == 0 ? S_MMC : S_QMC); w.u8(88); w.v3(ms[k]->centro); w.m3(ms[k]->A); w.m3(ms[k]->R); w.f(ms[k]->radio);
    }
    if (!w.ok || w.n + 4 > cap) return 0;
    const uint16_t len = (uint16_t)(w.n + 4);
    out[6] = (uint8_t)len; out[7] = (uint8_t)(len >> 8);
    const uint32_t crc = crc32(out, w.n);
    memcpy(out + w.n, &crc, 4);
    return len;
}

struct Lector {
    const uint8_t *b; uint16_t n, i; bool ok;
    Lector(const uint8_t *buf, uint16_t len, uint16_t ini) : b(buf), n(len), i(ini), ok(true) {}
    double f() { if (i + 4 > n) { ok = false; return 0; } float x; memcpy(&x, b + i, 4); i += 4; return x; }
    void m3(double M[3][3]) { for (int r = 0; r < 3; r++) for (int s = 0; s < 3; s++) M[r][s] = f(); }
    void v3(double v[3]) { for (int r = 0; r < 3; r++) v[r] = f(); }
};

// Lee y valida el blob (cabecera, largo, crc). Devuelve false con el motivo en *motivo.
inline bool leer(const uint8_t *b, uint16_t len, Calibracion &c, const char **motivo) {
    memset(&c, 0, sizeof(c));
    const char *m = nullptr;
    if (len < 16 || len > MAX) m = "largo invalido";
    else if (memcmp(b, "CAL1", 4) != 0) m = "no es una calibracion";
    else if (b[4] != VER) m = "version distinta";
    else if ((uint16_t)(b[6] | (b[7] << 8)) != len) m = "largo distinto al de la cabecera";
    else {
        uint32_t crc; memcpy(&crc, b + len - 4, 4);
        if (crc32(b, len - 4) != crc) m = "CRC32 no coincide";
        else c.crc = crc;
    }
    if (m) { if (motivo) *motivo = m; return false; }
    c.rocket = b[5];
    memcpy(&c.utc_s, b + 8, 4);
    uint16_t i = 12;
    while (i + 2 <= len - 4) {
        const uint8_t id = b[i], sl = b[i + 1];
        Lector r(b, (uint16_t)(len - 4), (uint16_t)(i + 2));
        if (id == S_LSM && sl == 60) { r.m3(c.lsm.R); r.v3(c.lsm.sesgo); r.v3(c.lsm.escala); c.lsm.ok = r.ok; }
        else if (id == S_QMI && sl == 76) { r.m3(c.qmi.R); r.v3(c.qmi.sesgo); r.v3(c.qmi.escala); r.v3(c.qmi_ganancia); c.qmi_retraso_ms = r.f(); c.qmi.ok = r.ok; }
        else if ((id == S_MMC || id == S_QMC) && sl == 88) {
            cal::Mag &g = id == S_MMC ? c.mmc : c.qmc;
            r.v3(g.centro); r.m3(g.A); r.m3(g.R); g.radio = r.f(); g.ok = g.alineado = r.ok;
        }
        i = (uint16_t)(i + 2 + sl);
    }
    c.ok = c.lsm.ok && c.qmi.ok && c.mmc.ok && c.qmc.ok;
    if (motivo) *motivo = nullptr;
    return true;
}

// Rangos razonables antes de guardar (como en el diseño): rotaciones validas, escalas 0.9-1.1, sesgos < 0.2 g, radio 0.15-0.8 G
inline const char *revisar(const Calibracion &c, uint8_t rocket) {
    if (c.rocket != rocket) return "la calibracion es de otro cohete";
    const cal::Imu *im[2] = {&c.lsm, &c.qmi};
    for (int k = 0; k < 2; k++) {
        if (!im[k]->ok) continue;
        const double (*R)[3] = im[k]->R;
        for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) {
            double d = 0; for (int q = 0; q < 3; q++) d += R[i][q] * R[j][q];
            if (fabs(d - (i == j)) > 0.01) return "una rotacion no es ortonormal";
        }
        for (int i = 0; i < 3; i++) {
            if (im[k]->escala[i] < 0.9 || im[k]->escala[i] > 1.1) return "escala del acelerometro fuera de 0.9-1.1";
            if (fabs(im[k]->sesgo[i]) > 0.2) return "sesgo del acelerometro mayor de 0.2 g";
        }
    }
    const cal::Mag *ms[2] = {&c.mmc, &c.qmc};
    for (int k = 0; k < 2; k++) if (ms[k]->ok && (ms[k]->radio < 0.15 || ms[k]->radio > 0.8)) return "radio del campo fuera de 0.15-0.8 G";
    if (c.qmi.ok) for (int i = 0; i < 3; i++) if (c.qmi_ganancia[i] < 0.7 || c.qmi_ganancia[i] > 1.4) return "ganancia del giro del QMI fuera de 0.7-1.4";
    return nullptr;
}

} // namespace calblob
