// in_mag.h - Magnetometro interno QMC6309 (I2C 0x7C): modo normal, consulta de DRDY y registro crudo.
#pragma once
#include <stdint.h>
#include "core_bus.h"

#ifndef MAG_FS_G
#define MAG_FS_G 8             // 8, 16 o 32 gauss
#endif
#ifndef MAG_ODR_HZ
#define MAG_ODR_HZ 100         // 10, 50, 100 o 200
#endif

// Ultima muestra para el EKF (cuentas crudas, ejes del chip, sin calibrar; t_us = instante local de deteccion de DRDY).
struct MagSample {
    int64_t  t_us;
    uint32_t seq;
    int16_t  raw[3];
    float    lsb_per_gauss;
    uint8_t  flags;            // rec::MF_*
};
extern Latest<MagSample> g_mag;

struct MagStats {
    uint32_t samples, errs, ovfl, inits;
    uint32_t gapMaxUs;
    float    normG;
    uint8_t  id;               // lo leido al iniciar; 0xFF si no responde
};

bool     magInit();
bool     magStep();            // false si hubo error de bus
MagStats magStats();
