// core_bus.h - Nucleo comun: ultima muestra por fuente (seqlock), anillos de registro y servicio de tiempo.
#pragma once
#include <Arduino.h>
#include <esp_timer.h>
#include "time_model.h"
#include "byte_ring.h"
#include "rec_format.h"

// ---------- Ultima muestra: un escritor, varios lectores, sin bloqueos ----------
template <typename T> class Latest {
public:
    void set(const T &v) {
        const uint32_t s = seq_;
        __atomic_store_n(&seq_, s + 1, __ATOMIC_RELEASE);
        __atomic_thread_fence(__ATOMIC_SEQ_CST);
        data_ = v;
        __atomic_thread_fence(__ATOMIC_SEQ_CST);
        __atomic_store_n(&seq_, s + 2, __ATOMIC_RELEASE);
    }
    bool get(T &out) const {                       // false si nunca se escribio
        for (int i = 0; i < 8; i++) {
            const uint32_t s0 = __atomic_load_n(&seq_, __ATOMIC_ACQUIRE);
            if (s0 & 1) continue;
            out = data_;
            __atomic_thread_fence(__ATOMIC_SEQ_CST);
            if (__atomic_load_n(&seq_, __ATOMIC_ACQUIRE) == s0) return s0 != 0;
        }
        return false;
    }
private:
    T data_;
    uint32_t seq_ = 0;
};

// ---------- Muestra GNSS publicada para EKF / telemetria ----------
struct GnssSample {
    int64_t  t_rx_us;       // reloj local al completar la trama
    int64_t  t_meas_us;     // reloj local estimado de la epoca de medicion (-1 si no hay modelo de tiempo)
    int64_t  utc_us;        // UTC de la epoca (epoch, us)
    uint32_t itow_ms;
    int32_t  lat_e7, lon_e7, h_mm, hmsl_mm;
    int32_t  vn_mmps, ve_mmps, vd_mmps, gspeed_mmps;
    uint32_t hacc_mm, vacc_mm, sacc_mmps, tacc_ns;
    uint16_t pdop_x100;
    uint8_t  fix, nsv, valid, flags;
    uint32_t seq;
};
extern Latest<GnssSample> g_gnss;

extern volatile uint16_t g_vbat_mv;                  // lo escribe el bucle principal, unico dueno de la PMU

// ---------- Servicio de tiempo (un solo escritor protegido por mutex; lecturas sin bloqueo) ----------
void    time_pps_anchor(int64_t t_local_us, int64_t utc_sec);
bool    time_link_anchor(int64_t t_local_us, int64_t utc_at_rx_us, int64_t err_floor_us);
bool    time_snapshot(TimeModel &out);               // copia coherente del modelo
int64_t time_to_utc_us(int64_t t_local_us);          // -1 si no hay hora
int64_t time_to_local_us(int64_t utc_us);            // -1 si no hay hora
inline int64_t time_local_now() { return esp_timer_get_time(); }

// ---------- Exclusion del bus SPI compartido SD + QMI8658 (semaforo binario, sin herencia de prioridad) ----------
extern SemaphoreHandle_t g_sdBusMx;

// ---------- Anillos de registro (hacia la SD) ----------
enum RingId : uint8_t { RING_GNSS = 0, RING_IMU, RING_I2C, RING_NET, RING_EXT, RING_COUNT };
void     bus_begin();
bool     bus_log(RingId r, uint8_t type, uint8_t src, int64_t t_us, const void *payload, uint16_t n);
uint32_t bus_ring_used(RingId r);
uint32_t bus_ring_drops(RingId r);
uint32_t bus_ring_capacity(RingId r);
uint32_t bus_ring_peek(RingId r, uint8_t *out, uint32_t n);   // solo el consumidor
void     bus_ring_consume(RingId r, uint32_t n);
