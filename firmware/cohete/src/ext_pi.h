// ext_pi.h - UART con la Raspberry Pi de Demeter (bloque 9a, 9b y 9c). Dueno de UART0: TXD 43 -> 1k -> RX de la Pi, RXD 44 <- TX de la Pi, 115200 8N1.
//   Trama (visionpack/demeter_protocol.py): AA 55 | tipo u8 | len u8 | payload | CRC16 CCITT-FALSE de tipo+len+payload, en big endian.
//   Recibe PAYLOAD_STATUS (0x30, 1 B o, desde D-056, 2 B con el motivo del error): el latido de la Pi, cada 1 s y en cada cambio de estado. Sin latido en PI_LATIDO_MS: desconocido.
//   Envia POSE (0x21, 54 B, demeter_pose.POSE_STRUCT) a 50 Hz. utc_us es la hora del primer byte: la Pi le resta lo que tarda la trama
//   y con eso disciplina su reloj (chrony, refclock SOCK) y ubica la pose de cada cuadro.
//   Comandos de mision (9c): la fase objetivo de la Pi sale del estado de la mision y se le manda el siguiente comando (pi_plan.h).
//   Solo corre en Demeter. Hermes no tiene Pi: piBegin no hace nada y piStatus da PI_DESCONOCIDO.
#pragma once
#include <stdint.h>
#include "rec_format.h"

static const uint32_t PI_BAUD          = 115200;
static const uint8_t  PI_RX_PIN        = 44;
static const uint8_t  PI_TX_PIN        = 43;
static const uint32_t PI_POSE_MS       = 20;       // 50 Hz
static const uint32_t PI_LATIDO_MS     = 3000;     // sin PAYLOAD_STATUS en este tiempo: estado desconocido
static const uint8_t  PI_DESCONOCIDO   = 0xFF;     // no es un StatusCode de la Pi
static const uint8_t  PI_MOTIVO_MAX    = 31;       // el motivo va en 5 bits de TELEM.actuators (bits 3-7)

// Tipos de trama (demeter_protocol.py)
static const uint8_t  PI_T_SYNC        = 0x10;     // PREFLIGHT_SYNC, LilyGo -> Pi (bloque 9c)
static const uint8_t  PI_T_POSE        = 0x21;     // POSE, LilyGo -> Pi
static const uint8_t  PI_T_STATUS      = 0x30;     // PAYLOAD_STATUS, Pi -> LilyGo

// Banderas de POSE (demeter_pose.py)
static const uint16_t PI_F_EKF   = 1u << 0;
static const uint16_t PI_F_ATT   = 1u << 1;
static const uint16_t PI_F_POS   = 1u << 2;
static const uint16_t PI_F_ALT   = 1u << 3;
static const uint8_t  PI_F_TSRC_SHIFT = 4;         // bits 4-5: 0 ninguna, 1 GNSS+PPS, 2 baliza de tierra, 3 retencion
static const uint16_t PI_F_TIME  = 1u << 6;        // hora con error < 1 ms
static const uint16_t PI_F_GNSS3D = 1u << 7;
static const uint16_t PI_F_FLY   = 1u << 8;

struct PiStats {
    bool     active;                // corre (solo Demeter)
    uint8_t  status;                // ultimo StatusCode, o PI_DESCONOCIDO
    uint8_t  reason;                // motivo del error (ErrorCode de demeter_protocol.py), 0 si no hay
    uint32_t ageMs;                 // desde el ultimo latido (0xFFFFFFFF si nunca)
    uint32_t rxBytes, rxFrames, crcErr, otherFrames, statusMsgs, changes, losses;
    uint32_t txPose, txSkipped;     // POSE enviadas; omitidas porque la FIFO de TX no tenia espacio
    uint16_t lastFlags;             // banderas de la ultima POSE
    uint8_t  goal;                  // fase objetivo de la Pi (piplan::Goal)
    uint8_t  lastCmd;               // ultimo comando enviado (0 ninguno)
    uint32_t cmds, cmdGaveUp;       // comandos enviados; veces que se agotaron los intentos de uno
};

// El anillo de red tiene un solo productor: la tarea de radio escribe estos registros (T_PI) en el log.
struct PiLog { int64_t t_us; rec::PiRec r; };

void        piBegin(uint8_t rocketId);     // despues de missionBegin
uint8_t     piStatus();                    // PI_DESCONOCIDO sin latido
uint8_t     piReason();                    // motivo del error de la Pi (0-31): PAYLOAD_STATUS de 2 bytes (D-056)
const char *piReasonName(uint8_t r);
PiStats     piStats();
bool        piTakeLog(PiLog &l);
const char *piStatusName(uint8_t s);
