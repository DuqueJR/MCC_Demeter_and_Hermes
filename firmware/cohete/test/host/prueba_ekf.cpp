// prueba_ekf.cpp - El EKF a bordo (src/ekf_core.cpp) sobre un log real, para compararlo con estacion/ekf.py (comparar_ekf.py).
// Uso: prueba_ekf LOG.BIN cal.txt salida.csv [t_suelo_C]
//   cal.txt: lo escribe comparar_ekf.py desde el JSON de calib.py (LSM, QMI, MMC, QMC).
// Alimenta el navegador en orden de llegada, como en el cohete: el IMU en el instante de cada muestra, los demas en el instante del
// registro (el GNSS lleva su instante de medicion, por el ajuste de los PPS, igual que ekf.py), y avanza el filtro con ese reloj.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <vector>
#include <algorithm>
#include "ekf_core.h"
#include "rec_format.h"

struct In { int64_t t; int tipo; float a[3], b[3]; ekf::Gnss g; };   // tipo: 0 lsm 1 qmi 2 bmp 3 bme 4 mmc 5 qmc 6 gnss 7 momento

static bool leerCal(const char *path, ekf::Config &c) {
    FILE *f = fopen(path, "r");
    if (!f) return false;
    ekf::configNominal(c);
    double x[200]; int n = 0;
    while (n < 200 && fscanf(f, "%lf", &x[n]) == 1) n++;
    fclose(f);
    int k = 0;
    auto imu = [&](ekf::ImuCal &m) { m.ok = true; for (int i = 0; i < 9; i++) m.R[i / 3][i % 3] = x[k++]; for (int i = 0; i < 3; i++) m.sesgo[i] = x[k++]; for (int i = 0; i < 3; i++) m.escala[i] = x[k++]; };
    auto mag = [&](ekf::MagCal &m) { m.ok = x[k++] != 0; for (int i = 0; i < 3; i++) m.centro[i] = x[k++]; for (int i = 0; i < 9; i++) m.A[i / 3][i % 3] = x[k++];
                                    for (int i = 0; i < 9; i++) m.R[i / 3][i % 3] = x[k++];
                                    m.radio = x[k++]; };
    if (n < 15 + 15 + 4 + 2 * 23) return false;
    imu(c.lsm); imu(c.qmi);
    for (int i = 0; i < 3; i++) c.qmi_ganancia[i] = x[k++];
    c.qmi_retraso_ms = x[k++];
    mag(c.mmc); mag(c.qmc);
    c.calibrado = true;
    return true;
}

int main(int argc, char **argv) {
    if (argc < 4) { fprintf(stderr, "uso: prueba_ekf LOG.BIN cal.txt salida.csv [t_suelo_C]\n"); return 2; }
    const size_t la = strlen(argv[1]);
    const bool texto = la > 4 && strcmp(argv[1] + la - 4, ".txt") == 0;     // entradas ya decodificadas (vuelo_sintetico.py --cpp)
    FILE *fi = fopen(argv[1], texto ? "r" : "rb");
    if (!fi) { fprintf(stderr, "no abre %s\n", argv[1]); return 2; }
    std::vector<In> in;
    if (texto) {
        long long t; int tipo;
        while (fscanf(fi, "%lld %d", &t, &tipo) == 2) {
            In x; memset(&x, 0, sizeof(x)); x.t = t; x.tipo = tipo;
            if (tipo == 6) {
                long long tm; int fix; double la_, lo_, h_; float ha, sa, vn, ve, vd;
                if (fscanf(fi, "%lld %d %lf %lf %lf %f %f %f %f %f", &tm, &fix, &la_, &lo_, &h_, &ha, &sa, &vn, &ve, &vd) != 10) break;
                x.g.t_us = tm; x.g.fix = (uint8_t)fix; x.g.lat_deg = la_; x.g.lon_deg = lo_; x.g.h_m = h_;
                x.g.hacc_m = ha; x.g.sacc_mps = sa; x.g.vn = vn; x.g.ve = ve; x.g.vd = vd;
            } else if (fscanf(fi, "%f %f %f %f %f %f", &x.a[0], &x.a[1], &x.a[2], &x.b[0], &x.b[1], &x.b[2]) != 6) break;
            in.push_back(x);
        }
        fclose(fi);
    }
    std::vector<uint8_t> d;
    if (!texto) {
    { uint8_t ch[65536]; size_t n; while ((n = fread(ch, 1, sizeof(ch), fi)) > 0) d.insert(d.end(), ch, ch + n); }
    fclose(fi);

    // registros validos
    std::vector<std::pair<size_t, uint16_t> > recs;
    for (size_t i = 0; i + 16 <= d.size();) {
        const uint16_t len = rec::check(&d[i], (uint32_t)(d.size() - i));
        if (len) { recs.push_back(std::make_pair(i, len)); i += len; } else i++;
    }
    // PPS: reloj local de cada segundo UTC (como el polyfit de ekf.py)
    std::vector<double> ps, pt;
    std::vector<std::pair<int64_t, int64_t> > tx;
    for (size_t r = 0; r < recs.size(); r++) {
        rec::Hdr h; memcpy(&h, &d[recs[r].first], sizeof(h));
        const uint8_t *p = &d[recs[r].first + rec::HDR_SIZE]; const int n = recs[r].second - rec::HDR_SIZE - rec::CRC_SIZE;
        if (h.type == rec::T_PPS && n >= 18 && p[16]) { int64_t te, sec; memcpy(&te, p, 8); memcpy(&sec, p + 8, 8); ps.push_back((double)sec); pt.push_back((double)te); }
        if (h.type == rec::T_LINK && n == 16 && p[0] == rec::LD_TX) { uint32_t air; memcpy(&air, p + 12, 4); tx.push_back(std::make_pair(h.t_us - (int64_t)air - 15000, h.t_us + 15000)); }
    }
    double fa = 0, fb = 0; const bool hayPps = ps.size() > 5;
    if (hayPps) {
        const double s0 = ps[0]; double sx = 0, sy = 0, sxx = 0, sxy = 0; const double N = (double)ps.size();
        for (size_t i = 0; i < ps.size(); i++) { const double x = ps[i] - s0; sx += x; sy += pt[i]; sxx += x * x; sxy += x * pt[i]; }
        fb = (N * sxy - sx * sy) / (N * sxx - sx * sx); fa = (sy - fb * sx) / N;
        fa -= fb * s0;                                         // te = fa + fb * sec
    }
    std::sort(tx.begin(), tx.end());
    auto enTx = [&](int64_t t) { auto it = std::upper_bound(tx.begin(), tx.end(), std::make_pair(t, INT64_MAX)); if (it == tx.begin()) return false; --it; return t <= it->second; };

    float bmpPrev[2]; int bmpN = 0; std::vector<In> bmpCrudo;
    for (size_t r = 0; r < recs.size(); r++) {
        rec::Hdr h; memcpy(&h, &d[recs[r].first], sizeof(h));
        const uint8_t *p = &d[recs[r].first + rec::HDR_SIZE]; const int n = recs[r].second - rec::HDR_SIZE - rec::CRC_SIZE;
        if (h.type == rec::T_EXT_LSM && n >= 24) {
            uint32_t n0; uint16_t cnt; int64_t tf; float period;
            memcpy(&n0, p, 4); memcpy(&cnt, p + 4, 2); memcpy(&tf, p + 8, 8); memcpy(&period, p + 16, 4);
            if (n != 24 + 7 * cnt) continue;
            uint32_t k = n0; float pend[3] = {0, 0, 0};
            for (int i = 0; i < cnt; i++) {
                const uint8_t *w = p + 24 + 7 * i; const uint8_t tag = w[0] >> 3;
                int16_t v[3]; memcpy(v, w + 1, 6);
                if (tag == 2) {
                    In x; x.tipo = 0; x.t = tf + (int64_t)llround((double)(k - n0) * period); k++;
                    for (int j = 0; j < 3; j++) { x.a[j] = v[j] / (1000.0f / 0.976f); x.b[j] = pend[j]; }
                    in.push_back(x);
                } else if (tag == 1) for (int j = 0; j < 3; j++) pend[j] = v[j] / (1000.0f / 70.0f);
                else if (tag == 0x0E) {
                    int32_t pp = w[4] | (w[5] << 8) | (w[6] << 16), tt = w[1] | (w[2] << 8) | (w[3] << 16);
                    pp -= (pp & 0x800000) << 1; tt -= (tt & 0x800000) << 1;
                    const float pa = pp / 64.0f, tc = tt / 65536.0f;
                    if (pa >= 20000 && pa <= 115000 && tc >= -40 && tc <= 85) { In x; x.tipo = 2; x.t = tf + (int64_t)llround((double)(k - n0) * period); x.a[0] = pa; x.a[1] = tc; bmpCrudo.push_back(x); }
                }
            }
        } else if (h.type == rec::T_IMU && n >= 40) {
            uint16_t cnt, afs, gfs; int64_t tf; double period;
            memcpy(&cnt, p + 4, 2); afs = p[7]; memcpy(&tf, p + 16, 8); memcpy(&period, p + 24, 8); memcpy(&gfs, p + 38, 2);
            if (n != 40 + 12 * cnt || !gfs || !afs) continue;
            for (int i = 0; i < cnt; i++) {
                int16_t v[6]; memcpy(v, p + 40 + 12 * i, 12);
                In x; x.tipo = 1; x.t = tf + (int64_t)llround(i * period);
                for (int j = 0; j < 3; j++) { x.a[j] = v[j] / (32768.0f / afs); x.b[j] = v[3 + j] / (32768.0f / gfs); }
                in.push_back(x);
            }
        } else if (h.type == rec::T_BAR && n == 32) {
            In x; x.tipo = 3; x.t = h.t_us; memcpy(&x.a[0], p + 20, 4); in.push_back(x);
        } else if (h.type == rec::T_EXT_MMC && n == 14) {
            if (p[12] & 7 || enTx(h.t_us)) continue;
            int32_t v[3]; memcpy(v, p, 12);
            In x; x.tipo = 4; x.t = h.t_us; for (int j = 0; j < 3; j++) x.a[j] = v[j] / 16384.0f; in.push_back(x);
        } else if (h.type == rec::T_MAG && n == 8) {
            if (p[6] & 1 || !p[7] || enTx(h.t_us)) continue;
            int16_t v[3]; memcpy(v, p, 6);
            In x; x.tipo = 5; x.t = h.t_us; for (int j = 0; j < 3; j++) x.a[j] = v[j] / (32000.0f / p[7]); in.push_back(x);
        } else if (h.type == rec::T_PVT && n == 92) {
            uint16_t year; memcpy(&year, p + 4, 2);
            const int mo = p[6], dy = p[7], hh = p[8], mi = p[9], ss = p[10];
            int32_t nano, lon, lat, hgt; uint32_t hacc, sacc; int32_t vn, ve, vd;
            memcpy(&nano, p + 16, 4); memcpy(&lon, p + 24, 4); memcpy(&lat, p + 28, 4); memcpy(&hgt, p + 32, 4);
            memcpy(&hacc, p + 40, 4); memcpy(&vn, p + 48, 4); memcpy(&ve, p + 52, 4); memcpy(&vd, p + 56, 4); memcpy(&sacc, p + 68, 4);
            // days_from_civil
            int y = year - (mo <= 2); const int era = (y >= 0 ? y : y - 399) / 400; const unsigned yoe = (unsigned)(y - era * 400);
            const unsigned doy = (153 * (mo + (mo > 2 ? -3 : 9)) + 2) / 5 + dy - 1; const unsigned doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
            const double utc = (double)(era * 146097 + (int)doe - 719468) * 86400.0 + hh * 3600 + mi * 60 + ss + nano * 1e-9;
            In x; x.tipo = 6; x.t = h.t_us;
            x.g.t_us = hayPps ? (int64_t)llround(fa + fb * utc) : h.t_us - 60000;
            x.g.fix = p[20]; x.g.lat_deg = lat * 1e-7; x.g.lon_deg = lon * 1e-7; x.g.h_m = hgt / 1000.0;
            x.g.hacc_m = hacc / 1000.0f; x.g.sacc_mps = sacc / 1000.0f; x.g.vn = vn / 1000.0f; x.g.ve = ve / 1000.0f; x.g.vd = vd / 1000.0f;
            if (x.g.t_us > x.t) x.t = x.g.t_us;
            in.push_back(x);
        } else if (h.type == rec::T_MISSION && n == 16) {
            In x; x.tipo = 7; x.t = h.t_us; x.a[0] = p[12] == 3 ? p[13] : (p[12] == 4 ? 7 : 0); in.push_back(x);
        }
    }
    // BMP581: mediana de 3, como el firmware y ekf.py
    for (size_t i = 0; i < bmpCrudo.size(); i++) {
        In x = bmpCrudo[i];
        if (i > 0 && i + 1 < bmpCrudo.size()) { float a = bmpCrudo[i - 1].a[0], b = bmpCrudo[i].a[0], c = bmpCrudo[i + 1].a[0];
            x.a[0] = std::max(std::min(a, b), std::min(std::max(a, b), c)); x.t = bmpCrudo[i].t; }
        in.push_back(x);
    }
    (void)bmpPrev; (void)bmpN;
    }
    ekf::Config cfg;
    if (!leerCal(argv[2], cfg)) { fprintf(stderr, "calibracion invalida %s\n", argv[2]); return 2; }
    std::stable_sort(in.begin(), in.end(), [](const In &a, const In &b) { return a.t < b.t; });

    ekf::Navegador *nav = new ekf::Navegador();
    nav->configurar(cfg);
    if (argc >= 5) nav->tSuelo((float)atof(argv[4]));
    FILE *fo = fopen(argv[3], "w");
    fprintf(fo, "t_us,qw,qx,qy,qz,pn_m,pe_m,pd_m,vn_mps,ve_mps,vd_mps,bgx_dps,bgy_dps,bgz_dps,bax_g,bay_g,baz_g,b_bmp_m,alt_baro_m,sig_x_deg,sig_y_deg,sig_z_deg,sgx_pct,sgy_pct,sgz_pct,fase,pres_dt_ms\n");
    const double G = 9.80665, DPS = M_PI / 180.0;
    int64_t ultAv = 0, ultOut = 0;
    double presMax = 0;
    for (size_t i = 0; i < in.size(); i++) {
        const In &x = in[i];
        switch (x.tipo) {
        case 0: nav->lsm(x.t, x.a, x.b); break;
        case 1: nav->qmi(x.t, x.a, x.b); break;
        case 2: nav->bmp(x.t, x.a[0], x.a[1]); break;
        case 3: nav->bme(x.t, x.a[0]); break;
        case 4: nav->mmc(x.t, x.a); break;
        case 5: nav->qmc(x.t, x.a); break;
        case 6: nav->gnss(x.g); break;
        case 7: nav->momento(x.t, (uint8_t)x.a[0]); break;
        }
        if (x.t - ultAv >= 5000) {                    // la tarea del cohete corre cada 5 ms
            ultAv = x.t;
            nav->avanzar(x.t);
            const ekf::Estado &e = nav->filtro();
            if (e.listo && e.t_us - ultOut >= 20000) {
                ultOut = e.t_us;
                ekf::Estado pr; nav->presente(x.t, pr); presMax = std::max(presMax, (x.t - pr.t_us) / 1000.0);
                fprintf(fo, "%lld,%.7f,%.7f,%.7f,%.7f,%.4f,%.4f,%.4f,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f,%.6f,%.6f,%.6f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%d,%.1f\n",
                        (long long)e.t_us, (double)e.q[0], (double)e.q[1], (double)e.q[2], (double)e.q[3], (double)e.p[0], (double)e.p[1], (double)e.p[2],
                        (double)e.v[0], (double)e.v[1], (double)e.v[2], e.bg[0] / DPS, e.bg[1] / DPS, e.bg[2] / DPS, e.ba[0] / G, e.ba[1] / G, e.ba[2] / G,
                        (double)e.b_bmp, (double)e.alt_baro_m, e.sd_th[0] / DPS, e.sd_th[1] / DPS, e.sd_th[2] / DPS, 100.0 * e.sg[0], 100.0 * e.sg[1], 100.0 * e.sg[2],
                        e.fase, (x.t - pr.t_us) / 1000.0);
            }
        }
    }
    fclose(fo);
    const ekf::Estado &e = nav->filtro();
    printf("{\"listo\": %s, \"pasos\": %u, \"h_escala\": %.3f, \"presente_max_ms\": %.1f, \"stats\": {", e.listo ? "true" : "false", nav->pasos(), nav->h_escala(), presMax);
    const char *nom[] = {"gnss_pN", "gnss_pE", "gnss_vN", "gnss_vE", "gnss_vD", "bmp", "bme", "mmc", "qmc", "gravedad"};
    for (int m = 0; m < ekf::M_COUNT; m++) { const ekf::Stat &s = nav->stat(m);
        printf("%s\"%s\": [%u, %u, %u, %u]", m ? ", " : "", nom[m], s.ok, s.rej, s.reabre, s.no_terrestre); }
    printf("}}\n");
    delete nav;
    return 0;
}
