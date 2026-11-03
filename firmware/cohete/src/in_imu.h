// in_imu.h - IMU interno QMI8658C (SPI compartido con la SD): FIFO + interrupcion, reloj de muestras y registro crudo.
#pragma once
#include <stdint.h>
#include "core_bus.h"

// Rangos (macros -D para cambiarlos). Los registros T_IMU llevan el fondo de escala usado.
#ifndef IMU_ACC_FS_G
#define IMU_ACC_FS_G 16        // 2, 4, 8 o 16 g
#endif
#ifndef IMU_GYR_FS_DPS
#define IMU_GYR_FS_DPS 1024    // 16..1024 dps
#endif

#ifndef IMU_WTM
#define IMU_WTM 16             // muestras en el FIFO que disparan la interrupcion (16..64); mas alto = menos lecturas por segundo
#endif

#ifndef IMU_SPI_HZ
#define IMU_SPI_HZ 8000000     // lectura del FIFO (SensorLib configura a 1 MHz). Maximo 15 MHz, pero SDO tarda hasta 50 ns: 8 MHz deja margen
#endif

// Ultima muestra publicada para el EKF (cuentas crudas, ejes del chip; t_us = reloj local estimado).
struct ImuSample {
    int64_t  t_us;
    uint64_t n;
    int16_t  a[3];
    int16_t  g[3];
    float    acc_lsb_per_g;
    float    gyr_lsb_per_dps;
};
extern Latest<ImuSample> g_imu;

struct ImuStats {
    uint8_t  state;                      // 0 sin iniciar, 1 esperando logger, 2 muestreando, 3 error
    const char *msg;
    uint32_t batches, samples, isr, timeouts, full, empty, mutexFail, logDrops;
    uint32_t lost, cmdFail;              // muestras perdidas (estimadas por tiempo), handshakes CTRL9 fallidos
    uint32_t readMaxUs, readAvgUs;
    uint32_t windowMaxUs, windowAvgUs;   // tiempo en modo lectura del FIFO
    double   periodUs, odrHz, rmsUs;
    uint32_t estRejects, estResets;
};

void     imuBegin();                     // lanza la tarea (nucleo 1); llamar desde setup() despues de bus_begin() y loggerBegin()
ImuStats imuStats();
