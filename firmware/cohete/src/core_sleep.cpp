// core_sleep.cpp - Apaga los actuadores, cierra los logs, corta todos los rieles menos DC1 (ESP32 y DRV5032) y duerme. Despertar equivale a un arranque completo.
#include "core_sleep.h"
#include "ext_drv.h"
#include "ext_act.h"
#include "logger.h"
#include "LoRaBoards.h"
#include <driver/rtc_io.h>
#include <esp_sleep.h>

static const uint32_t LOG_STOP_MS = 5000;

bool coreSleepEnter() {
    // Con el iman presente despertaria al instante
    if (extDrvStats().magnet) return false;

    // Buzzer e IO45 en bajo y retenidos (gpio_hold) antes de cortar nada: son pads digitales y sin hold el sueno profundo no garantiza su nivel
    extActSleep();

    const bool logOk = loggerStop(LOG_STOP_MS);
    Serial.printf("[sleep] a dormir, logs %s; despierta con el iman\n", logOk ? "cerrados" : "SIN CERRAR");
    delay(100);                                      // deja salir el mensaje; la conexion USB cae al dormir

    disablePeripherals();
    PMU->enableBattDetection();                      // disablePeripherals la apaga y sobrevive al sueno: sin ella getBattVoltage daria 0 al despertar

    esp_sleep_enable_ext0_wakeup((gpio_num_t)EXT_DRV_PIN, 0);
    rtc_gpio_pullup_en((gpio_num_t)EXT_DRV_PIN);
    rtc_gpio_pulldown_dis((gpio_num_t)EXT_DRV_PIN);
    esp_deep_sleep_start();
    return true;
}

const char *coreWakeCause() {
    return esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_EXT0 ? "iman" : "reset";
}
