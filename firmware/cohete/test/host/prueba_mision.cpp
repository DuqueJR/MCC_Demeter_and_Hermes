// prueba_mision.cpp - Prueba en el PC del gancho de BOOST en mission.cpp (T-410): compila el mission.cpp REAL contra stubs minimos de
// Arduino/FreeRTOS y corre su tarea con un reloj virtual de 20 ms por paso. Cada escenario es un proceso aparte (mission.cpp guarda su estado
// en variables estaticas). Uso:  prueba_mision <escenario>      Sale con 0 si todas las comprobaciones pasan.
// Escenarios: tierra | armado | launch_sin_boost | baro | qmi_con_lsm | qmi_sin_lsm
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

int main(int argc, char **argv) {
    if (argc < 2) { fprintf(stderr, "uso: prueba_mision escenario\n"); return 2; }
    const std::string n = argv[1];
    int ticks = 130;
    if (n == "tierra") g_escenario = esc_tierra;
    else if (n == "armado") g_escenario = esc_armado;
    else if (n == "launch_sin_boost") { g_escenario = esc_launch_sin_boost; ticks = 20 + 6110; }
    else if (n == "baro") g_escenario = esc_baro;
    else if (n == "qmi_con_lsm") g_escenario = esc_qmi_con_lsm;
    else if (n == "qmi_sin_lsm") g_escenario = esc_qmi_sin_lsm;
    else { fprintf(stderr, "escenario desconocido: %s\n", argv[1]); return 2; }
    g_maxTicks = ticks;
    missionBegin(1);                                           // Demeter
    try { g_taskFn(nullptr); } catch (const Parar &) {}
    printf("%s: %s\n", n.c_str(), g_fallas ? "FALLA" : "OK");
    return g_fallas ? 1 : 0;
}
