#pragma once
// Stub de RadioLib: solo los metodos que usa net_radio.cpp, para -fsyntax-only en el PC
#include <stdint.h>
#include <stddef.h>
#define RADIOLIB_ERR_NONE 0
struct Module { Module(int, int, int, int); };
struct SX1262 {
    SX1262(Module *);
    int16_t begin(float, float, uint8_t, uint8_t, uint8_t, int8_t, uint16_t);
    int16_t startTransmit(uint8_t *, size_t); int16_t finishTransmit(); int16_t startReceive(); int16_t standby();
    size_t getPacketLength(); int16_t readData(uint8_t *, size_t); float getRSSI(); float getSNR();
    int16_t setCurrentLimit(float); int16_t setCRC(uint8_t); void setDio1Action(void (*)());
};
