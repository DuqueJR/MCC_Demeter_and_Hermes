// ext_lsm.h - IMU externo LSM6DSO32 (principal), SPI por software: FIFO continuo con timestamp, BMP581 en el sensor hub.
#pragma once
#include <stdint.h>
#include "core_bus.h"
#include "in_imu.h"             // ImuSample

#ifndef EXT_LSM_SPI_NOPS
#define EXT_LSM_SPI_NOPS 8      // espera por medio periodo de SCK. El monitor informa la velocidad real; maximo del chip 10 MHz
#endif

extern Latest<ImuSample> g_ext_imu;   // ultima muestra para el EKF (cuentas crudas, ejes del chip)

struct ExtLsmStats {
    const char *msg;
    uint8_t  who, hubOk;
    int8_t   freqFine;                    // INTERNAL_FREQ_FINE: desviacion de fabrica del oscilador, 0.15 % por unidad
    uint8_t  hubSt;                       // STATUS_MASTER del paso que fallo
    uint32_t spiKhz, whoErrs;             // medidos al arrancar con 1000 lecturas de WHO_AM_I
    uint32_t batches, samples, lost, overruns, badTags, isr, polled, empty, logDrops;
    uint32_t readAvgUs, readMaxUs;
    uint32_t tsWords;
    double   odrHz, rmsUs;
    uint32_t estRejects, estResets;
};

void        extLsmBegin();              // lanza la tarea (nucleo 1); llamar despues de bus_begin() y loggerBegin()
ExtLsmStats extLsmStats();
