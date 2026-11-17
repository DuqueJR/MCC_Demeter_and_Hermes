// imu_clock.h - Reloj de muestras del IMU: ajusta t(n) = t0 + T*n con minimos cuadrados de memoria exponencial.
// C++11, sin dependencias de ESP32. Cada punto es (indice absoluto de muestra, instante local de la interrupcion).
// No usa el PPS: calibra el ODR real del IMU contra el reloj local; el modelo de tiempo (PPS) lleva el reloj local a UTC.
#pragma once
#include <stdint.h>
#include <math.h>

class ImuClock {
public:
    explicit ImuClock(double nominalPeriodUs = 2230.0) : nom_(nominalPeriodUs) { reset(); }

    void reset() { cnt_ = 0; mx_ = my_ = vxx_ = vxy_ = r2_ = 0; rejCons_ = 0; n0_ = 0; t0_ = 0; b_ = nom_; }

    // Devuelve false si el punto se rechazo (valor atipico).
    bool update(uint64_t n, int64_t t_us) {
        if (cnt_ == 0) { n0_ = n; t0_ = t_us; mx_ = my_ = vxx_ = vxy_ = r2_ = 0; cnt_ = 1; b_ = nom_; return true; }
        const double x = (double)(int64_t)(n - n0_), y = (double)(t_us - t0_);
        if (valid()) {
            const double res = y - (my_ + b_ * (x - mx_));
            if (fabs(res) > kOutUs) {
                rejects_++;
                if (++rejCons_ >= kMaxRej) { resets_++; reset(); update(n, t_us); }
                return false;
            }
            rejCons_ = 0;
            r2_ += kAlphaR * (res * res - r2_);
        }
        const double a = (cnt_ + 1 > kN) ? 1.0 / kN : 1.0 / (double)(cnt_ + 1);
        const double dx = x - mx_, dy = y - my_;
        mx_ += a * dx; my_ += a * dy;
        vxx_ = (1.0 - a) * (vxx_ + a * dx * dx);
        vxy_ = (1.0 - a) * (vxy_ + a * dx * dy);
        cnt_++;
        if (cnt_ >= kMinPts && vxx_ > 0) {
            const double b = vxy_ / vxx_;
            if (b > nom_ * 0.8 && b < nom_ * 1.25) b_ = b;
        }
        return true;
    }

    bool   valid() const { return cnt_ >= kMinPts; }
    double timeOf(uint64_t n) const {                         // instante local (us) de la muestra n
        if (cnt_ == 0) return 0;
        return (double)t0_ + my_ + b_ * ((double)(int64_t)(n - n0_) - mx_);
    }
    double   periodUs() const { return b_; }
    double   odrHz()    const { return 1e6 / b_; }
    double   rmsUs()    const { return sqrt(r2_); }
    uint32_t rejects()  const { return rejects_; }
    uint32_t resets()   const { return resets_; }
    uint32_t points()   const { return cnt_; }

private:
    static constexpr double   kOutUs   = 3000.0;    // mas de ~1 muestra de error: atipico (muestras perdidas, etc.)
    static constexpr double   kAlphaR  = 0.02;
    static constexpr double   kN       = 200.0;     // memoria efectiva ~200 lotes (~8 s a 25 lotes/s)
    static constexpr uint32_t kMinPts  = 8;
    static constexpr uint32_t kMaxRej  = 6;
    double   nom_, b_ = 0, mx_, my_, vxx_, vxy_, r2_;
    int64_t  t0_; uint64_t n0_;
    uint32_t cnt_, rejCons_;
    uint32_t rejects_ = 0, resets_ = 0;
};
