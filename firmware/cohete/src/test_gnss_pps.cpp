#include "test_gnss_pps.h"
#include "LoRaBoards.h"
#include <esp_timer.h>
#include <math.h>

static portMUX_TYPE s_mux = portMUX_INITIALIZER_UNLOCKED;

// ---------------- PPS ----------------
#define PPS_RING 16
static volatile int64_t  s_ppsT[PPS_RING];
static volatile uint32_t s_ppsN = 0;

static void IRAM_ATTR ppsIsr() {
    int64_t t = esp_timer_get_time();
    portENTER_CRITICAL_ISR(&s_mux);
    s_ppsT[s_ppsN % PPS_RING] = t;
    s_ppsN++;
    portEXIT_CRITICAL_ISR(&s_mux);
}

// ---------------- UBX ----------------
static void ubxSend(uint8_t cls, uint8_t id, const uint8_t *p, uint16_t n) {
    uint8_t h[6] = {0xB5, 0x62, cls, id, (uint8_t)n, (uint8_t)(n >> 8)};
    uint8_t a = 0, b = 0;
    for (int i = 2; i < 6; i++) { a += h[i]; b += a; }
    for (int i = 0; i < n; i++) { a += p[i]; b += a; }
    SerialGPS.write(h, 6);
    if (n) SerialGPS.write(p, n);
    SerialGPS.write(a);
    SerialGPS.write(b);
    SerialGPS.flush();
}

struct Vs { uint8_t b[64]; uint16_t n; };
static void vsInit(Vs &v) { v.n = 0; v.b[v.n++] = 0; v.b[v.n++] = 0x01; v.b[v.n++] = 0; v.b[v.n++] = 0; } // capa RAM
static void vsAdd(Vs &v, uint32_t key, uint32_t val) {
    int sz = (key >> 28) & 7;
    int len = (sz <= 2) ? 1 : (sz == 3) ? 2 : (sz == 4) ? 4 : 8;
    for (int i = 0; i < 4; i++) v.b[v.n++] = (uint8_t)(key >> (8 * i));
    for (int i = 0; i < len; i++) v.b[v.n++] = (uint8_t)(val >> (8 * i));
}
static void vsSend(Vs &v) { ubxSend(0x06, 0x8A, v.b, v.n); }

// Parser UBX
static uint8_t  s_st = 0, s_cls, s_id, s_ckA;
static uint16_t s_len, s_pos;
static uint8_t  s_pl[320];
static volatile uint32_t s_frames = 0, s_ckerr = 0, s_ack = 0, s_nak = 0;
static volatile uint32_t s_bytes = 0;
static const char *s_stat = "arrancando";
static uint32_t s_baud = 0;

struct Pvt {
    uint32_t itow; uint16_t year; uint8_t mon, day, h, m, s, valid;
    uint32_t tacc; int32_t nano; uint8_t fix, flags, sv; uint32_t hacc;
};
static Pvt s_pvt;
static volatile uint32_t s_pvtCnt = 0, s_gaps = 0, s_prevItow = 0;
static volatile uint32_t s_gapPrev = 0, s_gapNew = 0;
static int64_t s_latMin = INT64_MAX, s_latMax = INT64_MIN, s_latSum = 0;
static uint32_t s_latN = 0, s_latBad = 0;
static uint32_t s_t0 = 0, s_ttff = 0;

static void handlePvt(int64_t tRx) {
    const uint8_t *p = s_pl;
    Pvt v;
    memcpy(&v.itow, p + 0, 4);
    memcpy(&v.year, p + 4, 2);
    v.mon = p[6]; v.day = p[7]; v.h = p[8]; v.m = p[9]; v.s = p[10]; v.valid = p[11];
    memcpy(&v.tacc, p + 12, 4);
    memcpy(&v.nano, p + 16, 4);
    v.fix = p[20]; v.flags = p[21]; v.sv = p[23];
    memcpy(&v.hacc, p + 40, 4);

    portENTER_CRITICAL(&s_mux);
    s_pvt = v;
    s_pvtCnt++;
    if (s_prevItow && (v.itow - s_prevItow) != 100) {
        s_gaps++;
        s_gapPrev = s_prevItow;
        s_gapNew = v.itow;
    }
    s_prevItow = v.itow;
    if ((v.itow % 1000) == 0 && s_ppsN > 0) {
        int64_t lat = tRx - s_ppsT[(s_ppsN - 1) % PPS_RING];
        if (lat > 0 && lat < 1000000) {
            if (lat < s_latMin) s_latMin = lat;
            if (lat > s_latMax) s_latMax = lat;
            s_latSum += lat; s_latN++;
        } else s_latBad++;
    }
    if (!s_ttff && v.fix >= 3 && (v.flags & 1)) s_ttff = millis() - s_t0;
    portEXIT_CRITICAL(&s_mux);
}

static void ubxByte(uint8_t c) {
    s_bytes++;
    switch (s_st) {
    case 0: if (c == 0xB5) s_st = 1; break;
    case 1: s_st = (c == 0x62) ? 2 : 0; break;
    case 2: s_cls = c; s_st = 3; break;
    case 3: s_id = c; s_st = 4; break;
    case 4: s_len = c; s_st = 5; break;
    case 5:
        s_len |= (uint16_t)c << 8; s_pos = 0;
        if (s_len > sizeof(s_pl)) s_st = 0; else s_st = s_len ? 6 : 7;
        break;
    case 6: s_pl[s_pos++] = c; if (s_pos >= s_len) s_st = 7; break;
    case 7: s_ckA = c; s_st = 8; break;
    case 8: {
        int64_t tRx = esp_timer_get_time();
        uint8_t a = 0, b = 0;
        uint8_t h[4] = {s_cls, s_id, (uint8_t)s_len, (uint8_t)(s_len >> 8)};
        for (int i = 0; i < 4; i++) { a += h[i]; b += a; }
        for (int i = 0; i < s_len; i++) { a += s_pl[i]; b += a; }
        if (a == s_ckA && b == c) {
            s_frames++;
            if (s_cls == 0x05) { if (s_id == 1) s_ack++; else if (s_id == 0) s_nak++; }
            else if (s_cls == 0x01 && s_id == 0x07 && s_len == 92) handlePvt(tRx);
        } else s_ckerr++;
        s_st = 0;
    } break;
    }
}

static void gpsOpen(uint32_t baud) {
    SerialGPS.end();
    SerialGPS.setRxBufferSize(4096);
    SerialGPS.begin(baud, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
}

static bool probe(uint32_t baud) {
    gpsOpen(baud);
    delay(50);
    while (SerialGPS.available()) SerialGPS.read();
    s_st = 0;
    uint32_t f0 = s_frames;
    ubxSend(0x0A, 0x04, nullptr, 0);               // MON-VER
    uint32_t t0 = millis();
    while (millis() - t0 < 400) {
        while (SerialGPS.available()) ubxByte(SerialGPS.read());
        if (s_frames != f0) return true;
        delay(2);
    }
    return false;
}

static bool gnssInit() {
    const uint32_t bauds[] = {115200, 9600, 38400, 57600, 230400, 460800};
    uint32_t found = 0;
    s_stat = "buscando baud";
    for (uint32_t b : bauds) { if (probe(b)) { found = b; break; } }
    if (!found) { s_stat = "SIN RESPUESTA UBX"; return false; }
    s_baud = found;

    if (found != 115200) {
        Vs v; vsInit(v);
        vsAdd(v, 0x40520001, 115200);              // CFG-UART1-BAUDRATE
        vsSend(v);
        delay(100);
        if (!probe(115200)) { s_stat = "FALLO cambio a 115200"; return false; }
        s_baud = 115200;
    }

    Vs v; vsInit(v);
    vsAdd(v, 0x10740002, 0);    // UART1 salida NMEA off
    vsAdd(v, 0x10740001, 1);    // UART1 salida UBX on
    vsAdd(v, 0x30210001, 100);  // CFG-RATE-MEAS 100 ms
    vsAdd(v, 0x30210002, 1);    // CFG-RATE-NAV 1
    vsAdd(v, 0x20110021, 8);    // DYNMODEL Airborne <4g
    vsAdd(v, 0x20910007, 1);    // MSGOUT UBX-NAV-PVT UART1
    uint32_t a0 = s_ack, n0 = s_nak;
    vsSend(v);
    uint32_t t0 = millis();
    while (millis() - t0 < 500) { while (SerialGPS.available()) ubxByte(SerialGPS.read()); delay(2); }
    s_stat = (s_ack != a0 && s_nak == n0) ? "OK" : "CONFIG sin ACK o con NAK";
    return true;
}

static void gnssTask(void *) {
    bool ok = false;
    for (;;) {
        if (!ok) { ok = gnssInit(); if (!ok) vTaskDelay(pdMS_TO_TICKS(1000)); continue; }
        int n = SerialGPS.available();
        while (n-- > 0) ubxByte(SerialGPS.read());
        vTaskDelay(1);
    }
}

void testGnssPpsBegin() {
    s_t0 = millis();
    pinMode(GPS_PPS_PIN, INPUT);
    attachInterrupt(GPS_PPS_PIN, ppsIsr, RISING);
    xTaskCreatePinnedToCore(gnssTask, "gnss", 6144, nullptr, 2, nullptr, 0);
}

// ---------------- Informe ----------------
void testGnssPpsReport() {
    static uint32_t seen = 0, lastPvt = 0, lastMs = 0, nDt = 0, out = 0, lost = 0;
    static int64_t prev = 0, dtLast = 0, devMin = INT64_MAX, devMax = INT64_MIN;
    static double sum = 0, sum2 = 0;
    Serial.printf("[gnss] init=%s baud=%lu bytes_rx=%lu tramas_ok=%lu ack=%lu\n",
                  s_stat, (unsigned long)s_baud, (unsigned long)s_bytes,
                  (unsigned long)s_frames, (unsigned long)s_ack);
    Pvt v; uint32_t pc, N; int64_t ring[PPS_RING];
    uint32_t gapPrev, gapNew;
    int64_t lMin, lMax, lSum; uint32_t lN, lBad;
    portENTER_CRITICAL(&s_mux);
    v = s_pvt; pc = s_pvtCnt; N = s_ppsN;
    gapPrev = s_gapPrev; gapNew = s_gapNew;
    for (int i = 0; i < PPS_RING; i++) ring[i] = s_ppsT[i];
    lMin = s_latMin; lMax = s_latMax; lSum = s_latSum; lN = s_latN; lBad = s_latBad;
    s_latMin = INT64_MAX; s_latMax = INT64_MIN; s_latSum = 0; s_latN = 0;
    portEXIT_CRITICAL(&s_mux);

    if (N - seen > PPS_RING) { lost += N - seen - PPS_RING; seen = N - PPS_RING; }
    while (seen < N) {
        int64_t t = ring[seen % PPS_RING];
        if (prev) {
            int64_t dt = t - prev;
            int64_t dev = dt - 1000000;
            if (dev > 50000 || dev < -50000) out++;
            else {
                nDt++; sum += dev; sum2 += (double)dev * dev; dtLast = dt;
                if (dev < devMin) devMin = dev;
                if (dev > devMax) devMax = dev;
            }
        }
        prev = t; seen++;
    }

    uint32_t now = millis();
    float rate = lastMs ? (pc - lastPvt) * 1000.0f / (now - lastMs) : 0;
    lastPvt = pc; lastMs = now;

    Serial.printf("[gnss] pvt/s=%.1f fix=%u sv=%u valid=0x%02X tAcc=%lu ns hAcc=%.1f m UTC=%02u:%02u:%02u.%03d gaps=%lu ckerr=%lu nak=%lu ttff=%lus\n",
                  rate, v.fix, v.sv, v.valid, (unsigned long)v.tacc, v.hacc / 1000.0f,
                  v.h, v.m, v.s, (int)(v.nano / 1000000),
                  (unsigned long)s_gaps, (unsigned long)s_ckerr, (unsigned long)s_nak,
                  (unsigned long)(s_ttff / 1000));
    Serial.printf("[gnss] ultimo_gap: iTOW %lu -> %lu (salto %ld ms)\n",
                  (unsigned long)gapPrev, (unsigned long)gapNew, (long)(gapNew - gapPrev));
    if (nDt > 1) {
        double mean = sum / nDt;
        double sd = sqrt(fmax(0.0, sum2 / nDt - mean * mean));
        Serial.printf("[pps ] flancos=%lu dt=%lld us deriva=%+.2f ppm sd=%.1f us dev_min=%+lld dev_max=%+lld fuera=%lu perdidos=%lu",
                      (unsigned long)N, (long long)dtLast, mean, sd,
                      (long long)devMin, (long long)devMax, (unsigned long)out, (unsigned long)lost);
        if (lN) Serial.printf(" | lat_pvt=%lld..%lld ms (n=%lu mal=%lu)",
                      (long long)(lMin / 1000), (long long)(lMax / 1000), (unsigned long)lN, (unsigned long)lBad);
        Serial.println();
    } else {
        Serial.printf("[pps ] flancos=%lu (esperando mas flancos)\n", (unsigned long)N);
    }
}