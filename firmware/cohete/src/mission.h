// mission.h - Estados de la LilyGo y comandos de tierra: evalua si un comando es apto, pide confirmacion y lo ejecuta.
#pragma once
#include <stdint.h>
#include <net_proto.h>
#include "rec_format.h"

struct MissionStats {
    uint8_t  state, moment, flags;
    float    altM, vzMps;          // sobre el p0, barometro
    uint8_t  baroSrc;              // 0 BMP581, 1 BME280, 2 ninguno
    uint32_t cmds, lastCounter, lastReasons;
    uint8_t  lastResult;
};

// El anillo de red tiene un solo productor: la tarea de radio escribe estos registros en el log.
struct MissionLog { int64_t t_us; rec::MissionRec r; };

void         missionBegin(uint8_t rocketId);        // antes de netBegin
void         missionOnCmd(const net::Cmd &c);       // ya firmado y dirigido a este cohete; lo llama la tarea de radio
uint8_t      missionStateByte();                    // estado | momento << 4
uint8_t      missionFlags();                        // TF_*
uint8_t      missionAck();                          // byte cmd_ack
bool         missionTakeLog(MissionLog &l);
bool         missionTakeSleep();                    // true una vez, cuando la respuesta ya salio: el bucle principal (dueno de la PMU) duerme
bool         missionTakeReset();                    // igual, para reiniciar
MissionStats missionStats();
bool         missionP0(float p0[2]);                // p0 del BMP581 y del BME280 (0 si no hay); el EKF los usa al reanudar en vuelo sin foto
