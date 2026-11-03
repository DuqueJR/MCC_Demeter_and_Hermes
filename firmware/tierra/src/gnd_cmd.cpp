// gnd_cmd.cpp - Una linea por comando: "d armar", "h estado recovery"... Si el cohete responde no apto, muestra los motivos y pregunta si se fuerza.
#include "gnd_cmd.h"
#include "gnd_time.h"
#include <Arduino.h>
#include <Preferences.h>
#include <esp_timer.h>
#include <string.h>
#include <net_auth.h>

using namespace net;

static const uint32_t RETRY_MS = 1500;
static const uint8_t  MAX_TRIES = 4;
static const uint32_t NO_TX_MS = 5000;                      // sin poder transmitir (tierra perdio la hora) se abandona
static const uint32_t ASK_MS = CONFIRM_WINDOW_MS - 1000;     // el plazo del cohete empezo antes: se cierra aqui un poco antes
static const char *const ROCKET_NAME[3] = {"?", "Demeter", "Hermes"};
static const char *const STATE_NAME[5] = {"-", "TIERRA", "ARMED", "FLY", "RECOVERY"};
static const char *const MOMENT_NAME[8] = {"-", "LAUNCH", "BOOST", "COAST", "APOGEO", "CAIDA", "PARACAIDAS", "ATERRIZAJE"};
static const char *const MOMENT_ARG[8] = {"", "launch", "boost", "coast", "apogeo", "caida", "paracaidas", "aterrizaje"};
static const char *const STATE_ARG[5] = {"", "tierra", "armed", "fly", "recovery"};

static Preferences s_prefs;
static uint32_t s_counter = 0;

// Comando en curso
static Cmd      s_cmd;
static bool     s_waiting = false;
static uint8_t  s_tries = 0;
static uint32_t s_lastTx = 0, s_sendMs = 0;
static bool     s_retried = false;

// Respuesta no apta, en espera de "si" o "no"
static bool     s_asking = false;
static uint8_t  s_askTarget = 0, s_askOp = 0, s_askArg = 0;
static uint32_t s_askMask = 0, s_askMs = 0;

static char     s_line[48];
static uint8_t  s_lineLen = 0;

void gndCmdBegin() {
    s_prefs.begin("tbcmd", false);
    s_counter = s_prefs.getULong("ctr", 0);
    Serial.println("[cmd ] reset (esta placa) | <d|h> ping | armar | desarmar | launch | abortar | dormir | reiniciar | buzzer <on|off> | pi encender (solo Demeter) | estado <tierra|armed|fly|recovery> | momento <launch|boost|coast|apogeo|caida|paracaidas|aterrizaje>");
}

static void send(uint8_t target, uint8_t op, uint8_t arg, uint32_t reasons) {
    memset(&s_cmd, 0, sizeof(s_cmd));
    s_counter++;
    s_prefs.putULong("ctr", s_counter);
    s_cmd.type = P_CMD; s_cmd.target = target; s_cmd.op = op; s_cmd.arg = arg;
    s_cmd.counter = s_counter; s_cmd.reasons = reasons;
    authTag((const uint8_t *)&s_cmd, sizeof(s_cmd) - sizeof(s_cmd.tag), s_cmd.tag);
    s_waiting = true; s_tries = 0; s_sendMs = millis();
}

static int findArg(const char *word, const char *const *names, int n) {
    for (int i = 1; i < n; i++) if (strcmp(word, names[i]) == 0) return i;
    return -1;
}

static void parseLine(char *s) {
    if (strcmp(s, "si") == 0 || strcmp(s, "no") == 0) {
        if (!s_asking) { Serial.println("[cmd ] no hay nada por confirmar"); return; }
        s_asking = false;
        if (s[0] == 'n') { Serial.println("[cmd ] cancelado"); return; }
        if (millis() - s_askMs > ASK_MS) { Serial.println("[cmd ] confirmacion vencida: repite el comando"); return; }
        s_retried = false;
        send(s_askTarget, (uint8_t)(s_askOp | OP_CONFIRM), s_askArg, s_askMask);
        return;
    }
    if (strcmp(s, "reset") == 0) { Serial.println("[cmd ] reiniciando tierra"); Serial.flush(); ESP.restart(); }
    char *word = strtok(s, " ");
    char *order = strtok(nullptr, " ");
    char *arg = strtok(nullptr, " ");
    const uint8_t target = word && strcmp(word, "d") == 0 ? DEMETER : (word && strcmp(word, "h") == 0 ? HERMES : 0);
    if (!target || !order) { Serial.println("[cmd ] formato: <d|h> <orden>"); return; }

    uint8_t op = 0, val = 0;
    if (strcmp(order, "ping") == 0) op = OP_PING;
    else if (strcmp(order, "armar") == 0) op = OP_ARM;
    else if (strcmp(order, "desarmar") == 0) op = OP_DISARM;
    else if (strcmp(order, "launch") == 0) op = OP_LAUNCH;
    else if (strcmp(order, "abortar") == 0) op = OP_ABORT;
    else if (strcmp(order, "dormir") == 0) op = OP_SLEEP;
    else if (strcmp(order, "reiniciar") == 0) op = OP_RESET;
    else if (strcmp(order, "buzzer") == 0) {
        if (!arg || (strcmp(arg, "on") != 0 && strcmp(arg, "off") != 0)) { Serial.println("[cmd ] buzzer necesita on u off"); return; }
        op = OP_BUZZER;
        val = strcmp(arg, "on") == 0 ? 1 : 0;
    } else if (strcmp(order, "pi") == 0) {
        if (!arg || strcmp(arg, "encender") != 0) { Serial.println("[cmd ] pi solo admite: pi encender"); return; }
        op = OP_PI_POWER;
    } else if (strcmp(order, "estado") == 0 || strcmp(order, "momento") == 0) {
        const bool st = order[0] == 'e';
        const int v = arg ? (st ? findArg(arg, STATE_ARG, 5) : findArg(arg, MOMENT_ARG, 8)) : -1;
        if (v < 0) { Serial.println("[cmd ] falta o no existe ese valor"); return; }
        op = st ? OP_SET_STATE : OP_SET_MOMENT;
        val = (uint8_t)v;
    } else { Serial.println("[cmd ] orden desconocida"); return; }

    int64_t utc;
    if (!gndTimeUtc(esp_timer_get_time(), utc)) { Serial.println("[cmd ] tierra sin hora: no puede transmitir en ranuras"); return; }
    if (s_waiting) { Serial.println("[cmd ] hay un comando en curso"); return; }
    s_asking = false;
    s_retried = false;
    send(target, op, val, 0);
}

void gndCmdLoop() {
    while (Serial.available()) {
        const int c = Serial.read();
        if (c == '\r' || c == '\n') {
            if (s_lineLen) { s_line[s_lineLen] = 0; s_lineLen = 0; parseLine(s_line); }
        } else if (s_lineLen < sizeof(s_line) - 1) s_line[s_lineLen++] = (char)c;
    }
    if (s_waiting && s_tries >= MAX_TRIES && millis() - s_lastTx >= RETRY_MS) {
        s_waiting = false;
        Serial.printf("[cmd ] %s: sin respuesta tras %u intentos. Pudo ejecutarse o no: revisa el estado en la telemetria\n", ROCKET_NAME[s_cmd.target], MAX_TRIES);
    }
    if (s_waiting && !s_tries && millis() - s_sendMs >= NO_TX_MS) {
        s_waiting = false;
        Serial.println("[cmd ] no se pudo transmitir: tierra sin hora");
    }
    if (s_asking && millis() - s_askMs > ASK_MS) {
        s_asking = false;
        Serial.println("[cmd ] confirmacion vencida: repite el comando si aun lo quieres");
    }
}

bool gndCmdToSend(Cmd &c) {
    if (!s_waiting || s_tries >= MAX_TRIES) return false;
    if (s_tries && millis() - s_lastTx < RETRY_MS) return false;
    c = s_cmd;
    return true;
}

void gndCmdSent() {
    s_tries++;
    s_lastTx = millis();
}

void gndCmdOnResp(const CmdResp &r) {
    if (!s_waiting || r.counter != s_cmd.counter || r.rocket_id != s_cmd.target) return;   // la repeticion de la misma respuesta ya no aplica
    s_waiting = false;
    const uint8_t rid = r.rocket_id <= 2 ? r.rocket_id : 0;
    const uint8_t st = r.state & 0x0F, mo = r.state >> 4;
    const float alt = r.alt_dm / 10.0f, vz = r.vz_cms / 100.0f;
    const uint8_t op = r.op & (uint8_t)~OP_CONFIRM;

    // Contador de tierra atrasado (NVS borrado o placa cambiada): sigue desde el del cohete y reenvia una sola vez
    if (r.result == CR_ERROR && (r.reasons & (1UL << RZ_CONTADOR)) && !s_retried) {
        s_retried = true;
        s_counter = r.last_counter;
        send(s_cmd.target, s_cmd.op, s_cmd.arg, s_cmd.reasons);
        Serial.printf("[cmd ] %s: contador atrasado, reenviando con %lu\n", ROCKET_NAME[rid], (unsigned long)s_counter);
        return;
    }

    static const char *const RESULT[4] = {"EJECUTADO", "NO APTO", "APTO", "ERROR"};
    Serial.printf("[cmd ] %s: %s | estado=%s momento=%s alt=%.1f m vz=%.1f m/s reserva=%u%% vbat=%u mV\n", ROCKET_NAME[rid], RESULT[r.result & 3],
                  st <= 4 ? STATE_NAME[st] : "?", mo <= 7 ? MOMENT_NAME[mo] : "?", alt, vz, r.spare_pct, r.vbat_mv);
    for (uint8_t i = 0; i < RZ_COUNT; i++) {
        if (r.reasons & (1UL << i)) Serial.printf("[cmd ]   - %s\n", reasonText(i));
    }
    if (r.result == CR_NO_APTO || r.result == CR_CONFIRMA) {
        s_asking = true; s_askTarget = r.rocket_id; s_askOp = op; s_askArg = r.arg; s_askMask = r.reasons; s_askMs = millis();
        Serial.printf("[cmd ] %s (10 s): escribe si o no\n", r.result == CR_NO_APTO ? "Seguro que quieres forzar?" : "Confirma el armado");
    }
}
