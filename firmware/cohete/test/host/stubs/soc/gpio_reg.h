#pragma once
#include <stdint.h>
#define GPIO_OUT_W1TC_REG 1
#define GPIO_OUT_W1TS_REG 2
#define GPIO_OUT1_W1TC_REG 3
#define GPIO_OUT1_W1TS_REG 4
#define GPIO_IN1_REG 5
void REG_WRITE(int, uint32_t); uint32_t REG_READ(int);
