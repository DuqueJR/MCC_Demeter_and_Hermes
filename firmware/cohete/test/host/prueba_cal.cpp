// prueba_cal.cpp - Corre cal_core (la calibracion a bordo) sobre un .BIN en el PC y escribe el resultado en JSON, con las mismas claves
// que estacion/calib.py, para compararlos (comparar_cal.py).
// Uso: prueba_cal LOG.BIN [prev.txt]   prev.txt: 15 numeros (R por filas, sesgo, escala) de la calibracion anterior del LSM
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <vector>
#include "cal_core.h"
#include "cal_blob.h"
#include <string.h>

static void m3(FILE *f, const char *k, const double M[3][3]) {
    fprintf(f, "\"%s\": [[%.9g, %.9g, %.9g], [%.9g, %.9g, %.9g], [%.9g, %.9g, %.9g]]", k, M[0][0], M[0][1], M[0][2], M[1][0], M[1][1], M[1][2], M[2][0], M[2][1], M[2][2]);
}
static void v3(FILE *f, const char *k, const double v[3]) { fprintf(f, "\"%s\": [%.9g, %.9g, %.9g]", k, v[0], v[1], v[2]); }
static const char *num(double x, char *b) { if (isnan(x)) return "null"; snprintf(b, 32, "%.9g", x); return b; }

int main(int argc, char **argv) {
    if (argc < 2) { fprintf(stderr, "uso: prueba_cal LOG.BIN [prev.txt]\n"); return 2; }
    FILE *fi = fopen(argv[1], "rb");
    if (!fi) { fprintf(stderr, "no abre %s\n", argv[1]); return 2; }
    std::vector<uint8_t> d;
    uint8_t chunk[65536]; size_t n;
    while ((n = fread(chunk, 1, sizeof(chunk), fi)) > 0) d.insert(d.end(), chunk, chunk + n);
    fclose(fi);
    cal::Imu prev; bool hayPrev = false;
    if (argc >= 3) {
        FILE *fp = fopen(argv[2], "r");
        if (fp) {
            double x[15]; int k = 0;
            while (k < 15 && fscanf(fp, "%lf", &x[k]) == 1) k++;
            fclose(fp);
            if (k == 15) { for (int i = 0; i < 9; i++) prev.R[i / 3][i % 3] = x[i]; for (int i = 0; i < 3; i++) { prev.sesgo[i] = x[9 + i]; prev.escala[i] = x[12 + i]; } prev.ok = true; hayPrev = true; }
        }
    }
    cal::Analizador a;
    a.inicio(hayPrev ? &prev : nullptr);
    // dos pasadas en trozos de 64 KB, como en el cohete
    for (int pasada = 1; pasada <= 2; pasada++) {
        cal::Lector lec;
        for (size_t i = 0; i < d.size(); i += 65536) {
            const size_t m = d.size() - i < 65536 ? d.size() - i : 65536;
            if (pasada == 1) lec.feed(&d[i], m, [&](const uint8_t *r, uint16_t len) { a.pasada1(r, len); });
            else lec.feed(&d[i], m, [&](const uint8_t *r, uint16_t len) { a.pasada2(r, len); });
        }
        if (pasada == 1) a.finPasada1(); else a.finPasada2();
    }
    const cal::Resultado &r = a.res();
    // con PRUEBA_CAL_BLOB=archivo en el entorno, escribe tambien el blob que guardaria el cohete
    if (const char *bp = getenv("PRUEBA_CAL_BLOB")) {
        calblob::Calibracion c; memset(&c, 0, sizeof(c));
        const char *base = strrchr(argv[1], '/'); base = base ? base + 1 : argv[1];
        const char *b2 = strrchr(base, '\\'); base = b2 ? b2 + 1 : base;
        c.rocket = strncmp(base, "HER", 3) == 0 ? 2 : 1;
        c.lsm = r.lsm; c.qmi = r.qmi; c.mmc = r.mmc; c.qmc = r.qmc;
        for (int i = 0; i < 3; i++) c.qmi_ganancia[i] = r.qmi_giro ? r.qmi_ganancia[i] : 1.0;
        c.qmi_retraso_ms = r.qmi_giro ? r.qmi_retraso_ms : 0;
        uint8_t blob[calblob::MAX];
        const uint16_t n = calblob::armar(c, blob, sizeof(blob));
        FILE *fb = fopen(bp, "wb");
        if (fb) { fwrite(blob, 1, n, fb); fclose(fb); }
    }
    char b[32];
    FILE *f = stdout;
    fprintf(f, "{\"n_pos\": %d, \"nombradas\": %d, \"avisos\": %u, \"ok\": %s, \"n_lsm\": %u, \"n_qmi\": %u, \"n_mmc\": %u, \"n_qmc\": %u,\n",
            r.n_pos, r.nombradas, (unsigned)r.avisos, r.ok ? "true" : "false", (unsigned)r.n_lsm, (unsigned)r.n_qmi, (unsigned)r.n_mmc, (unsigned)r.n_qmc);
    const cal::Imu *imus[2] = {&r.lsm, &r.qmi}; const char *in[2] = {"lsm", "qmi"};
    for (int k = 0; k < 2; k++) {
        if (!imus[k]->ok) continue;
        fprintf(f, " \"%s\": {", in[k]); m3(f, "R", imus[k]->R); fprintf(f, ", "); v3(f, "sesgo_g", imus[k]->sesgo); fprintf(f, ", "); v3(f, "escala", imus[k]->escala);
        fprintf(f, ", \"error_pos_grados\": %s", num(imus[k]->err_pos, b));
        if (k == 1 && r.qmi_giro) { fprintf(f, ", \"retraso_ms\": %s, ", num(r.qmi_retraso_ms, b)); v3(f, "ganancia_giro", r.qmi_ganancia); fprintf(f, ", "); v3(f, "corr", r.qmi_corr); }
        fprintf(f, "},\n");
    }
    const cal::Mag *mags[2] = {&r.mmc, &r.qmc}; const char *mn[2] = {"mmc", "qmc"};
    for (int k = 0; k < 2; k++) {
        const cal::Mag &c = *mags[k];
        if (!c.ok) continue;
        fprintf(f, " \"%s\": {", mn[k]); v3(f, "centro", c.centro); fprintf(f, ", "); m3(f, "A", c.A);
        fprintf(f, ", \"radio_G\": %s", num(c.radio, b)); fprintf(f, ", \"max_min\": %s", num(c.max_min, b)); fprintf(f, ", \"residuo_mG\": %s", num(c.residuo_mG, b));
        fprintf(f, ", \"cobertura\": %s, \"muestras\": %d, \"descartadas\": %d", num(c.cobertura, b), c.muestras, c.descartadas);
        if (c.alineado) { fprintf(f, ", "); m3(f, "R_imu_desde_mag", c.R_imu); fprintf(f, ", "); m3(f, "R", c.R); fprintf(f, ", \"invertido\": %s", c.invertido ? "true" : "false"); }
        fprintf(f, ", \"dip_media\": %s", num(c.dip_media, b)); fprintf(f, ", \"dip_rango\": %s, \"dip_n\": %d", num(c.dip_rango, b), c.dip_n);
        fprintf(f, "},\n");
    }
    fprintf(f, " \"mag_acuerdo\": [%s, ", num(r.mag_acuerdo_min, b)); fprintf(f, "%s],\n", num(r.mag_acuerdo_max, b));
    const cal::Curva *cv[2] = {&r.bmp, &r.bme}; const char *cn[2] = {"bmp", "bme"};
    fprintf(f, " \"temperatura\": {");
    for (int k = 0; k < 2; k++) {
        const cal::Curva &c = *cv[k];
        if (k) fprintf(f, ", ");
        fprintf(f, "\"%s\": {\"ok\": %s, \"t0_C\": %s", cn[k], c.ok ? "true" : "false", num(c.t0, b));
        fprintf(f, ", \"final_C\": %s", num(c.final_, b)); fprintf(f, ", \"tau_min\": %s", num(c.tau_min, b)); fprintf(f, ", \"sube_5min_C\": %s}", num(c.sube5, b));
    }
    fprintf(f, "}}\n");
    return 0;
}
