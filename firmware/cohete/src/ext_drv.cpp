// ext_drv.cpp - Cuenta las apariciones del iman por interrupcion: el informe es cada segundo y una pasada rapida se perderia.
#include "ext_drv.h"
#include <driver/rtc_io.h>

static volatile uint32_t s_detections = 0;

static void IRAM_ATTR onMagnet() { s_detections = s_detections + 1; }

void extDrvBegin() {
    rtc_gpio_deinit((gpio_num_t)EXT_DRV_PIN);        // al despertar, el pin sigue en manos del dominio RTC
    pinMode(EXT_DRV_PIN, INPUT_PULLUP);              // no conozco la salida del modulo (abierta o push-pull): con pull-up sirven las dos
    attachInterrupt(EXT_DRV_PIN, onMagnet, FALLING);
}

DrvStats extDrvStats() {
    DrvStats s;
    s.magnet = digitalRead(EXT_DRV_PIN) == LOW;
    s.detections = s_detections;
    return s;
}
