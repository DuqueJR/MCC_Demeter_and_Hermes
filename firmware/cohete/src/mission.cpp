// mission.cpp - Un comando apto se ejecuta; uno no apto responde sus motivos y solo se ejecuta si tierra confirma esos mismos motivos a tiempo.
// BOOST se detecta solo (T-410, boost_detect.h): FLY ya no depende de LAUNCH. Los demas momentos todavia se fuerzan por comando.
// Actuadores (T-413, maquina_estados.md seccion 7): el buzzer suena solo en RECOVERY y en ATERRIZAJE; el pulso de la Pi es solo de Demeter y siempre con confirmacion.
// Persistencia en vuelo (T-411, maquina_estados.md seccion 8, D-052): el estado se guarda en RTC_NOINIT y en NVS solo en las transiciones, y missionBegin retoma FLY o RECOVERY tras un reinicio.
// Un comando que no aplica (RZ_OP) responde CR_ERROR y no se puede confirmar (D-051).
#include "mission.h"
#include "mission_config.h"
#include "boost_detect.h"
#include "core_bus.h"
#include "in_imu.h"
#include "in_bar.h"
#include "ext_lsm.h"
#include "ext_bmp.h"
#include "ext_drv.h"
#include "ext_act.h"
#include "ext_pi.h"
#include "amb_temp.h"
#include "cal_onboard.h"
#include "pi_plan.h"
#include "logger.h"
#include "net_radio.h"
#include <Preferences.h>
#include <esp_attr.h>
#include <math.h>

using namespace net;

static const uint32_t TASK_MS       = 20;
static const int64_t  FRESH_US      = 500000;     // una fuente sin datos en este tiempo cuenta como caida
static const float    REF_TAU_S     = 60.0f;      // en TIERRA, p0 sigue al clima
static const float    ALT_TAU_S     = 0.2f;
static const uint8_t  VZ_WINDOW     = 50;         // muestras de TASK_MS: velocidad vertical sobre 1 s
static const float    VZ_MOVING_MPS = 2.0f;
static const float    ACC_REST_G    = 0.25f;      // tolerancia sobre 1 g: acelerometros aun sin calibrar
static const uint32_t SLEEP_DELAY_MS = 1500;      // deja salir la respuesta antes de dormir
static const uint8_t  ROCKET_DEMETER = net::DEMETER;   // IO45 (encendido de la Pi) solo se usa en Demeter

static const MissionCfg *s_cfg = nullptr;
static uint8_t  s_rocket = 0;
static QueueHandle_t s_q = nullptr, s_logQ = nullptr;
static Preferences s_prefs;

// ---------- Registro persistente (seccion 8): RTC sin inicializar (reinicio por software, watchdog o brownout) y NVS (corte de energia) ----------
static const uint32_t PERSIST_MAGIC   = 0x4D495331;   // "MIS1"
static const uint8_t  PERSIST_VERSION = 1;
static const char    *const PERSIST_KEY = "vuelo";    // en el espacio "tbmis", el mismo del contador de comandos
static const uint8_t  MIS_REANUDADO   = 3;            // arg del T_MISSION automatico de la reanudacion (formato_log.md)
static const uint8_t  PERSIST_FLAGS   = TF_BOOST_SIN_ARMAR | TF_FORZADO;    // los TF_* que se guardan; TF_REANUDADO no: lo pone la reanudacion
struct MisPersist {                 // 32 B, sin relleno: el CRC cubre todos los bytes menos el suyo
    uint32_t magic;
    uint32_t bootCount;             // arranque que lo escribio (el contador "boot" del logger)
    int64_t  boostUtcMs;            // UTC del BOOST en ms; -1 si no hubo BOOST o no habia hora
    float    ref[2];                // p0 de cada barometro
    uint8_t  version, state, moment, flags;
    uint8_t  boosted;
    uint8_t  refOk;                 // bit 0: p0 del BMP581 valido; bit 1: el del BME280
    uint16_t crc;
};
static_assert(sizeof(MisPersist) == 32, "MisPersist debe medir 32 B");
static RTC_NOINIT_ATTR MisPersist s_rtc;
static bool    s_persistLive = false;      // la RTC o la NVS guardan un registro reanudable: hay que invalidarlo al salir de FLY o RECOVERY
static int64_t s_boostUtcMs = -1;

static volatile uint8_t s_state = ST_TIERRA, s_moment = M_NONE, s_flags = 0, s_ack = 0;
static bool     s_boosted = false;
static int64_t  s_abortAt = 0, s_recEndAt = 0;
static bool     s_abortOn = false;
static volatile uint32_t s_sleepAt = 0, s_resetAt = 0;

static uint32_t s_lastCounter = 0, s_cmds = 0;
static CmdResp  s_lastResp;
static bool     s_haveResp = false;

// Comando no apto en espera de confirmacion
static bool     s_pendOn = false;
static uint8_t  s_pendOp = 0, s_pendArg = 0;
static uint32_t s_pendMask = 0, s_pendMs = 0;

// Barometro: un p0 por sensor (el BMP581 lee ~71 Pa mas que el BME280)
static float    s_ref[2] = {0, 0};
static bool     s_refOk[2] = {false, false};
static float    s_alt = 0, s_vz = 0, s_altHist[VZ_WINDOW];
static uint8_t  s_histIdx = 0, s_histN = 0, s_src = 2;
static BoostBaroJump s_jump;
static bool     s_jumpHit = false;

static uint16_t persistCrc(const MisPersist &r) { return crc16((const uint8_t *)&r, sizeof(r) - sizeof(r.crc)); }

static bool persistValid(const MisPersist &r) {
    if (r.magic != PERSIST_MAGIC || r.version != PERSIST_VERSION || r.crc != persistCrc(r)) return false;
    if (r.state < ST_TIERRA || r.state > ST_RECOVERY || r.moment > M_ATERRIZAJE) return false;
    return true;
}

// Solo FLY y RECOVERY se reanudan; cualquier otro estado guardado es un arranque normal
static bool persistResumable(const MisPersist &r) {
    return (r.state == ST_FLY && r.moment >= M_LAUNCH) || (r.state == ST_RECOVERY && r.moment == M_ATERRIZAJE);
}

// Contador de arranques del logger (espacio "tbfw", clave "boot"): solo se lee, y mucho despues de que el logger lo incremento
static uint32_t bootCount() {
    Preferences p;
    if (!p.begin("tbfw", true)) return 0;
    const uint32_t n = p.getUInt("boot", 0);
    p.end();
    return n;
}

static int64_t utcNowMs() {
    const int64_t u = time_to_utc_us(esp_timer_get_time());
    return u < 0 ? -1 : u / 1000;
}

// Guarda el estado actual (RTC primero: es instantanea; luego NVS). Se llama solo en las transiciones: la NVS se desgasta y su escritura frena el flash
static void persistWrite(uint8_t state) {
    MisPersist r; memset(&r, 0, sizeof(r));
    r.magic = PERSIST_MAGIC; r.version = PERSIST_VERSION;
    r.state = state; r.moment = s_moment; r.flags = (uint8_t)(s_flags & PERSIST_FLAGS); r.boosted = s_boosted ? 1 : 0;
    r.ref[0] = s_ref[0]; r.ref[1] = s_ref[1]; r.refOk = (uint8_t)((s_refOk[0] ? 1 : 0) | (s_refOk[1] ? 2 : 0));
    r.boostUtcMs = s_boostUtcMs; r.bootCount = bootCount();
    r.crc = persistCrc(r);
    s_rtc = r;
    if (s_prefs.putBytes(PERSIST_KEY, &r, sizeof(r)) != sizeof(r)) s_prefs.remove(PERSIST_KEY);   // si no se pudo escribir, que no quede uno viejo que reanude de mas
}

static void persistSave() { persistWrite(s_state); s_persistLive = true; }

// Al pasar a TIERRA o ARMED: un registro valido con un estado no reanudable (gana a uno viejo en la otra memoria). Solo si hay algo que invalidar
static void persistClear() {
    if (!s_persistLive) return;
    s_persistLive = false;
    persistWrite(s_state);
}

static bool readPress(uint8_t i, float &p) {
    const int64_t now = esp_timer_get_time();
    if (i == 0) {
        ExtBarSample s;
        if (!g_ext_bar.get(s) || now - s.t_us > FRESH_US) return false;
        p = s.press_pa;
    } else {
        BarSample s;
        if (!g_bar.get(s) || now - s.t_us > FRESH_US) return false;
        p = s.press_pa;
    }
    return p > 0;
}

static void baroStep() {
    const float dt = TASK_MS / 1000.0f;
    float p[2];
    const bool ok[2] = {readPress(0, p[0]), readPress(1, p[1])};
    for (uint8_t i = 0; i < 2; i++) {
        if (!ok[i]) continue;
        if (!s_refOk[i]) { s_ref[i] = p[i]; s_refOk[i] = true; }
        else if (s_state == ST_TIERRA) s_ref[i] += (p[i] - s_ref[i]) * dt / REF_TAU_S;
    }
    const uint8_t src = ok[0] ? 0 : (ok[1] ? 1 : 2);
    if (src != s_src) { s_src = src; s_histN = 0; s_histIdx = 0; s_jump.reset(); }      // otro sensor: no se mezclan sus alturas
    if (src == 2) { s_jumpHit = false; return; }

    const float alt = amb::altura(p[src], s_ref[src], ambTempC());     // con la temperatura del suelo (D-058); 15 C sin muestra
    s_jumpHit = s_jump.feed(esp_timer_get_time(), alt);                // BOOST barometrico: la altura sin filtrar, el filtro de ALT_TAU_S solo la atrasaria
    s_alt = s_histN ? s_alt + (alt - s_alt) * dt / ALT_TAU_S : alt;
    const float old = s_altHist[s_histN < VZ_WINDOW ? 0 : s_histIdx];
    s_vz = s_histN ? (s_alt - old) / ((s_histN < VZ_WINDOW ? s_histN : VZ_WINDOW) * dt) : 0.0f;
    s_altHist[s_histIdx] = s_alt;
    s_histIdx = (uint8_t)((s_histIdx + 1) % VZ_WINDOW);
    if (s_histN < VZ_WINDOW) s_histN++;
}

static bool accAtRest() {
    const int64_t now = esp_timer_get_time();
    ImuSample s;
    if (!(g_ext_imu.get(s) && now - s.t_us < FRESH_US) && !(g_imu.get(s) && now - s.t_us < FRESH_US)) return true;   // sin IMU: lo dicen otros motivos
    const float g = sqrtf((float)s.a[0] * s.a[0] + (float)s.a[1] * s.a[1] + (float)s.a[2] * s.a[2]) / s.acc_lsb_per_g;
    return fabsf(g - 1.0f) <= ACC_REST_G;
}

static inline uint32_t rz(uint8_t r) { return 1UL << r; }

static uint32_t motionReasons() {
    uint32_t m = 0;
    if (s_vz > VZ_MOVING_MPS) m |= rz(RZ_SUBIENDO);
    if (s_vz < -VZ_MOVING_MPS) m |= rz(RZ_BAJANDO);
    return m;
}

// Lo que debe cumplirse para quedar en la rampa
static uint32_t readyReasons() {
    uint32_t m = 0;
    const LoggerStats l = loggerStats();
    const bool prepared = l.state == 5 && l.filePos > 0;       // armado antes y desarmado: el archivo sigue listo
    if (!prepared && (l.spareState != 2 || l.sparePct < 100)) m |= rz(RZ_RESERVA);
    if (l.state != 2 && l.state != 5) m |= rz(RZ_SD);
    const int64_t now = esp_timer_get_time();
    ImuSample im;
    if (!g_ext_imu.get(im) || now - im.t_us > FRESH_US) m |= rz(RZ_LSM);
    ExtBarSample b;
    if (!g_ext_bar.get(b) || now - b.t_us > FRESH_US) m |= rz(RZ_BMP);
    GnssSample g;
    if (!g_gnss.get(g) || g.fix < 3 || now - g.t_rx_us > FRESH_US) m |= rz(RZ_GNSS);
    if (g_vbat_mv < s_cfg->vbat_arm_mv) m |= rz(RZ_VBAT);
    if (!accAtRest()) m |= rz(RZ_MOVIMIENTO);
    if (s_rocket == ROCKET_DEMETER) {                  // la Pi debe estar lista o ya armada (D-055); se puede forzar con confirmacion
        const uint8_t pi = piStatus();
        if (pi != piplan::PS_READY && pi != piplan::PS_ARMED) m |= rz(RZ_PI_NO_LISTA);
    }
    if (ambArmBits()) m |= rz(RZ_TEMP);                // temperatura del suelo dudosa (D-058); se puede forzar con confirmacion
    return m | motionReasons();
}

static uint32_t evalTo(uint8_t to) {
    const uint8_t from = s_state;
    if (from == to) return rz(RZ_YA_ESTA);
    uint32_t m = 0;
    switch (to) {
    case ST_TIERRA:
        if (from == ST_FLY && s_boosted) m |= rz(RZ_EN_VUELO) | motionReasons();     // sin BOOST el cohete sigue en tierra
        break;
    case ST_ARMED:
        if (from == ST_FLY) m |= s_boosted ? rz(RZ_EN_VUELO) | motionReasons() : 0;     // sin BOOST es el aborto
        else {
            if (from != ST_TIERRA) m |= rz(RZ_TRANSICION);
            m |= readyReasons();
        }
        break;
    case ST_FLY:
        if (from == ST_TIERRA) m |= rz(RZ_NO_ARMADO);
        if (from == ST_RECOVERY) m |= rz(RZ_TRANSICION);
        break;
    case ST_RECOVERY:
        if (from != ST_FLY) m |= rz(RZ_SIN_VUELO);
        else if (s_moment != M_ATERRIZAJE) m |= rz(RZ_SIN_ATERRIZAJE);
        m |= motionReasons();
        if (!accAtRest()) m |= rz(RZ_MOVIMIENTO);
        break;
    default:
        m |= rz(RZ_OP);
    }
    return m;
}

static uint32_t evaluate(uint8_t op, uint8_t arg) {
    switch (op) {
    case OP_PING:      return 0;
    case OP_ARM:       return evalTo(ST_ARMED);
    case OP_DISARM:    return s_state == ST_ARMED ? 0 : (s_state == ST_FLY ? evalTo(ST_TIERRA) : rz(RZ_TRANSICION));
    case OP_LAUNCH:    return evalTo(ST_FLY);
    case OP_ABORT:     return s_state != ST_FLY ? rz(RZ_TRANSICION) : (s_boosted ? rz(RZ_EN_VUELO) | motionReasons() : 0);
    case OP_SLEEP: {
        uint32_t m = extDrvStats().magnet ? rz(RZ_IMAN) : 0;
        if (s_state == ST_RECOVERY) m |= rz(RZ_RECOVERY);
        else if (s_state == ST_ARMED) m |= rz(RZ_TRANSICION);
        else if (s_state == ST_FLY) m |= (s_boosted ? rz(RZ_EN_VUELO) : rz(RZ_TRANSICION)) | motionReasons();
        return m;
    }
    case OP_RESET:     return s_state == ST_TIERRA ? 0 : ((s_state == ST_FLY && s_boosted) ? rz(RZ_EN_VUELO) | motionReasons() : rz(RZ_TRANSICION));
    case OP_SET_STATE: return arg >= ST_TIERRA && arg <= ST_RECOVERY ? evalTo(arg) : rz(RZ_OP);
    case OP_BUZZER:    return arg <= 1 ? 0 : rz(RZ_OP);                  // apto en cualquier estado: sirve para el banco y para buscar el cohete
    case OP_PI_POWER:
        if (s_rocket != ROCKET_DEMETER) return rz(RZ_OP);                // Hermes no tiene Pi: IO45 queda sin usar
        // Sin la UART con la Pi (T-702) no se sabe si esta encendida, y una pulsacion podria apagarla: siempre pide confirmacion
        return rz(RZ_PI_DESCONOCIDA) | (s_state == ST_FLY && s_boosted ? rz(RZ_EN_VUELO) : 0);
    case OP_SET_MOMENT: {
        if (arg < M_LAUNCH || arg > M_ATERRIZAJE) return rz(RZ_OP);
        uint32_t m = s_state == ST_FLY ? 0 : rz(RZ_TRANSICION);
        if (arg > M_BOOST && !s_boosted) m |= rz(RZ_SIN_BOOST);
        if (arg == M_LAUNCH && s_boosted) m |= rz(RZ_EN_VUELO);
        if (arg == M_ATERRIZAJE) m |= motionReasons();
        return m;
    }
    // Calibracion a bordo (D-059): solo en TIERRA y sin registrar. RZ_CAL_NO_LISTA no se puede forzar (no hay nada que aplicar).
    case OP_CAL_ANALIZAR:
        if (s_state != ST_TIERRA) return rz(RZ_TRANSICION);
        return (loggerRecInfo().recording || calAnalizando()) ? rz(RZ_CAL_NO_LISTA) : 0;
    case OP_CAL_APLICAR:
        if (s_state != ST_TIERRA) return rz(RZ_TRANSICION);
        if (!calListo()) return rz(RZ_CAL_NO_LISTA);
        return calListoConAvisos() ? rz(RZ_CAL_AVISOS) : 0;
    case OP_CAL_DESCARTAR: return (calListo() || calEstado() == CE_ERROR) ? 0 : rz(RZ_CAL_NO_LISTA);
    case OP_CAL_ANTERIOR:
        if (s_state != ST_TIERRA) return rz(RZ_TRANSICION);
        return calHayAnterior() ? 0 : rz(RZ_CAL_NO_LISTA);
    default:           return rz(RZ_OP);
    }
}

static void logTransition(uint8_t op, uint8_t arg, uint8_t result, uint8_t from, uint32_t counter, uint32_t reasons) {
    MissionLog l; memset(&l, 0, sizeof(l));
    l.t_us = esp_timer_get_time();
    l.r.counter = counter; l.r.reasons = reasons;
    l.r.op = op; l.r.arg = arg; l.r.result = result; l.r.from = from; l.r.to = s_state; l.r.moment = s_moment; l.r.flags = s_flags;
    xQueueSend(s_logQ, &l, 0);
}

static void setState(uint8_t to, bool save = true) {
    const uint8_t from = s_state;
    s_state = to;
    s_recEndAt = 0;
    s_abortOn = false;
    s_flags = (uint8_t)(s_flags & ~TF_LAUNCH_VENCIDO);
    switch (to) {
    case ST_TIERRA:
        s_moment = M_NONE; s_boosted = false; s_boostUtcMs = -1;
        s_flags = (uint8_t)(s_flags & ~(TF_FORZADO | TF_REANUDADO));     // salir de un estado reanudado en el banco: estado tierra (seccion 8)
        persistClear();
        extActBuzzer(false, millis());                 // en TIERRA el buzzer calla (desarmar, estado tierra)
        loggerRecord(false);
        loggerAllowPrealloc(true);
        netSetFlying(false);
        break;
    case ST_ARMED:
        s_moment = M_NONE; s_boosted = false; s_boostUtcMs = -1;
        persistClear();
        loggerRecord(false);
        loggerAllowPrealloc(false);
        loggerPrepare();
        netSetFlying(false);
        break;
    case ST_FLY:
        s_moment = M_LAUNCH;
        s_abortOn = from == ST_ARMED;                  // FLY forzado desde TIERRA es a proposito: no se cancela solo
        s_abortAt = esp_timer_get_time() + (int64_t)(s_cfg->t_abort * 1e6f);
        loggerAllowPrealloc(from != ST_ARMED);         // en banco y en carro el registro es largo: se sigue creando reserva; en vuelo, no
        loggerRecord(true);
        netSetFlying(true);
        if (save) persistSave();
        break;
    case ST_RECOVERY:
        s_moment = M_ATERRIZAJE;
        s_recEndAt = esp_timer_get_time() + (int64_t)(s_cfg->t_post * 1e6f);
        extActBuzzer(true, millis());                  // aterrizado: suena para encontrarlo (si ya sonaba por ATERRIZAJE, sigue su fase)
        netSetFlying(false);
        persistSave();
        break;
    }
}

// BOOST detectado (T-410). Se llama desde la tarea de mision, la misma que atiende los comandos.
static void onBoost(uint8_t kind, uint32_t value) {
    const uint8_t from = s_state;
    if (from == ST_RECOVERY || (from == ST_FLY && s_moment >= M_BOOST)) return;      // ya en BOOST o despues: nada
    if (from == ST_TIERRA) s_flags = (uint8_t)(s_flags | TF_BOOST_SIN_ARMAR);        // se mantiene hasta un reinicio
    if (from != ST_FLY) setState(ST_FLY, false);                                     // desde ARMED: el archivo ya esta preparado. Se guarda abajo, una sola vez, con el momento BOOST
    s_moment = M_BOOST; s_boosted = true; s_abortOn = false;
    s_flags = (uint8_t)(s_flags & ~TF_LAUNCH_VENCIDO);
    s_boostUtcMs = utcNowMs();                                                       // -1 si no hay hora
    persistSave();
    logTransition(0, kind, CR_OK, from, value, 0);                                   // op 0 = automatico; arg = criterio; counter = dv (cm/s) o salto (cm)
}

// Inercial (LSM; el QMI solo si el LSM no tiene datos frescos) y, de respaldo, barometrico
static void boostStep() {
    const int64_t now = esp_timer_get_time();
    uint32_t vl = 0, vq = 0;
    const uint8_t kl = boostTakeLsm(vl), kq = boostTakeQmi(vq);       // siempre se leen, para no arrastrar avisos viejos
    ImuSample s;
    const bool lsmFresh = g_ext_imu.get(s) && now - s.t_us < FRESH_US;
    if (kl) onBoost(kl, vl);
    else if (kq && !lsmFresh) onBoost(kq, vq);
    else if (s_jumpHit) onBoost(BOOST_BARO, (uint32_t)lroundf(s_jump.jump() * 100.0f));
}

static void execute(uint8_t op, uint8_t arg) {
    switch (op) {
    case OP_ARM:       setState(ST_ARMED); break;
    case OP_DISARM:    setState(ST_TIERRA); break;
    case OP_LAUNCH:    setState(ST_FLY); break;
    case OP_ABORT:     setState(ST_ARMED); break;
    case OP_SLEEP:     s_sleepAt = millis() + SLEEP_DELAY_MS; if (!s_sleepAt) s_sleepAt = 1; break;
    case OP_RESET:     s_resetAt = millis() + SLEEP_DELAY_MS; if (!s_resetAt) s_resetAt = 1; break;
    case OP_SET_STATE: setState(arg); break;
    case OP_SET_MOMENT:
        s_moment = arg;
        if (arg >= M_BOOST) { if (!s_boosted) s_boostUtcMs = utcNowMs(); s_boosted = true; }     // la hora del BOOST es la de la primera vez
        if (arg == M_ATERRIZAJE) extActBuzzer(true, millis());
        if (s_state == ST_FLY) persistSave();          // cada cambio de momento (seccion 8)
        break;
    case OP_BUZZER:    extActBuzzer(arg != 0, millis()); break;
    case OP_PI_POWER:  if (s_rocket == ROCKET_DEMETER) extActPiPulse(millis()); break;     // en Hermes no hay nada que pulsar
    case OP_CAL_ANALIZAR:  calAnalizar(); break;
    case OP_CAL_APLICAR:   calAplicar(); break;
    case OP_CAL_DESCARTAR: calDescartar(); break;
    case OP_CAL_ANTERIOR:  calAnterior(); break;
    default: break;
    }
}

static void reply(const Cmd &c, uint8_t result, uint32_t reasons, bool store) {
    CmdResp r; memset(&r, 0, sizeof(r));
    r.type = P_CMD_RESP; r.rocket_id = s_rocket; r.op = c.op; r.arg = c.arg;
    r.result = result; r.state = missionStateByte(); r.flags = s_flags;
    r.spare_pct = loggerStats().sparePct;
    r.counter = c.counter; r.reasons = reasons; r.last_counter = s_lastCounter;
    const float dm = s_alt * 10.0f, cms = s_vz * 100.0f;
    r.alt_dm = dm > 32767.0f ? 32767 : (dm < -32768.0f ? -32768 : (int16_t)lroundf(dm));
    r.vz_cms = cms > 32767.0f ? 32767 : (cms < -32768.0f ? -32768 : (int16_t)lroundf(cms));
    r.vbat_mv = g_vbat_mv;
    r.crc = crc16((const uint8_t *)&r, sizeof(r) - 2);
    netQueueResp(r);
    if (store) { s_lastResp = r; s_haveResp = true; s_ack = (uint8_t)((c.counter & 0x3F) | (result << 6)); }
}

static void handleCmd(const Cmd &c) {
    if (c.counter == s_lastCounter && s_haveResp) { netQueueResp(s_lastResp); return; }   // reintento: no se ejecuta otra vez
    if (c.counter <= s_lastCounter) { reply(c, CR_ERROR, rz(RZ_CONTADOR), false); return; }

    s_lastCounter = c.counter;
    s_prefs.putULong("ctr", c.counter);
    s_cmds++;

    const uint8_t op = c.op & (uint8_t)~OP_CONFIRM, from = s_state;
    const bool confirming = c.op & OP_CONFIRM;
    const bool esCal = op >= OP_CAL_ANALIZAR && op <= OP_CAL_ANTERIOR;
    const bool needsTwoSteps = op == OP_ARM || (op == OP_SET_STATE && c.arg == ST_ARMED && s_state == ST_TIERRA) ||
                               op == OP_CAL_APLICAR || op == OP_CAL_ANTERIOR;          // cambiar la calibracion: siempre se confirma
    const uint32_t mask = evaluate(op, c.arg);
    uint8_t result;

    if (mask & (rz(RZ_OP) | rz(RZ_CAL_NO_LISTA))) {    // D-051: un comando que no aplica no se confirma ni se ejecuta (ni forzado)
        s_pendOn = false;
        reply(c, CR_ERROR, mask, true);
        logTransition(c.op, c.arg, CR_ERROR, from, c.counter, mask);
        return;
    }

    if (confirming) {
        const bool valid = s_pendOn && s_pendOp == op && s_pendArg == c.arg && s_pendMask == c.reasons && millis() - s_pendMs <= CONFIRM_WINDOW_MS;
        if (!valid) { s_pendOn = false; reply(c, CR_ERROR, rz(RZ_CONFIRM), true); logTransition(c.op, c.arg, CR_ERROR, from, c.counter, rz(RZ_CONFIRM)); return; }
        if (mask != c.reasons && (mask || needsTwoSteps)) {       // la situacion cambio: lo confirmado ya no es lo que hay
            s_pendMask = mask; s_pendMs = millis();
            result = mask ? CR_NO_APTO : CR_CONFIRMA;
        } else {
            s_pendOn = false;
            if (mask && !esCal) s_flags = (uint8_t)(s_flags | TF_FORZADO);   // forzar una calibracion no fuerza la mision
            execute(op, c.arg);
            result = CR_OK;
        }
    } else if (mask || needsTwoSteps) {
        s_pendOn = true; s_pendOp = op; s_pendArg = c.arg; s_pendMask = mask; s_pendMs = millis();
        result = mask ? CR_NO_APTO : CR_CONFIRMA;
    } else {
        s_pendOn = false;
        execute(op, c.arg);
        result = CR_OK;
    }
    reply(c, result, mask, true);
    logTransition(c.op, c.arg, result, from, c.counter, mask);
}

static void missionTask(void *) {
    uint32_t last = millis();
    for (;;) {
        Cmd c;
        if (xQueueReceive(s_q, &c, pdMS_TO_TICKS(TASK_MS)) == pdTRUE) handleCmd(c);
        if (millis() - last < TASK_MS) continue;
        last += TASK_MS;
        if (millis() - last > 10 * TASK_MS) last = millis();
        ambStep(millis());
        calStep(millis());
        baroStep();
        boostStep();
        extActStep(millis());

        // LAUNCH sin BOOST en el tiempo limite: se avisa y se sigue esperando; un fallback nunca anula el registro
        if (s_state == ST_RECOVERY && s_recEndAt && esp_timer_get_time() > s_recEndAt) { s_recEndAt = 0; loggerRecord(false); }
        if (s_state == ST_FLY && s_abortOn && !s_boosted && esp_timer_get_time() > s_abortAt) {
            s_abortOn = false;
            s_flags = (uint8_t)(s_flags | TF_LAUNCH_VENCIDO);
            logTransition(0, 0, CR_OK, ST_FLY, 0, rz(RZ_SIN_BOOST));
        }
    }
}

// Reanuda FLY o RECOVERY tras un reinicio (seccion 8). Va dentro de missionBegin, antes de crear la tarea: el logger, extActBegin y las colas
// de esta tarea ya existen, y loggerRecord, netSetFlying y extActBuzzer solo marcan banderas (la radio arranca despues, en netBegin, y lee las banderas).
static void resume(const MisPersist &r) {
    s_state = r.state; s_moment = r.moment; s_boosted = r.boosted != 0;
    s_flags = (uint8_t)((r.flags & PERSIST_FLAGS) | TF_REANUDADO);
    s_ref[0] = r.ref[0]; s_ref[1] = r.ref[1]; s_refOk[0] = (r.refOk & 1) != 0; s_refOk[1] = (r.refOk & 2) != 0;
    s_boostUtcMs = r.boostUtcMs;
    s_recEndAt = 0; s_abortOn = false;                 // el registro de t_post no se repite; el aviso de t_abort tampoco
    if (r.state == ST_FLY) {
        loggerAllowPrealloc(false);                    // archivo nuevo, sin reserva: en vuelo no se crean
        loggerRecord(true);
        netSetFlying(true);                            // 10 Hz
    } else {
        extActBuzzer(true, millis());                  // la LilyGO esta en el suelo: suena para encontrarla (T-413)
        netSetFlying(false);                           // 2 Hz
    }
    s_rtc = r; s_persistLive = true;                   // la RTC vuelve a tener el registro aunque solo la NVS lo conservara
    logTransition(0, MIS_REANUDADO, CR_OK, r.state, r.bootCount, 0);   // from y to = el estado guardado; counter = el arranque que lo guardo
}

// Primero la RTC (si es valida) y si no, la NVS. Un registro de otro estado (TIERRA, ARMED) o invalido es un arranque normal
static void persistRestore() {
    MisPersist nvs; memset(&nvs, 0, sizeof(nvs));
    const bool nvsOk = s_prefs.getBytes(PERSIST_KEY, &nvs, sizeof(nvs)) == sizeof(nvs) && persistValid(nvs);
    const bool rtcOk = persistValid(s_rtc);
    s_persistLive = (rtcOk && persistResumable(s_rtc)) || (nvsOk && persistResumable(nvs));
    const MisPersist &r = rtcOk ? s_rtc : nvs;
    if ((rtcOk || nvsOk) && persistResumable(r)) { resume(r); return; }
    if (s_persistLive) persistClear();                 // la otra memoria guardaba un vuelo que esta ya no: no se debe reanudar mas tarde
}

void missionBegin(uint8_t rocketId) {
    s_rocket = rocketId;
    s_cfg = &missionCfg(rocketId);
    boostSetTarget(s_cfg->boost_dv_mps);
    s_jump.configure(s_cfg->jump_m, s_cfg->jump_s, BOOST_BARO_EVAL);
    s_prefs.begin("tbmis", false);
    s_lastCounter = s_prefs.getULong("ctr", 0);
    s_q = xQueueCreate(4, sizeof(Cmd));
    s_logQ = xQueueCreate(8, sizeof(MissionLog));
    persistRestore();
    xTaskCreatePinnedToCore(missionTask, "mission", 4096, nullptr, 2, nullptr, 0);
}

void missionOnCmd(const Cmd &c) { if (s_q) xQueueSend(s_q, &c, 0); }
bool missionTakeLog(MissionLog &l) { return s_logQ && xQueueReceive(s_logQ, &l, 0) == pdTRUE; }
uint8_t missionStateByte() { return (uint8_t)(s_state | (s_moment << 4)); }
uint8_t missionFlags() { return s_flags; }
uint8_t missionAck() { return s_ack; }

bool missionTakeSleep() {
    const uint32_t at = s_sleepAt;
    if (!at || (int32_t)(millis() - at) < 0) return false;
    s_sleepAt = 0;
    return true;
}

bool missionTakeReset() {
    const uint32_t at = s_resetAt;
    if (!at || (int32_t)(millis() - at) < 0) return false;
    s_resetAt = 0;
    return true;
}

MissionStats missionStats() {
    MissionStats s;
    s.state = s_state; s.moment = s_moment; s.flags = s_flags;
    s.altM = s_alt; s.vzMps = s_vz; s.baroSrc = s_src;
    s.cmds = s_cmds; s.lastCounter = s_lastCounter;
    s.lastReasons = s_haveResp ? s_lastResp.reasons : 0;
    s.lastResult = s_haveResp ? s_lastResp.result : 0;
    return s;
}
