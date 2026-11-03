#pragma once
#include <stdint.h>
#include <Arduino.h>
struct SPISettings { SPISettings(uint32_t,int,int){} };
struct SPIClass { void beginTransaction(SPISettings); void endTransaction(); uint8_t transfer(uint8_t); void transferBytes(const uint8_t*, uint8_t*, uint32_t); };
extern SPIClass SDCardSPI;
#define IMU_CS 1
#define IMU_INT 2
// T-413: PMU, rieles y pines del radio, solo para -fsyntax-only de core_sleep.cpp y net_radio.cpp
struct PmuStub { void enableBattDetection(); };
extern PmuStub *PMU;
void disablePeripherals();
#define RADIO_CS_PIN 1
#define RADIO_DIO1_PIN 2
#define RADIO_RST_PIN 3
#define RADIO_BUSY_PIN 4
#ifndef NET_TX_DBM
#define NET_TX_DBM 10
#endif
