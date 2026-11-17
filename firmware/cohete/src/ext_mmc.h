// ext_mmc.h - Magnetometro externo MMC5983MA (I2C 0x30, bus de la tarea in_i2c): continuo a 100 Hz con SET periodico.
#pragma once
#include <stdint.h>
#include "core_bus.h"

// Ultima muestra para el EKF (cuentas con el cero en 0, ejes del chip, sin calibrar; t_us = instante local de deteccion del dato listo).
struct ExtMagSample {
    int64_t  t_us;
    uint32_t seq;
    int32_t  raw[3];
    float    lsb_per_gauss;
    uint8_t  flags;            // rec::MMCF_*
};
extern Latest<ExtMagSample> g_ext_mag;

struct ExtMmcStats {
    uint8_t  id;
    uint32_t samples, errs, sat, inits;
    uint32_t gapMaxUs;
    float    normG;
    float    fieldG;           // |H| de la medicion SET/RESET del arranque: no lleva el offset del puente
    float    offsetMg[3];      // offset del puente en esa medicion
};

bool        extMmcInit();
bool        extMmcStep();      // false si hubo error de bus
ExtMmcStats extMmcStats();
