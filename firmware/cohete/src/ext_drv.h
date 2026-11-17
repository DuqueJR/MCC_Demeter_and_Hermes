// ext_drv.h - Detector de iman externo (DRV5032, modulo Scout Makes) en IO21, alimentado por DC1. Salida en 0 V con iman.
#pragma once
#include <Arduino.h>

static const uint8_t EXT_DRV_PIN = 21;

struct DrvStats {
    bool     magnet;       // iman presente ahora
    uint32_t detections;   // veces que aparecio el iman desde el arranque
};

void extDrvBegin();
DrvStats extDrvStats();
