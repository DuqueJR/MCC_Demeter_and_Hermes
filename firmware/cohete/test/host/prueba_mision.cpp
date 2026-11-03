// prueba_mision.cpp - Prueba en el PC del gancho de BOOST en mission.cpp (T-410): compila el mission.cpp REAL contra stubs minimos de
// Arduino/FreeRTOS y corre su tarea con un reloj virtual de 20 ms por paso. Cada escenario es un proceso aparte (mission.cpp guarda su estado
// en variables estaticas). Uso:  prueba_mision <escenario>      Sale con 0 si todas las comprobaciones pasan.
// Escenarios de BOOST (T-410): tierra | armado | launch_sin_boost | baro | qmi_con_lsm | qmi_sin_lsm
// Escenarios de actuadores (T-413, con ext_act.cpp REAL y los pines registrados con su hora virtual):
//   buzzer_patron | buzzer_aterrizaje | buzzer_recovery | pi_demeter | pi_vuelo | pi_hermes | sueno | protocolo
#include <Arduino.h>
#include <esp_timer.h>
#include <Preferences.h>
#include <stdio.h>
#include <stdlib.h>
#include <string>
#include <algorithm>
#include <deque>
#include <vector>
#include "mission.h"
#include "core_bus.h"
#include "in_imu.h"
#include "in_bar.h"
#include "ext_lsm.h"
#include "ext_bmp.h"
#include "ext_drv.h"
#include "ext_act.h"
#include <driver/gpio.h>
#include "logger.h"
#include "net_radio.h"
#include "boost_detect.h"

using namespace net;

// ---------- Reloj virtual y colas ----------
static int64_t g_nowUs = 1000000;
int64_t esp_timer_get_time() { return g_nowUs; }
uint32_t millis() { return (uint32_t)(g_nowUs / 1000); }

struct Cola { size_t item; std::deque<std::vector<uint8_t> > d; };
static Cola *g_cmdQ = nullptr, *g_logQ = nullptr;
static void (*g_taskFn)(void *) = nullptr;
struct Parar {};
static int  g_tick = 0, g_maxTicks = 0;
static void (*g_escenario)(int) = nullptr;

QueueHandle_t xQueueCreate(int, int item) {
    Cola *c = new Cola; c->item = (size_t)item;
    if (!g_cmdQ) g_cmdQ = c; else g_logQ = c;                  // missionBegin crea primero la de comandos y luego la del registro
    return c;
}
BaseType_t xQueueSend(QueueHandle_t q, const void *p, TickType_t) {
    Cola *c = (Cola *)q;
    c->d.push_back(std::vector<uint8_t>((const uint8_t *)p, (const uint8_t *)p + c->item));
    return pdTRUE;
}
BaseType_t xQueueReceive(QueueHandle_t q, void *p, TickType_t) {
    Cola *c = (Cola *)q;
    if (c == g_cmdQ) {                                         // la espera de la tarea de mision = un paso de 20 ms
        if (g_tick >= g_maxTicks) throw Parar();
        g_nowUs += 20000;
        if (g_escenario) g_escenario(g_tick);
        g_tick++;
    }
    if (c->d.empty()) return pdFALSE;
    memcpy(p, c->d.front().data(), c->item);
    c->d.pop_front();
    return pdTRUE;
}
BaseType_t xTaskCreatePinnedToCore(void (*f)(void *), const char *, uint32_t, void *, int, TaskHandle_t *, int) { g_taskFn = f; return pdTRUE; }
bool Preferences::begin(const char *, bool) { return true; }
uint32_t Preferences::getULong(const char *, uint32_t d) { return d; }
void Preferences::putULong(const char *, uint32_t) {}

// ---------- Resto de dependencias de mission.cpp ----------
Latest<ImuSample>    g_ext_imu, g_imu;
Latest<ExtBarSample> g_ext_bar;
Latest<BarSample>    g_bar;
Latest<GnssSample>   g_gnss;
volatile uint16_t    g_vbat_mv = 4000;

static std::vector<int> g_rec;                                 // llamadas a loggerRecord: 1 = true, 0 = false
static int  g_prepare = 0;
static size_t g_recDesde = 0;                                  // desde aqui se cuentan las llamadas a loggerRecord (armar ya llamo a loggerRecord(false))
static int cierres() { return (int)std::count(g_rec.begin() + g_recDesde, g_rec.end(), 0); }
static CmdResp g_resp;
static bool g_haveResp = false;
LoggerStats loggerStats() { LoggerStats l; memset(&l, 0, sizeof(l)); l.state = 2; l.spareState = 2; l.sparePct = 100; return l; }
void loggerRecord(bool on) { g_rec.push_back(on ? 1 : 0); }
void loggerPrepare() { g_prepare++; }
void loggerAllowPrealloc(bool) {}
void netSetFlying(bool) {}
void netQueueResp(const CmdResp &r) { g_resp = r; g_haveResp = true; }
DrvStats extDrvStats() { DrvStats d; d.magnet = false; d.detections = 0; return d; }

// ---------- Pines de los actuadores (T-413): cada escritura se registra con la hora virtual ----------
struct PinEv { int64_t ms; int pin, nivel; };
static std::vector<PinEv> g_pins;
static int g_holdEn[64], g_holdDis[64], g_sleepHoldEn = 0, g_sleepHoldDis = 0;
void pinMode(int, int) {}
void digitalWrite(int pin, int nivel) { PinEv e = {g_nowUs / 1000, pin, nivel}; g_pins.push_back(e); }
int  gpio_hold_en(gpio_num_t p) { g_holdEn[p]++; return 0; }
int  gpio_hold_dis(gpio_num_t p) { g_holdDis[p]++; return 0; }
void gpio_deep_sleep_hold_en(void) { g_sleepHoldEn++; }
void gpio_deep_sleep_hold_dis(void) { g_sleepHoldDis++; }
static int nivel(int pin) { int n = 0; for (size_t i = 0; i < g_pins.size(); i++) if (g_pins[i].pin == pin) n = g_pins[i].nivel; return n; }
static std::vector<PinEv> cambios(int pin) {                  // solo los flancos; el nivel inicial es bajo
    std::vector<PinEv> v; int n = 0;
    for (size_t i = 0; i < g_pins.size(); i++) if (g_pins[i].pin == pin && g_pins[i].nivel != n) { n = g_pins[i].nivel; v.push_back(g_pins[i]); }
    return v;
}
static const int BUZ = EXT_ACT_BUZZER_PIN, PI = EXT_ACT_PI_PIN;

// ---------- Utilidades de escenario ----------
static int g_fallas = 0;
#define CHECK(cond, msg) do { const bool ok_ = (cond); printf("  [%s] %s\n", ok_ ? "OK" : "FALLA", msg); if (!ok_) g_fallas++; } while (0)

static double g_altM = 0;                                      // altura que ve el barometro
static bool   g_lsmVivo = true;
static const float LSB_LSM = 1000.0f / 0.976f, LSB_QMI = 2048.0f;
static uint32_t g_cmdCounter = 0;

static void sano() {                                           // sensores sanos y quietos, con datos frescos
    const int64_t t = g_nowUs;
    ImuSample s; memset(&s, 0, sizeof(s));
    s.t_us = t; s.acc_lsb_per_g = LSB_LSM; s.a[2] = (int16_t)LSB_LSM;
    if (g_lsmVivo) g_ext_imu.set(s);
    s.acc_lsb_per_g = LSB_QMI; s.a[2] = (int16_t)LSB_QMI;
    g_imu.set(s);
    const float p = 95000.0f * powf(1.0f - (float)g_altM / 44330.0f, 1.0f / 0.19029f);
    ExtBarSample b; b.t_us = t; b.press_pa = p; b.temp_c = 25.0f; g_ext_bar.set(b);
    BarSample c; memset(&c, 0, sizeof(c)); c.t_us = t; c.press_pa = p + 70.0f; g_bar.set(c);
    GnssSample g; memset(&g, 0, sizeof(g)); g.t_rx_us = t; g.fix = 3; g_gnss.set(g);
}

static void cmd(uint8_t op, uint8_t arg = 0, uint32_t reasons = 0) {
    Cmd c; memset(&c, 0, sizeof(c));
    c.type = P_CMD; c.op = op; c.arg = arg; c.counter = ++g_cmdCounter; c.reasons = reasons;
    missionOnCmd(c);
}
static void armar() { cmd(OP_ARM); }                           // el segundo paso (confirmar) va un paso despues
static void armarConfirma() { cmd((uint8_t)(OP_ARM | OP_CONFIRM)); }

static void rafaga(bool lsm, float g) {                        // los 20 ms que acaban de pasar, a g constante: 32 muestras del LSM o 9 del QMI
    const int n = lsm ? 32 : 9;
    const int64_t paso = 20000 / n;
    for (int k = 0; k < n; k++) {
        const int64_t t = g_nowUs - 20000 + (k + 1) * paso;
        int16_t a[3] = {0, 0, (int16_t)(g * (lsm ? LSB_LSM : LSB_QMI))};
        if (lsm) boostLsmSample(t, a, LSB_LSM); else boostQmiSample(t, a, LSB_QMI);
    }
}

static MissionStats st() { return missionStats(); }
static std::vector<MissionLog> g_logs;
static void recogerLogs() { MissionLog l; while (missionTakeLog(l)) g_logs.push_back(l); }
static int  autoLogs(uint8_t arg) { int n = 0; for (size_t i = 0; i < g_logs.size(); i++) if (g_logs[i].r.op == 0 && g_logs[i].r.arg == arg && g_logs[i].r.reasons == 0) n++; return n; }
static const MissionLog *primerAuto(uint8_t arg) { for (size_t i = 0; i < g_logs.size(); i++) if (g_logs[i].r.op == 0 && g_logs[i].r.arg == arg && g_logs[i].r.reasons == 0) return &g_logs[i]; return nullptr; }

// ---------- Escenarios ----------
static void esc_tierra(int t) {
    sano();
    if (t >= 50 && t < 60) rafaga(true, 7.0f);                 // 7 g sostenidos: dv = 5 m/s en ~85 ms
    if (t == 80) {
        recogerLogs();
        printf("TIERRA: BOOST inercial sin armar\n");
        CHECK(st().state == ST_FLY && st().moment == M_BOOST, "pasa a FLY con momento BOOST");
        CHECK(st().flags & TF_BOOST_SIN_ARMAR, "levanta TF_BOOST_SIN_ARMAR");
        CHECK(!g_rec.empty() && g_rec.back() == 1, "empieza a registrar (loggerRecord(true))");
        const MissionLog *l = primerAuto(BOOST_INERCIAL);
        CHECK(autoLogs(BOOST_INERCIAL) == 1, "un solo T_MISSION automatico de BOOST (op 0, arg 1)");
        CHECK(l && l->r.from == ST_TIERRA && l->r.to == ST_FLY && l->r.moment == M_BOOST && l->r.result == CR_OK, "el T_MISSION dice TIERRA -> FLY, momento BOOST");
        CHECK(l && l->r.counter >= 500 && l->r.counter <= 650, "counter = dv en cm/s (alrededor de 500)");
        if (l) printf("  T_MISSION: counter = %u cm/s, flags = 0x%02X\n", (unsigned)l->r.counter, l->r.flags);
    }
}

static void esc_armado(int t) {
    sano();
    if (t == 10) armar();
    if (t == 11) armarConfirma();
    if (t == 13) { printf("ARMED: BOOST inercial\n"); CHECK(st().state == ST_ARMED && g_prepare == 1, "armado, con el archivo preparado"); }
    if (t == 14) g_recDesde = g_rec.size();
    if (t >= 60 && t < 70) rafaga(true, 7.0f);
    if (t == 80) {
        recogerLogs();
        CHECK(st().state == ST_FLY && st().moment == M_BOOST, "ARMED -> FLY con momento BOOST");
        CHECK(!(st().flags & TF_BOOST_SIN_ARMAR), "no levanta TF_BOOST_SIN_ARMAR");
        CHECK(!g_rec.empty() && g_rec.back() == 1, "registra (loggerRecord(true))");
        const MissionLog *l = primerAuto(BOOST_INERCIAL);
        CHECK(autoLogs(BOOST_INERCIAL) == 1 && l && l->r.from == ST_ARMED, "un T_MISSION automatico, from = ARMED");
        g_haveResp = false; cmd(OP_DISARM);
    }
    if (t == 82) {
        CHECK(g_haveResp && g_resp.result == CR_NO_APTO && (g_resp.reasons & (1u << RZ_EN_VUELO)), "s_boosted activo: desarmar en vuelo = NO_APTO (EN_VUELO)");
        CHECK(st().state == ST_FLY, "sigue en FLY");
    }
    if (t >= 90 && t < 100) rafaga(true, 7.0f);                // otro BOOST ya en BOOST: nada
    if (t == 120) {
        recogerLogs();
        CHECK(autoLogs(BOOST_INERCIAL) == 1, "un BOOST ya en BOOST no genera otro T_MISSION");
        CHECK(cierres() == 0, "el registro nunca se cierra");
    }
}

static void esc_launch_sin_boost(int t) {
    sano();
    if (t == 10) armar();
    if (t == 11) armarConfirma();
    if (t == 20) cmd(OP_LAUNCH);
    if (t == 21) g_recDesde = g_rec.size() - 1;                // incluye la llamada de LAUNCH: loggerRecord(true)
    if (t == 22) { printf("LAUNCH sin BOOST\n"); CHECK(st().state == ST_FLY && st().moment == M_LAUNCH && st().flags == 0, "FLY, momento LAUNCH"); }
    if (t == 20 + 6050) {                                      // 121 s: pasaron los t_abort = 120 s
        recogerLogs();
        CHECK(st().flags & TF_LAUNCH_VENCIDO, "a los 120 s levanta TF_LAUNCH_VENCIDO");
        CHECK(st().state == ST_FLY, "sigue en FLY");
        CHECK(!g_rec.empty() && g_rec.back() == 1 && cierres() == 0, "sigue registrando (sin cerrar el archivo)");
    }
    if (t >= 20 + 6060 && t < 20 + 6070) rafaga(true, 7.0f);
    if (t == 20 + 6100) {
        recogerLogs();
        CHECK(st().state == ST_FLY && st().moment == M_BOOST, "el BOOST tardio pone el momento BOOST");
        CHECK(!(st().flags & TF_LAUNCH_VENCIDO), "y apaga el aviso de t_abort");
        CHECK(autoLogs(BOOST_INERCIAL) == 1, "con su T_MISSION automatico");
        g_haveResp = false; cmd(OP_ABORT);
    }
    if (t == 20 + 6102) CHECK(g_haveResp && g_resp.result == CR_NO_APTO && (g_resp.reasons & (1u << RZ_EN_VUELO)), "abortar en vuelo = NO_APTO (EN_VUELO)");
}

static void esc_baro(int t) {
    sano();
    if (t == 10) armar();
    if (t == 11) armarConfirma();
    if (t >= 60) g_altM = 40.0 * (t - 60) * 0.02;              // sube a 40 m/s desde t = 60
    if (t == 100) {
        recogerLogs();
        printf("ARMED: BOOST barometrico (sin aceleracion)\n");
        CHECK(st().state == ST_FLY && st().moment == M_BOOST, "ARMED -> FLY con momento BOOST");
        const MissionLog *l = primerAuto(BOOST_BARO);
        CHECK(autoLogs(BOOST_BARO) == 1 && autoLogs(BOOST_INERCIAL) == 0, "un T_MISSION automatico con arg = 2 (barometrico)");
        CHECK(l && l->r.counter >= 1000, "counter = salto en cm (>= 1000)");
        if (l) printf("  T_MISSION: counter = %u cm\n", (unsigned)l->r.counter);
    }
}

static void esc_qmi_con_lsm(int t) {
    sano();
    if (t == 10) armar();
    if (t == 11) armarConfirma();
    if (t >= 60 && t < 70) rafaga(false, 7.0f);
    if (t == 90) {
        printf("QMI con el LSM fresco\n");
        CHECK(st().state == ST_ARMED && st().moment == M_NONE, "el aviso del QMI se ignora si el LSM tiene datos frescos");
    }
}

static void esc_qmi_sin_lsm(int t) {
    if (t == 12) g_lsmVivo = false;                            // el LSM deja de publicar
    sano();
    if (t == 10) armar();
    if (t == 11) armarConfirma();
    if (t >= 60 && t < 70) rafaga(false, 7.0f);                // 0,5 s despues: el LSM ya no cuenta como fresco
    if (t == 90) {
        recogerLogs();
        printf("QMI sin LSM\n");
        CHECK(st().state == ST_FLY && st().moment == M_BOOST, "con el LSM sin datos, el QMI da el BOOST");
        const MissionLog *l = primerAuto(BOOST_INERCIAL);
        CHECK(l && l->r.counter >= 500 && l->r.counter <= 700, "T_MISSION automatico, arg 1, counter = dv del QMI");
    }
}

// ---------- Escenarios de actuadores (T-413) ----------
// Valores esperados escritos a mano (maquina_estados.md seccion 7): si alguien cambia las constantes de ext_act.h, la prueba falla
static const int64_t ON_ESP = 500, OFF_ESP = 1500, PULSO_ESP = 1500;
static int64_t g_t0 = 0;                                       // hora virtual (ms) del comando que arranca el patron o el pulso
static int64_t ahora_ms() { return g_nowUs / 1000; }
static void resp_nueva() { g_haveResp = false; }
static bool resp(uint8_t result, uint32_t reasons) { return g_haveResp && g_resp.result == result && g_resp.reasons == reasons; }
static bool flanco(const std::vector<PinEv> &v, size_t i, int64_t ms, int lvl) { return i < v.size() && v[i].ms == ms && v[i].nivel == lvl; }

static void esc_buzzer_patron(int t) {                         // solo con comandos: 500 ms alto, 1500 ms bajo, sin reiniciar la fase
    sano();
    if (t == 5) { resp_nueva(); g_t0 = ahora_ms(); cmd(OP_BUZZER, 1); }
    if (t == 6) {
        printf("BUZZER: patron 500/1500 ms con reloj virtual\n");
        CHECK(resp(CR_OK, 0), "buzzer on en TIERRA: apto, EJECUTADO, sin motivos");
        CHECK(nivel(BUZ) == 1 && (extActBits() & ACT_BUZZER_ACTIVO), "IO46 sube y el bit 0 de actuators se levanta");
        CHECK(nivel(PI) == 0 && !(extActBits() & (ACT_PI_EN_CURSO | ACT_PI_ENVIADO)), "IO45 sigue en bajo y los bits 1 y 2 en cero");
    }
    if (t == 15) cmd(OP_BUZZER, 1);                            // otro on a mitad de la fase alta: no reinicia el patron
    if (t == 31) {
        std::vector<PinEv> v = cambios(BUZ);
        CHECK(v.size() == 2 && flanco(v, 0, g_t0, 1) && flanco(v, 1, g_t0 + ON_ESP, 0), "alto en T0 y bajo en T0 + 500 ms (un segundo on no reinicia la fase)");
        CHECK(extActBits() & ACT_BUZZER_ACTIVO, "en la fase baja el bit 0 sigue en 1: el patron corre");
    }
    if (t == 106) {
        std::vector<PinEv> v = cambios(BUZ);
        CHECK(v.size() == 3 && flanco(v, 2, g_t0 + ON_ESP + OFF_ESP, 1), "vuelve a subir en T0 + 2000 ms");
    }
    if (t == 131) {
        std::vector<PinEv> v = cambios(BUZ);
        CHECK(v.size() == 4 && flanco(v, 3, g_t0 + 2 * ON_ESP + OFF_ESP, 0), "y a bajar en T0 + 2500 ms");
    }
    if (t == 210) { resp_nueva(); cmd(OP_BUZZER, 0); }         // T0 + 4100 ms: en plena fase alta del tercer ciclo
    if (t == 212) {
        CHECK(resp(CR_OK, 0), "buzzer off: apto, EJECUTADO");
        CHECK(nivel(BUZ) == 0 && !(extActBits() & ACT_BUZZER_ACTIVO) && cambios(BUZ).size() == 6, "apaga al instante (sin esperar el fin de la fase) y el bit 0 baja");
    }
    if (t == 300) { resp_nueva(); cmd(OP_BUZZER, 2); }
    if (t == 302) CHECK(resp(CR_NO_APTO, 1u << RZ_OP), "buzzer con argumento 2: NO_APTO con RZ_OP");
    if (t == 400) CHECK(cambios(BUZ).size() == 6 && nivel(BUZ) == 0, "apagado no vuelve a sonar");
    if (t == 405) armar();
    if (t == 406) armarConfirma();
    if (t == 410) { resp_nueva(); cmd(OP_BUZZER, 1); }
    if (t == 412) CHECK(st().state == ST_ARMED && resp(CR_OK, 0) && nivel(BUZ) == 1, "buzzer on tambien es apto en ARMED");
}

static void esc_buzzer_aterrizaje(int t) {                     // BOOST real -> momento ATERRIZAJE por comando -> RECOVERY -> TIERRA
    sano();
    if (t == 10) armar();
    if (t == 11) armarConfirma();
    if (t >= 60 && t < 70) rafaga(true, 7.0f);
    if (t == 80) {
        printf("BUZZER: ATERRIZAJE, RECOVERY y TIERRA\n");
        CHECK(st().state == ST_FLY && st().moment == M_BOOST, "en vuelo, con BOOST");
        CHECK(!(extActBits() & ACT_BUZZER_ACTIVO) && cambios(BUZ).empty(), "el buzzer calla en vuelo");
        resp_nueva(); g_t0 = ahora_ms(); cmd(OP_SET_MOMENT, M_ATERRIZAJE);
    }
    if (t == 82) {
        CHECK(resp(CR_OK, 0) && st().moment == M_ATERRIZAJE, "momento ATERRIZAJE: apto y ejecutado");
        CHECK(nivel(BUZ) == 1 && (extActBits() & ACT_BUZZER_ACTIVO), "el buzzer suena al pasar al momento ATERRIZAJE (aun en FLY)");
    }
    if (t == 90) { resp_nueva(); cmd(OP_SET_STATE, ST_RECOVERY); }
    if (t == 92) CHECK(resp(CR_OK, 0) && st().state == ST_RECOVERY, "estado recovery: apto con ATERRIZAJE y el cohete quieto");
    if (t == 100) CHECK(cambios(BUZ).size() == 1 && nivel(BUZ) == 1, "entrar a RECOVERY con el buzzer sonando no reinicia el patron");
    if (t == 120) {
        std::vector<PinEv> v = cambios(BUZ);
        CHECK(v.size() == 2 && flanco(v, 0, g_t0, 1) && flanco(v, 1, g_t0 + ON_ESP, 0), "la fase alta dura 500 ms desde el comando de ATERRIZAJE");
        CHECK(extActBits() & ACT_BUZZER_ACTIVO, "en la fase baja el patron sigue activo (bit 0)");
    }
    if (t == 200) { resp_nueva(); cmd(OP_SET_STATE, ST_TIERRA); }
    if (t == 202) {
        CHECK(resp(CR_OK, 0) && st().state == ST_TIERRA, "RECOVERY -> TIERRA: apto");
        CHECK(nivel(BUZ) == 0 && !(extActBits() & ACT_BUZZER_ACTIVO), "en TIERRA el buzzer calla");
    }
    if (t == 300) CHECK(nivel(BUZ) == 0 && !(extActBits() & ACT_BUZZER_ACTIVO), "y sigue callado");
}

static void esc_buzzer_recovery(int t) {                       // RECOVERY forzado (sin ATERRIZAJE): el buzzer suena al entrar
    sano();
    if (t == 10) armar();
    if (t == 11) armarConfirma();
    if (t == 20) cmd(OP_LAUNCH);
    if (t == 30) { resp_nueva(); cmd(OP_SET_STATE, ST_RECOVERY); }
    if (t == 32) {
        printf("BUZZER: RECOVERY forzado\n");
        CHECK(resp(CR_NO_APTO, 1u << RZ_SIN_ATERRIZAJE), "estado recovery sin ATERRIZAJE: NO_APTO (RZ_SIN_ATERRIZAJE)");
        CHECK(cambios(BUZ).empty(), "un comando no apto no hace sonar el buzzer");
        const uint32_t m = g_resp.reasons;
        resp_nueva(); g_t0 = ahora_ms(); cmd((uint8_t)(OP_SET_STATE | OP_CONFIRM), ST_RECOVERY, m);
    }
    if (t == 34) {
        CHECK(g_haveResp && g_resp.result == CR_OK && st().state == ST_RECOVERY, "confirmado: pasa a RECOVERY");
        CHECK(nivel(BUZ) == 1 && (extActBits() & ACT_BUZZER_ACTIVO), "el buzzer suena al entrar a RECOVERY");
    }
    if (t == 140) {
        std::vector<PinEv> v = cambios(BUZ);
        CHECK(v.size() >= 3 && flanco(v, 0, g_t0, 1) && v[1].ms - v[0].ms == ON_ESP && v[2].ms - v[1].ms == OFF_ESP, "patron: 500 ms alto y 1500 ms bajo");
    }
    if (t == 3199) CHECK(extActBits() & ACT_BUZZER_ACTIVO, "tras t_post (60 s) el buzzer sigue sonando");
    if (t == 3200) { resp_nueva(); cmd(OP_BUZZER, 0); }
    if (t == 3202) CHECK(resp(CR_OK, 0) && nivel(BUZ) == 0 && !(extActBits() & ACT_BUZZER_ACTIVO), "buzzer off por comando en RECOVERY: calla");
}

static void esc_pi_demeter(int t) {                            // pi encender: siempre NO_APTO (motivo 21); con la confirmacion, un pulso de 1500 ms
    sano();
    if (t == 5) { resp_nueva(); cmd(OP_PI_POWER); }
    if (t == 7) {
        printf("PI: Demeter, en TIERRA\n");
        CHECK(resp(CR_NO_APTO, 1u << RZ_PI_DESCONOCIDA), "pi encender: NO_APTO con el motivo 21 (RZ_PI_DESCONOCIDA) y solo ese");
        CHECK(cambios(PI).empty() && extActBits() == 0, "sin confirmar no hay pulso y actuators = 0");
        resp_nueva(); cmd((uint8_t)(OP_PI_POWER | OP_CONFIRM), 0, 0);       // confirmacion con motivos que no son los del cohete
    }
    if (t == 9) {
        CHECK(g_haveResp && g_resp.result == CR_ERROR && g_resp.reasons == (1u << RZ_CONFIRM), "confirmar con motivos distintos: ERROR (RZ_CONFIRM)");
        CHECK(cambios(PI).empty(), "y no pulsa");
        resp_nueva(); cmd(OP_PI_POWER);
    }
    if (t == 11) {
        CHECK(resp(CR_NO_APTO, 1u << RZ_PI_DESCONOCIDA), "pi encender otra vez: NO_APTO otra vez");
        resp_nueva(); g_t0 = ahora_ms(); cmd((uint8_t)(OP_PI_POWER | OP_CONFIRM), 0, 1u << RZ_PI_DESCONOCIDA);
    }
    if (t == 13) {
        CHECK(g_haveResp && g_resp.result == CR_OK, "con la confirmacion de los mismos motivos: EJECUTADO");
        CHECK(nivel(PI) == 1 && extActBits() == (ACT_PI_EN_CURSO | ACT_PI_ENVIADO), "IO45 sube; bits 1 (en curso) y 2 (enviado) levantados");
        CHECK(nivel(BUZ) == 0, "IO46 no se toca");
    }
    if (t == 85) CHECK(nivel(PI) == 1, "a los 1480 ms el pulso sigue en alto");
    if (t == 88) {
        std::vector<PinEv> v = cambios(PI);
        CHECK(v.size() == 2 && flanco(v, 0, g_t0, 1) && flanco(v, 1, g_t0 + PULSO_ESP, 0), "el pulso dura exactamente 1500 ms (PI_PULSO_MS)");
        CHECK(extActBits() == ACT_PI_ENVIADO, "terminado: el bit 1 baja y el bit 2 sigue levantado");
    }
    if (t == 200) { resp_nueva(); cmd(OP_PI_POWER); }
    if (t == 202) CHECK(resp(CR_NO_APTO, 1u << RZ_PI_DESCONOCIDA) && cambios(PI).size() == 2, "despues del pulso sigue pidiendo confirmacion y no repite el pulso solo");
}

static void esc_pi_vuelo(int t) {                              // en FLY con BOOST, ademas RZ_EN_VUELO
    sano();
    if (t == 10) armar();
    if (t == 11) armarConfirma();
    if (t >= 60 && t < 70) rafaga(true, 7.0f);
    if (t == 80) { resp_nueva(); cmd(OP_PI_POWER); }
    if (t == 82) {
        printf("PI: en vuelo con BOOST\n");
        CHECK(st().state == ST_FLY && st().moment == M_BOOST, "en FLY con BOOST");
        CHECK(resp(CR_NO_APTO, (1u << RZ_PI_DESCONOCIDA) | (1u << RZ_EN_VUELO)), "pi encender: NO_APTO con RZ_PI_DESCONOCIDA y tambien RZ_EN_VUELO");
        CHECK(cambios(PI).empty(), "sin pulso");
        const uint32_t m = g_resp.reasons;
        resp_nueva(); cmd((uint8_t)(OP_PI_POWER | OP_CONFIRM), 0, m);
    }
    if (t == 84) CHECK(g_haveResp && g_resp.result == CR_OK && nivel(PI) == 1 && (st().flags & TF_FORZADO), "con los dos motivos confirmados: pulsa y queda FORZADO");
    if (t == 200) {
        std::vector<PinEv> v = cambios(PI);
        CHECK(v.size() == 2 && v[1].ms - v[0].ms == PULSO_ESP, "pulso de 1500 ms");
    }
}

static void esc_pi_hermes(int t) {                             // en Hermes IO45 no se usa
    sano();
    if (t == 5) { resp_nueva(); cmd(OP_PI_POWER); }
    if (t == 7) {
        printf("PI: Hermes\n");
        CHECK(resp(CR_NO_APTO, 1u << RZ_OP), "pi encender en Hermes: NO_APTO con RZ_OP (y no con RZ_PI_DESCONOCIDA)");
        const uint32_t m = g_resp.reasons;
        resp_nueva(); cmd((uint8_t)(OP_PI_POWER | OP_CONFIRM), 0, m);
    }
    if (t == 100) CHECK(nivel(PI) == 0 && cambios(PI).empty() && !(extActBits() & (ACT_PI_EN_CURSO | ACT_PI_ENVIADO)), "ni siquiera confirmado se pulsa IO45 en Hermes");
    if (t == 110) { resp_nueva(); cmd(OP_BUZZER, 1); }
    if (t == 112) CHECK(resp(CR_OK, 0) && nivel(BUZ) == 1 && (extActBits() & ACT_BUZZER_ACTIVO), "el buzzer si funciona en Hermes");
}

static void esc_sueno(int t) {                                 // extActSleep: pines en bajo, retenidos, y nada los reactiva
    sano();
    if (t == 5) cmd(OP_BUZZER, 1);
    if (t == 7) extActPiPulse(millis());
    if (t == 9) {
        printf("SUENO: actuadores\n");
        CHECK(nivel(BUZ) == 1 && nivel(PI) == 1 && extActBits() == (ACT_BUZZER_ACTIVO | ACT_PI_EN_CURSO | ACT_PI_ENVIADO), "antes de dormir: los dos pines altos");
        extActSleep();
        CHECK(nivel(BUZ) == 0 && nivel(PI) == 0, "extActSleep deja IO45 e IO46 en bajo");
        CHECK(g_holdEn[BUZ] == 1 && g_holdEn[PI] == 1 && g_sleepHoldEn == 1, "y los retiene: gpio_hold_en de los dos y gpio_deep_sleep_hold_en");
        CHECK(!(extActBits() & (ACT_BUZZER_ACTIVO | ACT_PI_EN_CURSO)), "los bits de actividad bajan");
    }
    if (t == 12) cmd(OP_BUZZER, 1);
    if (t == 100) CHECK(nivel(BUZ) == 0 && nivel(PI) == 0 && !(extActBits() & ACT_BUZZER_ACTIVO), "ya dormido, ni un comando ni el paso de la tarea los reactivan");
    if (t == 101) {
        extActBegin();
        CHECK(g_holdDis[BUZ] == 2 && g_holdDis[PI] == 2 && g_sleepHoldDis == 2, "al despertar (extActBegin) se libera el hold (uno en el arranque y otro ahora)");
        CHECK(nivel(BUZ) == 0 && nivel(PI) == 0 && extActBits() == 0, "y salen en bajo, con los bits en cero");
        cmd(OP_BUZZER, 1);
    }
    if (t == 103) CHECK(nivel(BUZ) == 1, "despues del despertar el buzzer vuelve a responder");
}

static int prueba_protocolo() {                                // contrato de net_proto.h
    static_assert(OP_BUZZER == 10 && OP_PI_POWER == 11, "ops 10 y 11");
    static_assert(RZ_PI_DESCONOCIDA == 21 && RZ_COUNT == 22, "motivo 21 y RZ_COUNT = 22");
    CHECK(RZ_OP == 20, "RZ_OP sigue en 20");
    for (uint8_t i = 0; i < RZ_COUNT; i++) { char m[64]; snprintf(m, sizeof(m), "reasonText(%u) existe", i); CHECK(reasonText(i) && reasonText(i)[0] && strcmp(reasonText(i), "?") != 0, m); }
    CHECK(strcmp(reasonText(RZ_COUNT), "?") == 0, "fuera de rango da ?");
    CHECK(BUZZER_ON_MS == 500 && BUZZER_OFF_MS == 1500 && PI_PULSO_MS == 1500, "constantes de ext_act.h = constantes.md (500, 1500, 1500)");
    CHECK(EXT_ACT_BUZZER_PIN == 46 && EXT_ACT_PI_PIN == 45, "IO46 buzzer, IO45 Pi");
    CHECK(strstr(reasonText(RZ_PI_DESCONOCIDA), "Pi") != nullptr, "el texto del motivo 21 habla de la Pi");
    CHECK((ACT_BUZZER_ACTIVO | ACT_PI_EN_CURSO | ACT_PI_ENVIADO) == 7 && sizeof(Telem) == 64, "bits de actuators 0, 1 y 2; Telem sigue en 64 B");
    return g_fallas;
}

int main(int argc, char **argv) {
    if (argc < 2) { fprintf(stderr, "uso: prueba_mision escenario\n"); return 2; }
    const std::string n = argv[1];
    int ticks = 130;
    uint8_t rocket = 1;                                        // 1 = Demeter, 2 = Hermes
    if (n == "tierra") g_escenario = esc_tierra;
    else if (n == "armado") g_escenario = esc_armado;
    else if (n == "launch_sin_boost") { g_escenario = esc_launch_sin_boost; ticks = 20 + 6110; }
    else if (n == "baro") g_escenario = esc_baro;
    else if (n == "qmi_con_lsm") g_escenario = esc_qmi_con_lsm;
    else if (n == "qmi_sin_lsm") g_escenario = esc_qmi_sin_lsm;
    else if (n == "buzzer_patron") { g_escenario = esc_buzzer_patron; ticks = 420; }
    else if (n == "buzzer_aterrizaje") { g_escenario = esc_buzzer_aterrizaje; ticks = 310; }
    else if (n == "buzzer_recovery") { g_escenario = esc_buzzer_recovery; ticks = 3210; }
    else if (n == "pi_demeter") { g_escenario = esc_pi_demeter; ticks = 210; }
    else if (n == "pi_vuelo") { g_escenario = esc_pi_vuelo; ticks = 210; }
    else if (n == "pi_hermes") { g_escenario = esc_pi_hermes; rocket = 2; ticks = 120; }
    else if (n == "sueno") { g_escenario = esc_sueno; ticks = 110; }
    else if (n == "protocolo") { prueba_protocolo(); printf("protocolo: %s\n", g_fallas ? "FALLA" : "OK"); return g_fallas ? 1 : 0; }
    else { fprintf(stderr, "escenario desconocido: %s\n", argv[1]); return 2; }
    g_maxTicks = ticks;
    extActBegin();                                             // como el arranque: los pines salen en bajo antes de missionBegin
    missionBegin(rocket);
    try { g_taskFn(nullptr); } catch (const Parar &) {}
    printf("%s: %s\n", n.c_str(), g_fallas ? "FALLA" : "OK");
    return g_fallas ? 1 : 0;
}
