// enganches.h - Banco de replay (T-305): lo que los consumidores de los sensores del firmware le entregan a los detectores, repetido en el PC.
//
// En el chip, cada muestra del IMU pasa de la tarea del sensor al detector (ext_lsm.cpp y in_imu.cpp, nucleo 1) y los barometros llegan a la
// tarea de mision por g_ext_bar / g_bar. Esos dos .cpp no compilan en el PC (SPI, FreeRTOS, FIFO), asi que el banco lee los registros `rec` y
// hace por su cuenta lo mismo que ellos hacen con cada palabra del FIFO. Lo unico que hay que mantener a la par son estas llamadas.
//
// CUANDO T-412 AGREGUE UN DETECTOR (por ejemplo moment_detect.cpp):
//   1. replay.py: sumarlo a FUENTES_DETECTORES (una linea).
//   2. Aqui: repetir la llamada que el firmware agregue en ext_lsm.cpp / in_imu.cpp, en el enganche que corresponda (una linea por llamada).
//   replay.py comprueba por texto que todo `boost*(` / `moment*(` que aparezca en ext_lsm.cpp o in_imu.cpp tambien aparezca en este archivo:
//   si el firmware cableo un detector y aqui falta, el banco falla en vez de pasar con el detector desconectado.
//   Lo que el detector lea de g_ext_bar, g_bar, g_ext_imu, g_imu o g_gnss ya lo alimenta el banco (prueba_replay.cpp, funcion procesar).
#pragma once
#include <stdint.h>
#include "boost_detect.h"

// ---- Constantes de los consumidores, con el mismo nombre y valor que en el firmware (son privadas de cada .cpp, por eso se repiten) ----
static const uint8_t TAG_GYRO = 0x01, TAG_ACC = 0x02, TAG_TEMP = 0x03, TAG_TS = 0x04, TAG_CFG = 0x05, TAG_HUB0 = 0x0E, TAG_HUB_NACK = 0x19;   // ext_lsm.cpp:39
static const uint16_t WORD_B = 7;                                  // bytes de una palabra del FIFO del LSM6DSO32: tag + 6 de datos
static const uint16_t QMI_SAMPLE_B = 12;                           // bytes de una muestra del QMI8658C: ax ay az gx gy gz (int16)
static const float    GYR_LSB_PER_DPS_LSM = 1000.0f / 70.0f;       // ext_lsm.cpp:51
static const int64_t  P_CENTER_US = 11250;                         // in_bar.cpp:18: el instante del BME280 es t_trig + este centro de la fase de presion
static const int64_t  LSM_PERIODO_NOMINAL_US = 600;                // la ranura nominal si el registro no trae periodo (ext_lsm.cpp)
static const double   QMI_HZ_NOMINAL = 445.0;                      // constantes.md seccion 5: tasa del QMI8658C, si el registro no trae periodo

// Sensibilidad del acelerometro del LSM6DSO32 segun el fondo de escala del registro (hoja de datos, tabla de sensibilidades; ext_lsm.cpp:51 usa la de +-32 g)
static inline float lsmLsbPorG(uint8_t fsG) {
    switch (fsG) { case 2: return 1000.0f / 0.061f; case 4: return 1000.0f / 0.122f; case 8: return 1000.0f / 0.244f; case 16: return 1000.0f / 0.488f; default: return 1000.0f / 0.976f; }
}
// QMI8658C: 32768 / fondo de escala (in_imu.cpp:127)
static inline float qmiLsbPorG(uint8_t fsG) { return 32768.0f / (fsG ? fsG : 16); }

// ---- Los enganches: una llamada por cada una que el firmware hace por muestra ----
// ext_lsm.cpp:308, por cada palabra TAG_ACC del FIFO del LSM6DSO32, con su hora estimada
static inline void engancheMuestraLsm(int64_t t_us, const int16_t a[3], float lsbPerG) { boostLsmSample(t_us, a, lsbPerG); }
// in_imu.cpp:197, por cada muestra del FIFO del QMI8658C
static inline void engancheMuestraQmi(int64_t t_us, const int16_t a[3], float lsbPerG) { boostQmiSample(t_us, a, lsbPerG); }
