// prueba_cal_blob.cpp - Lee un blob de calibracion con el lector del firmware (cal_blob.h) y escribe lo leido en JSON, para comprobar
// que estacion/cal_blob.py arma exactamente lo que el cohete espera. Uso: prueba_cal_blob BLOB.bin ROCKET_ID
#include <stdio.h>
#include <stdlib.h>
#include <vector>
#include "cal_blob.h"

static void m3(const char *k, const double M[3][3]) { printf("\"%s\": [[%.9g, %.9g, %.9g], [%.9g, %.9g, %.9g], [%.9g, %.9g, %.9g]]", k, M[0][0], M[0][1], M[0][2], M[1][0], M[1][1], M[1][2], M[2][0], M[2][1], M[2][2]); }
static void v3(const char *k, const double v[3]) { printf("\"%s\": [%.9g, %.9g, %.9g]", k, v[0], v[1], v[2]); }

int main(int argc, char **argv) {
    if (argc < 3) return 2;
    FILE *f = fopen(argv[1], "rb");
    if (!f) return 2;
    std::vector<uint8_t> b(calblob::MAX + 1);
    const size_t n = fread(b.data(), 1, b.size(), f);
    fclose(f);
    calblob::Calibracion c;
    const char *m = nullptr;
    if (!calblob::leer(b.data(), (uint16_t)n, c, &m)) { printf("{\"error\": \"%s\"}\n", m); return 1; }
    const char *rv = calblob::revisar(c, (uint8_t)atoi(argv[2]));
    printf("{\"ok\": %s, \"crc\": %u, \"rocket\": %u, \"revisar\": \"%s\"", c.ok ? "true" : "false", (unsigned)c.crc, c.rocket, rv ? rv : "");
    if (c.lsm.ok) { printf(", \"lsm\": {"); m3("R", c.lsm.R); printf(", "); v3("sesgo_g", c.lsm.sesgo); printf(", "); v3("escala", c.lsm.escala); printf("}"); }
    if (c.qmi.ok) { printf(", \"qmi\": {"); m3("R", c.qmi.R); printf(", "); v3("sesgo_g", c.qmi.sesgo); printf(", "); v3("escala", c.qmi.escala); printf(", "); v3("ganancia_giro", c.qmi_ganancia); printf(", \"retraso_ms\": %.9g}", c.qmi_retraso_ms); }
    const cal::Mag *ms[2] = {&c.mmc, &c.qmc}; const char *mn[2] = {"mmc", "qmc"};
    for (int k = 0; k < 2; k++) if (ms[k]->ok) { printf(", \"%s\": {", mn[k]); v3("centro", ms[k]->centro); printf(", "); m3("A", ms[k]->A); printf(", "); m3("R", ms[k]->R); printf(", \"radio_G\": %.9g}", ms[k]->radio); }
    printf("}\n");
    return 0;
}
