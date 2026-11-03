#pragma once
#include <stdint.h>
struct Preferences { bool begin(const char*, bool); uint32_t getULong(const char*, uint32_t); void putULong(const char*, uint32_t); };
