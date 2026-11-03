// net_proto.h - Protocolo de radio comun a cohetes y tierra. C++11, sin dependencias de ESP32.
//
// TDMA alineado con UTC: 25 ranuras de 40 ms por segundo, en 5 grupos de 200 ms con el patron T A B A B.
//   Tierra (T): ranura 0 = baliza de hora; 5, 10, 15, 20 = comandos.
//   Cohete: 2 ranuras base, siempre activas (Demeter 1 y 13, Hermes 2 y 14), y 8 de extension solo en vuelo: 2 Hz o 10 Hz.
#pragma once
#include <stdint.h>
#include <stddef.h>

namespace net {

// LoRa. A BW250 un TELEM tarda 59 ms y no cabe en la ranura; a BW500, 29.5 ms.
static const float    FREQ_MHZ = 903.0f;
static const float    BW_KHZ   = 500.0f;
static const uint8_t  SF       = 7;
static const uint8_t  CR       = 5;
static const uint8_t  SYNC     = 0xD3;
static const uint16_t PREAMBLE = 8;

static const int64_t  SLOT_US      = 40000;
static const uint8_t  SLOTS_PER_S  = 25;
static const int64_t  TX_OFFSET_US = 2000;     // la transmision empieza 2 ms despues del inicio de la ranura

enum RocketId : uint8_t { GROUND = 0, DEMETER = 1, HERMES = 2 };
static const int64_t  BEACON_AIR_US = 12864;   // tiempo en aire teorico de un Beacon de 18 B
static const int64_t  RX_OPEN_US    = 6000;    // el cohete abre recepcion antes del inicio de la ranura de tierra
static const int64_t  RX_CLOSE_US   = 24000;   // y la cierra aqui: alcanza para un paquete de tierra de hasta 32 B

enum PktType  : uint8_t { P_TELEM = 1, P_BEACON = 2, P_CMD = 3, P_CMD_RESP = 4, P_LOG_INFO = 5 };
enum TelemFlags : uint8_t { TF_FLYING = 1, TF_BOOST_SIN_ARMAR = 2, TF_FORZADO = 4, TF_LAUNCH_VENCIDO = 8, TF_REANUDADO = 16 };

// Estados de la LilyGo y momentos del vuelo. En telemetria van juntos: estado en los 4 bits bajos, momento en los 4 altos.
enum State  : uint8_t { ST_NONE = 0, ST_TIERRA = 1, ST_ARMED = 2, ST_FLY = 3, ST_RECOVERY = 4 };
enum Moment : uint8_t { M_NONE = 0, M_LAUNCH = 1, M_BOOST = 2, M_COAST = 3, M_APOGEO = 4, M_CAIDA = 5, M_PARACAIDAS = 6, M_ATERRIZAJE = 7 };

// Comandos. Con OP_CONFIRM en op, es la confirmacion de un comando que el cohete declaro no apto (o de ARM).
enum Op : uint8_t { OP_PING = 1, OP_ARM = 2, OP_DISARM = 3, OP_LAUNCH = 4, OP_ABORT = 5, OP_SLEEP = 6, OP_SET_STATE = 7, OP_SET_MOMENT = 8, OP_RESET = 9, OP_BUZZER = 10, OP_PI_POWER = 11, OP_CONFIRM = 0x80 };
// CR_OK: ejecutado. CR_NO_APTO: no ejecutado, con motivos; espera confirmacion. CR_CONFIRMA: apto, pero pide segundo paso (ARM). CR_ERROR: no ejecutado, sin confirmacion posible.
enum CmdResult : uint8_t { CR_OK = 0, CR_NO_APTO = 1, CR_CONFIRMA = 2, CR_ERROR = 3 };
static const uint32_t CONFIRM_WINDOW_MS = 10000;   // la confirmacion vale esto, y solo si el comando y los motivos no cambiaron

// Motivos de una respuesta: mascara de bits; tierra los traduce con reasonText.
enum Reason : uint8_t {
    RZ_TRANSICION = 0, RZ_RESERVA, RZ_SD, RZ_LSM, RZ_BMP, RZ_GNSS, RZ_VBAT, RZ_SUBIENDO, RZ_BAJANDO, RZ_MOVIMIENTO, RZ_EN_VUELO,
    RZ_SIN_ATERRIZAJE, RZ_SIN_BOOST, RZ_NO_ARMADO, RZ_SIN_VUELO, RZ_YA_ESTA, RZ_IMAN, RZ_RECOVERY, RZ_CONFIRM, RZ_CONTADOR, RZ_OP, RZ_PI_DESCONOCIDA, RZ_COUNT
};
inline const char *reasonText(uint8_t r) {
    static const char *const T[RZ_COUNT] = {
        "esa transicion no existe desde el estado actual", "reserva incompleta", "la SD no esta registrando", "LSM6DSO32 sin datos", "BMP581 sin datos",
        "sin fix 3D del GNSS", "bateria baja", "altura aumentando", "altura disminuyendo", "aceleracion distinta de 1 g: el cohete se mueve", "en vuelo: ya hubo BOOST",
        "sin aterrizaje detectado", "sin BOOST detectado", "el cohete no esta armado", "no ha habido vuelo", "ya esta en ese estado", "hay un iman presente: despertaria al instante",
        "RECOVERY: aun sin bateria baja, el cohete debe seguir transmitiendo", "confirmacion invalida o vencida", "contador antiguo", "comando desconocido",
        "no se sabe si la Pi esta encendida: una pulsacion podria apagarla"
    };
    return r < RZ_COUNT ? T[r] : "?";
}

inline uint8_t slotOwner(uint8_t s) {
    const uint8_t p = s % 5;
    return p == 0 ? GROUND : ((p == 1 || p == 3) ? DEMETER : HERMES);
}
inline bool slotIsBase(uint8_t s) { return s == 1 || s == 13 || s == 2 || s == 14; }
inline bool slotIsTx(uint8_t rocket, uint8_t s, bool flying) { return slotOwner(s) == rocket && (flying || slotIsBase(s)); }

#pragma pack(push, 1)
// Telemetria, 64 B. El cuaternion va en identidad hasta que exista el EKF; actuators: bit 0 buzzer activo, bit 1 pulso de la Pi en curso, bit 2 se envio algun pulso a la Pi (T-413).
// utc_ms = inicio de la ranura; 0 si es la baliza lenta sin hora.
struct Telem {
    uint8_t  type;             // P_TELEM
    uint8_t  rocket_id;
    uint16_t mission_id;
    uint64_t utc_ms;
    int32_t  lat_e7, lon_e7;
    int32_t  alt_cm;
    int16_t  vn_cms, ve_cms, vd_cms;
    int16_t  quat[4];          // Hamilton, escalar primero, x32767
    int16_t  acc_mg[3];
    int16_t  gyro_01dps[3];
    uint8_t  fix, nsv;
    uint16_t vbat_mv;
    int8_t   temp_c[2];        // barometro, reservado
    uint8_t  state, flags;     // estado | momento << 4, TF_*
    uint16_t actuators;
    uint8_t  time_flags;       // bits 0-1 calidad, bits 2-3 fuente
    uint8_t  cmd_ack;          // bits 0-5 contador del ultimo comando, bits 6-7 CmdResult
    uint16_t crc;
};
// Baliza de hora de tierra, 18 B, ranura 0. utc_ms = inicio de esa ranura (segundo entero); debe crecer: es el contador anti-repeticion.
struct Beacon {
    uint8_t  type;             // P_BEACON
    uint8_t  time_flags;       // calidad de la hora de tierra
    uint64_t utc_ms;
    uint8_t  tag[8];           // HMAC de los 10 B anteriores
};
// Comando de tierra, 20 B, ranuras 5, 10, 15 y 20. counter debe crecer: es el anti-repeticion; el mismo counter es un reintento y no se ejecuta de nuevo.
struct Cmd {
    uint8_t  type;             // P_CMD
    uint8_t  target;           // RocketId
    uint8_t  op;               // Op, con OP_CONFIRM si es confirmacion
    uint8_t  arg;              // State o Moment
    uint32_t counter;
    uint32_t reasons;          // en una confirmacion: los motivos que se aceptan
    uint8_t  tag[8];           // HMAC de los 12 B anteriores
};
// Respuesta a un comando, 28 B. Ocupa el lugar de un TELEM en las dos siguientes ranuras propias. Sin firma, como TELEM.
struct CmdResp {
    uint8_t  type;             // P_CMD_RESP
    uint8_t  rocket_id;
    uint8_t  op, arg;          // los del comando
    uint8_t  result;           // CmdResult
    uint8_t  state;            // estado | momento << 4, tras ejecutar
    uint8_t  flags;            // TF_*
    uint8_t  spare_pct;        // reserva de la SD
    uint32_t counter;          // el del comando
    uint32_t reasons;          // bits de Reason
    uint32_t last_counter;     // ultimo aceptado: con RZ_CONTADOR, tierra sigue desde aqui
    int16_t  alt_dm;           // sobre el p0, barometro
    int16_t  vz_cms;           // positiva hacia arriba
    uint16_t vbat_mv;
    uint16_t crc;
};
// Estado del registro, 54 B, cada 5 s en lugar de un TELEM.
struct LogInfo {
    uint8_t  type;             // P_LOG_INFO
    uint8_t  rocket_id;
    uint8_t  recording;        // 0 no, 1 registrando, 2 archivo preparado al armar
    uint8_t  pct;              // del bloque de 32 MB
    uint8_t  spare_state;      // 0 no hay, 1 creando, 2 lista
    uint8_t  spare_pct;
    char     name[34];         // archivo que se registra o esta preparado; vacio si no hay ninguno
    uint32_t elapsed_s;
    uint32_t pos;              // bytes en el archivo
    uint32_t remain_s;         // lo que aun cabe en este archivo
    uint16_t crc;
};
#pragma pack(pop)
static_assert(sizeof(Telem) == 64, "Telem debe medir 64 B");
static_assert(sizeof(Beacon) == 18, "Beacon debe medir 18 B");
static_assert(sizeof(Cmd) == 20, "Cmd debe medir 20 B");
static_assert(sizeof(CmdResp) == 28, "CmdResp debe medir 28 B");
static_assert(sizeof(LogInfo) == 54, "LogInfo debe medir 54 B");

inline uint16_t crc16(const uint8_t *d, size_t n) {    // CCITT-FALSE
    uint16_t c = 0xFFFF;
    while (n--) {
        c ^= (uint16_t)(*d++) << 8;
        for (int i = 0; i < 8; i++) c = (c & 0x8000) ? (uint16_t)((c << 1) ^ 0x1021) : (uint16_t)(c << 1);
    }
    return c;
}

} // namespace net
