// in_i2c.h - Tarea duena del bus Wire (GPIO 17/18): lee los magnetometros y el barometro. Ninguna otra tarea usa Wire.
#pragma once
#include <stdint.h>

#ifndef IN_I2C_HZ
#define IN_I2C_HZ 400000
#endif

struct I2cStats {
    uint32_t busResets;
    bool     magUp, barUp, mmcUp;
};

void     i2cBegin();                     // lanza la tarea (nucleo 0); llamar desde setup() despues de bus_begin()
I2cStats i2cStats();

// Acceso a registros; solo desde la tarea in_i2c.
bool i2cRead(uint8_t addr, uint8_t reg, uint8_t *buf, uint8_t n);
bool i2cWrite(uint8_t addr, uint8_t reg, uint8_t val);
