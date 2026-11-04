// gnd_rx.cpp - Tierra aun no tiene hora propia: valida las ranuras con el utc_ms del paquete y con su reloj local.
//   perdidos: ranuras propias del cohete entre dos paquetes seguidos que no llegaron.
//   ranura_mala: paquete que dice venir de una ranura que no es de ese cohete.
//   dispersion: maximo-minimo por segundo de (instante de recepcion - utc_ms); mide el temblor real de la transmision.
//   ofs_utc: con hora propia, fin real de la recepcion menos el previsto (inicio de ranura + 2 ms + tiempo en aire), media por segundo.
#include "gnd_rx.h"
#include "gnd_time.h"
#include "gnd_cmd.h"
#include "LoRaBoards.h"
#include <RadioLib.h>
#include <net_proto.h>
#include <net_auth.h>
#include <fw_build.h>

#ifndef GND_TX_DBM
#define GND_TX_DBM 10          // para prueba de banco; 22 para alcance y vuelo
#endif

static const int64_t BEACON_SOON_US = 3000;           // a menos de esto del momento de llamar a TX, se espera activamente
static const uint32_t TX_DONE_MS    = 40;
static const int64_t MAX_GAP_SLOTS = 25 * 60;          // mas que esto es un reinicio, no perdidas
static const int64_t TELEM_AIR_US  = 29500;
static const char *NAMES[3] = {"?", "Demeter", "Hermes"};
static const char *STATES[5] = {"-", "TIERRA", "ARMED", "FLY", "RECOVERY"};
static const char *MOMENTS[8] = {"-", "LAUNCH", "BOOST", "COAST", "APOGEO", "CAIDA", "PARACAIDAS", "ATERRIZAJE"};

static SX1262 s_radio = new Module(RADIO_CS_PIN, RADIO_DIO1_PIN, RADIO_RST_PIN, RADIO_BUSY_PIN);
static volatile bool s_flag = false;
static volatile int64_t s_tRx = 0;
static void IRAM_ATTR onRx() { s_tRx = esp_timer_get_time(); s_flag = true; }

struct RocketRx {
    uint32_t rx, lost, badSlot, beacons, resets, win, others;   // others: ocuparon ranura sin ser TELEM
    int64_t  lastAbs;
    float    rssiSum, snrSum, rssiMin;
    int64_t  ofsMin, ofsMax;
    int64_t  utcOfsSum;
    uint32_t utcOfsN;
    net::Telem last;
    bool     have;
};
static RocketRx s_r[3];
static uint32_t s_crcBad = 0, s_lenBad = 0, s_err = 0, s_foreign = 0;
static uint32_t s_bcnTx = 0, s_bcnErr = 0, s_bcnLateMax = 0, s_bcnAir = 0, s_cmdTx = 0, s_cmdErr = 0;
static int64_t  s_bcnLead = 6000, s_bcnSec = 0;        // duracion medida de startTransmit; ultimo segundo con baliza

// Lineas para el dashboard: "@T rssi snr bytes-en-hex" (TELEM), "@L bytes-en-hex" (LogInfo). El resto de la salida sigue siendo texto para leer.
static void emitPacket(char tag, const void *pkt, size_t len, float rssi, float snr) {
    char b[32 + 2 * sizeof(net::Telem)];
    int n = tag == 'T' ? snprintf(b, 31, "@T %.1f %.1f ", rssi, snr) : snprintf(b, 31, "@%c ", tag);
    const uint8_t *d = (const uint8_t *)pkt;
    static const char HEX_CH[] = "0123456789abcdef";
    for (size_t i = 0; i < len; i++) { b[n++] = HEX_CH[d[i] >> 4]; b[n++] = HEX_CH[d[i] & 15]; }
    b[n++] = '\n';
    Serial.write((const uint8_t *)b, n);
}

void gndRxBegin() {
    // Con bufer de salida, imprimir no frena el bucle: de el dependen la baliza y los comandos
    Serial.flush();
    Serial.end();
    Serial.setTxBufferSize(4096);
    Serial.begin(115200);
    int st = s_radio.begin(net::FREQ_MHZ, net::BW_KHZ, net::SF, net::CR, net::SYNC, GND_TX_DBM, net::PREAMBLE);
    Serial.printf("[lora] begin -> %d\n", st);
    if (st != RADIOLIB_ERR_NONE) return;
    s_radio.setCurrentLimit(140);
    s_radio.setCRC(2);
    s_radio.setPacketReceivedAction(onRx);
    s_radio.startReceive();
    gndCmdBegin();
}

static void accept(const net::Telem &p, int64_t t, float rssi, float snr) {
    RocketRx &r = s_r[p.rocket_id];
    r.rx++; r.win++;
    r.rssiSum += rssi; r.snrSum += snr;
    if (r.win == 1 || rssi < r.rssiMin) r.rssiMin = rssi;
    r.last = p; r.have = true;
    if (p.utc_ms == 0) { r.beacons++; return; }

    const int64_t abs = (int64_t)p.utc_ms * 1000 / net::SLOT_US;
    if (!net::slotIsTx(p.rocket_id, (uint8_t)(abs % net::SLOTS_PER_S), true)) r.badSlot++;
    if (r.lastAbs && abs > r.lastAbs) {
        if (abs - r.lastAbs > MAX_GAP_SLOTS) r.resets++;
        else {
            const bool flying = p.flags & net::TF_FLYING;
            for (int64_t a = r.lastAbs + 1; a < abs; a++)
                if (net::slotIsTx(p.rocket_id, (uint8_t)(a % net::SLOTS_PER_S), flying)) r.lost++;
        }
    }
    r.lastAbs = abs;
    const int64_t ofs = t - (int64_t)p.utc_ms * 1000;
    if (r.ofsMin == 0 || ofs < r.ofsMin) r.ofsMin = ofs;
    if (r.ofsMax == 0 || ofs > r.ofsMax) r.ofsMax = ofs;
    int64_t utc;
    if (gndTimeUtc(t, utc)) {
        r.utcOfsSum += utc - ((int64_t)p.utc_ms * 1000 + net::TX_OFFSET_US + TELEM_AIR_US);
        r.utcOfsN++;
    }
}

static void report() {
    int64_t utcNow;
    Serial.printf("@G %d\n", gndTimeUtc(esp_timer_get_time(), utcNow) ? 1 : 0);
    gndTimeReport();
    Serial.printf("[bcn ] fw=%s %s %d dBm | tx=%lu err=%lu tarde_max=%lu us aire=%lu us adelanto=%ld us\n", FW_ENV, FW_GIT, GND_TX_DBM, (unsigned long)s_bcnTx, (unsigned long)s_bcnErr,
                  (unsigned long)s_bcnLateMax, (unsigned long)s_bcnAir, (long)s_bcnLead);
    for (int i = 1; i <= 2; i++) {
        RocketRx &r = s_r[i];
        if (!r.have) { Serial.printf("[%s] sin recepcion\n", NAMES[i]); continue; }
        const net::Telem &p = r.last;
        const float ax = p.acc_mg[0], ay = p.acc_mg[1], az = p.acc_mg[2];
        Serial.printf("[%s] %s/%s flags=0x%02X ack=%u/%u | rx=%lu %lu/s perdidos=%lu ranura_mala=%lu balizas=%lu reinicios=%lu | RSSI=%.1f (min %.1f) dBm SNR=%.1f dB dispersion=%ld us ofs_utc=%ld us | %s q=%u fix=%u sv=%u alt=%.1f m vbat=%u mV |a|=%.0f mg T=%d C\n",
                      NAMES[i], STATES[(p.state & 0x0F) <= 4 ? (p.state & 0x0F) : 0], MOMENTS[(p.state >> 4) <= 7 ? (p.state >> 4) : 0], p.flags, p.cmd_ack & 0x3F, p.cmd_ack >> 6,
                      (unsigned long)r.rx, (unsigned long)r.win, (unsigned long)(r.lost > r.others ? r.lost - r.others : 0), (unsigned long)r.badSlot,
                      (unsigned long)r.beacons, (unsigned long)r.resets,
                      r.win ? r.rssiSum / r.win : 0.0f, r.win ? r.rssiMin : 0.0f, r.win ? r.snrSum / r.win : 0.0f,
                      (long)(r.ofsMax - r.ofsMin), r.utcOfsN ? (long)(r.utcOfsSum / r.utcOfsN) : 0L, (p.flags & net::TF_FLYING) ? "vuelo" : "tierra", p.time_flags & 3, p.fix, p.nsv,
                      p.alt_cm / 100.0f, p.vbat_mv, sqrtf(ax * ax + ay * ay + az * az), p.temp_c[0]);
        r.win = 0; r.rssiSum = r.snrSum = 0; r.ofsMin = r.ofsMax = 0; r.utcOfsSum = 0; r.utcOfsN = 0;
    }
    Serial.printf("[rx  ] crc_mal=%lu largo_mal=%lu ajeno=%lu err=%lu | cmd_tx=%lu cmd_err=%lu\n",
                  (unsigned long)s_crcBad, (unsigned long)s_lenBad, (unsigned long)s_foreign, (unsigned long)s_err, (unsigned long)s_cmdTx, (unsigned long)s_cmdErr);
}

static void processRx() {
    if (!s_flag) return;
    s_flag = false;
    const int64_t t = s_tRx;
    net::Telem p;
    const size_t len = s_radio.getPacketLength();
    const int16_t st = s_radio.readData((uint8_t *)&p, sizeof(p));
    if (st == RADIOLIB_ERR_CRC_MISMATCH) s_crcBad++;
    else if (st != RADIOLIB_ERR_NONE) s_err++;
    else if (len == sizeof(net::CmdResp) && p.type == net::P_CMD_RESP) {
        net::CmdResp r;
        memcpy(&r, &p, sizeof(r));
        if (r.crc == net::crc16((const uint8_t *)&r, sizeof(r) - 2)) { if (r.rocket_id <= 2) s_r[r.rocket_id].others++; gndCmdOnResp(r); }
        else s_foreign++;
    }
    else if (len == sizeof(net::LogInfo) && p.type == net::P_LOG_INFO) {
        net::LogInfo l;
        memcpy(&l, &p, sizeof(l));
        if (l.crc == net::crc16((const uint8_t *)&l, sizeof(l) - 2)) { if (l.rocket_id <= 2) s_r[l.rocket_id].others++; emitPacket('L', &l, sizeof(l), 0, 0); }
        else s_foreign++;
    }
    else if (len != sizeof(p)) s_lenBad++;
    else if (p.type != net::P_TELEM || p.crc != net::crc16((const uint8_t *)&p, sizeof(p) - 2) ||
             (p.rocket_id != net::DEMETER && p.rocket_id != net::HERMES)) s_foreign++;
    else {
        const float rssi = s_radio.getRSSI(), snr = s_radio.getSNR();
        accept(p, t, rssi, snr);
        emitPacket('T', &p, sizeof(p), rssi, snr);
    }
    s_radio.startReceive();
}

// Transmite a la hora exacta y espera el fin. Mientras transmite, tierra no escucha: dura menos de la ranura.
static bool txAt(const void *d, size_t n, int64_t tTarget, int64_t &tStart) {
    const int64_t tCall = tTarget - s_bcnLead;
    while (esp_timer_get_time() < tCall) {}
    const int64_t t0 = esp_timer_get_time();
    s_flag = false;
    const int16_t st = s_radio.startTransmit((uint8_t *)d, n);
    tStart = esp_timer_get_time();
    if (st != RADIOLIB_ERR_NONE) { s_radio.startReceive(); return false; }
    const uint32_t tw = millis();
    while (!s_flag && millis() - tw < TX_DONE_MS) {}
    const bool done = s_flag;
    if (done) s_bcnLead += ((tStart - t0) - s_bcnLead) / 4;
    s_flag = false;
    s_radio.finishTransmit();
    s_radio.startReceive();
    return done;
}

// Baliza en la ranura 0, solo con hora propia buena.
static void beaconStep() {
    const int64_t now = esp_timer_get_time();
    int64_t utc;
    if (!gndTimeUtc(now, utc)) return;
    const int64_t sec = utc / 1000000LL + 1;
    if (sec == s_bcnSec) return;
    const int64_t tTarget = now + (sec * 1000000LL + net::TX_OFFSET_US - utc);
    if (tTarget - s_bcnLead - now > BEACON_SOON_US) return;

    s_bcnSec = sec;
    processRx();                                       // lo ultimo de la ranura 24 ya debe haber llegado
    net::Beacon b;
    b.type = net::P_BEACON;
    b.time_flags = gndTimeFlags(now);
    b.utc_ms = (uint64_t)sec * 1000ULL;
    net::authTag((const uint8_t *)&b, sizeof(b) - sizeof(b.tag), b.tag);

    int64_t tStart;
    if (txAt(&b, sizeof(b), tTarget, tStart)) {
        s_bcnTx++;
        s_bcnAir = (uint32_t)(s_tRx - tStart);
        const int64_t late = tStart - tTarget;
        if (late > 0 && (uint32_t)late > s_bcnLateMax) s_bcnLateMax = (uint32_t)late;
    } else s_bcnErr++;
}

// Comando en la siguiente ranura de tierra que no sea la de la baliza.
static void cmdStep() {
    net::Cmd c;
    if (!gndCmdToSend(c)) return;
    const int64_t now = esp_timer_get_time();
    int64_t utc;
    if (!gndTimeUtc(now, utc)) return;
    int64_t abs = utc / net::SLOT_US + 1, tTarget;
    for (;; abs++) {
        const uint8_t slot = (uint8_t)(abs % net::SLOTS_PER_S);
        if (net::slotOwner(slot) != net::GROUND || slot == 0) continue;
        tTarget = now + (abs * net::SLOT_US + net::TX_OFFSET_US - utc);
        if (tTarget - s_bcnLead > now) break;
    }
    if (tTarget - s_bcnLead - now > BEACON_SOON_US) return;
    processRx();
    int64_t tStart;
    if (txAt(&c, sizeof(c), tTarget, tStart)) s_cmdTx++;
    else s_cmdErr++;
    gndCmdSent();
}

void gndRxLoop() {
    processRx();
    beaconStep();
    gndCmdLoop();
    cmdStep();
    static uint32_t tRep = 0;
    if (millis() - tRep >= 1000) { tRep = millis(); report(); }
}
