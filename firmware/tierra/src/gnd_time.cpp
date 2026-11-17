// gnd_time.cpp - El M8N no admite CFG-VALSET: se configura con CFG-PRT, CFG-MSG y CFG-RATE. A 1 Hz basta para PPS y posicion.
#include "gnd_time.h"
#include "LoRaBoards.h"
#include <esp_timer.h>
#include <ubx.h>
#include <time_model.h>

#ifndef GND_PPS_PIN
#define GND_PPS_PIN 37
#endif

static const uint32_t GPS_BAUD      = 115200;
static const uint32_t SILENCE_MS    = 3000;      // sin tramas: reconfigurar
static const uint32_t MAX_TACC_NS   = 1000;
static const int64_t  MAX_EDGE_AGE  = 900000;    // a 1 Hz el PVT puede llegar lejos del flanco, pero antes del siguiente
static const double   MAX_ERR_US    = 1000.0;
static const uint32_t POS_MAX_HACC_MM = 5000;

static ubx::Parser s_parser;
static TimeModel   s_tm;
static volatile int64_t s_edge = 0;
static volatile uint32_t s_edges = 0;
static uint32_t s_lastFrameMs = 0, s_acks = 0, s_naks = 0, s_pvt = 0, s_anchors = 0, s_noEdge = 0;
static ubx::NavPvt s_last;
static bool     s_haveLast = false;
static uint32_t s_posN = 0;
static double   s_lat = 0, s_lon = 0, s_alt = 0;

static void IRAM_ATTR ppsIsr() { s_edge = esp_timer_get_time(); s_edges = s_edges + 1; }

static void handlePvt(const uint8_t *p) {
    const int64_t tRx = esp_timer_get_time();
    ubx::NavPvt v;
    if (!ubx::decodePvt(p, 92, v)) return;
    s_pvt++; s_last = v; s_haveLast = true;

    int64_t sec = 0;
    if (ubx::wholeSecondAnchor(v, MAX_TACC_NS, &sec)) {
        const int64_t e = s_edge, age = tRx - e;
        if (e > 0 && age > 0 && age <= MAX_EDGE_AGE) { s_tm.onPpsAnchor(e, sec); s_anchors++; }
        else s_noEdge++;
    }
    if (v.fixType >= 3 && v.fixType <= 4 && v.hAcc <= POS_MAX_HACC_MM) {
        s_posN++;
        const double a = 1.0 / s_posN;
        s_lat += a * (v.lat * 1e-7 - s_lat); s_lon += a * (v.lon * 1e-7 - s_lon); s_alt += a * (v.hMSL * 1e-3 - s_alt);
    }
}

static void onFrame(void *, uint8_t cls, uint8_t id, const uint8_t *p, uint16_t n) {
    s_lastFrameMs = millis();
    if (cls == 0x05) { if (id == 1) s_acks++; else if (id == 0) s_naks++; }
    else if (cls == 0x01 && id == 0x07 && n == 92) handlePvt(p);
}

static void gpsOpen(uint32_t baud) {
    SerialGPS.end();
    SerialGPS.setRxBufferSize(2048);
    SerialGPS.begin(baud, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
}

static void sendCfg(uint8_t id, const uint8_t *p, uint16_t n) {
    uint8_t f[40];
    const uint16_t len = ubx::build(f, 0x06, id, p, n);
    SerialGPS.write(f, len);
    SerialGPS.flush();
}

static void configure() {
    // CFG-PRT UART1: 8N1, 115200, entrada UBX+NMEA, salida solo UBX. No se conoce la velocidad actual: se envia en las probables.
    static const uint32_t bauds[] = {9600, 38400, GPS_BAUD};
    uint8_t prt[20]; memset(prt, 0, sizeof(prt));
    prt[0] = 1;
    prt[4] = 0xD0; prt[5] = 0x08;
    prt[8] = (uint8_t)GPS_BAUD; prt[9] = (uint8_t)(GPS_BAUD >> 8); prt[10] = (uint8_t)(GPS_BAUD >> 16);
    prt[12] = 0x03; prt[14] = 0x01;
    for (size_t i = 0; i < sizeof(bauds) / sizeof(bauds[0]); i++) {
        gpsOpen(bauds[i]);
        delay(30);
        sendCfg(0x00, prt, sizeof(prt));
        delay(120);
    }
    gpsOpen(GPS_BAUD);
    delay(50);
    const uint8_t msg[3] = {0x01, 0x07, 1};              // NAV-PVT en cada solucion
    sendCfg(0x01, msg, sizeof(msg));
    const uint8_t rate[6] = {0xE8, 0x03, 1, 0, 0, 0};    // 1000 ms, referencia UTC
    sendCfg(0x08, rate, sizeof(rate));
    s_lastFrameMs = millis();
}

void gndTimeBegin() {
    s_parser.init(onFrame, nullptr);
    pinMode(GND_PPS_PIN, INPUT);
    attachInterrupt(GND_PPS_PIN, ppsIsr, RISING);
    configure();
}

void gndTimeLoop() {
    int n = SerialGPS.available();
    if (n > 0) {
        uint8_t tmp[128]; if (n > (int)sizeof(tmp)) n = sizeof(tmp);
        n = SerialGPS.readBytes(tmp, n);
        s_parser.feed(tmp, n);
    }
    if (millis() - s_lastFrameMs > SILENCE_MS) configure();
}

bool gndTimeUtc(int64_t t, int64_t &utc) {
    if (!s_tm.valid() || s_tm.errEstUs(t) >= MAX_ERR_US) return false;
    utc = s_tm.toUtcUs(t);
    return true;
}

uint8_t gndTimeFlags(int64_t t) { return s_tm.timeFlags(t); }

void gndTimeReport() {
    const int64_t now = esp_timer_get_time();
    if (s_haveLast)
        Serial.printf("[gnss] fix=%u sv=%u tAcc=%lu ns hAcc=%.1f m pvt=%lu ack=%lu nak=%lu ckerr=%lu flancos=%lu\n",
                      s_last.fixType, s_last.numSV, (unsigned long)s_last.tacc, s_last.hAcc / 1000.0f, (unsigned long)s_pvt,
                      (unsigned long)s_acks, (unsigned long)s_naks, (unsigned long)s_parser.ckerr, (unsigned long)s_edges);
    else
        Serial.printf("[gnss] SIN PVT: tramas=%lu ack=%lu nak=%lu ckerr=%lu bytes=%lu flancos=%lu\n",
                      (unsigned long)s_parser.frames, (unsigned long)s_acks, (unsigned long)s_naks,
                      (unsigned long)s_parser.ckerr, (unsigned long)s_parser.bytes, (unsigned long)s_edges);
    if (s_tm.valid()) {
        const int64_t utc = s_tm.toUtcUs(now), sod = (utc / 1000000LL) % 86400LL;
        Serial.printf("[time] q=%u err=%.1f us deriva=%+.2f ppm UTC=%02d:%02d:%02d anclas=%lu sin_flanco=%lu | pos(%lu)=%.7f %.7f %.1f m\n",
                      s_tm.quality(now), s_tm.errEstUs(now), s_tm.driftPpm(), (int)(sod / 3600), (int)((sod / 60) % 60), (int)(sod % 60),
                      (unsigned long)s_anchors, (unsigned long)s_noEdge, (unsigned long)s_posN, s_lat, s_lon, s_alt);
    } else {
        Serial.printf("[time] sin hora (q=3) anclas=%lu sin_flanco=%lu\n", (unsigned long)s_anchors, (unsigned long)s_noEdge);
    }
}
