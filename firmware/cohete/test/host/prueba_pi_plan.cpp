// prueba_pi_plan.cpp - Prueba en el PC de pi_plan.h (bloque 9c, D-055): la fase objetivo de la Pi segun la mision y el siguiente
// comando segun su estado. Las cadenas se recorren contra un modelo de las transiciones de demeter_missiond.py (TRANSITIONS y lo que
// hace cada comando), escrito a mano: si alguien cambia pi_plan.h o missiond, la prueba lo nota.
#include <stdio.h>
#include <string>
#include "pi_plan.h"

using namespace piplan;
using namespace net;

static int g_fallas = 0;
#define CHECK(cond, msg) do { const bool ok_ = (cond); printf("  [%s] %s\n", ok_ ? "OK" : "FALLA", msg); if (!ok_) g_fallas++; } while (0)

// Lo que hace missiond con cada comando, desde cada estado (si no lo acepta, el estado no cambia)
static uint8_t efecto(piplan::Cmd c, uint8_t st) {
    switch (c) {
    case C_PREFLIGHT:    return (st == PS_BOOT || st == PS_ABORTED || st == PS_ERROR) ? PS_READY : st;
    case C_ARM:          return st == PS_READY ? PS_ARMED : st;
    case C_START_ASCENT: return st == PS_ARMED ? PS_ASCENT : st;
    case C_START_REC:    return st == PS_ASCENT ? PS_RECORDING : st;      // pasa por STARTING
    case C_TOUCHDOWN:    return st == PS_RECORDING ? PS_COMPLETE : st;    // INGESTING, PROCESSING, COMPLETE
    case C_ABORT:        return (st == PS_ARMED || st == PS_ASCENT || st == PS_RECORDING || st == PS_PREFLIGHT) ? PS_ABORTED : st;
    default:             return st;
    }
}

// Lleva la Pi desde st hacia g aplicando nextCmd hasta que no haya comando; devuelve la cadena y deja el estado final en st
static std::string cadena(Goal g, uint8_t &st) {
    std::string out;
    for (int i = 0; i < 8; i++) {
        const piplan::Cmd c = nextCmd(g, st);
        if (c == C_NADA) break;
        const uint8_t nuevo = efecto(c, st);
        if (!out.empty()) out += " ";
        out += cmdName(c);
        if (nuevo == st) { out += "(sin efecto)"; break; }      // un comando que missiond rechaza: bucle
        st = nuevo;
    }
    return out;
}

int main() {
    printf("fase objetivo (goalFor)\n");
    CHECK(goalFor(ST_TIERRA, M_NONE, 0) == G_READY, "TIERRA -> READY");
    CHECK(goalFor(ST_ARMED, M_NONE, 0) == G_ARMED, "ARMED -> ARMED");
    CHECK(goalFor(ST_FLY, M_LAUNCH, 0) == G_ARMED, "FLY tras LAUNCH -> ARMED");
    CHECK(goalFor(ST_FLY, M_LAUNCH, TF_FORZADO) == G_READY, "FLY forzado sin BOOST (banco, calibracion) -> READY");
    CHECK(goalFor(ST_FLY, M_BOOST, 0) == G_ASCENT && goalFor(ST_FLY, M_COAST, 0) == G_ASCENT, "BOOST y COAST -> ASCENT");
    CHECK(goalFor(ST_FLY, M_BOOST, TF_FORZADO | TF_BOOST_SIN_ARMAR) == G_ASCENT, "BOOST forzado o sin armar -> ASCENT");
    CHECK(goalFor(ST_FLY, M_APOGEO, 0) == G_REC && goalFor(ST_FLY, M_CAIDA, 0) == G_REC && goalFor(ST_FLY, M_PARACAIDAS, 0) == G_REC,
          "APOGEO, CAIDA y PARACAIDAS -> REC");
    CHECK(goalFor(ST_FLY, M_ATERRIZAJE, 0) == G_FIN && goalFor(ST_RECOVERY, M_ATERRIZAJE, 0) == G_FIN, "ATERRIZAJE y RECOVERY -> FIN");
    CHECK(goalFor(ST_NONE, M_NONE, 0) == G_NADA, "sin estado -> nada");

    printf("siguiente comando (nextCmd)\n");
    const uint8_t quietos[] = {PS_PREFLIGHT, PS_STARTING, PS_INGESTING, PS_PROCESSING, PS_COMPLETE, PS_DESCONOCIDO};
    bool nada = true;
    for (uint8_t g = G_NADA; g <= G_FIN; g++)
        for (uint8_t st : quietos) nada = nada && nextCmd((Goal)g, st) == C_NADA;
    CHECK(nada, "en transito, terminada o desconocida: nunca se le manda nada");
    bool sinMeta = true;
    const uint8_t todos[] = {PS_BOOT, PS_READY, PS_ARMED, PS_ASCENT, PS_RECORDING, PS_ABORTED, PS_ERROR};
    for (uint8_t st : todos) sinMeta = sinMeta && nextCmd(G_NADA, st) == C_NADA;
    CHECK(sinMeta, "sin fase objetivo: nada");
    CHECK(nextCmd(G_FIN, PS_BOOT) == C_NADA, "fin y la Pi reiniciada en BOOT tras COMPLETE: no se toca");
    CHECK(nextCmd(G_READY, PS_ERROR) == C_PREFLIGHT, "ERROR con objetivo READY: PREFLIGHT (ext_pi lo espacia 30 s)");
    CHECK(nextCmd(G_READY, PS_READY) == C_NADA && nextCmd(G_ARMED, PS_ARMED) == C_NADA && nextCmd(G_REC, PS_RECORDING) == C_NADA,
          "ya en la fase: nada");

    printf("cadenas contra missiond\n");
    uint8_t st = PS_BOOT;
    CHECK(cadena(G_READY, st) == "PREFLIGHT" && st == PS_READY, "arranque en TIERRA: PREFLIGHT -> READY");
    CHECK(cadena(G_ARMED, st) == "ARM" && st == PS_ARMED, "armar: ARM");
    CHECK(cadena(G_READY, st) == "ABORT PREFLIGHT" && st == PS_READY, "desarmar: ABORT y PREFLIGHT, vuelve a READY");
    st = PS_READY;
    CHECK(cadena(G_ASCENT, st) == "ARM START_ASCENT" && st == PS_ASCENT, "BOOST sin armar: ARM y START_ASCENT");
    CHECK(cadena(G_REC, st) == "START_REC" && st == PS_RECORDING, "APOGEO: START_REC");
    CHECK(cadena(G_FIN, st) == "TOUCHDOWN" && st == PS_COMPLETE, "ATERRIZAJE: TOUCHDOWN");
    st = PS_BOOT;
    CHECK(cadena(G_REC, st) == "PREFLIGHT ARM START_ASCENT START_REC" && st == PS_RECORDING, "la Pi reinicia en pleno descenso: se recupera hasta grabar");
    st = PS_ARMED;
    CHECK(cadena(G_FIN, st) == "ABORT" && st == PS_ABORTED, "aterriza sin BOOST con la Pi armada: ABORT");
    st = PS_ASCENT;
    CHECK(cadena(G_FIN, st) == "START_REC TOUCHDOWN" && st == PS_COMPLETE, "aterriza sin APOGEO: START_REC y TOUCHDOWN");
    st = PS_RECORDING;
    CHECK(cadena(G_READY, st) == "ABORT PREFLIGHT" && st == PS_READY, "estado tierra con la Pi grabando: ABORT y PREFLIGHT");
    st = PS_ERROR;
    CHECK(cadena(G_ARMED, st) == "PREFLIGHT ARM" && st == PS_ARMED, "en ERROR con objetivo ARMED: PREFLIGHT y ARM");

    printf("nombres\n");
    CHECK(std::string(goalName(G_REC)) == "REC" && std::string(cmdName(C_START_ASCENT)) == "START_ASCENT" && std::string(cmdName(0)) == "-",
          "goalName y cmdName");
    CHECK(C_PREFLIGHT == 0xA0 && C_ARM == 0xA1 && C_START_ASCENT == 0xA2 && C_START_REC == 0xB1 && C_TOUCHDOWN == 0xC1 && C_ABORT == 0xF1,
          "codigos de comando de demeter_protocol.py");
    CHECK(PS_RECORDING == 0x30 && PS_ERROR == 0xEF && PS_ASCENT == 0x08, "codigos de estado de demeter_protocol.py");

    printf("%s: %d fallas\n", g_fallas ? "FALLA" : "OK", g_fallas);
    return g_fallas ? 1 : 0;
}
