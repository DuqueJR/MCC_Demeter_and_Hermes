// in_bar.h - Barometro interno BME280 (I2C 0x77 o 0x76): modo forzado, compensacion Bosch y registro crudo.
#pragma once
#include <stdint.h>
#include "core_bus.h"

// Ultima muestra para el EKF. t_us = instante local estimado de la medicion de presion (centro de esa fase).
struct BarSample {
    int64_t  t_us;
    uint32_t seq;
    float    press_pa, temp_c, hum_pct;
};
extern Latest<BarSample> g_bar;

struct BarStats {
    uint32_t samples, errs, timeouts, inits;
    uint32_t measMaxUs;
    float    press_pa, temp_c, hum_pct;
    uint8_t  addr;
};

bool     barInit();
bool     barStep();            // false si hubo error de bus
BarStats barStats();
