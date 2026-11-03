#include "LoRaBoards.h"
#ifdef TEST_CORE
#include "core_selftest.h"
#include "core_bus.h"
#endif
#ifdef TEST_GNSS_PPS
#include "test_gnss_pps.h"
#endif
#ifdef TEST_SD_IMU
#include "test_sd_imu.h"
#endif
#ifdef TEST_LORA_TX
#include "test_lora.h"
#endif

static int lastChg = -1;

void setup() {
    setupBoards();            // PMU, rails, buses I2C/SPI, UART del GNSS
    Serial.println("[boot] tbeam_fw fase0");
#ifdef TEST_CORE
    coreSelftestBegin();
#endif
#ifdef TEST_SD_IMU
    testSdImuBegin();
#endif
#ifdef TEST_GNSS_PPS
    testGnssPpsBegin();
#endif
#ifdef TEST_LORA_TX
    testLoraBegin();
#endif
}

void loop() {
    int chg = PMU->isCharging() ? 1 : 0;
    if (chg != lastChg) {
        lastChg = chg;
        PMU->setChargingLedMode(chg ? XPOWERS_CHG_LED_BLINK_1HZ
                                    : XPOWERS_CHG_LED_ON);
    }
    static uint32_t t = 0;
    if (millis() - t >= 1000) {
        t = millis();
        const uint16_t vbat = PMU->getBattVoltage();
        Serial.printf("[pmu] vbat=%u mV vbus=%u mV chg=%d\n",
                      vbat, PMU->getVbusVoltage(), chg);
#ifdef TEST_CORE
        g_vbat_mv = vbat;
        coreSelftestReport();
#endif
#ifdef TEST_GNSS_PPS
        testGnssPpsReport();
#endif
#ifdef TEST_SD_IMU
        testSdImuReport();
#endif
    }
#ifdef TEST_LORA_TX
    testLoraLoop();
#endif
}