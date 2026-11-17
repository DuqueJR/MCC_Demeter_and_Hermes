// in_i2c.cpp - Un sensor que falla no frena al otro: se reintenta cada segundo; si fallan los dos, se reinicia el bus.
#include "in_i2c.h"
#include "in_mag.h"
#include "in_bar.h"
#include "ext_mmc.h"
#include "LoRaBoards.h"          // I2C_SDA, I2C_SCL
#include <Wire.h>

static const uint16_t TIMEOUT_MS = 10;
static const uint32_t RETRY_MS   = 1000;
static const uint32_t MAX_FAILS  = 5;        // errores seguidos para dar un sensor por caido
static const uint32_t TICK_MS    = 2;

static I2cStats s_st;

bool i2cRead(uint8_t addr, uint8_t reg, uint8_t *buf, uint8_t n) {
    Wire.beginTransmission(addr);
    Wire.write(reg);
    if (Wire.endTransmission(false) != 0) return false;
    if (Wire.requestFrom((int)addr, (int)n) != n) return false;
    for (uint8_t i = 0; i < n; i++) buf[i] = (uint8_t)Wire.read();
    return true;
}

bool i2cWrite(uint8_t addr, uint8_t reg, uint8_t val) {
    Wire.beginTransmission(addr);
    Wire.write(reg);
    Wire.write(val);
    return Wire.endTransmission() == 0;
}

static void busStart() {                     // aqui, no en setup(): la interrupcion del I2C queda en el nucleo 0, lejos del IMU
    Wire.end();
    Wire.begin(I2C_SDA, I2C_SCL, IN_I2C_HZ);
    Wire.setTimeOut(TIMEOUT_MS);
}

static void i2cTask(void *) {
    busStart();
    bool magUp = magInit(), barUp = barInit(), mmcUp = extMmcInit();
    uint32_t magFails = 0, barFails = 0, mmcFails = 0, lastRetry = millis();
    for (;;) {
        if (magUp) {
            if (magStep()) magFails = 0;
            else if (++magFails >= MAX_FAILS) { magUp = false; magFails = 0; }
        }
        if (barUp) {
            if (barStep()) barFails = 0;
            else if (++barFails >= MAX_FAILS) { barUp = false; barFails = 0; }
        }
        if (mmcUp) {
            if (extMmcStep()) mmcFails = 0;
            else if (++mmcFails >= MAX_FAILS) { mmcUp = false; mmcFails = 0; }
        }
        if ((!magUp || !barUp || !mmcUp) && millis() - lastRetry >= RETRY_MS) {
            lastRetry = millis();
            if (!magUp && !barUp) { busStart(); s_st.busResets++; }    // el MMC no cuenta: puede no estar conectado
            if (!magUp) magUp = magInit();
            if (!barUp) barUp = barInit();
            if (!mmcUp) mmcUp = extMmcInit();
        }
        s_st.magUp = magUp; s_st.barUp = barUp; s_st.mmcUp = mmcUp;
        vTaskDelay(pdMS_TO_TICKS(TICK_MS));
    }
}

void i2cBegin() {
    xTaskCreatePinnedToCore(i2cTask, "in_i2c", 4096, nullptr, 3, nullptr, 0);
}

I2cStats i2cStats() { return s_st; }
