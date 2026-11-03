// net_radio.cpp - La tarea duerme hasta poco antes de cada ranura propia o de tierra; transmite o escucha y vuelve a dormir.
// startTransmit tarda unos 6.8 ms hasta salir al aire, muy repetible: se mide y se adelanta la llamada esa cantidad.
#include "net_radio.h"
#include "core_bus.h"
#include "in_imu.h"
#include "in_bar.h"
#include "mission.h"
#include "ext_act.h"
#include "logger.h"
#include "LoRaBoards.h"
#include <RadioLib.h>
#include <net_proto.h>
#include <net_auth.h>
#include <esp_random.h>

static const int64_t  PREP_US     = 3000;      // margen entre despertar y llamar a startTransmit
static const int64_t  MAX_LATE_US = 1000;      // mas tarde que esto se salta la ranura
static const double   MAX_ERR_US  = 2000.0;    // error de hora maximo para usar ranuras
static const int64_t  LINK_FLOOR_US = 100;     // error base de una hora recibida por baliza
static const uint32_t TX_DONE_MS  = 60;
static const uint32_t BEACON_MIN_MS = 1000, BEACON_MAX_MS = 3000;
static const uint8_t  RX_BUF = 40;

static SX1262        s_radio = new Module(RADIO_CS_PIN, RADIO_DIO1_PIN, RADIO_RST_PIN, RADIO_BUSY_PIN);
static TaskHandle_t  s_task = nullptr;
static volatile int64_t s_tDone = 0;
static volatile bool s_flying = false;
static uint8_t       s_rocket = 0;
static uint16_t      s_mission = 0;
static int64_t       s_leadUs = 6800;          // duracion medida de startTransmit
static uint64_t      s_lastBeaconMs = 0;
static NetStats      s_st;
static portMUX_TYPE  s_respMux = portMUX_INITIALIZER_UNLOCKED;
static net::CmdResp  s_resp;
static uint8_t       s_respLeft = 0;
static const uint8_t RESP_REPEATS = 2;
static const uint32_t LOG_INFO_MS = 5000;
static uint32_t      s_lastLogInfoMs = 0;

static void IRAM_ATTR onDio1() {
    s_tDone = esp_timer_get_time();
    BaseType_t hp = pdFALSE;
    if (s_task) vTaskNotifyGiveFromISR(s_task, &hp);
    if (hp) portYIELD_FROM_ISR();
}

static inline int16_t clamp16(float v) { return v > 32767.0f ? 32767 : (v < -32768.0f ? -32768 : (int16_t)lroundf(v)); }

static bool takeResp(net::CmdResp &out) {
    portENTER_CRITICAL(&s_respMux);
    const bool have = s_respLeft > 0;
    if (have) { out = s_resp; s_respLeft--; }
    portEXIT_CRITICAL(&s_respMux);
    return have;
}

// Lo que no es TELEM: respuesta a un comando o estado del registro. Devuelve su tamano, 0 si toca TELEM.
static size_t specialPacket(uint8_t *out) {
    net::CmdResp r;
    if (takeResp(r)) { memcpy(out, &r, sizeof(r)); return sizeof(r); }
    if (millis() - s_lastLogInfoMs < LOG_INFO_MS) return 0;
    s_lastLogInfoMs = millis();
    const LoggerRecInfo i = loggerRecInfo();
    const LoggerStats l = loggerStats();
    net::LogInfo p; memset(&p, 0, sizeof(p));
    p.type = net::P_LOG_INFO; p.rocket_id = s_rocket; p.recording = i.recording ? 1 : (i.prepared ? 2 : 0); p.pct = i.pct;
    p.spare_state = l.spareState; p.spare_pct = l.sparePct;
    strncpy(p.name, i.name, sizeof(p.name) - 1);
    p.elapsed_s = i.elapsedS; p.pos = i.pos; p.remain_s = i.remainS;
    p.crc = net::crc16((const uint8_t *)&p, sizeof(p) - 2);
    memcpy(out, &p, sizeof(p));
    return sizeof(p);
}

static bool timeUsable(TimeModel &m, int64_t now) { return time_snapshot(m) && m.valid() && m.errEstUs(now) < MAX_ERR_US; }

static void sleepUntil(int64_t t) {
    const int64_t wait = t - esp_timer_get_time();
    if (wait > 1000) vTaskDelay(pdMS_TO_TICKS(wait / 1000));
    else taskYIELD();
}

static void buildTelem(net::Telem &p, int64_t utc_us, uint8_t timeFlags) {
    memset(&p, 0, sizeof(p));
    p.type = net::P_TELEM; p.rocket_id = s_rocket; p.mission_id = s_mission;
    p.utc_ms = utc_us > 0 ? (uint64_t)(utc_us / 1000) : 0;
    p.time_flags = timeFlags;
    p.flags = (uint8_t)((s_flying ? net::TF_FLYING : 0) | missionFlags());
    p.state = missionStateByte();
    p.cmd_ack = missionAck();
    p.actuators = extActBits();
    p.quat[0] = 32767;                                  // identidad hasta que exista el EKF
    p.vbat_mv = g_vbat_mv;

    GnssSample g;
    if (g_gnss.get(g)) {
        p.lat_e7 = g.lat_e7; p.lon_e7 = g.lon_e7; p.alt_cm = g.hmsl_mm / 10;
        p.vn_cms = clamp16(g.vn_mmps / 10.0f); p.ve_cms = clamp16(g.ve_mmps / 10.0f); p.vd_cms = clamp16(g.vd_mmps / 10.0f);
        p.fix = g.fix; p.nsv = g.nsv;
    }
    ImuSample s;
    if (g_imu.get(s)) {
        for (int i = 0; i < 3; i++) {
            p.acc_mg[i] = clamp16(s.a[i] * 1000.0f / s.acc_lsb_per_g);
            p.gyro_01dps[i] = clamp16(s.g[i] * 10.0f / s.gyr_lsb_per_dps);
        }
    }
    BarSample b;
    if (g_bar.get(b)) p.temp_c[0] = (int8_t)lroundf(b.temp_c);
    p.crc = net::crc16((const uint8_t *)&p, sizeof(p) - 2);
}

// Devuelve true si la transmision termino. tStart = instante tras ordenar TX; tDone = interrupcion de fin.
static bool sendPacket(const void *p, size_t n, int64_t &tStart, int64_t &tDone) {
    ulTaskNotifyTake(pdTRUE, 0);
    const int16_t st = s_radio.startTransmit((uint8_t *)p, n);
    tStart = esp_timer_get_time();
    if (st != RADIOLIB_ERR_NONE) { s_st.txErr++; return false; }
    const bool done = ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(TX_DONE_MS)) > 0;
    tDone = s_tDone;
    s_radio.finishTransmit();
    if (!done) { s_st.txErr++; return false; }
    s_st.airUs = (uint32_t)(tDone - tStart);
    return true;
}

static void logLink(uint8_t dir, uint8_t slot, uint8_t len, int64_t t, int32_t lateUs, uint32_t airUs, float rssi, float snr) {
    rec::LinkRec r; memset(&r, 0, sizeof(r));
    r.dir = dir; r.slot = slot; r.len = len;
    r.rssi_x10 = (int16_t)lroundf(rssi * 10.0f); r.snr_x10 = (int16_t)lroundf(snr * 10.0f);
    r.late_us = lateUs; r.air_us = airUs;
    bus_log(RING_NET, rec::T_LINK, rec::S_SYS, t, &r, sizeof(r));
}

// Paquete recibido: solo se acepta una baliza o un comando bien firmados; la baliza, ademas, mas nueva que la anterior.
static void handleRx(int64_t tRx) {
    uint8_t buf[RX_BUF];
    const size_t len = s_radio.getPacketLength();
    if (len > sizeof(buf)) { s_st.rxBad++; return; }
    const int16_t st = s_radio.readData(buf, len);
    if (st != RADIOLIB_ERR_NONE) { s_st.rxBad++; return; }
    if (len == sizeof(net::Cmd) && buf[0] == net::P_CMD) {
        net::Cmd c;
        memcpy(&c, buf, sizeof(c));
        if (c.target != s_rocket) { s_st.rxOther++; return; }
        if (!net::authCheck(buf, sizeof(c) - sizeof(c.tag), c.tag)) { s_st.rxBad++; return; }
        s_st.rxCmd++;
        logLink(rec::LD_RX, 1, sizeof(c), tRx, 0, 0, s_radio.getRSSI(), s_radio.getSNR());
        missionOnCmd(c);
        return;
    }
    if (len != sizeof(net::Beacon) || buf[0] != net::P_BEACON) { s_st.rxOther++; return; }

    net::Beacon b;
    memcpy(&b, buf, sizeof(b));
    if (!net::authCheck(buf, sizeof(b) - sizeof(b.tag), b.tag) || b.utc_ms <= s_lastBeaconMs) { s_st.rxBad++; return; }
    s_lastBeaconMs = b.utc_ms;

    // Instante en UTC del fin de recepcion segun tierra
    const int64_t utcRx = (int64_t)b.utc_ms * 1000 + net::TX_OFFSET_US + net::BEACON_AIR_US;
    TimeModel m;
    int32_t res = 0;
    if (time_snapshot(m) && m.valid()) { res = (int32_t)(m.toUtcUs(tRx) - utcRx); s_st.lastResUs = res; }
    time_link_anchor(tRx, utcRx, LINK_FLOOR_US);
    s_st.rx++;
    logLink(rec::LD_RX, 0, sizeof(b), tRx, res, 0, s_radio.getRSSI(), s_radio.getSNR());
}

// Sin hora: escucha continua, y una baliza lenta propia en tiempo aleatorio.
static void slowBeacon() {
    const uint32_t tEnd = millis() + BEACON_MIN_MS + esp_random() % (BEACON_MAX_MS - BEACON_MIN_MS);
    ulTaskNotifyTake(pdTRUE, 0);
    s_radio.startReceive();
    TimeModel m;
    for (int32_t left; (left = (int32_t)(tEnd - millis())) > 0; ) {
        if (ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(left)) == 0) break;
        handleRx(s_tDone);
        if (timeUsable(m, esp_timer_get_time())) { s_radio.standby(); return; }
        s_radio.startReceive();
    }
    s_radio.standby();

    int64_t tStart, tDone;
    uint8_t sp[sizeof(net::Telem)];
    const size_t spN = specialPacket(sp);
    if (spN) {
        if (sendPacket(sp, spN, tStart, tDone)) { s_st.txResp++; logLink(rec::LD_TX, 0xFF, (uint8_t)spN, tDone, 0, s_st.airUs, 0, 0); }
        return;
    }
    net::Telem p;
    const int64_t now = esp_timer_get_time();
    const bool have = time_snapshot(m) && m.valid();
    buildTelem(p, 0, have ? m.timeFlags(now) : 3);
    if (sendPacket(&p, sizeof(p), tStart, tDone)) { s_st.beacons++; logLink(rec::LD_TX, 0xFF, sizeof(p), tDone, 0, s_st.airUs, 0, 0); }
}

static void listenSlot(int64_t slotUtc) {
    TimeModel m;
    if (!time_snapshot(m)) return;
    const int64_t tOpen = m.toLocalUs(slotUtc - net::RX_OPEN_US), tClose = m.toLocalUs(slotUtc + net::RX_CLOSE_US);
    sleepUntil(tOpen);
    while (esp_timer_get_time() < tOpen) {}
    if (esp_timer_get_time() - tOpen > MAX_LATE_US) { s_st.rxSkipped++; return; }

    ulTaskNotifyTake(pdTRUE, 0);
    s_radio.startReceive();
    const int64_t left = tClose - esp_timer_get_time();
    if (left > 0 && ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(left / 1000 + 1)) > 0) handleRx(s_tDone);
    s_radio.standby();
}

static void txSlot(int64_t abs, int64_t slotUtc) {
    TimeModel m;
    if (!time_snapshot(m)) return;
    sleepUntil(m.toLocalUs(slotUtc + net::TX_OFFSET_US) - s_leadUs - PREP_US);

    // Hora fresca: el modelo pudo actualizarse con un PPS mientras se dormia
    time_snapshot(m);
    const int64_t tTarget = m.toLocalUs(slotUtc + net::TX_OFFSET_US);
    const int64_t tCall = tTarget - s_leadUs;
    net::Telem p;
    uint8_t sp[sizeof(net::Telem)];
    const size_t spN = specialPacket(sp);
    const bool isResp = spN != 0;
    if (!isResp) buildTelem(p, slotUtc, m.timeFlags(esp_timer_get_time()));
    const void *data = isResp ? (const void *)sp : (const void *)&p;
    const size_t size = isResp ? spN : sizeof(p);
    while (esp_timer_get_time() < tCall) {}
    const int64_t now = esp_timer_get_time();
    if (now - tCall > MAX_LATE_US) { s_st.skipped++; return; }

    int64_t tStart, tDone = 0;
    if (!sendPacket(data, size, tStart, tDone)) return;
    s_leadUs += ((tStart - now) - s_leadUs) / 8;
    const int32_t late = (int32_t)(tStart - tTarget);
    const uint32_t end = (uint32_t)(tDone - (tTarget - net::TX_OFFSET_US));
    if (late > 0 && (uint32_t)late > s_st.lateMaxUs) s_st.lateMaxUs = (uint32_t)late;
    if (end > s_st.endMaxUs) s_st.endMaxUs = end;
    s_st.tx++;
    if (isResp) s_st.txResp++;
    logLink(rec::LD_TX, (uint8_t)(abs % net::SLOTS_PER_S), (uint8_t)size, tDone, late, s_st.airUs, 0, 0);
}

static void netTask(void *) {
    s_task = xTaskGetCurrentTaskHandle();
    while (s_radio.begin(net::FREQ_MHZ, net::BW_KHZ, net::SF, net::CR, net::SYNC, NET_TX_DBM, net::PREAMBLE) != RADIOLIB_ERR_NONE)
        vTaskDelay(pdMS_TO_TICKS(1000));
    s_radio.setCurrentLimit(140);
    s_radio.setCRC(2);
    s_radio.setDio1Action(onDio1);
    s_st.radioOk = true;

    for (;;) {
        MissionLog ml;
        while (missionTakeLog(ml)) bus_log(RING_NET, rec::T_MISSION, rec::S_SYS, ml.t_us, &ml.r, sizeof(ml.r));
        TimeModel m;
        const int64_t now = esp_timer_get_time();
        if (!timeUsable(m, now)) {
            s_st.slotted = false;
            slowBeacon();
            continue;
        }
        s_st.slotted = true;

        // Siguiente ranura con algo que hacer: propia o de tierra
        int64_t abs = m.toUtcUs(now) / net::SLOT_US + 1;
        uint8_t slot = (uint8_t)(abs % net::SLOTS_PER_S);
        while (net::slotOwner(slot) != net::GROUND && !net::slotIsTx(s_rocket, slot, s_flying)) {
            abs++;
            slot = (uint8_t)(abs % net::SLOTS_PER_S);
        }
        const int64_t slotUtc = abs * net::SLOT_US;
        if (net::slotOwner(slot) == net::GROUND) listenSlot(slotUtc);
        else txSlot(abs, slotUtc);
    }
}

void netBegin(uint8_t rocketId, uint16_t missionId) {
    s_rocket = rocketId; s_mission = missionId;
    xTaskCreatePinnedToCore(netTask, "net", 6144, nullptr, 4, nullptr, 0);
}

NetStats netStats() { return s_st; }
void     netSetFlying(bool flying) { s_flying = flying; }
bool     netFlying() { return s_flying; }

void netQueueResp(const net::CmdResp &r) {
    portENTER_CRITICAL(&s_respMux);
    s_resp = r;
    s_respLeft = RESP_REPEATS;
    portEXIT_CRITICAL(&s_respMux);
}
