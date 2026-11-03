// time_model.h - Modelo de tiempo de mision (C++ puro, sin dependencias de ESP32).
// Convierte el reloj local monotono (esp_timer, us) a UTC (epoch, us) y estima su calidad.
// Fuentes: PPS+UTC del GNSS (prioridad), baliza de tierra por LoRa (respaldo), retencion con deriva.
#pragma once
#include <stdint.h>
#include <math.h>
#include <stdlib.h>

class TimeModel {
public:
    enum Src : uint8_t { SRC_NONE = 0, SRC_GNSS = 1, SRC_LINK = 2 };
    // Calidad: 0 bloqueado (PPS reciente), 1 error<1 ms, 2 error>=1 ms, 3 sin UTC
    static constexpr double  kHoldPpm     = 1.0;      // incertidumbre de deriva en retencion [ppm]
    static constexpr double  kPpsFloorUs  = 2.0;      // error base con PPS [us]
    static constexpr int64_t kLockedAgeUs = 2500000;  // edad maxima del ancla PPS para calidad 0
    static constexpr int64_t kMaxGapUs    = 60000000; // hueco maximo entre anclas PPS para estimar deriva
    static constexpr int64_t kLinkRejectUs= 100000;   // salto maximo aceptado de una baliza con hora previa

    void reset() { *this = TimeModel(); }

    // El flanco PPS capturado en t_local_us marca el inicio del segundo UTC utc_sec (epoch, s).
    void onPpsAnchor(int64_t t_local_us, int64_t utc_sec) {
        const int64_t utc = utc_sec * 1000000LL;
        if (haveG_) {
            const int64_t dl = t_local_us - gLocal_, du = utc - gUtc_;
            if (du > 0 && du <= kMaxGapUs && dl > 0) {
                const double m = (double)du / (double)dl - 1.0;       // deriva medida
                if (nEps_ < 8 || fabs(m - eps_) < 5e-6) {
                    nEps_++;
                    double a = 1.0 / (nEps_ < 32 ? nEps_ : 32);
                    a *= (du >= 8000000 ? 8.0 : du / 1e6);            // mas peso a bases largas
                    if (a > 1.0) a = 1.0;
                    eps_ += a * (m - eps_);
                    ppb_ = (int32_t)llround(eps_ * 1e9);
                } else rejected_++;
            }
        }
        gLocal_ = t_local_us; gUtc_ = utc; haveG_ = true;
        aLocal_ = t_local_us; aUtc_ = utc; lastLocal_ = t_local_us;
        link_ = false; have_ = true;
    }

    // Baliza de tierra: recibida por completo en t_local_us; utc_at_rx_us es el UTC de tierra en ese instante
    // (inicio de ranura + tiempo en el aire). err_floor_us: error base esperado del enlace.
    // Devuelve true si se uso para actualizar el modelo.
    bool onLinkAnchor(int64_t t_local_us, int64_t utc_at_rx_us, int64_t err_floor_us) {
        if (haveG_ && (t_local_us - gLocal_) <= kLockedAgeUs) {       // GNSS manda: solo calibrar sesgo
            const double bias = (double)(toUtcUs(t_local_us) - utc_at_rx_us);
            biasUs_ = nBias_ ? biasUs_ + 0.1 * (bias - biasUs_) : bias;
            if (nBias_ < 1000) nBias_++;
            return false;
        }
        const int64_t u = utc_at_rx_us + (int64_t)llround(nBias_ >= 5 ? biasUs_ : 0.0);
        if (!have_) {                                                  // primera hora
            aLocal_ = t_local_us; aUtc_ = u; have_ = true;
        } else {
            const int64_t r = u - toUtcUs(t_local_us);                 // residuo
            if (llabs(r) > kLinkRejectUs && quality(t_local_us) <= 1) { rejected_++; return false; }
            aUtc_ = toUtcUs(t_local_us) + (int64_t)llround(0.25 * r); // suavizado
            aLocal_ = t_local_us;
        }
        link_ = true; linkErr_ = (double)err_floor_us; lastLocal_ = t_local_us;
        return true;
    }

    int64_t toUtcUs(int64_t t) const {
        const int64_t dt = t - aLocal_;
        return aUtc_ + dt + (dt * (int64_t)ppb_) / 1000000000LL;
    }
    int64_t toLocalUs(int64_t utc) const {                              // para programar ranuras
        const int64_t du = utc - aUtc_;
        return aLocal_ + du - (du * (int64_t)ppb_) / 1000000000LL;
    }

    // Error estimado [us], calidad y fuente en el instante t
    double errEstUs(int64_t t) const {
        if (!have_) return 1e12;
        const double age = (double)(t - lastLocal_) / 1e6;
        return (link_ ? linkErr_ : kPpsFloorUs) + (age > 0 ? age : 0) * kHoldPpm;
    }
    uint8_t quality(int64_t t) const {
        if (!have_) return 3;
        if (!link_ && (t - lastLocal_) <= kLockedAgeUs) return 0;
        return errEstUs(t) < 1000.0 ? 1 : 2;
    }
    uint8_t source() const { return !have_ ? SRC_NONE : (link_ ? SRC_LINK : SRC_GNSS); }
    // Byte para la telemetria: bits0-1 calidad, bits2-3 fuente
    uint8_t timeFlags(int64_t t) const { return (uint8_t)(quality(t) | (source() << 2)); }

    double  driftPpm() const { return eps_ * 1e6; }
    double  linkBiasUs() const { return biasUs_; }
    uint32_t rejected() const { return rejected_; }
    bool    valid() const { return have_; }

private:
    bool have_ = false, haveG_ = false, link_ = false;
    int64_t aLocal_ = 0, aUtc_ = 0, gLocal_ = 0, gUtc_ = 0, lastLocal_ = 0;
    double  eps_ = 0.0, linkErr_ = 0.0, biasUs_ = 0.0;
    int32_t ppb_ = 0;
    uint32_t nEps_ = 0, nBias_ = 0, rejected_ = 0;
};
