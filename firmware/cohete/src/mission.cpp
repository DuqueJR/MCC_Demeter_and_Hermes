// mission.cpp - Un comando apto se ejecuta; uno no apto responde sus motivos y solo se ejecuta si tierra confirma esos mismos motivos a tiempo.
// BOOST se detecta solo (T-410, boost_detect.h): FLY ya no depende de LAUNCH. Los demas momentos todavia se fuerzan por comando.
#include "mission.h"
#include "mission_config.h"
#include "boost_detect.h"
#include "core_bus.h"
#include "in_imu.h"
#include "in_bar.h"
#include "ext_lsm.h"
#include "ext_bmp.h"
#include "ext_drv.h"
#include "logger.h"
#include "net_radio.h"
#include <Preferences.h>
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

static const MissionCfg *s_cfg = nullptr;
static uint8_t  s_rocket = 0;
static QueueHandle_t s_q = nullptr, s_logQ = nullptr;
static Preferences s_prefs;

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

    const float alt = 44330.0f * (1.0f - powf(p[src] / s_ref[src], 0.19029f));
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
    case OP_SET_MOMENT: {
        if (arg < M_LAUNCH || arg > M_ATERRIZAJE) return rz(RZ_OP);
        uint32_t m = s_state == ST_FLY ? 0 : rz(RZ_TRANSICION);
        if (arg > M_BOOST && !s_boosted) m |= rz(RZ_SIN_BOOST);
        if (arg == M_LAUNCH && s_boosted) m |= rz(RZ_EN_VUELO);
        if (arg == M_ATERRIZAJE) m |= motionReasons();
        return m;
    }
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

static void setState(uint8_t to) {
    const uint8_t from = s_state;
    s_state = to;
    s_recEndAt = 0;
    s_abortOn = false;
    s_flags = (uint8_t)(s_flags & ~TF_LAUNCH_VENCIDO);
    switch (to) {
    case ST_TIERRA:
        s_moment = M_NONE; s_boosted = false;
        s_flags = (uint8_t)(s_flags & ~TF_FORZADO);
        loggerRecord(false);
        loggerAllowPrealloc(true);
        netSetFlying(false);
        break;
    case ST_ARMED:
        s_moment = M_NONE; s_boosted = false;
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
        break;
    case ST_RECOVERY:
        s_moment = M_ATERRIZAJE;
        s_recEndAt = esp_timer_get_time() + (int64_t)(s_cfg->t_post * 1e6f);
        netSetFlying(false);
        break;
    }
}

// BOOST detectado (T-410). Se llama desde la tarea de mision, la misma que atiende los comandos.
static void onBoost(uint8_t kind, uint32_t value) {
    const uint8_t from = s_state;
    if (from == ST_RECOVERY || (from == ST_FLY && s_moment >= M_BOOST)) return;      // ya en BOOST o despues: nada
    if (from == ST_TIERRA) s_flags = (uint8_t)(s_flags | TF_BOOST_SIN_ARMAR);        // se mantiene hasta un reinicio
    if (from != ST_FLY) setState(ST_FLY);                                            // desde ARMED: el archivo ya esta preparado
    s_moment = M_BOOST; s_boosted = true; s_abortOn = false;
    s_flags = (uint8_t)(s_flags & ~TF_LAUNCH_VENCIDO);
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
        if (arg >= M_BOOST) s_boosted = true;
        break;
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
    const bool needsTwoSteps = op == OP_ARM || (op == OP_SET_STATE && c.arg == ST_ARMED && s_state == ST_TIERRA);
    const uint32_t mask = evaluate(op, c.arg);
    uint8_t result;

    if (confirming) {
        const bool valid = s_pendOn && s_pendOp == op && s_pendArg == c.arg && s_pendMask == c.reasons && millis() - s_pendMs <= CONFIRM_WINDOW_MS;
        if (!valid) { s_pendOn = false; reply(c, CR_ERROR, rz(RZ_CONFIRM), true); logTransition(c.op, c.arg, CR_ERROR, from, c.counter, rz(RZ_CONFIRM)); return; }
        if (mask != c.reasons && (mask || needsTwoSteps)) {       // la situacion cambio: lo confirmado ya no es lo que hay
            s_pendMask = mask; s_pendMs = millis();
            result = mask ? CR_NO_APTO : CR_CONFIRMA;
        } else {
            s_pendOn = false;
            if (mask) s_flags = (uint8_t)(s_flags | TF_FORZADO);
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
        baroStep();
        boostStep();

        // LAUNCH sin BOOST en el tiempo limite: se avisa y se sigue esperando; un fallback nunca anula el registro
        if (s_state == ST_RECOVERY && s_recEndAt && esp_timer_get_time() > s_recEndAt) { s_recEndAt = 0; loggerRecord(false); }
        if (s_state == ST_FLY && s_abortOn && !s_boosted && esp_timer_get_time() > s_abortAt) {
            s_abortOn = false;
            s_flags = (uint8_t)(s_flags | TF_LAUNCH_VENCIDO);
            logTransition(0, 0, CR_OK, ST_FLY, 0, rz(RZ_SIN_BOOST));
        }
    }
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
