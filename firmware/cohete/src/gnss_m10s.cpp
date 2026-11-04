// gnss_m10s.cpp - Modulo GNSS u-blox M10S: configuracion UBX, parser, PPS y publicacion.
#include "gnss_m10s.h"
#include "core_bus.h"
#include "ubx.h"
#include "LoRaBoards.h"      // SerialGPS, GPS_RX_PIN, GPS_TX_PIN, GPS_PPS_PIN
#include <esp_timer.h>

static const uint32_t kMaxTAccNs   = 1000;      // para anclar el PPS
static const int64_t  kMaxEdgeAge  = 500000;    // us entre el flanco y la llegada del PVT de ese segundo
static const uint32_t kSilenceMs   = 3000;      // sin tramas -> reiniciar la configuracion

// ---------------- PPS ----------------
static const uint32_t PPS_RING = 4;
static int64_t  s_edge[PPS_RING];
static uint32_t s_edgeN = 0;

static void IRAM_ATTR ppsIsr() {
    const int64_t t = esp_timer_get_time();
    const uint32_t n = s_edgeN;
    s_edge[n % PPS_RING] = t;
    __atomic_store_n(&s_edgeN, n + 1, __ATOMIC_RELEASE);
}

// ultimo flanco anterior a t_rx y a menos de kMaxEdgeAge; -1 si no hay
static int64_t findEdge(int64_t t_rx) {
    const uint32_t n = __atomic_load_n(&s_edgeN, __ATOMIC_ACQUIRE);
    for (uint32_t k = 0; k < PPS_RING && k < n; k++) {
        const int64_t e = s_edge[(n - 1 - k) % PPS_RING];
        const int64_t age = t_rx - e;
        if (age > 0 && age <= kMaxEdgeAge) return e;
        if (age > kMaxEdgeAge) break;
    }
    return -1;
}

// ---------------- estado ----------------
static ubx::Parser s_parser;
static GnssStats   s_st;
static uint32_t    s_prevItow = 0, s_seq = 0, s_lastFrameMs = 0;
static volatile uint32_t s_acks = 0, s_naks = 0;
static const char *s_stat = "arrancando";
#ifdef GNSS_NO_ANCHORS
static volatile bool s_useAnchors = false;       // prueba: arrancar sin hora de GNSS, solo con la baliza de tierra
#else
static volatile bool s_useAnchors = true;
#endif

void gnssSetAnchors(bool use) { s_useAnchors = use; }
bool gnssAnchors() { return s_useAnchors; }

static void handlePvt(const uint8_t *p) {
    const int64_t t_rx = esp_timer_get_time();
    ubx::NavPvt v;
    if (!ubx::decodePvt(p, 92, v)) return;

    bus_log(RING_GNSS, rec::T_PVT, rec::S_IN_GNSS, t_rx, p, 92);       // trama cruda, sin perdida

    s_st.pvt++;
    if (s_prevItow && (v.itow - s_prevItow) != 100) {
        s_st.gaps++; s_st.lastGapMs = (int32_t)(v.itow - s_prevItow);
    }
    s_prevItow = v.itow;
    s_st.fix = v.fixType; s_st.nsv = v.numSV;

    // --- asociacion PVT <-> flanco PPS ---
    int64_t sec = 0;
    if (ubx::wholeSecondAnchor(v, kMaxTAccNs, &sec)) {
        const int64_t edge = findEdge(t_rx);
        rec::PpsRec pr; memset(&pr, 0, sizeof(pr));
        pr.t_edge_us = edge; pr.utc_sec = sec; pr.fix = v.fixType; pr.tacc_ns = v.tacc;
        if (edge >= 0 && s_useAnchors) { time_pps_anchor(edge, sec); pr.used = 1; s_st.anchors++; }
        else s_st.rejects++;
        bus_log(RING_GNSS, rec::T_PPS, rec::S_IN_GNSS, t_rx, &pr, sizeof(pr));
    }

    // --- publicacion para EKF y telemetria ---
    GnssSample s;
    s.t_rx_us = t_rx;
    s.utc_us = ubx::utcEpochUs(v);
    s.t_meas_us = time_to_local_us(s.utc_us);
    s.itow_ms = v.itow;
    s.lat_e7 = v.lat; s.lon_e7 = v.lon; s.h_mm = v.height; s.hmsl_mm = v.hMSL;
    s.vn_mmps = v.velN; s.ve_mmps = v.velE; s.vd_mmps = v.velD; s.gspeed_mmps = v.gSpeed;
    s.hacc_mm = v.hAcc; s.vacc_mm = v.vAcc; s.sacc_mmps = v.sAcc; s.tacc_ns = v.tacc;
    s.pdop_x100 = v.pDOP; s.fix = v.fixType; s.nsv = v.numSV; s.valid = v.valid; s.flags = v.flags;
    s.seq = ++s_seq;
    g_gnss.set(s);
}

static void onFrame(void *, uint8_t cls, uint8_t id, const uint8_t *p, uint16_t n) {
    s_lastFrameMs = millis();
    if (cls == 0x05) { if (id == 1) s_acks++; else if (id == 0) s_naks++; }
    else if (cls == 0x01 && id == 0x07 && n == 92) handlePvt(p);
}

// ---------------- UART / configuracion ----------------
static void gpsOpen(uint32_t baud) {
    SerialGPS.end();
    SerialGPS.setRxBufferSize(4096);
    SerialGPS.begin(baud, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
}
static void sendFrame(const uint8_t *f, uint16_t n) { SerialGPS.write(f, n); SerialGPS.flush(); }

static void pump(uint32_t ms) {
    const uint32_t t0 = millis();
    while (millis() - t0 < ms) {
        int n = SerialGPS.available();
        if (n > 0) { uint8_t tmp[128]; if (n > (int)sizeof(tmp)) n = sizeof(tmp); n = SerialGPS.readBytes(tmp, n); s_parser.feed(tmp, n); }
        else vTaskDelay(1);
    }
}

static bool probe(uint32_t baud) {
    gpsOpen(baud);
    vTaskDelay(pdMS_TO_TICKS(50));
    while (SerialGPS.available()) SerialGPS.read();
    const uint32_t f0 = s_parser.frames;
    uint8_t f[16]; const uint16_t n = ubx::build(f, 0x0A, 0x04, nullptr, 0);   // MON-VER
    sendFrame(f, n);
    const uint32_t t0 = millis();
    while (millis() - t0 < 400) { pump(10); if (s_parser.frames != f0) return true; }
    return false;
}

static bool gnssInit() {
    static const uint32_t bauds[] = {115200, 9600, 38400, 57600, 230400, 460800};
    uint32_t found = 0;
    s_stat = "buscando baud";
    for (size_t i = 0; i < sizeof(bauds) / sizeof(bauds[0]); i++) if (probe(bauds[i])) { found = bauds[i]; break; }
    if (!found) { s_stat = "SIN RESPUESTA UBX"; return false; }

    uint8_t f[96];
    if (found != 115200) {
        ubx::ValSet v; v.init(); v.add(ubx::K_UART1_BAUD, 115200);
        sendFrame(f, v.frame(f));
        vTaskDelay(pdMS_TO_TICKS(100));
        if (!probe(115200)) { s_stat = "FALLO cambio a 115200"; return false; }
    }
    ubx::ValSet v; v.init();
    v.add(ubx::K_UART1OUT_NMEA, 0);        // sin NMEA
    v.add(ubx::K_UART1OUT_UBX, 1);
    v.add(ubx::K_RATE_MEAS_MS, 100);       // 10 Hz
    v.add(ubx::K_RATE_NAV, 1);
    v.add(ubx::K_DYNMODEL, 8);             // Airborne <4g
    v.add(ubx::K_MSGOUT_PVT_U1, 1);        // NAV-PVT por UART1
    const uint32_t a0 = s_acks, n0 = s_naks;
    sendFrame(f, v.frame(f));
    pump(500);
    s_stat = (s_acks != a0 && s_naks == n0) ? "OK" : "CONFIG sin ACK o con NAK";
#ifndef GNSS_TODAS
    // Solo GPS+Galileo: con ~30 satelites a cielo abierto el M10S perdia 12-23 % de las epocas a 10 Hz (3 nov).
    // Mensaje aparte: si el receptor lo rechaza, lo anterior sigue valiendo. -DGNSS_TODAS vuelve a la configuracion de fabrica.
    ubx::ValSet c; c.init();
    c.add(ubx::K_SIG_BDS_ENA, 0);
    c.add(ubx::K_SIG_QZSS_ENA, 0);
    c.add(ubx::K_SIG_SBAS_ENA, 0);
    const uint32_t a1 = s_acks, n1 = s_naks;
    sendFrame(f, c.frame(f));
    pump(1500);                            // el receptor reinicia su parte GNSS
    if (s_stat[0] == 'O' && !(s_acks != a1 && s_naks == n1)) s_stat = "OK, pero constelaciones sin ACK o con NAK";
#endif
    s_lastFrameMs = millis();
    s_prevItow = 0;
    return true;
}

static void gnssTask(void *) {
    bool ok = false;
    for (;;) {
        if (!ok) {
            ok = gnssInit();
            s_st.initOk = ok;
            if (!ok) vTaskDelay(pdMS_TO_TICKS(1000));
            continue;
        }
        int n = SerialGPS.available();
        if (n > 0) {
            uint8_t tmp[128]; if (n > (int)sizeof(tmp)) n = sizeof(tmp);
            n = SerialGPS.readBytes(tmp, n);
            s_parser.feed(tmp, n);
        } else {
            vTaskDelay(1);
        }
        if (millis() - s_lastFrameMs > kSilenceMs) { ok = false; s_stat = "silencio, reiniciando"; }
    }
}

void gnssBegin() {
    memset(&s_st, 0, sizeof(s_st));
    s_parser.init(onFrame, nullptr);
    pinMode(GPS_PPS_PIN, INPUT);
    attachInterrupt(GPS_PPS_PIN, ppsIsr, RISING);                    // el ISR queda en este nucleo
    xTaskCreatePinnedToCore(gnssTask, "gnss", 6144, nullptr, 3, nullptr, 0);
}

GnssStats gnssStats() {
    GnssStats o = s_st;
    o.frames = s_parser.frames; o.ckerr = s_parser.ckerr; o.bytes = s_parser.bytes;
    o.ack = s_acks; o.nak = s_naks;
    o.edges = __atomic_load_n(&s_edgeN, __ATOMIC_ACQUIRE);
    o.stat = s_stat;
    return o;
}
