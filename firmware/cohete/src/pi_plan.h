// pi_plan.h - Que comando mandarle a la Pi de Demeter (bloque 9c). C++11 puro, sin Arduino: se prueba en el PC.
//   La LilyGo no dispara un comando por transicion: calcula la fase en que deberia estar la Pi segun la mision (goalFor) y, con el
//   ultimo estado que la Pi informo por su latido, el siguiente comando para llevarla ahi (nextCmd). Asi se recupera sola si un comando
//   se pierde, si la Pi se reinicia o si hay BOOST sin armar (encadena PREFLIGHT, ARM y START_ASCENT).
//   Los estados y comandos son los de visionpack/demeter_protocol.py y demeter_missiond.py (TRANSITIONS).
#pragma once
#include <stdint.h>
#include <net_proto.h>

namespace piplan {

// StatusCode de la Pi (demeter_protocol.py)
enum PiSt : uint8_t { PS_BOOT = 0x00, PS_PREFLIGHT = 0x01, PS_READY = 0x02, PS_ARMED = 0x03, PS_STARTING = 0x04, PS_INGESTING = 0x05,
                      PS_PROCESSING = 0x06, PS_COMPLETE = 0x07, PS_ASCENT = 0x08, PS_RECORDING = 0x30, PS_ABORTED = 0xE0,
                      PS_ERROR = 0xEF, PS_DESCONOCIDO = 0xFF };

// Comandos LilyGo -> Pi (tipo de trama, sin payload)
enum Cmd : uint8_t { C_NADA = 0, C_PREFLIGHT = 0xA0, C_ARM = 0xA1, C_START_ASCENT = 0xA2, C_START_REC = 0xB1, C_TOUCHDOWN = 0xC1, C_ABORT = 0xF1 };

// Fase objetivo de la Pi
enum Goal : uint8_t { G_NADA = 0, G_READY = 1, G_ARMED = 2, G_ASCENT = 3, G_REC = 4, G_FIN = 5 };

// TIERRA: lista (READY). ARMED, y FLY sin BOOST (LAUNCH): armada. FLY forzado sin BOOST (registro en banco o calibracion): solo lista.
// Tras BOOST: video del ascenso; desde APOGEO, CAIDA o PARACAIDAS (lo primero que llegue): captura del descenso. ATERRIZAJE o RECOVERY: fin.
inline Goal goalFor(uint8_t state, uint8_t moment, uint8_t flags) {
    switch (state) {
    case net::ST_TIERRA: return G_READY;
    case net::ST_ARMED:  return G_ARMED;
    case net::ST_FLY:
        if (moment == net::M_ATERRIZAJE) return G_FIN;
        if (moment >= net::M_APOGEO) return G_REC;          // APOGEO, CAIDA, PARACAIDAS
        if (moment >= net::M_BOOST) return G_ASCENT;        // BOOST, COAST
        return (flags & net::TF_FORZADO) ? G_READY : G_ARMED;
    case net::ST_RECOVERY: return G_FIN;
    default: return G_NADA;
    }
}

// Siguiente comando para llevar a la Pi de st hacia g. C_NADA si ya esta, si esta en transito (PREFLIGHT, STARTING), si no se sabe su
// estado o si ya termino (INGESTING, PROCESSING, COMPLETE). Tras COMPLETE missiond termina y systemd lo reinicia en BOOT: con G_FIN no se toca.
inline Cmd nextCmd(Goal g, uint8_t st) {
    if (g == G_NADA) return C_NADA;
    switch (st) {
    case PS_BOOT:
    case PS_ABORTED:
    case PS_ERROR:     return g == G_FIN ? C_NADA : C_PREFLIGHT;
    case PS_READY:     return (g == G_ARMED || g == G_ASCENT || g == G_REC) ? C_ARM : C_NADA;
    case PS_ARMED:     return (g == G_READY || g == G_FIN) ? C_ABORT : (g == G_ASCENT || g == G_REC ? C_START_ASCENT : C_NADA);
    case PS_ASCENT:    return g == G_READY ? C_ABORT : ((g == G_REC || g == G_FIN) ? C_START_REC : C_NADA);
    case PS_RECORDING: return g == G_READY ? C_ABORT : (g == G_FIN ? C_TOUCHDOWN : C_NADA);
    default:           return C_NADA;                       // PREFLIGHT, STARTING, INGESTING, PROCESSING, COMPLETE, desconocido
    }
}

inline const char *goalName(uint8_t g) {
    static const char *const N[] = {"-", "READY", "ARMED", "ASCENT", "REC", "FIN"};
    return g <= G_FIN ? N[g] : "?";
}

inline const char *cmdName(uint8_t c) {
    switch (c) {
    case C_PREFLIGHT: return "PREFLIGHT";
    case C_ARM: return "ARM";
    case C_START_ASCENT: return "START_ASCENT";
    case C_START_REC: return "START_REC";
    case C_TOUCHDOWN: return "TOUCHDOWN";
    case C_ABORT: return "ABORT";
    default: return "-";
    }
}

} // namespace piplan
