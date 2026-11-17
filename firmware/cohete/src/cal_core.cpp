// cal_core.cpp - Calibracion a bordo: estacion/calib.py en C++11. Ver cal_core.h.
#include "cal_core.h"
#include <math.h>
#include <string.h>
#include <algorithm>
#include "rec_format.h"

namespace cal {

// Umbrales de calib.py
static const double STILL_WIN_US = 0.5e6, STILL_SD_G = 0.03, STILL_MIN_S = 4.0, WARM_MIN_S = 120.0, WARM_TAIL_S = 20.0, NEW_POSE_DEG = 30.0, ANGLE_WARN_DEG = 12.0;
static const int64_t TX_MARGIN_US = 15000;
static const int    BIN_KEEP = 300;
static const double COVER_MIN = 0.8, RES_WARN_MG = 15.0, DIP_MIN_DEG = 10.0, DIP_RANGE_WARN_DEG = 25.0, DIP_POSE_DEG = 12.0;
static const double MAG_AGREE_WARN_DEG = 15.0, MAG_OUTLIER = 0.25, POSE_MATCH_DEG = 45.0, POSE_FIELD_TOL = 0.05;
static const double POSE_BODY[NPOS][3] = {{1, 0, 0}, {-1, 0, 0}, {0, 0, -1}, {0, 0, 1}, {0, 1, 0}, {0, -1, 0}};
static const double LSM_NOMINAL_R[3][3] = {{0, 1, 0}, {0, 0, -1}, {-1, 0, 0}};
static const double PI_ = 3.14159265358979323846, D2R = PI_ / 180.0, R2D = 180.0 / PI_;
static const double GB_US = 100000.0, L5_US = 5000.0, TB_US = 10e6;

// ---------- algebra ----------
static double dot3(const double a[3], const double b[3]) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
static double norm3(const double a[3]) { return sqrt(dot3(a, a)); }
static void cross3(const double a[3], const double b[3], double o[3]) { o[0] = a[1] * b[2] - a[2] * b[1]; o[1] = a[2] * b[0] - a[0] * b[2]; o[2] = a[0] * b[1] - a[1] * b[0]; }
static void mv3(const double M[3][3], const double v[3], double o[3]) { for (int i = 0; i < 3; i++) o[i] = M[i][0] * v[0] + M[i][1] * v[1] + M[i][2] * v[2]; }
static void mm3(const double A[3][3], const double B[3][3], double C[3][3]) {
    for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) C[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
}
static void cp3(const double A[3][3], double B[3][3]) { memcpy(B, A, sizeof(double) * 9); }
static double angDeg(const double a[3], const double b[3]) {
    double c = dot3(a, b) / (norm3(a) * norm3(b));
    c = c > 1 ? 1 : (c < -1 ? -1 : c);
    return acos(c) * R2D;
}
static double det3(const double M[3][3]) {
    return M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
}
// Sistema lineal n x n por eliminacion con pivoteo parcial (A se destruye). false si es singular.
static bool resolver(double *A, double *b, int n) {
    for (int c = 0; c < n; c++) {
        int p = c;
        for (int r = c + 1; r < n; r++) if (fabs(A[r * n + c]) > fabs(A[p * n + c])) p = r;
        if (fabs(A[p * n + c]) < 1e-300) return false;
        if (p != c) { for (int k = 0; k < n; k++) std::swap(A[c * n + k], A[p * n + k]); std::swap(b[c], b[p]); }
        for (int r = c + 1; r < n; r++) {
            const double f = A[r * n + c] / A[c * n + c];
            for (int k = c; k < n; k++) A[r * n + k] -= f * A[c * n + k];
            b[r] -= f * b[c];
        }
    }
    for (int r = n - 1; r >= 0; r--) {
        double s = b[r];
        for (int k = r + 1; k < n; k++) s -= A[r * n + k] * b[k];
        b[r] = s / A[r * n + r];
    }
    return true;
}
// Valores y vectores propios de una matriz simetrica 3x3 (Jacobi). V columnas = vectores.
static void eigSim(const double S[3][3], double w[3], double V[3][3]) {
    double a[3][3]; cp3(S, a);
    for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) V[i][j] = i == j;
    for (int it = 0; it < 60; it++) {
        int p = 0, q = 1;
        double mx = fabs(a[0][1]);
        if (fabs(a[0][2]) > mx) { mx = fabs(a[0][2]); p = 0; q = 2; }
        if (fabs(a[1][2]) > mx) { mx = fabs(a[1][2]); p = 1; q = 2; }
        if (mx < 1e-15) break;
        const double th = 0.5 * atan2(2 * a[p][q], a[q][q] - a[p][p]);
        const double c = cos(th), s = sin(th);
        for (int k = 0; k < 3; k++) {             // a = J^T a J
            const double akp = a[k][p], akq = a[k][q];
            a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq;
        }
        for (int k = 0; k < 3; k++) {
            const double apk = a[p][k], aqk = a[q][k];
            a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk;
        }
        for (int k = 0; k < 3; k++) {
            const double vkp = V[k][p], vkq = V[k][q];
            V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
        }
    }
    for (int i = 0; i < 3; i++) w[i] = a[i][i];
}
static void rotvec(const double v[3], double R[3][3]) {
    const double a = norm3(v);
    for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) R[i][j] = i == j;
    if (a < 1e-12) return;
    const double k[3] = {v[0] / a, v[1] / a, v[2] / a};
    const double K[3][3] = {{0, -k[2], k[1]}, {k[2], 0, -k[0]}, {-k[1], k[0], 0}};
    double K2[3][3]; mm3(K, K, K2);
    for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) R[i][j] += sin(a) * K[i][j] + (1 - cos(a)) * K2[i][j];
}
static double mediana(std::vector<double> v) {
    if (v.empty()) return NAN;
    const size_t m = v.size() / 2;
    std::nth_element(v.begin(), v.begin() + m, v.end());
    double x = v[m];
    if (v.size() % 2 == 0) { x = (x + *std::max_element(v.begin(), v.begin() + m)) / 2; }
    return x;
}

uint16_t recCheck(const uint8_t *r, uint32_t avail) { return rec::check(r, avail); }

void (*ceder)() = nullptr;
static inline void cedeCada(uint32_t &k, uint32_t cada) { if (++k >= cada) { k = 0; if (ceder) ceder(); } }

// ---------- pasada 1 ----------
void Analizador::inicio(const Imu *prev) {
    memset(&r_, 0, sizeof(r_));
    hayPrev_ = prev && prev->ok;
    if (hayPrev_) prev_ = *prev;
    wl_.clear(); wq_.clear(); tl0_ = tq0_ = t0_ = tGuia_ = INT64_MIN;
    for (int i = 0; i < 3; i++) { gb_s_[i].clear(); l5_[i].clear(); }
    gb_n_.clear(); l5n_.clear(); mmc_.clear(); qmc_.clear(); txA_.clear(); txB_.clear(); q2_.clear();
    tb_s_.clear(); te_s_.clear(); tb_n_.clear(); te_n_.clear(); bmpPrevN_ = 0;
    poses_.clear(); hayUps_ = false; segA_ = segB_ = 0;
    memset(sesgoGiro_, 0, sizeof(sesgoGiro_));
}

void Analizador::ventana(std::vector<Ventana> &w, int64_t &t0, int64_t t, const double a[3], const double *g) {
    if (t0 == INT64_MIN) t0 = t;
    if (t < t0) return;
    const size_t k = (size_t)((t - t0) / STILL_WIN_US);
    if (k > 200000) return;                                   // mas de 27 h: registro raro
    if (w.size() <= k) { Ventana z; memset(&z, 0, sizeof(z)); w.resize(k + 1, z); }
    Ventana &v = w[k];
    if (!v.n) v.tf = t;
    v.tl = t; v.n++;
    for (int i = 0; i < 3; i++) { v.s[i] += a[i]; v.q[i] += a[i] * a[i]; if (g) v.g[i] += g[i]; }
}

static void acumular(std::vector<double> &s, std::vector<uint32_t> &n, size_t k, double v) {
    if (k > 100000) return;
    if (s.size() <= k) { s.resize(k + 1, 0.0); n.resize(k + 1, 0); }
    s[k] += v; n[k]++;
}

void Analizador::pasada1(const uint8_t *rec, uint16_t len) {
    rec::Hdr h; memcpy(&h, rec, sizeof(h));
    const uint8_t *p = rec + rec::HDR_SIZE;
    const uint16_t n = (uint16_t)(len - rec::HDR_SIZE - rec::CRC_SIZE);
    if (t0_ == INT64_MIN) t0_ = h.t_us;
    if (h.type == rec::T_EXT_LSM && n >= 24) {
        uint32_t n0; uint16_t cnt; int64_t tf; float period;
        memcpy(&n0, p, 4); memcpy(&cnt, p + 4, 2); memcpy(&tf, p + 8, 8); memcpy(&period, p + 16, 4);
        if (n != 24 + 7 * cnt) return;
        const double ALSB = 1000.0 / 0.976, GLSB = 1000.0 / 70.0;
        uint32_t k = n0; double pend[3] = {0, 0, 0}; bool hayG = false;
        for (uint16_t i = 0; i < cnt; i++) {
            const uint8_t *w = p + 24 + 7 * i;
            const uint8_t tag = w[0] >> 3;
            int16_t v[3]; memcpy(v, w + 1, 6);
            if (tag == 2) {
                const int64_t t = tf + (int64_t)llround((double)(k - n0) * period);
                const double a[3] = {v[0] / ALSB, v[1] / ALSB, v[2] / ALSB};
                ventana(wl_, tl0_, t, a, pend);
                r_.n_lsm++;
                const size_t kb = (size_t)((t - t0_) / GB_US);
                if (t >= t0_) for (int j = 0; j < 3; j++) { if (gb_s_[j].size() <= kb) { gb_s_[j].resize(kb + 1, 0.0); } gb_s_[j][kb] += pend[j]; }
                if (t >= t0_) { if (gb_n_.size() <= kb) gb_n_.resize(kb + 1, 0); gb_n_[kb]++; }
                k++;
            } else if (tag == 1) {
                for (int j = 0; j < 3; j++) pend[j] = v[j] / GLSB;
                hayG = true;
            } else if (tag == 0x0E) {                             // BMP581 por el hub: temperatura (mediana de 3, como el firmware)
                int32_t pp = w[4] | (w[5] << 8) | (w[6] << 16), tt = w[1] | (w[2] << 8) | (w[3] << 16);
                if (pp & 0x800000) pp -= 1 << 24;
                if (tt & 0x800000) tt -= 1 << 24;
                const double P = pp / 64.0, T = tt / 65536.0;
                if (P >= 20000 && P <= 115000 && T >= -40 && T <= 85) {
                    float m = (float)T;
                    if (bmpPrevN_ >= 2) { float a = bmpPrev_[0], b = bmpPrev_[1], c = (float)T; m = std::max(std::min(a, b), std::min(std::max(a, b), c)); }
                    bmpPrev_[0] = bmpPrev_[1]; bmpPrev_[1] = (float)T; if (bmpPrevN_ < 2) bmpPrevN_++;
                    const int64_t t = tf + (int64_t)llround((double)(k - n0) * period);
                    if (t >= t0_) acumular(tb_s_, tb_n_, (size_t)((t - t0_) / TB_US), m);
                }
            }
        }
        (void)hayG;
    } else if (h.type == rec::T_IMU && n >= 40) {
        uint16_t cnt; uint8_t accfs; int64_t tf; double period; uint16_t gfs;
        memcpy(&cnt, p + 4, 2); accfs = p[7]; memcpy(&tf, p + 16, 8); memcpy(&period, p + 24, 8); memcpy(&gfs, p + 38, 2);
        if (n != 40 + 12 * cnt || !accfs || !gfs) return;
        const double alsb = 32768.0 / accfs;
        for (uint16_t i = 0; i < cnt; i++) {
            int16_t v[6]; memcpy(v, p + 40 + 12 * i, 12);
            const int64_t t = tf + (int64_t)llround(i * period);
            const double a[3] = {v[0] / alsb, v[1] / alsb, v[2] / alsb};
            ventana(wq_, tq0_, t, a, nullptr);
            r_.n_qmi++;
        }
    } else if (h.type == rec::T_LINK && n == 16 && p[0] == rec::LD_TX) {
        uint32_t air; memcpy(&air, p + 12, 4);
        txA_.push_back(h.t_us - (int64_t)air - TX_MARGIN_US); txB_.push_back(h.t_us + TX_MARGIN_US);
    } else if (h.type == rec::T_BAR && n == 32) {
        float T; memcpy(&T, p + 24, 4);
        if (h.t_us >= t0_) acumular(te_s_, te_n_, (size_t)((h.t_us - t0_) / TB_US), T);
    }
}

// ---------- posiciones ----------
void Analizador::posesDe(const std::vector<Ventana> &w, std::vector<Pose> &out, int64_t &tGuia) {
    out.clear();
    tGuia = INT64_MIN;
    std::vector<std::pair<int64_t, int64_t> > segs;
    bool en = false; int64_t a = 0, b = 0;
    for (size_t k = 0; k < w.size(); k++) {
        const Ventana &v = w[k];
        if (!v.n) continue;                                     // como np.split: las ventanas vacias no cortan
        bool still = v.n > 10;
        for (int i = 0; i < 3 && still; i++) {
            const double m = v.s[i] / v.n, var = v.q[i] / v.n - m * m;
            if (sqrt(var > 0 ? var : 0) >= STILL_SD_G) still = false;
        }
        if (still) { if (!en) { a = v.tf; en = true; } b = v.tl; }
        else if (en) { segs.push_back(std::make_pair(a, b)); en = false; }
    }
    if (en) segs.push_back(std::make_pair(a, b));
    // Calentamiento (D-058): un tramo quieto de 2 min o mas seguido de posiciones de la guia. La guia empieza WARM_TAIL_S antes del final del ultimo:
    // ese final es una posicion (la 1, nariz arriba, se suele hacer sin mover el cohete). Lo anterior no son posiciones ni sirve para los
    // magnetometros (su mediana quedaria en ese punto). El reposo final no cuenta: no lo siguen posiciones.
    for (size_t s = 0; s < segs.size(); s++) {
        const double d = (segs[s].second - segs[s].first) / 1e6;
        if (d < WARM_MIN_S) continue;
        for (size_t q = s + 1; q < segs.size(); q++) {
            const double dq = (segs[q].second - segs[q].first) / 1e6;
            if (dq >= STILL_MIN_S && dq < WARM_MIN_S) { tGuia = segs[s].second - (int64_t)(WARM_TAIL_S * 1e6); break; }
        }
    }
    for (size_t s = 0; s < segs.size(); s++) {
        const int64_t t2 = segs[s].second, t1 = segs[s].first < tGuia ? tGuia : segs[s].first;
        if (t2 <= tGuia) continue;
        if ((t2 - t1) / 1e6 < STILL_MIN_S) continue;
        Pose p; p.t1 = t1; p.t2 = t2;
        double m[3];
        if (!media(w, p, m)) continue;
        const double nm = norm3(m);
        for (int i = 0; i < 3; i++) p.u[i] = m[i] / nm;
        bool nueva = true;
        for (size_t q = 0; q < out.size(); q++) {
            if (angDeg(p.u, out[q].u) < NEW_POSE_DEG) {
                if (t2 - t1 > out[q].t2 - out[q].t1) { out[q].t1 = t1; out[q].t2 = t2; }
                nueva = false;
                break;
            }
        }
        if (nueva) out.push_back(p);
    }
    if (out.size() > NPOS) out.resize(NPOS);
}

bool Analizador::media(const std::vector<Ventana> &w, const Pose &p, double m[3]) {
    double s[3] = {0, 0, 0}; uint64_t n = 0;
    for (size_t k = 0; k < w.size(); k++) {
        const Ventana &v = w[k];
        if (!v.n || v.tf <= p.t1 + 500000 || v.tl >= p.t2 - 500000) continue;
        for (int i = 0; i < 3; i++) s[i] += v.s[i];
        n += v.n;
    }
    if (!n) return false;
    for (int i = 0; i < 3; i++) m[i] = s[i] / n;
    return true;
}

// Sesgo y escala por eje para que |a| = 1 g en las 6 posiciones (Levenberg-Marquardt, como least_squares)
static void ajustarAcel(const double m[NPOS][3], double b[3], double s[3]) {
    double x[6] = {0, 0, 0, 1, 1, 1}, lam = 1e-3;
    const auto res = [&](const double *y, double r[NPOS]) {
        for (int k = 0; k < NPOS; k++) {
            double v[3]; for (int i = 0; i < 3; i++) v[i] = (m[k][i] - y[i]) / y[3 + i];
            r[k] = norm3(v) - 1.0;
        }
    };
    double r[NPOS]; res(x, r);
    double c = 0; for (int k = 0; k < NPOS; k++) c += r[k] * r[k];
    for (int it = 0; it < 200; it++) {
        double J[NPOS][6];
        for (int j = 0; j < 6; j++) {
            double y[6]; memcpy(y, x, sizeof(y)); const double h = 1e-7 * std::max(1.0, fabs(x[j])); y[j] += h;
            double r2[NPOS]; res(y, r2);
            for (int k = 0; k < NPOS; k++) J[k][j] = (r2[k] - r[k]) / h;
        }
        double A[36], g[6];
        for (int i = 0; i < 6; i++) {
            g[i] = 0; for (int k = 0; k < NPOS; k++) g[i] -= J[k][i] * r[k];
            for (int j = 0; j < 6; j++) { double a = 0; for (int k = 0; k < NPOS; k++) a += J[k][i] * J[k][j]; A[i * 6 + j] = a; }
            A[i * 6 + i] *= 1 + lam;
        }
        if (!resolver(A, g, 6)) break;
        double y[6]; for (int i = 0; i < 6; i++) y[i] = x[i] + g[i];
        double r2[NPOS]; res(y, r2);
        double c2 = 0; for (int k = 0; k < NPOS; k++) c2 += r2[k] * r2[k];
        if (c2 < c) {
            const double mejora = c - c2;
            memcpy(x, y, sizeof(x)); memcpy(r, r2, sizeof(r)); c = c2; lam *= 0.3;
            if (mejora < 1e-18) break;
        } else lam *= 10;
        if (lam > 1e12) break;
    }
    for (int i = 0; i < 3; i++) { b[i] = x[i]; s[i] = x[3 + i]; }
}

// R (cuerpo desde chip), peor error de posicion y si el signo de Y cuadra
static void rotacionCuerpo(const double cal_[NPOS][3], double R[3][3], double &err, bool &signo) {
    double u[NPOS][3];
    for (int k = 0; k < NPOS; k++) { const double n = norm3(cal_[k]); for (int i = 0; i < 3; i++) u[k][i] = cal_[k][i] / n; }
    double x[3], z[3], ym[3];
    for (int i = 0; i < 3; i++) { x[i] = u[0][i] - u[1][i]; z[i] = u[3][i] - u[2][i]; ym[i] = u[4][i] - u[5][i]; }
    double n = norm3(x); for (int i = 0; i < 3; i++) x[i] /= n;
    const double zx = dot3(z, x); for (int i = 0; i < 3; i++) z[i] -= zx * x[i];
    n = norm3(z); for (int i = 0; i < 3; i++) z[i] /= n;
    double y[3]; cross3(z, x, y);
    for (int i = 0; i < 3; i++) { R[0][i] = x[i]; R[1][i] = y[i]; R[2][i] = z[i]; }
    err = 0;
    for (int k = 0; k < NPOS; k++) { double v[3]; mv3(R, u[k], v); err = std::max(err, angDeg(v, POSE_BODY[k])); }
    signo = dot3(ym, y) > 0;
}

void Analizador::imu(const std::vector<Ventana> &w, Imu &c, bool esLsm, uint32_t avSinDatos, uint32_t avMal) {
    c.ok = false;
    if (w.empty()) { r_.avisos |= avSinDatos; return; }
    double m[NPOS][3];
    for (int k = 0; k < NPOS; k++) if (!media(w, poses_[k], m[k])) { r_.avisos |= avSinDatos; return; }
    double b[3], s[3]; ajustarAcel(m, b, s);
    double cl[NPOS][3];
    for (int k = 0; k < NPOS; k++) for (int i = 0; i < 3; i++) cl[k][i] = (m[k][i] - b[i]) / s[i];
    bool signo; rotacionCuerpo(cl, c.R, c.err_pos, signo);
    if (!signo || c.err_pos > ANGLE_WARN_DEG) r_.avisos |= avMal;
    for (int i = 0; i < 3; i++) { c.sesgo[i] = b[i]; c.escala[i] = s[i]; }
    c.ok = true;
    if (esLsm) { memcpy(ups_, cl, sizeof(ups_)); hayUps_ = true; }
}

// ---------- magnetometros ----------
struct Elipsoide { double c[3], A[3][3], r, ratio, rms_mG; };
static bool elipsoide(const std::vector<const float *> &m, Elipsoide &e) {
    const size_t N = m.size();
    if (N < 10) return false;
    double mu[3] = {0, 0, 0};
    for (size_t i = 0; i < N; i++) for (int j = 0; j < 3; j++) mu[j] += m[i][j];
    for (int j = 0; j < 3; j++) mu[j] /= N;
    double DtD[81] = {0}, Dt1[9] = {0};
    uint32_t kc = 0;
    for (size_t i = 0; i < N; i++) {
        cedeCada(kc, 1000);
        const double x = m[i][0] - mu[0], y = m[i][1] - mu[1], z = m[i][2] - mu[2];
        const double D[9] = {x * x, y * y, z * z, 2 * x * y, 2 * x * z, 2 * y * z, 2 * x, 2 * y, 2 * z};
        for (int a = 0; a < 9; a++) { Dt1[a] += D[a]; for (int b = 0; b < 9; b++) DtD[a * 9 + b] += D[a] * D[b]; }
    }
    double v[9]; memcpy(v, Dt1, sizeof(v));
    if (!resolver(DtD, v, 9)) return false;
    const double Q[3][3] = {{v[0], v[3], v[4]}, {v[3], v[1], v[5]}, {v[4], v[5], v[2]}};
    double Qc[9] = {Q[0][0], Q[0][1], Q[0][2], Q[1][0], Q[1][1], Q[1][2], Q[2][0], Q[2][1], Q[2][2]};
    double c[3] = {-v[6], -v[7], -v[8]};
    if (!resolver(Qc, c, 3)) return false;
    double Qcv[3]; mv3(Q, c, Qcv);
    const double k = 1 + dot3(c, Qcv);
    double S[3][3]; for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) S[i][j] = Q[i][j] / k;
    double w[3], V[3][3]; eigSim(S, w, V);
    if (w[0] <= 0 || w[1] <= 0 || w[2] <= 0) return false;
    double radii[3]; for (int i = 0; i < 3; i++) radii[i] = 1 / sqrt(w[i]);
    const double r = (radii[0] + radii[1] + radii[2]) / 3;
    for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) { double a = 0; for (int q = 0; q < 3; q++) a += V[i][q] * (r / radii[q]) * V[j][q]; e.A[i][j] = a; }
    // residuo: |(s - c) A| - r  (A simetrica)
    double sum = 0, sum2 = 0;
    for (size_t i = 0; i < N; i++) {
        double d[3]; for (int j = 0; j < 3; j++) d[j] = m[i][j] - mu[j] - c[j];
        double o[3]; mv3(e.A, d, o);
        const double res = norm3(o) - r;
        sum += res; sum2 += res * res;
    }
    const double mean = sum / N;
    e.rms_mG = 1000 * sqrt(std::max(0.0, sum2 / N - mean * mean));    // np.std
    for (int j = 0; j < 3; j++) e.c[j] = c[j] + mu[j];
    e.r = r;
    e.ratio = std::max(radii[0], std::max(radii[1], radii[2])) / std::min(radii[0], std::min(radii[1], radii[2]));
    return true;
}

// Un ajuste: centro de esfera para las direcciones, hasta BIN_KEEP muestras por celda (26), y elipsoide
static bool ajusteUnaVez(const std::vector<Analizador::Muestra> &m, const std::vector<char> &keep, Mag &c, uint32_t &av) {
    std::vector<const float *> sel;
    for (size_t i = 0; i < m.size(); i++) if (keep[i]) sel.push_back(m[i].v);
    if (sel.size() < 300) { av |= AVM_FALLA_AJUSTE; return false; }
    double A[16] = {0}, b[4] = {0};
    for (size_t i = 0; i < sel.size(); i++) {
        const double r[4] = {2.0 * sel[i][0], 2.0 * sel[i][1], 2.0 * sel[i][2], 1.0};
        const double y = (double)sel[i][0] * sel[i][0] + (double)sel[i][1] * sel[i][1] + (double)sel[i][2] * sel[i][2];
        for (int a = 0; a < 4; a++) { b[a] += r[a] * y; for (int q = 0; q < 4; q++) A[a * 4 + q] += r[a] * r[q]; }
    }
    if (!resolver(A, b, 4)) { av |= AVM_FALLA_AJUSTE; return false; }
    int seen[27] = {0}, celdas = 0;
    std::vector<const float *> kept;
    for (size_t i = 0; i < sel.size(); i++) {
        double u[3] = {sel[i][0] - b[0], sel[i][1] - b[1], sel[i][2] - b[2]};
        const double n = norm3(u); for (int j = 0; j < 3; j++) u[j] /= n;
        const double mx = std::max(fabs(u[0]), std::max(fabs(u[1]), fabs(u[2])));
        int cel = 0;
        for (int j = 0; j < 3; j++) { const int q = (int)llrint(u[j] / mx * 1.2); cel = cel * 3 + (q + 1); }   // np.round: mitad al par
        if (!seen[cel]++) celdas++;
        if (seen[cel] <= BIN_KEEP) kept.push_back(sel[i]);
    }
    c.cobertura = celdas / 26.0;
    if (c.cobertura < COVER_MIN) av |= AVM_COBERTURA;
    Elipsoide e;
    if (!elipsoide(kept, e)) { av |= AVM_FALLA_AJUSTE; return false; }
    memcpy(c.centro, e.c, sizeof(c.centro)); cp3(e.A, c.A); c.radio = e.r; c.max_min = e.ratio; c.residuo_mG = e.rms_mG; c.muestras = (int)kept.size();
    if (e.rms_mG > RES_WARN_MG) av |= AVM_RESIDUO;
    return true;
}

static void calibrar(const Mag &c, const float v[3], double o[3]) {
    double d[3] = {v[0] - c.centro[0], v[1] - c.centro[1], v[2] - c.centro[2]};
    mv3(c.A, d, o);
}

void Analizador::magnetometro(std::vector<Muestra> &m, Mag &c, int base) {
    memset(&c, 0, sizeof(c));
    uint32_t av = 0;
    // fuera las muestras durante la transmision (como calib.load)
    if (!txA_.empty()) {
        std::vector<Muestra> lim; lim.reserve(m.size());
        for (size_t i = 0; i < m.size(); i++) {
            const int64_t t = t0_ + (int64_t)llround(m[i].t * 1e6);
            const size_t j = std::upper_bound(txA_.begin(), txA_.end(), t) - txA_.begin();
            if (j > 0 && t <= txB_[j - 1]) continue;
            lim.push_back(m[i]);
        }
        m.swap(lim);
    }
    if (m.empty()) { r_.avisos |= (uint32_t)AVM_SIN_DATOS << base; return; }
    // descarte de lo perturbado: lejos de la mediana, y luego lejos del elipsoide (fit_mag)
    std::vector<char> keep(m.size(), 1);
    if (m.size() >= 300) {
        double med[3];
        for (int j = 0; j < 3; j++) { std::vector<double> v(m.size()); for (size_t i = 0; i < m.size(); i++) v[i] = m[i].v[j]; med[j] = mediana(v); }
        std::vector<double> d(m.size());
        for (size_t i = 0; i < m.size(); i++) { double q[3] = {m[i].v[0] - med[0], m[i].v[1] - med[1], m[i].v[2] - med[2]}; d[i] = norm3(q); }
        const double md = mediana(d);
        for (size_t i = 0; i < m.size(); i++) keep[i] = d[i] < 2.5 * md;
    }
    uint32_t avAjuste = 0;
    bool ok = ajusteUnaVez(m, keep, c, avAjuste);
    for (int it = 0; it < 4 && ok; it++) {
        std::vector<char> k2(m.size()); size_t nk = 0; bool igual = true;
        for (size_t i = 0; i < m.size(); i++) {
            double o[3]; calibrar(c, m[i].v, o);
            k2[i] = fabs(norm3(o) / c.radio - 1) < MAG_OUTLIER;
            nk += k2[i]; if (k2[i] != keep[i]) igual = false;
        }
        if (igual || nk < 300) break;
        keep.swap(k2);
        avAjuste = 0;
        ok = ajusteUnaVez(m, keep, c, avAjuste);
    }
    av |= avAjuste;
    if (!ok) { r_.avisos |= av << base; c.ok = false; return; }
    size_t nk = 0; for (size_t i = 0; i < keep.size(); i++) nk += keep[i];
    c.descartadas = (int)(m.size() - nk);
    if (c.descartadas > 0.2 * m.size()) av |= AVM_DESCARTADAS;
    std::vector<Muestra> mk; mk.reserve(nk);
    for (size_t i = 0; i < m.size(); i++) if (keep[i]) mk.push_back(m[i]);
    c.ok = true;

    // Alineacion con el giro (dm/dt = -w x m): ejes del magnetometro a ejes del LSM
    if (!gb_n_.empty() && mk.size() > 10) {
        const double dt = 0.1;
        const double ta = mk.front().t, tb = mk.back().t;
        std::vector<double> tq; for (double t = ta; t < tb; t += dt) tq.push_back(t);
        const size_t N = tq.size();
        std::vector<double> mi(3 * N), wi(3 * N);
        // interpolacion lineal del campo calibrado
        size_t j = 0;
        for (size_t q = 0; q < N; q++) {
            while (j + 1 < mk.size() && mk[j + 1].t < tq[q]) j++;
            const size_t j2 = std::min(j + 1, mk.size() - 1);
            double o1[3], o2[3]; calibrar(c, mk[j].v, o1); calibrar(c, mk[j2].v, o2);
            const double f = (j2 == j || mk[j2].t == mk[j].t) ? 0 : std::min(1.0, std::max(0.0, (tq[q] - mk[j].t) / (mk[j2].t - mk[j].t)));
            for (int a = 0; a < 3; a++) mi[3 * q + a] = o1[a] + f * (o2[a] - o1[a]);
        }
        // giro del LSM (sin sesgo) en las ventanas de 100 ms, interpolado en sus centros
        for (size_t q = 0; q < N; q++) {
            const double x = tq[q] / (GB_US / 1e6) - 0.5;
            long k0 = (long)floor(x);
            for (int a = 0; a < 3; a++) {
                const auto val = [&](long k) -> double {
                    k = std::max(0L, std::min((long)gb_n_.size() - 1, k));
                    while (k > 0 && !gb_n_[k]) k--;
                    return gb_n_[k] ? gb_s_[a][k] / gb_n_[k] - sesgoGiro_[a] : 0.0;
                };
                const double f = x - k0;
                wi[3 * q + a] = (val(k0) * (1 - f) + val(k0 + 1) * f) * D2R;
            }
        }
        std::vector<double> dm(3 * N, 0.0);
        for (size_t q = 0; q < N; q++) for (int a = 0; a < 3; a++) {
            if (N < 2) break;
            if (q == 0) dm[a] = (mi[3 + a] - mi[a]) / dt;
            else if (q == N - 1) dm[3 * q + a] = (mi[3 * q + a] - mi[3 * (q - 1) + a]) / dt;
            else dm[3 * q + a] = (mi[3 * (q + 1) + a] - mi[3 * (q - 1) + a]) / (2 * dt);
        }
        std::vector<size_t> rap;
        for (size_t q = 0; q < N; q++) { const double w3[3] = {wi[3 * q], wi[3 * q + 1], wi[3 * q + 2]}; if (norm3(w3) > 40 * D2R) rap.push_back(q); }
        if (rap.size() < 100) av |= AVM_POCO_GIRO;
        else {
            const auto costo = [&](const double R[3][3]) {
                double s = 0;
                for (size_t ii = 0; ii < rap.size(); ii++) {
                    const size_t q = rap[ii];
                    double Rw[3], cr[3]; mv3(R, &wi[3 * q], Rw); cross3(Rw, &mi[3 * q], cr);
                    for (int a = 0; a < 3; a++) { const double r = dm[3 * q + a] + cr[a]; s += r * r; }
                }
                return s;
            };
            // mejor de las 24 rotaciones de ejes
            static const int perms[6][3] = {{0, 1, 2}, {0, 2, 1}, {1, 0, 2}, {1, 2, 0}, {2, 0, 1}, {2, 1, 0}};
            double best = 1e300, R0[3][3];
            for (int p = 0; p < 6; p++) for (int sx = -1; sx <= 1; sx += 2) for (int sy = -1; sy <= 1; sy += 2) for (int sz = -1; sz <= 1; sz += 2) {
                double M[3][3] = {{0, 0, 0}, {0, 0, 0}, {0, 0, 0}};
                M[0][perms[p][0]] = sx; M[1][perms[p][1]] = sy; M[2][perms[p][2]] = sz;
                if (det3(M) <= 0) continue;
                if (ceder) ceder();
                const double cst = costo(M);
                if (cst < best) { best = cst; cp3(M, R0); }
            }
            // Gauss-Newton sobre un vector de rotacion: R = rot(x) R0 (magnetometro desde LSM)
            double x[3] = {0, 0, 0};
            uint32_t kc = 0;
            for (int it = 0; it < 30; it++) {
                if (ceder) ceder();
                double JtJ[9] = {0}, Jtr[3] = {0};
                double Rx[3][3], R[3][3]; rotvec(x, Rx); mm3(Rx, R0, R);
                double Rd[3][3][3];
                for (int k = 0; k < 3; k++) { double y[3] = {x[0], x[1], x[2]}; y[k] += 1e-6; double Ry[3][3]; rotvec(y, Ry); mm3(Ry, R0, Rd[k]); }
                for (size_t ii = 0; ii < rap.size(); ii++) {
                    cedeCada(kc, 500);
                    const size_t q = rap[ii];
                    double Rw[3], cr[3]; mv3(R, &wi[3 * q], Rw); cross3(Rw, &mi[3 * q], cr);
                    double r[3]; for (int a = 0; a < 3; a++) r[a] = dm[3 * q + a] + cr[a];
                    double J[3][3];
                    for (int k = 0; k < 3; k++) {
                        double Rw2[3], cr2[3]; mv3(Rd[k], &wi[3 * q], Rw2); cross3(Rw2, &mi[3 * q], cr2);
                        for (int a = 0; a < 3; a++) J[a][k] = (dm[3 * q + a] + cr2[a] - r[a]) / 1e-6;
                    }
                    for (int k = 0; k < 3; k++) { for (int a = 0; a < 3; a++) Jtr[k] -= J[a][k] * r[a]; for (int l = 0; l < 3; l++) for (int a = 0; a < 3; a++) JtJ[k * 3 + l] += J[a][k] * J[a][l]; }
                }
                if (!resolver(JtJ, Jtr, 3)) break;
                for (int k = 0; k < 3; k++) x[k] += Jtr[k];
                if (norm3(Jtr) < 1e-10) break;
            }
            double Rx[3][3], R[3][3]; rotvec(x, Rx); mm3(Rx, R0, R);
            for (int i = 0; i < 3; i++) for (int k = 0; k < 3; k++) c.R_imu[i][k] = R[k][i];     // IMU desde magnetometro = R^T
            c.giro_residual_deg = norm3(x) * R2D;
            c.alineado = true;
        }
    }
    // Signo por la inclinacion, posiciones perturbadas fuera, y R a cuerpo
    if (c.alineado) {
        if (!hayUps_) av |= AVM_POSICIONES;
        else {
            double v[NPOS][3]; bool hay[NPOS]; double dp[NPOS];
            std::vector<double> dps;
            for (int k = 0; k < NPOS; k++) {
                hay[k] = false;
                const float t1 = (float)((poses_[k].t1 + 500000 - t0_) / 1e6), t2 = (float)((poses_[k].t2 - 500000 - t0_) / 1e6);
                double s[3] = {0, 0, 0}; std::vector<double> nr; size_t n = 0;
                for (size_t i = 0; i < mk.size(); i++) {
                    if (mk[i].t <= t1 || mk[i].t >= t2) continue;
                    double o[3]; calibrar(c, mk[i].v, o);
                    for (int a = 0; a < 3; a++) s[a] += o[a];
                    nr.push_back(norm3(o)); n++;
                }
                if (!n || fabs(mediana(nr) / c.radio - 1) >= POSE_FIELD_TOL) continue;
                double mm[3] = {s[0] / n, s[1] / n, s[2] / n};
                mv3(c.R_imu, mm, v[k]);
                hay[k] = true;
                dp[k] = asin(-dot3(v[k], ups_[k]) / norm3(v[k]) / norm3(ups_[k])) * R2D;
                dps.push_back(dp[k]);
            }
            if (!dps.empty() && mediana(dps) < 0) {
                for (int i = 0; i < 3; i++) for (int k = 0; k < 3; k++) c.R_imu[i][k] = -c.R_imu[i][k];
                for (int k = 0; k < NPOS; k++) if (hay[k]) { dp[k] = -dp[k]; for (int a = 0; a < 3; a++) v[k][a] = -v[k][a]; }
                for (size_t i = 0; i < dps.size(); i++) dps[i] = -dps[i];
                c.invertido = true;
            }
            const double med = dps.empty() ? 0 : mediana(dps);
            double sum = 0, mn = 1e9, mx = -1e9; int n = 0;
            for (int k = 0; k < NPOS; k++) {
                if (!hay[k]) continue;
                if (fabs(dp[k] - med) > DIP_POSE_DEG) { hay[k] = false; continue; }
                sum += dp[k]; mn = std::min(mn, dp[k]); mx = std::max(mx, dp[k]); n++;
            }
            c.dip_n = n; c.dip_media = n ? sum / n : NAN; c.dip_rango = n ? mx - mn : NAN;
            if (n < 3) av |= AVM_POSICIONES;
            if (n && c.dip_media < DIP_MIN_DEG) av |= AVM_INCLINACION;
            if (n && c.dip_rango > DIP_RANGE_WARN_DEG) av |= AVM_INCLINACION;
            // para comparar MMC con QMC en las posiciones: el campo en cuerpo
            if (r_.lsm.ok) {
                mm3(r_.lsm.R, c.R_imu, c.R);
                double (*dst)[3] = base == AV_MMC_BASE ? magPos_mmc : magPos_qmc;
                bool *dh = base == AV_MMC_BASE ? magHay_mmc : magHay_qmc;
                for (int k = 0; k < NPOS; k++) { dh[k] = hay[k]; if (hay[k]) mv3(r_.lsm.R, v[k], dst[k]); }
            }
        }
    }
    r_.avisos |= av << base;
}

// ---------- curva de temperatura ----------
void Analizador::curva(const std::vector<double> &s, const std::vector<uint32_t> &n, Curva &c) {
    memset(&c, 0, sizeof(c));
    std::vector<double> t, v;
    for (size_t k = 0; k < s.size(); k++) if (n[k]) { t.push_back((k + 0.5) * TB_US / 60e6); v.push_back(s[k] / n[k]); }
    if (t.size() < 6) return;
    const double t00 = t.front();
    for (size_t i = 0; i < t.size(); i++) t[i] -= t00;
    double best = 1e300, bt = 0, bc[2] = {0, 0};
    for (int g = 0; g < 60; g++) {
        const double tau = 0.5 * pow(120.0 / 0.5, g / 59.0);
        double A[4] = {0}, b[2] = {0};
        for (size_t i = 0; i < t.size(); i++) {
            const double e = exp(-t[i] / tau), r[2] = {1 - e, e};
            for (int a = 0; a < 2; a++) { b[a] += r[a] * v[i]; for (int q = 0; q < 2; q++) A[a * 2 + q] += r[a] * r[q]; }
        }
        if (!resolver(A, b, 2)) continue;
        double res = 0;
        for (size_t i = 0; i < t.size(); i++) { const double e = exp(-t[i] / tau), d = b[0] * (1 - e) + b[1] * e - v[i]; res += d * d; }
        if (res < best) { best = res; bt = tau; bc[0] = b[0]; bc[1] = b[1]; }
    }
    const double dur = t.back(), tinf = bc[0], t0 = bc[1];
    const auto sube = [&](double m) { return m <= dur + 0.05 ? tinf - (tinf - t0) * exp(-m / bt) - t0 : NAN; };
    double fs = 0; int fn = 0;
    for (size_t i = 0; i < t.size(); i++) if (t[i] >= dur - 1) { fs += v[i]; fn++; }
    c.ok = true; c.t0 = t0; c.tau_min = bt; c.duracion_min = dur; c.final_ = fn ? fs / fn : NAN;
    c.sube5 = sube(5); c.sube10 = sube(10); c.sube30 = sube(30); c.tau_fiable = bt < dur;
}

// ---------- fin de la pasada 1 ----------
static bool cuadra(const std::vector<Analizador::Pose> &p, const double u[NPOS][3], const double R[3][3], std::vector<int> &orden) {
    orden.assign(NPOS, -1);
    std::vector<char> usado(p.size(), 0);
    for (int e = 0; e < NPOS; e++) {
        int bi = -1; double ba = 1e9;
        for (size_t i = 0; i < p.size(); i++) {
            double g[3]; mv3(R, u[i], g);
            const double a = angDeg(g, POSE_BODY[e]);
            if (a < ba) { ba = a; bi = (int)i; }
        }
        if (ba > POSE_MATCH_DEG || usado[bi]) return false;
        usado[bi] = 1; orden[e] = bi;
    }
    return true;
}

void Analizador::finPasada1() {
    const bool hayLsm = !wl_.empty();
    if (hayLsm) posesDe(wl_, poses_, tGuia_);
    if (poses_.empty() && !wq_.empty()) { posesDe(wq_, poses_, tGuia_); r_.avisos |= AV_SIN_LSM; }
    if (tGuia_ != INT64_MIN && t0_ != INT64_MIN) r_.calentamiento_s = (tGuia_ - t0_) / 1e6 + WARM_TAIL_S;
    r_.n_pos = (int)poses_.size();
    // Nombrar las posiciones: con la calibracion anterior, con el montaje nominal o por geometria
    if (hayLsm && poses_.size() == NPOS) {
        double m[NPOS][3];
        bool ok = true;
        for (int k = 0; k < NPOS && ok; k++) ok = media(wl_, poses_[k], m[k]);
        std::vector<int> orden;
        bool hecho = false;
        if (ok && hayPrev_) {
            double u[NPOS][3];
            for (int k = 0; k < NPOS; k++) for (int i = 0; i < 3; i++) u[k][i] = (m[k][i] - prev_.sesgo[i]) / prev_.escala[i];
            if (cuadra(poses_, u, prev_.R, orden)) { r_.nombradas = 1; hecho = true; }
        }
        if (ok && !hecho && cuadra(poses_, m, LSM_NOMINAL_R, orden)) { r_.nombradas = 2; hecho = true; }
        if (hecho) {
            std::vector<Pose> o(NPOS); for (int e = 0; e < NPOS; e++) o[e] = poses_[orden[e]];
            poses_.swap(o);
        } else {
            // geometria (label_geometry): nariz arriba = la primera; abajo = la mas opuesta; marca arriba = la siguiente; ...
            std::vector<int> resto; for (int i = 0; i < NPOS; i++) resto.push_back(i);
            const auto opuesta = [&](int i) { int bj = -1; double bd = 1e9; size_t bk = 0;
                for (size_t k = 0; k < resto.size(); k++) { const double d = dot3(poses_[i].u, poses_[resto[k]].u); if (d < bd) { bd = d; bj = resto[k]; bk = k; } }
                resto.erase(resto.begin() + bk); return bj; };
            const int n0 = resto.front(); resto.erase(resto.begin());
            const int n1 = opuesta(n0);
            const int m0 = resto.front(); resto.erase(resto.begin());
            const int m1 = opuesta(m0);
            double z[3]; const double zu = dot3(poses_[m1].u, poses_[n0].u);
            for (int i = 0; i < 3; i++) z[i] = poses_[m1].u[i] - zu * poses_[n0].u[i];
            double y[3]; cross3(z, poses_[n0].u, y);
            int dd = resto[0], ii = resto[1];
            if (dot3(poses_[dd].u, y) < 0) std::swap(dd, ii);
            const int idx[NPOS] = {n0, n1, m0, m1, dd, ii};
            std::vector<Pose> o(NPOS); for (int e = 0; e < NPOS; e++) o[e] = poses_[idx[e]];
            poses_.swap(o);
            r_.nombradas = 3;
        }
    }
    if (poses_.size() < NPOS) r_.avisos |= AV_POCAS_POS;
    else {
        imu(wl_, r_.lsm, true, AV_LSM_SIN_DATOS, AV_LSM_POS_MAL);
        imu(wq_, r_.qmi, false, AV_QMI_SIN_DATOS, AV_QMI_POS_MAL);
    }
    // sesgo del giro de esta corrida (posicion 1), solo para alinear los magnetometros
    if (!poses_.empty() && hayLsm) {
        double s[3] = {0, 0, 0}; uint64_t n = 0;
        for (size_t k = 0; k < wl_.size(); k++) {
            const Ventana &v = wl_[k];
            if (!v.n || v.tf <= poses_[0].t1 + 500000 || v.tl >= poses_[0].t2 - 500000) continue;
            for (int i = 0; i < 3; i++) s[i] += v.g[i];
            n += v.n;
        }
        if (n) for (int i = 0; i < 3; i++) sesgoGiro_[i] = s[i] / n;
    }
    curva(tb_s_, tb_n_, r_.bmp);
    curva(te_s_, te_n_, r_.bme);
    // tramo de la pasada 2: despues de la ultima posicion
    if (!poses_.empty()) {
        int64_t fin = poses_[0].t2;
        for (size_t k = 0; k < poses_.size(); k++) fin = std::max(fin, poses_[k].t2);
        segA_ = fin;
        segB_ = INT64_MAX;
    }
}

// ---------- pasada 2: retraso y ganancia del QMI ----------
void Analizador::pasada2(const uint8_t *rec, uint16_t len) {
    rec::Hdr h; memcpy(&h, rec, sizeof(h));
    const uint8_t *p = rec + rec::HDR_SIZE;
    const uint16_t n = (uint16_t)(len - rec::HDR_SIZE - rec::CRC_SIZE);
    // Magnetometros: solo desde el fin del calentamiento (con 30 min quieto no caben en la PSRAM y arrastrarian la mediana)
    if (h.type == rec::T_EXT_MMC && n == 14) {
        if (p[12] & 7 || h.t_us < tGuia_) return;
        int32_t v[3]; memcpy(v, p, 12);
        Muestra m; m.t = (float)((h.t_us - t0_) / 1e6); for (int i = 0; i < 3; i++) m.v[i] = (float)(v[i] / 16384.0);
        mmc_.push_back(m);
        return;
    }
    if (h.type == rec::T_MAG && n == 8) {
        if (p[6] & 1 || !p[7] || h.t_us < tGuia_) return;
        int16_t v[3]; memcpy(v, p, 6);
        const double lsb = 32000.0 / p[7];
        Muestra m; m.t = (float)((h.t_us - t0_) / 1e6); for (int i = 0; i < 3; i++) m.v[i] = (float)(v[i] / lsb);
        qmc_.push_back(m);
        return;
    }
    if (!r_.lsm.ok || !r_.qmi.ok || !segA_) return;
    if (h.type == rec::T_EXT_LSM && n >= 24) {
        uint32_t n0; uint16_t cnt; int64_t tf; float period;
        memcpy(&n0, p, 4); memcpy(&cnt, p + 4, 2); memcpy(&tf, p + 8, 8); memcpy(&period, p + 16, 4);
        if (n != 24 + 7 * cnt) return;
        const double GLSB = 1000.0 / 70.0;
        uint32_t k = n0; double pend[3] = {0, 0, 0};
        for (uint16_t i = 0; i < cnt; i++) {
            const uint8_t *w = p + 24 + 7 * i;
            const uint8_t tag = w[0] >> 3;
            int16_t v[3]; memcpy(v, w + 1, 6);
            if (tag == 2) {
                const int64_t t = tf + (int64_t)llround((double)(k - n0) * period);
                k++;
                if (t < segA_) continue;
                const size_t kb = (size_t)((t - segA_) / L5_US);
                if (kb > 400000) continue;
                for (int j = 0; j < 3; j++) if (l5_[j].size() <= kb) l5_[j].resize(kb + 1, 0.0f);
                if (l5n_.size() <= kb) l5n_.resize(kb + 1, 0);
                for (int j = 0; j < 3; j++) l5_[j][kb] += (float)pend[j];
                l5n_[kb]++;
            } else if (tag == 1) for (int j = 0; j < 3; j++) pend[j] = v[j] / GLSB;
        }
    } else if (h.type == rec::T_IMU && n >= 40) {
        uint16_t cnt; int64_t tf; double period; uint16_t gfs;
        memcpy(&cnt, p + 4, 2); memcpy(&tf, p + 16, 8); memcpy(&period, p + 24, 8); memcpy(&gfs, p + 38, 2);
        if (n != 40 + 12 * cnt || !gfs) return;
        const double glsb = 32768.0 / gfs;
        for (uint16_t i = 0; i < cnt; i++) {
            const int64_t t = tf + (int64_t)llround(i * period);
            if (t < segA_) continue;
            int16_t v[6]; memcpy(v, p + 40 + 12 * i, 12);
            Muestra m; m.t = (float)((t - segA_) / 1e6); for (int j = 0; j < 3; j++) m.v[j] = (float)(v[3 + j] / glsb);
            q2_.push_back(m);
        }
    }
}

void Analizador::finPasada2() {
    for (int k = 0; k < NPOS; k++) { magHay_mmc[k] = magHay_qmc[k] = false; }
    magnetometro(mmc_, r_.mmc, AV_MMC_BASE);
    magnetometro(qmc_, r_.qmc, AV_QMC_BASE);
    r_.n_mmc = (uint32_t)mmc_.size(); r_.n_qmc = (uint32_t)qmc_.size();
    mmc_.clear(); mmc_.shrink_to_fit(); qmc_.clear(); qmc_.shrink_to_fit();
    // MMC contra QMC en las posiciones
    if (r_.mmc.alineado && r_.qmc.alineado && hayUps_) {
        double mn = 1e9, mx = -1e9; int n = 0;
        for (int k = 0; k < NPOS; k++) if (magHay_mmc[k] && magHay_qmc[k]) { const double a = angDeg(magPos_mmc[k], magPos_qmc[k]); mn = std::min(mn, a); mx = std::max(mx, a); n++; }
        if (!n) r_.avisos |= AV_MAG_NO_COMPARABLES;
        else { r_.mag_acuerdo_min = mn; r_.mag_acuerdo_max = mx; if (mx > MAG_AGREE_WARN_DEG) r_.avisos |= AV_MAG_DIFIEREN; }
    }
    r_.qmi_giro = false;
    if (r_.lsm.ok && r_.qmi.ok && l5n_.size() > 100 && q2_.size() > 100) {
        std::sort(q2_.begin(), q2_.end(), [](const Muestra &a, const Muestra &b) { return a.t < b.t; });
        // LSM en cuerpo en la rejilla de 5 ms (centros de ventana), QMI interpolado con retraso
        const double ta = std::max(0.0, (double)q2_.front().t) + 0.2, tb = std::min(l5n_.size() * L5_US / 1e6, (double)q2_.back().t) - 0.2;
        std::vector<double> tg; for (double t = ta; t < tb; t += 0.005) tg.push_back(t);
        const size_t N = tg.size();
        if (N > 100) {
            std::vector<double> L(3 * N);
            for (size_t i = 0; i < N; i++) {
                const double x = tg[i] / 0.005 - 0.5; long k0 = (long)floor(x); const double f = x - k0;
                double c0[3] = {0, 0, 0}, c1[3] = {0, 0, 0};
                const auto val = [&](long k, double o[3]) { k = std::max(0L, std::min((long)l5n_.size() - 1, k)); while (k > 0 && !l5n_[k]) k--; for (int j = 0; j < 3; j++) o[j] = l5n_[k] ? l5_[j][k] / l5n_[k] : 0; };
                val(k0, c0); val(k0 + 1, c1);
                double g[3]; for (int j = 0; j < 3; j++) g[j] = c0[j] * (1 - f) + c1[j] * f;
                double b[3]; mv3(r_.lsm.R, g, b);
                for (int j = 0; j < 3; j++) L[3 * i + j] = b[j];
            }
            const auto qmiEn = [&](double t, double o[3]) {
                size_t lo = 0, hi = q2_.size() - 1;
                if (t <= q2_[0].t) { lo = hi = 0; }
                else if (t >= q2_[hi].t) { lo = hi; }
                else { while (hi - lo > 1) { const size_t m = (lo + hi) / 2; if (q2_[m].t <= t) lo = m; else hi = m; } }
                const double f = hi == lo ? 0 : (t - q2_[lo].t) / (q2_[hi].t - q2_[lo].t);
                double g[3]; for (int j = 0; j < 3; j++) g[j] = q2_[lo].v[j] * (1 - f) + q2_[hi].v[j] * f;
                mv3(r_.qmi.R, g, o);
            };
            double bestE = 1e300; int bestLag = 0;
            std::vector<double> Q(3 * N), Qb;
            uint32_t kc = 0;
            for (int lag = -80; lag <= 80; lag += 2) {
                double e = 0;
                for (size_t i = 0; i < N; i++) {
                    cedeCada(kc, 2000); double o[3]; qmiEn(tg[i] + lag / 1000.0, o); for (int j = 0; j < 3; j++) { Q[3 * i + j] = o[j]; const double d = L[3 * i + j] - o[j]; e += d * d; } }
                e /= 3.0 * N;
                if (e < bestE) { bestE = e; bestLag = lag; Qb = Q; }
            }
            r_.qmi_retraso_ms = bestLag;
            for (int j = 0; j < 3; j++) {
                double lq = 0, ll = 0, sl = 0, sq = 0, sll = 0, sqq = 0, slq = 0;
                for (size_t i = 0; i < N; i++) {
                    const double l = L[3 * i + j], q = Qb[3 * i + j];
                    lq += l * q; ll += l * l; sl += l; sq += q; sll += l * l; sqq += q * q; slq += l * q;
                }
                r_.qmi_ganancia[j] = ll > 0 ? lq / ll : NAN;
                const double cov = slq / N - sl / N * sq / N, vl = sll / N - sl / N * sl / N, vq = sqq / N - sq / N * sq / N;
                r_.qmi_corr[j] = (vl > 0 && vq > 0) ? cov / sqrt(vl * vq) : NAN;
            }
            r_.qmi_giro = true;
            const double cmin = std::min(r_.qmi_corr[0], std::min(r_.qmi_corr[1], r_.qmi_corr[2]));
            if (!(cmin >= 0.95)) r_.avisos |= AV_QMI_CORR;
        }
    }
    r_.ok = !r_.avisos && r_.lsm.ok && r_.qmi.ok && r_.mmc.ok && r_.qmc.ok && r_.qmi_giro;
    for (int j = 0; j < 3; j++) { l5_[j].clear(); l5_[j].shrink_to_fit(); }
    l5n_.clear(); l5n_.shrink_to_fit(); q2_.clear(); q2_.shrink_to_fit();
}

} // namespace cal
