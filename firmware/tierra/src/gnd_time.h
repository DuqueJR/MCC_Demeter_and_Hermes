// gnd_time.h - Hora de tierra: M8N (UBX heredado) + PPS + TimeModel, y posicion promediada.
#pragma once
#include <stdint.h>

void gndTimeBegin();
void gndTimeLoop();
void gndTimeReport();
bool gndTimeUtc(int64_t t_local_us, int64_t &utc_us);   // false si no hay hora con error < 1 ms
uint8_t gndTimeFlags(int64_t t_local_us);
