// net_radio.h - Radio del cohete: telemetria por ranuras TDMA alineadas con UTC; baliza lenta si no hay hora.
#pragma once
#include <stdint.h>
#include <net_proto.h>

#ifndef NET_TX_DBM
#define NET_TX_DBM 10          // para prueba de banco; 22 para alcance y vuelo
#endif

struct NetStats {
    bool     radioOk;
    bool     slotted;          // false = sin hora: baliza lenta
    uint32_t tx, beacons, txErr, skipped;
    uint32_t lateMaxUs;        // inicio real de TX respecto al previsto
    uint32_t endMaxUs;         // fin de TX respecto al inicio de la ranura (debe ser < 40000)
    uint32_t airUs;
    uint32_t rx, rxBad, rxOther, rxSkipped;
    uint32_t rxCmd, txResp;
    int32_t  lastResUs;        // ultima baliza: UTC propio al recibirla menos UTC segun tierra
};

void     netBegin(uint8_t rocketId, uint16_t missionId);   // lanza la tarea (nucleo 0)
NetStats netStats();
void     netSetFlying(bool flying);                        // true: 10 Hz; false: 2 Hz
bool     netFlying();
void     netQueueResp(const net::CmdResp &r);              // sale en las dos siguientes ranuras propias, en lugar de TELEM
