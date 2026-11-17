// boost_detect.cpp - Ver boost_detect.h. Sin dependencias de ESP32: se prueba en el PC (test/host).
#include "boost_detect.h"
#include <math.h>

static const float    G0_MPS2      = 9.80665f;
static const int64_t  RESET_US     = (int64_t)BOOST_RESET_MS * 1000;
static const uint32_t VALUE_MASK   = 0x0FFFFFFFu;

bool BoostIntegrator::feed(int64_t t_us, float a) {
    const int64_t dt = havePrev_ ? t_us - tPrev_ : 0;
    tPrev_ = t_us; havePrev_ = true;
    if (dt > RESET_US) { dv_ = 0; below_ = false; }               // hueco largo: no se sabe si |a| se mantuvo

    if (a <= BOOST_ACC_MIN_G) {
        if (dt > 0 && dt <= BOOST_DT_MAX_US) {                    // bajo 2 g dv decae: una sacudida no acumula entre sus semiciclos
            dv_ -= BOOST_DV_DECAY_G * G0_MPS2 * (float)dt * 1e-6f;
            if (dv_ < 0) dv_ = 0;
        }
        if (!below_) { below_ = true; tBelow_ = t_us; }
        else if (t_us - tBelow_ > RESET_US) dv_ = 0;
        return false;
    }
    below_ = false;
    if (dt <= 0 || dt > BOOST_DT_MAX_US) return false;                  // primera muestra, reloj atrasado o hueco
    dv_ += (a - 1.0f) * G0_MPS2 * (float)dt * 1e-6f;
    if (dv_ < target_) return false;
    hitDv_ = dv_;
    dv_ = 0;
    return true;
}

bool BoostBaroJump::feed(int64_t t_us, float altM) {
    t_[head_] = t_us; h_[head_] = altM;
    head_ = (uint8_t)((head_ + 1) % CAP);
    if (n_ < CAP) n_++;

    const int64_t want = t_us - (int64_t)llroundf(jumpS_ * 1e6f);
    bool found = false;
    float old = 0;
    for (uint8_t k = 1; k < n_; k++) {                            // de la mas nueva hacia atras: la primera con t <= t_us - jump_s
        const uint8_t i = (uint8_t)((head_ + CAP - 1 - k) % CAP);
        if (t_[i] <= want) { old = h_[i]; found = true; break; }
    }
    if (!found) { ok_ = 0; jump_ = 0; return false; }
    jump_ = altM - old;
    ok_ = jump_ >= jumpM_ ? (uint8_t)(ok_ < 255 ? ok_ + 1 : 255) : 0;
    return ok_ >= evals_;
}

void BoostFlag::post(uint8_t kind, uint32_t value) {
    const uint32_t v = value > VALUE_MASK ? VALUE_MASK : value;
    __atomic_store_n(&w_, ((uint32_t)kind << 28) | v, __ATOMIC_RELEASE);
}

uint8_t BoostFlag::take(uint32_t &value) {
    const uint32_t w = __atomic_exchange_n(&w_, 0u, __ATOMIC_ACQ_REL);
    value = w & VALUE_MASK;
    return (uint8_t)(w >> 28);
}

// ---- Gancho de los IMU ----
static BoostIntegrator s_lsm, s_qmi;
static BoostFlag       s_flagLsm, s_flagQmi;

void boostSetTarget(float dvMps) { s_lsm.setTarget(dvMps); s_qmi.setTarget(dvMps); }   // se escribe una vez, antes de que haya vuelo

// Un eje en el tope de la escala no es una medida: es el chip saturado o un dato basura (el primer lote del QMI al encender traia x = -32768,
// unas 16 muestras a 16,5 g, y eso solo daba los 5 m/s: BOOST sin armar en cada arranque, 6 nov). Esa muestra no se integra ni reinicia nada.
// El motor no satura ninguno de los dos (LSM +-32 g, QMI +-16 g); un golpe si.
static inline bool saturated(const int16_t a[3]) {
    for (int i = 0; i < 3; i++) if (a[i] >= 32767 || a[i] <= -32767) return true;
    return false;
}

static inline float norm(const int16_t a[3], float lsbPerG) {
    const float x = a[0], y = a[1], z = a[2];
    return sqrtf(x * x + y * y + z * z) / lsbPerG;
}

void boostLsmSample(int64_t t_us, const int16_t a[3], float lsbPerG) {
    if (saturated(a)) return;
    if (s_lsm.feed(t_us, norm(a, lsbPerG))) s_flagLsm.post(BOOST_INERCIAL, (uint32_t)lroundf(s_lsm.hitDv() * 100.0f));
}
void boostQmiSample(int64_t t_us, const int16_t a[3], float lsbPerG) {
    if (saturated(a)) return;
    if (s_qmi.feed(t_us, norm(a, lsbPerG))) s_flagQmi.post(BOOST_INERCIAL, (uint32_t)lroundf(s_qmi.hitDv() * 100.0f));
}
uint8_t boostTakeLsm(uint32_t &dvCms) { return s_flagLsm.take(dvCms); }
uint8_t boostTakeQmi(uint32_t &dvCms) { return s_flagQmi.take(dvCms); }
