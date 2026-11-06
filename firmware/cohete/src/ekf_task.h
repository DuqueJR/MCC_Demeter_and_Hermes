// ekf_task.h - EKF a bordo (D-060): tarea "ekf" en el nucleo 1, prioridad 3 (debajo de los IMU, 5 y 4). Ver ekf_core.h.
//   Entradas: cada muestra de los IMU por anillos SPSC (los llenan in_imu y ext_lsm), y la ultima muestra de barometros, magnetometros
//   y GNSS (Latest). Salidas: g_ekf (estado llevado al presente, para TELEM y la POSE de la Pi) y T_EKF en el log a 50 Hz.
//   Se reinicia al armar (sesgos del giro, p0 y actitud en la rampa) y toma la calibracion activa (calActiva) cuando cambia, fuera de FLY.
#pragma once
#include <stdint.h>
#include "core_bus.h"

struct EkfOut {
    bool     listo, hayOrigen, calibrado;
    uint8_t  fase;
    int64_t  t_us;                 // instante del estado (presente)
    float    q[4];                 // cuerpo FRD -> NED
    float    v[3];                 // NED, m/s
    float    f_g[3], w_dps[3];     // acel. especifica y giro en cuerpo, corregidos
    double   lat, lon;             // grados (si hayOrigen)
    float    alt_msl, alt_agl;     // m: MSL (origen GNSS menos la bajada) y sobre el p0 del barometro
    float    sd_att_deg, sd_pos_m, sd_alt_m;
};
extern Latest<EkfOut> g_ekf;

struct EkfStats { uint32_t pasos, lsmIn, qmiIn, lsmDrop, qmiDrop, cicloMaxUs, reinicios; uint32_t gnss, baro, mag, grav, rech; bool listo, calibrado; };

void     ekfBegin();
void     ekfLsm(int64_t t_us, const int16_t a[3], const int16_t g[3]);                       // ext_lsm, cada muestra
void     ekfQmi(int64_t t_us, const int16_t a[3], const int16_t g[3], float accLsb, float gyrLsb);   // in_imu, cada muestra
void     ekfTx(int64_t desde_us, int64_t hasta_us);   // la radio: ventana de transmision (el magnetometro se descarta ahi)
EkfStats ekfStats();
