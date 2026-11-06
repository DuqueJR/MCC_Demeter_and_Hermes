// ekf_core.cpp - Ver ekf_core.h. Cada bloque dice a que parte de estacion/ekf.py corresponde; las constantes son las mismas.
#include "ekf_core.h"
#include <math.h>
#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace ekf {

static const double G = 9.80665, DPS = M_PI / 180.0, DT = DT_US / 1e6;
static const double DECL_DEG = -8.0;
static const double ACC_SAT_G = 15.0, GYR_SAT_DPS = 1000.0, ACC_DISAGREE_G = 1.0, GYR_DISAGREE_DPS = 30.0;
static const double STILL_S = 1.5, BLOQUE_US = 250000;
static const double W_LSM = 0.8;
static const double Q_GYR = 0.05 * DPS, Q_ACC = 0.03, Q_BG = 0.002 * DPS, Q_BA = 0.0005, Q_BARO = 0.001, Q_SG = 2e-5, SG0 = 0.03;
static const double BME_RESPALDO_US = 0.5e6;
static const double R_BARO_M[2] = {0.5, 1.0};               // bmp, bme
static const double R_MAG_DEG[2] = {4.0, 6.0};              // mmc, qmc
static const int    MAG_PASO = 10, BMP_PASO = 5, BME_PASO = 2;   // MAG_RATE_HZ 10 de 100 Hz; BARO_RATE_HZ 20 de 100 y 40 Hz
static const double MAG_NORM_TOL = 0.05, MAG_DIP_DEG = 32.0, MAG_DIP_TOL_DEG = 8.0;
static const double T_ESTANDAR_C = 15.0;
static const double GATE = 5.0;
static const uint32_t GATE_RUN[3] = {20, 40, 40};           // gnss, baro, mag
static const double GNSS_MAX_HACC_M = 50.0, GNSS_MAX_SACC_MPS = 3.0, GNSS_ORIGEN_HACC_M = 20.0;
static const double GYR_SF = 0.005;
static const double STILL_G = 0.03, STILL_DPS = 5.0; static const int STILL_N = 200;
static const double R_GRAV_RAD = 0.03;
static const double EYECCION_US = 2.0e6;
// FASES de ekf.py: (acel, giro, gnss, baro, mag); negativo = esa medida no se usa en la fase
static const double FASES[F_COUNT][5] = {
    {1.0, 1.0, 1.0, 1.0, 1.0},       // reposo
    {10.0, 1.5, 5.0, 2.0, -1},       // boost
    {1.5, 1.0, 1.0, 1.0, 2.0},       // coast
    {10.0, 4.0, 2.0, -1, -1},        // eyeccion
    {4.0, 3.0, 1.0, 1.5, 2.0},       // paracaidas
    {1.0, 1.0, 1.0, 1.0, 1.0},       // aterrizaje
};
enum { EV_GNSS = 0, EV_BMP, EV_BME, EV_MMC, EV_QMC, EV_MOM };
static const int GR_GNSS = 0, GR_BARO = 1, GR_MAG = 2;

// ---------- algebra ----------
static void qToC(const Real q[4], Real C[3][3]) {
    const Real w = q[0], x = q[1], y = q[2], z = q[3];
    C[0][0] = 1 - 2 * (y * y + z * z); C[0][1] = 2 * (x * y - w * z); C[0][2] = 2 * (x * z + w * y);
    C[1][0] = 2 * (x * y + w * z); C[1][1] = 1 - 2 * (x * x + z * z); C[1][2] = 2 * (y * z - w * x);
    C[2][0] = 2 * (x * z - w * y); C[2][1] = 2 * (y * z + w * x); C[2][2] = 1 - 2 * (x * x + y * y);
}
static void CtoQ(const double C[3][3], Real q[4]) {
    const double t = C[0][0] + C[1][1] + C[2][2];
    double o[4];
    if (t > 0) {
        const double s = sqrt(t + 1) * 2;
        o[0] = 0.25 * s; o[1] = (C[2][1] - C[1][2]) / s; o[2] = (C[0][2] - C[2][0]) / s; o[3] = (C[1][0] - C[0][1]) / s;
    } else {
        int i = 0; if (C[1][1] > C[i][i]) i = 1; if (C[2][2] > C[i][i]) i = 2;
        const int j = (i + 1) % 3, k = (i + 2) % 3;
        const double s = sqrt(1 + C[i][i] - C[j][j] - C[k][k]) * 2;
        o[0] = (C[k][j] - C[j][k]) / s; o[i + 1] = 0.25 * s; o[j + 1] = (C[j][i] + C[i][j]) / s; o[k + 1] = (C[k][i] + C[i][k]) / s;
    }
    for (int i = 0; i < 4; i++) q[i] = (Real)o[i];
}
static void qMulRot(Real q[4], const Real th[3]) {          // q = q * q_rot(th), normalizado
    const Real n = sqrt(th[0] * th[0] + th[1] * th[1] + th[2] * th[2]);
    Real r[4];
    if (n < (Real)1e-9) { r[0] = 1; r[1] = th[0] / 2; r[2] = th[1] / 2; r[3] = th[2] / 2; }
    else { const Real s = sin(n / 2) / n; r[0] = cos(n / 2); r[1] = th[0] * s; r[2] = th[1] * s; r[3] = th[2] * s; }
    const Real a0 = q[0], a1 = q[1], a2 = q[2], a3 = q[3];
    q[0] = a0 * r[0] - a1 * r[1] - a2 * r[2] - a3 * r[3];
    q[1] = a0 * r[1] + a1 * r[0] + a2 * r[3] - a3 * r[2];
    q[2] = a0 * r[2] - a1 * r[3] + a2 * r[0] + a3 * r[1];
    q[3] = a0 * r[3] + a1 * r[2] - a2 * r[1] + a3 * r[0];
    const Real m = sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
    for (int i = 0; i < 4; i++) q[i] /= m;
}
template <typename A, typename B> static inline double dot3(const A *a, const B *b) { return (double)a[0] * b[0] + (double)a[1] * b[1] + (double)a[2] * b[2]; }
template <typename A> static inline double nrm3(const A *a) { return sqrt(dot3(a, a)); }

void configNominal(Config &c) {
    memset(&c, 0, sizeof(c));
    const double R[3][3] = {{0, 1, 0}, {0, 0, -1}, {-1, 0, 0}};     // calib.LSM_NOMINAL
    const double Rq[3][3] = {{0, 1, 0}, {0, 0, 1}, {1, 0, 0}};      // el QMI: y y z del cuerpo al reves que el LSM (calibraciones de ambos cohetes)
    c.lsm.ok = c.qmi.ok = true;
    memcpy(c.lsm.R, R, sizeof(R)); memcpy(c.qmi.R, Rq, sizeof(Rq));
    for (int i = 0; i < 3; i++) { c.lsm.escala[i] = c.qmi.escala[i] = 1.0; c.qmi_ganancia[i] = 1.0; }
    c.qmi_retraso_ms = 42.0;
}

// ---------- Navegador ----------
Navegador::Navegador() { Config c; configNominal(c); configurar(c); tSuelo_ = NAN; }

void Navegador::configurar(const Config &c) { cfg_ = c; reiniciar(); nl_ = nq_ = 0; il_ = iq_ = 0;
    bmpAc_ = 0; bmpN_ = 0; bmpI_ = 0; bmeAc_ = 0; bmeN_ = 0; bmeI_ = 0; mmcI_ = qmcI_ = 0; }

void Navegador::tSuelo(float c) { tSuelo_ = c; }

void Navegador::reiniciar() {
    memset(&e_, 0, sizeof(e_));
    e_.q[0] = 1;
    memset(st_, 0, sizeof(st_));
    memset(Pm_, 0, sizeof(Pm_));
    nev_ = 0; nbl_ = 0; blIni_ = INT64_MIN; buscando_ = true;
    for (int i = 0; i < 7; i++) memset(&bl6_[i], 0, sizeof(Bloque));
    t0_ = tk_ = 0; ultBmp_ = INT64_MIN / 2; tPar_ = INT64_MIN; pasos_ = 0; momento_ = 0; fase_ = F_REPOSO;
    stillN_ = 0; ultGrav_ = -1; hayLp_ = false;
    memset(bl_, 0, sizeof(bl_)); memset(bq_, 0, sizeof(bq_));
    ref_bmp_ = ref_bme_ = NAN; hEsc_ = (T_ESTANDAR_C + 273.15) / 0.0065;
    modo_ = 0; arranque_ = A_NINGUNO; gap_ = 0; accN_ = 0; accT0_ = INT64_MIN; hayMb_ = 0; ultPa_ = 0;
    memset(accA_, 0, sizeof(accA_)); memset(accW_, 0, sizeof(accW_));
}

void Navegador::aCuerpo(const ImuCal &c, const float a[3], const float w[3], float ab[3], float wb[3], bool qmi) const {   // to_body
    double u[3];
    for (int i = 0; i < 3; i++) u[i] = (a[i] - c.sesgo[i]) / c.escala[i];
    for (int i = 0; i < 3; i++) {
        ab[i] = (float)(c.R[i][0] * u[0] + c.R[i][1] * u[1] + c.R[i][2] * u[2]);
        wb[i] = (float)(c.R[i][0] * w[0] + c.R[i][1] * w[1] + c.R[i][2] * w[2]);
        if (qmi) wb[i] = (float)(wb[i] / cfg_.qmi_ganancia[i]);
    }
}

void Navegador::magCuerpo(const MagCal &c, const float m[3], float mb[3]) const {     // mag_body: R A (m - centro)
    double d[3], u[3];
    for (int i = 0; i < 3; i++) d[i] = m[i] - c.centro[i];
    for (int i = 0; i < 3; i++) u[i] = c.A[i][0] * d[0] + c.A[i][1] * d[1] + c.A[i][2] * d[2];
    for (int i = 0; i < 3; i++) mb[i] = (float)(c.R[i][0] * u[0] + c.R[i][1] * u[1] + c.R[i][2] * u[2]);
}

// ---------- entradas ----------
// Grupos como ekf.py: con j el indice de la muestra, se emite en j = paso, 2 pasos, ... la media de j - paso + 1 .. j (la 0 no entra)
void Navegador::grupo(uint32_t &j, float &ac, int &n, int paso, float v, int64_t t, uint8_t tipo) {
    const uint32_t i = j++;
    if (i % paso == 1 % paso) { ac = 0; n = 0; }
    ac += v; n++;
    if (i % paso == 0 && i > 0) { Ev e; e.t = t; e.tipo = tipo; e.v[0] = ac / n; push(e); }
}

void Navegador::lsm(int64_t t, const float a[3], const float w[3]) {
    Imu s; s.t = t;
    aCuerpo(cfg_.lsm, a, w, s.a, s.w, false);
    l_[nl_ % NL] = s; nl_++;
    if (buscando_) bloqueReposo(t, s.a, s.w);
    else if (modo_) enVuelo(t, s.a, s.w);
}

void Navegador::qmi(int64_t t, const float a[3], const float w[3]) {
    Imu s; s.t = t - (int64_t)llround(cfg_.qmi_retraso_ms * 1000.0);
    aCuerpo(cfg_.qmi, a, w, s.a, s.w, true);
    q_[nq_ % NQ] = s; nq_++;
    if (buscando_ && blIni_ != INT64_MIN && s.t >= blIni_) {          // sesgo del giro del QMI en el reposo
        const int64_t b = (s.t - blIni_) / (int64_t)BLOQUE_US;
        Bloque &k = bl6_[b % 7];
        if (k.t1 >= 0 && (k.t1 - blIni_) / (int64_t)BLOQUE_US == b) { for (int i = 0; i < 3; i++) k.sgq[i] += s.w[i]; k.nq++; }
    }
}

// Bloque del reposo que contiene t, si existe (para las medidas lentas)
#define BLOQUE_DE(t, k) Bloque *k = nullptr; \
    if (buscando_ && blIni_ != INT64_MIN && (t) >= blIni_) { const int64_t b_ = ((t) - blIni_) / (int64_t)BLOQUE_US; Bloque &x_ = bl6_[b_ % 7]; \
        if (x_.n && (x_.t1 - blIni_) / (int64_t)BLOQUE_US == b_) k = &x_; }

void Navegador::bmp(int64_t t, float pa, float tc) {
    if (ref_bmp_ != ref_bmp_) ref_bmp_ = pa;                       // sin reposo: la primera
    ultPa_ = pa;
    BLOQUE_DE(t, k); if (k) { k->sb += pa; k->nb++; k->st += tc; k->nt++; }
    grupo(bmpI_, bmpAc_, bmpN_, BMP_PASO, pa, t, EV_BMP);
}

void Navegador::bme(int64_t t, float pa) {
    if (ref_bme_ != ref_bme_) ref_bme_ = pa;
    BLOQUE_DE(t, k); if (k) { k->se += pa; k->ne++; }
    grupo(bmeI_, bmeAc_, bmeN_, BME_PASO, pa, t, EV_BME);
}

void Navegador::mmc(int64_t t, const float m[3]) {
    if (!cfg_.mmc.ok) return;
    float mb[3]; magCuerpo(cfg_.mmc, m, mb);
    BLOQUE_DE(t, k); if (k) { for (int i = 0; i < 3; i++) k->sm[i] += mb[i]; k->nm++; }
    memcpy(ultMb_, mb, sizeof(mb)); hayMb_ = 2;
    if (mmcI_++ % MAG_PASO == 0) { Ev e; e.t = t; e.tipo = EV_MMC; memcpy(e.v, mb, sizeof(mb)); push(e); }
}

void Navegador::qmc(int64_t t, const float m[3]) {
    if (!cfg_.qmc.ok) return;
    float mb[3]; magCuerpo(cfg_.qmc, m, mb);
    BLOQUE_DE(t, k); if (k) { for (int i = 0; i < 3; i++) k->sqm[i] += mb[i]; k->nqm++; }
    if (hayMb_ != 2 || !cfg_.mmc.ok) { memcpy(ultMb_, mb, sizeof(mb)); hayMb_ = 1; }
    if (qmcI_++ % MAG_PASO == 0) { Ev e; e.t = t; e.tipo = EV_QMC; memcpy(e.v, mb, sizeof(mb)); push(e); }
}

static const int NG = 8;
static Gnss s_gn[NG];
static uint16_t s_ngn = 0;

void Navegador::gnss(const Gnss &g) {
    if (g.fix < 3) return;
    const uint16_t i = s_ngn++ % NG;
    s_gn[i] = g;
    Ev e; e.t = g.t_us; e.tipo = EV_GNSS; e.i = i; push(e);
}

void Navegador::momento(int64_t t, uint8_t m) { Ev e; e.t = t; e.tipo = EV_MOM; e.v[0] = m; e.i = m; push(e); }

// Cola ordenada por tiempo. Antes de arrancar solo interesan los momentos; despues, lo posterior a t0 (como ekf.py)
void Navegador::push(const Ev &e) {
    if (e.tipo != EV_MOM && (!e_.listo || e.t <= t0_)) return;
    if (nev_ >= NE) return;
    int i = nev_++;
    while (i > 0 && ev_[i - 1].t > e.t) { ev_[i] = ev_[i - 1]; i--; }
    ev_[i] = e;
}

// ---------- reposo inicial (find_still) ----------
void Navegador::bloqueReposo(int64_t t, const float ab[3], const float wb[3]) {
    if (blIni_ == INT64_MIN) blIni_ = t;
    const int64_t b = (t - blIni_) / (int64_t)BLOQUE_US;
    Bloque &k = bl6_[b % 7];
    if (!k.n || (k.t1 - blIni_) / (int64_t)BLOQUE_US != b) {
        // empieza el bloque b: la ventana b-6 .. b-1 esta completa
        if (b >= 6) {
            bool ok = true; uint32_t n = 0; double sa[3] = {0, 0, 0}, qa[3] = {0, 0, 0}, sg[3] = {0, 0, 0}, qg[3] = {0, 0, 0};
            int64_t tfin = 0, tini = 0;
            for (int64_t j = b - 6; j < b && ok; j++) {
                const Bloque &x = bl6_[j % 7];
                if (!x.n || (x.t1 - blIni_) / (int64_t)BLOQUE_US != j) { ok = false; break; }
                n += x.n; for (int i = 0; i < 3; i++) { sa[i] += x.sa[i]; qa[i] += x.qa[i]; sg[i] += x.sg[i]; qg[i] += x.qg[i]; }
                if (j == b - 6) tini = x.t1;
                tfin = x.t2;
            }
            if (ok && n > 100) {
                double sdA = 0, sdG = 0;
                for (int i = 0; i < 3; i++) {
                    const double ma = sa[i] / n, mg = sg[i] / n;
                    const double va = qa[i] / n - ma * ma, vg = qg[i] / n - mg * mg;
                    sdA = fmax(sdA, sqrt(va > 0 ? va : 0)); sdG = fmax(sdG, sqrt(vg > 0 ? vg : 0));
                }
                if (sdA < 0.02 && sdG < 3.0) {
                    // medias de la ventana para arrancar
                    double f0[3], gb[3], gq[3] = {0, 0, 0}, mm[3] = {0, 0, 0}, mq[3] = {0, 0, 0}, pb = 0, pe = 0, tc = 0;
                    uint32_t nq = 0, nm = 0, nqm = 0, nb = 0, ne = 0, nt = 0;
                    for (int i = 0; i < 3; i++) { f0[i] = sa[i] / n; gb[i] = sg[i] / n; }
                    for (int64_t j = b - 6; j < b; j++) {
                        const Bloque &x = bl6_[j % 7];
                        for (int i = 0; i < 3; i++) { gq[i] += x.sgq[i]; mm[i] += x.sm[i]; mq[i] += x.sqm[i]; }
                        nq += x.nq; nm += x.nm; nqm += x.nqm; pb += x.sb; nb += x.nb; pe += x.se; ne += x.ne; tc += x.st; nt += x.nt;
                    }
                    for (int i = 0; i < 3; i++) { bl_[i] = (Real)gb[i]; bq_[i] = (Real)(nq ? gq[i] / nq : gb[i]); }
                    if (nb) ref_bmp_ = pb / nb;
                    if (ne) ref_bme_ = pe / ne;
                    const double ts = tSuelo_ == tSuelo_ ? tSuelo_ : (nt ? tc / nt : T_ESTANDAR_C);
                    hEsc_ = (ts + 273.15) / 0.0065;
                    // actitud inicial con gravedad y campo (MMC si hay, si no QMC; sin magnetometro, guinada con la marca)
                    double down[3]; const double nf = nrm3(f0);
                    for (int i = 0; i < 3; i++) down[i] = -f0[i] / nf;
                    double m0[3]; bool hayM = true;
                    if (nm) for (int i = 0; i < 3; i++) m0[i] = mm[i] / nm;
                    else if (nqm) for (int i = 0; i < 3; i++) m0[i] = mq[i] / nqm;
                    else hayM = false;
                    actitud(down, hayM ? m0 : nullptr);
                    (void)tini;
                    static const double SD_REPOSO[NX] = {2 * DPS, 2 * DPS, 10 * DPS, 5, 5, 5, 0.5, 0.5, 0.5, 0.2 * DPS, 0.2 * DPS, 0.2 * DPS, 0.2, 0.2, 0.2, SG0, SG0, SG0, 0.05};
                    arrancar(tfin, SD_REPOSO, false);
                    arranque_ = A_REPOSO;
                    return;
                }
            }
        }
        memset(&k, 0, sizeof(k));
        k.t1 = t;
    }
    k.t2 = t; k.n++;
    for (int i = 0; i < 3; i++) { k.sa[i] += ab[i]; k.qa[i] += (double)ab[i] * ab[i]; k.sg[i] += wb[i]; k.qg[i] += (double)wb[i] * wb[i]; }
}

// e_.q con la vertical (down, en cuerpo) y el campo (m0, en cuerpo; null: la guinada la da la marca, -Z del cuerpo)
void Navegador::actitud(const double down[3], const double *m0in) {
    const double marca[3] = {0, 0, -1};
    const double *m0 = m0in ? m0in : marca;
    const double md = dot3(m0, down);
    double north[3]; for (int i = 0; i < 3; i++) north[i] = m0[i] - md * down[i];
    double nn = nrm3(north);
    if (nn < 1e-6) { const double x[3] = {1, 0, 0}; const double xd = dot3(x, down); for (int i = 0; i < 3; i++) north[i] = x[i] - xd * down[i]; nn = nrm3(north); }
    if (nn < 1e-6) { const double y[3] = {0, 1, 0}; const double yd = dot3(y, down); for (int i = 0; i < 3; i++) north[i] = y[i] - yd * down[i]; nn = nrm3(north); }
    for (int i = 0; i < 3; i++) north[i] /= nn;
    double east[3] = {down[1] * north[2] - down[2] * north[1], down[2] * north[0] - down[0] * north[2], down[0] * north[1] - down[1] * north[0]};
    const double dc = m0in ? DECL_DEG * DPS : 0.0;
    double Cm[3][3], C0[3][3];
    for (int i = 0; i < 3; i++) { Cm[0][i] = north[i]; Cm[1][i] = east[i]; Cm[2][i] = down[i]; }
    const double Rz[3][3] = {{cos(dc), -sin(dc), 0}, {sin(dc), cos(dc), 0}, {0, 0, 1}};
    for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) C0[i][j] = Rz[i][0] * Cm[0][j] + Rz[i][1] * Cm[1][j] + Rz[i][2] * Cm[2][j];
    CtoQ(C0, e_.q);
}

// ---------- reinicio en vuelo ----------
void Navegador::foto(const Estado &s, Foto &f) const {
    memset(&f, 0, sizeof(f));
    for (int i = 0; i < 4; i++) f.q[i] = (float)s.q[i];
    for (int i = 0; i < 3; i++) {
        f.v[i] = (float)s.v[i]; f.p[i] = (float)s.p[i]; f.bg[i] = (float)s.bg[i]; f.ba[i] = (float)s.ba[i]; f.sg[i] = (float)s.sg[i];
        f.bl[i] = (float)bl_[i]; f.bq[i] = (float)bq_[i];
        f.f_g[i] = (float)s.f_g[i]; f.w_dps[i] = (float)s.w_dps[i];
    }
    f.b_bmp = (float)s.b_bmp;
    f.lat0 = s.lat0; f.lon0 = s.lon0; f.h0 = s.h0; f.hayOrigen = s.hayOrigen ? 1 : 0;
    f.ref_bmp = ref_bmp_; f.ref_bme = ref_bme_; f.hEsc = hEsc_;
}

void Navegador::reanudar(const Foto *f, float gap_s, float p0_bmp, float p0_bme) {
    reiniciar();
    buscando_ = false;
    gap_ = gap_s < 0 ? 0 : gap_s;
    if (f) { foto_ = *f; modo_ = 1; return; }
    modo_ = 2;
    if (p0_bmp > 0) ref_bmp_ = p0_bmp;
    if (p0_bme > 0) ref_bme_ = p0_bme;
    hEsc_ = ((tSuelo_ == tSuelo_ ? tSuelo_ : T_ESTANDAR_C) + 273.15) / 0.0065;
}

void Navegador::enVuelo(int64_t t, const float ab[3], const float wb[3]) {
    if (modo_ == 1) {                                     // con foto: sigue desde ella, ya
        const Foto &f = foto_;
        const double g = fmin((double)gap_, 10.0);
        // el tiempo sin datos se proyecta con el ultimo giro (el alabeo de las aletas es casi constante) y la ultima aceleracion
        // (a lo sumo 2 s: despues se mantiene la velocidad), y lo que no se sabe queda en la incertidumbre
        for (int i = 0; i < 4; i++) e_.q[i] = (Real)f.q[i];
        Real C[3][3]; qToC(e_.q, C);
        const double ga = fmin(g, 2.0), gr = fmin(g, 3.0);
        double a[3];
        for (int i = 0; i < 3; i++) a[i] = (C[i][0] * f.f_g[0] + C[i][1] * f.f_g[1] + C[i][2] * f.f_g[2]) * G;
        a[2] += G;
        const Real th[3] = {(Real)(f.w_dps[0] * DPS * gr), (Real)(f.w_dps[1] * DPS * gr), (Real)(f.w_dps[2] * DPS * gr)};
        qMulRot(e_.q, th);
        for (int i = 0; i < 3; i++) {
            e_.v[i] = (Real)(f.v[i] + a[i] * ga);
            e_.p[i] = (Real)(f.p[i] + f.v[i] * g + 0.5 * a[i] * ga * ga + a[i] * ga * (g - ga));
            e_.bg[i] = (Real)f.bg[i]; e_.ba[i] = (Real)f.ba[i]; e_.sg[i] = (Real)f.sg[i];
            bl_[i] = (Real)f.bl[i]; bq_[i] = (Real)f.bq[i];
        }
        e_.b_bmp = (Real)f.b_bmp;
        e_.lat0 = f.lat0; e_.lon0 = f.lon0; e_.h0 = f.h0; e_.hayOrigen = f.hayOrigen != 0;
        ref_bmp_ = f.ref_bmp; ref_bme_ = f.ref_bme; hEsc_ = f.hEsc;
        // la incertidumbre crece con el tiempo sin datos (el empuje puede cambiar la velocidad 100 m/s en 1 s)
        const double wn = sqrt((double)f.w_dps[0] * f.w_dps[0] + (double)f.w_dps[1] * f.w_dps[1] + (double)f.w_dps[2] * f.w_dps[2]);
        const double sth = fmin(2.0 + 20.0 * g + 0.1 * wn * gr, 45.0) * DPS, sv = fmin(3.0 + 30.0 * g, 150.0), sp = fmin(5.0 + 20.0 * g + 15.0 * g * g, 500.0);
        const double sd[NX] = {sth, sth, sth, sp, sp, sp, sv, sv, sv, 0.5 * DPS, 0.5 * DPS, 0.5 * DPS, 0.3, 0.3, 0.3, SG0, SG0, SG0, 0.5};
        arrancar(t, sd, true);
        arranque_ = A_FOTO;
        return;
    }
    // sin foto: 0.5 s de IMU
    if (accT0_ == INT64_MIN) accT0_ = t;
    for (int i = 0; i < 3; i++) { accA_[i] += ab[i]; accW_[i] += wb[i]; }
    accN_++;
    if (t - accT0_ < 500000 || accN_ < 50) return;
    double f0[3], w0[3];
    for (int i = 0; i < 3; i++) { f0[i] = accA_[i] / accN_; w0[i] = accW_[i] / accN_; }
    const double nf = nrm3(f0);
    const bool grav = fabs(nf - 1.0) < 0.25 && nrm3(w0) < 60.0;    // ~1 g sin girar rapido: la gravedad (paracaidas, suelo)
    double down[3];
    if (grav) for (int i = 0; i < 3; i++) down[i] = -f0[i] / nf;
    else { down[0] = -1; down[1] = 0; down[2] = 0; }              // empuje o inercia: la nariz (X del cuerpo) hacia arriba
    double m0[3];
    if (hayMb_) for (int i = 0; i < 3; i++) m0[i] = ultMb_[i];
    actitud(down, hayMb_ ? m0 : nullptr);
    memset(bl_, 0, sizeof(bl_)); memset(bq_, 0, sizeof(bq_));     // el sesgo del giro no se conoce: lo estima el filtro
    const double sti = (grav ? 15.0 : 30.0) * DPS, sru = (hayMb_ ? 20.0 : 90.0) * DPS, sv = grav ? 20.0 : 100.0;
    const double sd[NX] = {sti, sti, sru, 100, 100, 300, sv, sv, sv, 3 * DPS, 3 * DPS, 3 * DPS, 0.5, 0.5, 0.5, SG0, SG0, SG0, 2.0};
    arrancar(t, sd, false);
    if (ultPa_ > 0 && ref_bmp_ == ref_bmp_) e_.p[2] = (Real)(-hEsc_ * (1.0 - pow(ultPa_ / ref_bmp_, 0.190263)));   // la altura del BMP, ya
    arranque_ = grav ? A_VUELO_GRAVEDAD : A_VUELO_NARIZ;
}

void Navegador::arrancar(int64_t t0, const double s[NX], bool conservar) {
    buscando_ = false; modo_ = 0;
    t0_ = tk_ = t0;
    memset(Pm_, 0, sizeof(Pm_));
    for (int i = 0; i < NX; i++) Pm_[i][i] = (Real)(s[i] * s[i]);
    if (!conservar) {
        memset(e_.p, 0, sizeof(e_.p)); memset(e_.v, 0, sizeof(e_.v)); memset(e_.bg, 0, sizeof(e_.bg)); memset(e_.ba, 0, sizeof(e_.ba));
        memset(e_.sg, 0, sizeof(e_.sg)); e_.b_bmp = 0; e_.hayOrigen = false;
    }
    e_.listo = true; e_.t_us = t0;
    // eventos de antes del arranque fuera (los momentos quedan)
    int k = 0; for (int i = 0; i < nev_; i++) if (ev_[i].tipo == EV_MOM || ev_[i].t > t0) ev_[k++] = ev_[i];
    nev_ = k;
    // el filtro consume el IMU desde t0
    if (nl_ - il_ > NL) il_ = nl_ - NL;
    while (il_ < nl_ && l_[il_ % NL].t < t0) il_++;
    if (nq_ - iq_ > NQ) iq_ = nq_ - NQ;
    while (iq_ < nq_ && q_[iq_ % NQ].t < t0) iq_++;
}

// ---------- IMU virtual de un paso [ta, tb) (bin_steps y el bloque de navigate) ----------
bool Navegador::imuPaso(int64_t ta, int64_t tb, int64_t &il, int64_t &iq, Real f[3], Real w[3], bool &okF) const {
    Real la[3] = {0, 0, 0}, lg[3] = {0, 0, 0}, qa[3] = {0, 0, 0}, qg[3] = {0, 0, 0};   // Real: en la S3, double es por software
    int nl = 0, nq = 0;
    if (nl_ - il > NL) il = nl_ - NL;
    while (il < nl_ && l_[il % NL].t < tb) { const Imu &s = l_[il % NL]; if (s.t >= ta) { for (int i = 0; i < 3; i++) { la[i] += s.a[i]; lg[i] += s.w[i]; } nl++; } il++; }
    if (nq_ - iq > NQ) iq = nq_ - NQ;
    while (iq < nq_ && q_[iq % NQ].t < tb) { const Imu &s = q_[iq % NQ]; if (s.t >= ta) { for (int i = 0; i < 3; i++) { qa[i] += s.a[i]; qg[i] += s.w[i]; } nq++; } iq++; }
    for (int i = 0; i < 3; i++) {
        if (nl) { la[i] /= nl; lg[i] = lg[i] / nl - bl_[i]; }
        if (nq) { qa[i] /= nq; qg[i] = qg[i] / nq - bq_[i]; }
    }
    bool useL = nl > 0, useQ = nq > 0;
    if (useL && useQ) {
        Real da = 0, dg = 0, amax = 0, gmax = 0;
        for (int i = 0; i < 3; i++) { da += (la[i] - qa[i]) * (la[i] - qa[i]); dg += (lg[i] - qg[i]) * (lg[i] - qg[i]); amax = fmax(amax, fabs(qa[i])); gmax = fmax(gmax, fabs(qg[i])); }
        if (amax > (Real)ACC_SAT_G || gmax > (Real)GYR_SAT_DPS || da > (Real)(ACC_DISAGREE_G * ACC_DISAGREE_G) || dg > (Real)(GYR_DISAGREE_DPS * GYR_DISAGREE_DPS)) useQ = false;
    }
    okF = useL || useQ;
    if (!okF) return false;
    for (int i = 0; i < 3; i++) {
        if (useL && useQ) { f[i] = (Real)W_LSM * la[i] + (Real)(1 - W_LSM) * qa[i]; w[i] = (Real)W_LSM * lg[i] + (Real)(1 - W_LSM) * qg[i]; }
        else if (useL) { f[i] = (Real)la[i]; w[i] = (Real)lg[i]; }
        else { f[i] = (Real)qa[i]; w[i] = (Real)qg[i]; }
    }
    return true;
}

// ---------- prediccion (Ekf.predict) ----------
void Navegador::propagarMedia(Estado &s, const Real w0[3], const Real f0[3]) const {
    Real w[3], f[3], C[3][3];
    for (int i = 0; i < 3; i++) { w[i] = (w0[i] - s.bg[i]) / (1 + s.sg[i]); f[i] = f0[i] - s.ba[i]; }
    qToC(s.q, C);
    Real a[3];
    for (int i = 0; i < 3; i++) a[i] = C[i][0] * f[0] + C[i][1] * f[1] + C[i][2] * f[2];
    a[2] += (Real)G;
    for (int i = 0; i < 3; i++) { s.p[i] += s.v[i] * (Real)DT + (Real)0.5 * a[i] * (Real)(DT * DT); s.v[i] += a[i] * (Real)DT; }
    Real th[3] = {w[0] * (Real)DT, w[1] * (Real)DT, w[2] * (Real)DT};
    qMulRot(s.q, th);
}

void Navegador::predecir(const Real w0[3], const Real f0[3], Real qa, Real qg) {
    Real w[3], f[3], C[3][3];
    for (int i = 0; i < 3; i++) { w[i] = (w0[i] - e_.bg[i]) / (1 + e_.sg[i]); f[i] = f0[i] - e_.ba[i]; }
    qToC(e_.q, C);
    propagarMedia(e_, w0, f0);
    // F = I + D, D disperso: P <- (I + D) P (I + D)^T
    struct Nz { uint8_t i, j; Real v; };
    Nz d[48]; int nd = 0;
    const Real dt = (Real)DT;
    const Real S[3][3] = {{0, -w[2], w[1]}, {w[2], 0, -w[0]}, {-w[1], w[0], 0}};
    for (int a = 0; a < 3; a++) for (int b = 0; b < 3; b++) if (a != b) { d[nd].i = TH + a; d[nd].j = TH + b; d[nd].v = -S[a][b] * dt; nd++; }
    for (int a = 0; a < 3; a++) { d[nd].i = TH + a; d[nd].j = BG + a; d[nd].v = -dt; nd++; }
    for (int a = 0; a < 3; a++) { d[nd].i = TH + a; d[nd].j = SG + a; d[nd].v = -w[a] * dt; nd++; }
    for (int a = 0; a < 3; a++) { d[nd].i = P + a; d[nd].j = V + a; d[nd].v = dt; nd++; }
    const Real Sf[3][3] = {{0, -f[2], f[1]}, {f[2], 0, -f[0]}, {-f[1], f[0], 0}};
    for (int a = 0; a < 3; a++) for (int b = 0; b < 3; b++) {
        const Real m = C[a][0] * Sf[0][b] + C[a][1] * Sf[1][b] + C[a][2] * Sf[2][b];
        d[nd].i = V + a; d[nd].j = TH + b; d[nd].v = -m * dt; nd++;
    }
    for (int a = 0; a < 3; a++) for (int b = 0; b < 3; b++) { d[nd].i = V + a; d[nd].j = BA + b; d[nd].v = -C[a][b] * dt; nd++; }
    static Real A[NX][NX];
    memcpy(A, Pm_, sizeof(A));
    for (int k = 0; k < nd; k++) { const Real v = d[k].v; const Real *src = Pm_[d[k].j]; Real *dst = A[d[k].i]; for (int c = 0; c < NX; c++) dst[c] += v * src[c]; }
    memcpy(Pm_, A, sizeof(A));
    for (int k = 0; k < nd; k++) { const Real v = d[k].v; const int i = d[k].i, j = d[k].j; for (int r = 0; r < NX; r++) Pm_[r][i] += v * A[r][j]; }
    // ruido de proceso
    const Real wn = (Real)nrm3(w);
    Real qd[NX];
    for (int i = 0; i < 3; i++) {
        qd[TH + i] = (Real)(Q_GYR * Q_GYR) * qg * qg + (Real)(GYR_SF * GYR_SF) * wn * wn;
        qd[P + i] = 0; qd[V + i] = (Real)(Q_ACC * Q_ACC) * qa * qa;
        qd[BG + i] = (Real)(Q_BG * Q_BG); qd[BA + i] = (Real)(Q_BA * Q_BA); qd[SG + i] = (Real)(Q_SG * Q_SG);
    }
    qd[B_BMP] = (Real)(Q_BARO * Q_BARO);
    for (int i = 0; i < NX; i++) Pm_[i][i] += qd[i] * dt;
}

// ---------- medidas (Ekf.update) ----------
void Navegador::inyectar(const Real dx[NX]) {
    qMulRot(e_.q, dx + TH);
    for (int i = 0; i < 3; i++) { e_.p[i] += dx[P + i]; e_.v[i] += dx[V + i]; e_.bg[i] += dx[BG + i]; e_.ba[i] += dx[BA + i]; e_.sg[i] += dx[SG + i]; }
    e_.b_bmp += dx[B_BMP];
}

void Navegador::actualizar(int m, const Real H[NX], Real y, Real r, int grupo) {
    Stat &s = st_[m];
    Real PH[NX];
    for (int i = 0; i < NX; i++) { Real a = 0; for (int j = 0; j < NX; j++) if (H[j] != 0) a += Pm_[i][j] * H[j]; PH[i] = a; }
    Real S = r * r; for (int j = 0; j < NX; j++) S += H[j] * PH[j];
    if (y * y > (Real)(GATE * GATE) * S) {
        s.rej++; s.run++;
        if (s.run < GATE_RUN[grupo]) return;
        int im = 0; for (int j = 1; j < NX; j++) if (fabs(H[j]) > fabs(H[im])) im = j;   // la referencia lleva tiempo diciendo otra cosa
        Pm_[im][im] += y * y / (H[im] * H[im]);
        s.reabre++;
        for (int i = 0; i < NX; i++) { Real a = 0; for (int j = 0; j < NX; j++) if (H[j] != 0) a += Pm_[i][j] * H[j]; PH[i] = a; }
        S = r * r; for (int j = 0; j < NX; j++) S += H[j] * PH[j];
    }
    s.ok++; s.run = 0; s.e2 += (double)y * y;
    Real K[NX], dx[NX];
    for (int i = 0; i < NX; i++) { K[i] = PH[i] / S; dx[i] = K[i] * y; }
    for (int i = 0; i < NX; i++) for (int j = 0; j < NX; j++) Pm_[i][j] -= K[i] * PH[j];
    for (int i = 0; i < NX; i++) for (int j = i + 1; j < NX; j++) { const Real a = (Real)0.5 * (Pm_[i][j] + Pm_[j][i]); Pm_[i][j] = Pm_[j][i] = a; }
    inyectar(dx);
}

void Navegador::baro(int m, float pa) {
    const double k = FASES[fase_][3];
    if (k < 0) return;
    const double ref = m == M_BMP ? ref_bmp_ : ref_bme_;
    if (ref != ref) return;
    const double alt = hEsc_ * (1.0 - pow(pa / ref, 0.190263));
    Real H[NX] = {0}; H[P + 2] = -1; H[B_BMP] = 1;          // el BME280 de respaldo usa el sesgo del BMP581
    actualizar(m, H, (Real)(alt - (-e_.p[2] + e_.b_bmp)), (Real)(R_BARO_M[m == M_BMP ? 0 : 1] * k), GR_BARO);
}

void Navegador::rumbo(int m, const float mb[3], double radio) {
    const double k = FASES[fase_][4];
    if (k < 0) return;
    Real C[3][3]; qToC(e_.q, C);
    double mn[3]; for (int i = 0; i < 3; i++) mn[i] = C[i][0] * mb[0] + C[i][1] * mb[1] + C[i][2] * mb[2];
    const double nm = nrm3(mb);
    const double dip = asin(fmax(-1.0, fmin(1.0, mn[2] / nm))) / DPS;
    if (fabs(nm / radio - 1) > MAG_NORM_TOL || fabs(dip - MAG_DIP_DEG) > MAG_DIP_TOL_DEG) { st_[m].no_terrestre++; return; }
    if (hypot(mn[0], mn[1]) < 0.3 * nm) return;                 // campo casi vertical: el rumbo no se puede medir
    double y = DECL_DEG * DPS - atan2(mn[1], mn[0]);
    y = fmod(y + M_PI, 2 * M_PI); if (y < 0) y += 2 * M_PI; y -= M_PI;
    Real H[NX] = {0}; for (int i = 0; i < 3; i++) H[TH + i] = C[2][i];
    actualizar(m, H, (Real)y, (Real)(R_MAG_DEG[m == M_MMC ? 0 : 1] * DPS * k), GR_MAG);
}

void Navegador::gravedad(const Real f[3]) {
    for (int eje = 0; eje < 2; eje++) {
        Real C[3][3]; qToC(e_.q, C);
        const double nf = nrm3(f);
        double fn[3]; for (int i = 0; i < 3; i++) fn[i] = (C[i][0] * f[0] + C[i][1] * f[1] + C[i][2] * f[2]) / nf;
        Real H[NX] = {0};
        for (int i = 0; i < 3; i++) H[TH + i] = eje == 0 ? -C[1][i] : C[0][i];
        actualizar(M_GRAV, H, (Real)(eje == 0 ? -fn[0] : -fn[1]), (Real)R_GRAV_RAD, GR_MAG);
    }
}

void Navegador::evento(const Ev &e, int64_t tk) {
    switch (e.tipo) {
    case EV_GNSS: {
        const Gnss &r = s_gn[e.i];
        if (r.hacc_m > GNSS_MAX_HACC_M || r.sacc_mps > GNSS_MAX_SACC_MPS) return;
        if (!e_.hayOrigen) {
            if (r.hacc_m > GNSS_ORIGEN_HACC_M) return;
            e_.lat0 = r.lat_deg; e_.lon0 = r.lon_deg; e_.h0 = r.h_m; e_.hayOrigen = true;
        }
        const double k = FASES[fase_][2];
        if (k < 0) return;
        const double rad = M_PI / 180.0, Rn = 6378137.0 + e_.h0;
        const double ned[2] = {(r.lat_deg - e_.lat0) * rad * Rn, (r.lon_deg - e_.lon0) * rad * Rn * cos(e_.lat0 * rad)};
        const float vel[3] = {r.vn, r.ve, r.vd};
        for (int i = 0; i < 2; i++) {
            Real H[NX] = {0}; H[P + i] = 1;
            actualizar(M_GNSS_PN + i, H, (Real)(ned[i] - e_.p[i]), (Real)(fmax(r.hacc_m, 0.3) * k), GR_GNSS);
        }
        for (int i = 0; i < 3; i++) {
            Real H[NX] = {0}; H[V + i] = 1;
            actualizar(M_GNSS_VN + i, H, (Real)(vel[i] - e_.v[i]), (Real)(fmax(r.sacc_mps, 0.05) * k), GR_GNSS);
        }
        break;
    }
    case EV_BMP: ultBmp_ = tk; baro(M_BMP, e.v[0]); break;
    case EV_BME: if (tk - ultBmp_ > (int64_t)BME_RESPALDO_US) baro(M_BME, e.v[0]); break;
    case EV_MMC: rumbo(M_MMC, e.v, cfg_.mmc.radio); break;
    case EV_QMC: rumbo(M_QMC, e.v, cfg_.qmc.radio); break;
    }
}

// ---------- bucle (navigate) ----------
int Navegador::avanzar(int64_t ahora) {
    if (!e_.listo) return 0;
    int n = 0;
    while (tk_ + DT_US <= ahora - RETRASO_US) {
        const int64_t ta = tk_, tb = tk_ + DT_US;
        // momentos hasta tb, despues la fase, despues las medidas hasta tb
        int k = 0;
        for (int i = 0; i < nev_; i++) {
            const Ev &e = ev_[i];
            if (e.tipo == EV_MOM && e.t <= tb) { momento_ = (uint8_t)e.i; if (momento_ == 6 && tPar_ == INT64_MIN) tPar_ = e.t; }
            else ev_[k++] = e;
        }
        nev_ = k;
        uint8_t f = F_REPOSO;
        if (momento_ == 2) f = F_BOOST;
        else if (momento_ >= 3 && momento_ <= 5) f = F_COAST;
        else if (momento_ == 6) f = (tPar_ != INT64_MIN && tb - tPar_ < (int64_t)EYECCION_US) ? F_EYECCION : F_PARACAIDAS;
        else if (momento_ == 7) f = F_ATERRIZAJE;
        fase_ = f; e_.fase = f;
        k = 0;
        while (k < nev_ && ev_[k].t <= tb) { evento(ev_[k], tb); k++; }
        if (k) { memmove(ev_, ev_ + k, (nev_ - k) * sizeof(Ev)); nev_ -= k; }
        Real fk[3], wk[3]; bool ok;
        imuPaso(ta, tb, il_, iq_, fk, wk, ok);
        tk_ = tb; e_.t_us = tb; n++; pasos_++;
        if (!ok) continue;                                    // sin IMU en este paso: se sigue en el siguiente
        Real w[3], fm[3];
        for (int i = 0; i < 3; i++) { w[i] = wk[i] * (Real)DPS; fm[i] = fk[i] * (Real)G; }
        predecir(w, fm, (Real)FASES[fase_][0], (Real)FASES[fase_][1]);
        for (int i = 0; i < 3; i++) { e_.f_g[i] = fk[i] - e_.ba[i] / (Real)G; e_.w_dps[i] = wk[i] - e_.bg[i] / (Real)DPS; }
        if (!hayLp_) { memcpy(flp_, fk, sizeof(flp_)); hayLp_ = true; }
        else for (int i = 0; i < 3; i++) flp_[i] += (Real)0.05 * (fk[i] - flp_[i]);
        Real wr[3]; for (int i = 0; i < 3; i++) wr[i] = wk[i] - e_.bg[i] / (Real)DPS;
        const bool quieto = fabs(nrm3(fk) - 1.0) < STILL_G * 3 && fabs(nrm3(flp_) - 1.0) < STILL_G && nrm3(wr) < STILL_DPS;
        stillN_ = quieto ? stillN_ + 1 : 0;
        const int kk = (int)((tb - t0_) / DT_US) - 1;
        if (stillN_ >= STILL_N && kk - ultGrav_ >= 40) { ultGrav_ = kk; gravedad(flp_); }
    }
    completar(e_);
    return n;
}

void Navegador::completar(Estado &s) const {
    for (int i = 0; i < 3; i++) {
        s.sd_th[i] = sqrt(Pm_[TH + i][TH + i]); s.sd_p[i] = sqrt(Pm_[P + i][P + i]); s.sd_v[i] = sqrt(Pm_[V + i][V + i]);
    }
    s.alt_baro_m = (float)(-s.p[2] + s.b_bmp);
}

bool Navegador::presente(int64_t ahora, Estado &out) const {
    out = e_;
    if (!e_.listo) return false;
    int64_t il = il_, iq = iq_, t = tk_;
    while (t + DT_US <= ahora) {
        Real f[3], w[3]; bool ok;
        imuPaso(t, t + DT_US, il, iq, f, w, ok);
        t += DT_US;
        if (!ok) { if (il >= nl_ && iq >= nq_) break; continue; }   // sin mas IMU: hasta aqui
        Real wr[3], fm[3];
        for (int i = 0; i < 3; i++) { wr[i] = w[i] * (Real)DPS; fm[i] = f[i] * (Real)G; }
        propagarMedia(out, wr, fm);
        for (int i = 0; i < 3; i++) { out.f_g[i] = f[i] - out.ba[i] / (Real)G; out.w_dps[i] = w[i] - out.bg[i] / (Real)DPS; }
        out.t_us = t;
    }
    out.alt_baro_m = (float)(-out.p[2] + out.b_bmp);
    return true;
}

} // namespace ekf
