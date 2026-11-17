#pragma once
#include <stdint.h>

struct GnssStats {
    uint8_t  fix, nsv, initOk;
    uint32_t frames, ckerr, pvt, gaps, edges, anchors, rejects, ack, nak, bytes;
    int32_t  lastGapMs;           // salto de iTOW del ultimo hueco (200 = 1 epoca perdida)
    const char *stat;             // estado de la inicializacion
};

void gnssBegin();                 // llamar desde setup() (el ISR del PPS queda en el nucleo que lo llama)
GnssStats gnssStats();
void gnssSetAnchors(bool use);    // prueba: false deja de anclar la hora al PPS, para ejercitar la hora por baliza
bool gnssAnchors();
