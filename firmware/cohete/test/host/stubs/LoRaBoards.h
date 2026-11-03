#pragma once
#include <stdint.h>
struct SPISettings { SPISettings(uint32_t,int,int){} };
struct SPIClass { void beginTransaction(SPISettings); void endTransaction(); uint8_t transfer(uint8_t); void transferBytes(const uint8_t*, uint8_t*, uint32_t); };
extern SPIClass SDCardSPI;
#define IMU_CS 1
#define IMU_INT 2
