// ext_act.cpp - Buzzer (IO46) y pulso de encendido de la Pi (IO45). Sin esperas: el avance lo da extActStep() con la hora de la tarea de mision.
#include "ext_act.h"
#include <Arduino.h>
#include <driver/gpio.h>

static volatile bool     s_buzz = false, s_buzzHigh = false, s_pi = false, s_piSent = false, s_off = false;
static volatile uint32_t s_buzzAt = 0, s_piAt = 0;      // instante del proximo cambio (millis)

static inline bool due(uint32_t now, uint32_t at) { return (int32_t)(now - at) >= 0; }

static void buzzPin(bool high) {
    s_buzzHigh = high;
    digitalWrite(EXT_ACT_BUZZER_PIN, high ? HIGH : LOW);
}

static void piPin(bool high) { digitalWrite(EXT_ACT_PI_PIN, high ? HIGH : LOW); }

void extActBegin() {
    s_buzz = s_buzzHigh = s_pi = s_piSent = s_off = false;
    // Primero el nivel y la direccion y despues se libera el hold: tras un sueno profundo el pad sigue retenido en bajo
    digitalWrite(EXT_ACT_BUZZER_PIN, LOW);
    digitalWrite(EXT_ACT_PI_PIN, LOW);
    pinMode(EXT_ACT_BUZZER_PIN, OUTPUT);
    pinMode(EXT_ACT_PI_PIN, OUTPUT);
    gpio_hold_dis((gpio_num_t)EXT_ACT_BUZZER_PIN);
    gpio_hold_dis((gpio_num_t)EXT_ACT_PI_PIN);
    gpio_deep_sleep_hold_dis();
    digitalWrite(EXT_ACT_BUZZER_PIN, LOW);
    digitalWrite(EXT_ACT_PI_PIN, LOW);
}

void extActBuzzer(bool on, uint32_t nowMs) {
    if (!on) {
        s_buzz = false;
        buzzPin(false);
        return;
    }
    if (s_buzz || s_off) return;                         // ya corre: la fase del patron no se reinicia
    s_buzz = true;
    s_buzzAt = nowMs + BUZZER_ON_MS;
    buzzPin(true);
}

void extActPiPulse(uint32_t nowMs) {
    if (s_pi || s_off) return;
    s_pi = true;
    s_piSent = true;
    s_piAt = nowMs + PI_PULSO_MS;
    piPin(true);
}

void extActStep(uint32_t nowMs) {
    if (s_off) return;
    if (s_buzz && due(nowMs, s_buzzAt)) {
        if (s_buzzHigh) { buzzPin(false); s_buzzAt = nowMs + BUZZER_OFF_MS; }
        else            { buzzPin(true);  s_buzzAt = nowMs + BUZZER_ON_MS; }
    }
    if (s_pi && due(nowMs, s_piAt)) {
        s_pi = false;
        piPin(false);
    }
}

uint16_t extActBits() {
    return (uint16_t)((s_buzz ? ACT_BUZZER_ACTIVO : 0) | (s_pi ? ACT_PI_EN_CURSO : 0) | (s_piSent ? ACT_PI_ENVIADO : 0));
}

void extActSleep() {
    s_off = true;                                        // extActStep y los comandos ya no los vuelven a activar
    s_buzz = false;
    s_pi = false;
    buzzPin(false);
    piPin(false);
    // Los dos pines son pads digitales (no RTC) del ESP32-S3: sin hold, al dormir el dominio digital pierde su nivel.
    // Quedan como salida en bajo y se retienen; extActBegin() libera el hold al despertar.
    gpio_hold_en((gpio_num_t)EXT_ACT_BUZZER_PIN);
    gpio_hold_en((gpio_num_t)EXT_ACT_PI_PIN);
    gpio_deep_sleep_hold_en();
}
