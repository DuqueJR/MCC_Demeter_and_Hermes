// ext_pi.cpp - UART con la Raspberry Pi de Demeter (bloque 9a y 9b): latido de la Pi y POSE a 50 Hz. Ver ext_pi.h.
//   Tarea "ext_pi" en el nucleo 0, prioridad 2 (como el logger y la mision; debajo de GNSS, I2C y radio). Vuelta de PI_POSE_MS con
//   vTaskDelayUntil: siempre cede CPU. Una POSE de 60 B tarda 5.2 ms a 115200 y cabe entera en la FIFO de TX (128 B), asi que write()
//   no bloquea y el primer byte sale al copiarla: la hora se toma justo antes.
//   Mientras no exista el EKF a bordo, la POSE lleva GNSS (posicion y velocidad), la altura del barometro de la mision (sobre su p0),
//   cuaternion identidad y giro en 0, con F_EKF y F_ATT en 0 para que la Pi no use la actitud.
#include "ext_pi.h"
#include <Arduino.h>
#include <math.h>
#include <freertos/queue.h>
#include <net_proto.h>
#include "core_bus.h"
#include "mission.h"

#pragma pack(push, 1)
struct PoseMsg {                       // demeter_pose.POSE_STRUCT "<QHHiiiihhh4h3hHHH"
    uint64_t utc_us;
    uint16_t seq, flags;
    int32_t  lat_e7, lon_e7, alt_agl_cm, ground_msl_cm;
    int16_t  vn_cms, ve_cms, vd_cms;
    int16_t  q[4];                     // Hamilton, escalar primero, cuerpo FRD -> NED, x32767
    int16_t  gyro_01dps[3];            // cuerpo FRD
    uint16_t sd_att_cdeg, sd_pos_cm, sd_alt_cm;   // 0xFFFF = sin estimar
};
#pragma pack(pop)
static_assert(sizeof(PoseMsg) == 54, "POSE debe medir 54 B (demeter_pose.POSE_STRUCT)");

static const uint32_t SIN_LATIDO      = 0xFFFFFFFFu;
static const float    GROUND_ALPHA    = 0.002f;     // promedio del suelo MSL a 50 Hz: ~10 s
static const uint32_t GROUND_VACC_MM  = 10000;      // GNSS vertical aceptable para estimar el suelo

static bool              s_active = false;
static QueueHandle_t     s_logQ = nullptr;
static volatile uint8_t  s_status = PI_DESCONOCIDO;
static volatile uint32_t s_lastStatusMs = 0;
static volatile bool     s_haveStatus = false;
static PiStats           s_st;                       // contadores: solo los escribe la tarea
static float             s_groundMsl = NAN;          // suelo MSL estimado (m), congelado en vuelo

// ---------- Decodificador (maquina de estados por byte) ----------
static uint8_t  s_buf[2 + 2 + 255 + 2];
static uint16_t s_n = 0;

static void logEvent(uint8_t status, uint8_t prev, uint8_t kind) {
    if (!s_logQ) return;
    PiLog l; memset(&l, 0, sizeof(l));
    l.t_us = time_local_now();
    l.r.status = status; l.r.prev = prev; l.r.kind = kind;
    l.r.rx_frames = s_st.rxFrames; l.r.crc_err = s_st.crcErr; l.r.tx_pose = s_st.txPose;
    xQueueSend(s_logQ, &l, 0);
}

static void onFrame(uint8_t type, const uint8_t *p, uint8_t len) {
    s_st.rxFrames++;
    if (type == PI_T_STATUS && len == 1) {
        s_st.statusMsgs++;
        const uint8_t prev = s_status;
        s_lastStatusMs = millis();
        s_haveStatus = true;
        if (p[0] != prev) {
            s_status = p[0];
            s_st.changes++;
            logEvent(p[0], prev, rec::PIK_CHANGE);
        }
        return;
    }
    s_st.otherFrames++;                               // la Pi no manda otras tramas por ahora
}

// Una trama con el CRC malo se descarta entera (no se busca otra cabecera dentro): con tramas cortas y la Pi como unica fuente, basta.
static void feed(uint8_t b) {
    if (s_n == 0) { if (b == 0xAA) s_buf[s_n++] = b; return; }
    if (s_n == 1) {
        if (b == 0x55) s_buf[s_n++] = b;
        else s_n = (b == 0xAA) ? 1 : 0;
        return;
    }
    s_buf[s_n++] = b;
    if (s_n < 4) return;
    const uint16_t total = (uint16_t)(4 + s_buf[3] + 2);
    if (s_n < total) return;
    const uint16_t crc = rec::crc16(s_buf + 2, (size_t)2 + s_buf[3]);
    const uint16_t got = (uint16_t)((s_buf[total - 2] << 8) | s_buf[total - 1]);
    if (crc == got) onFrame(s_buf[2], s_buf + 4, s_buf[3]);
    else s_st.crcErr++;
    s_n = 0;
}

// ---------- POSE ----------
static int16_t clamp16(float v) {
    if (!(v == v)) return 0;
    if (v > 32767.0f) return 32767;
    if (v < -32768.0f) return -32768;
    return (int16_t)lroundf(v);
}

static void sendFrame(uint8_t type, const void *payload, uint8_t len, PoseMsg *stampUtc) {
    uint8_t f[2 + 2 + 255 + 2];
    f[0] = 0xAA; f[1] = 0x55; f[2] = type; f[3] = len;
    if (stampUtc) {                                   // la hora del primer byte: se toma lo mas tarde posible
        TimeModel m;
        const int64_t t = time_local_now();
        stampUtc->utc_us = (time_snapshot(m) && m.valid()) ? (uint64_t)m.toUtcUs(t) : 0;
    }
    memcpy(f + 4, payload, len);
    const uint16_t crc = rec::crc16(f + 2, (size_t)2 + len);
    f[4 + len] = (uint8_t)(crc >> 8);
    f[5 + len] = (uint8_t)crc;
    Serial0.write(f, (size_t)len + 6);
}

static void sendPose() {
    const size_t n = sizeof(PoseMsg) + 6;
    if ((size_t)Serial0.availableForWrite() < n) { s_st.txSkipped++; return; }   // no bloquear: la anterior no ha salido

    PoseMsg p; memset(&p, 0, sizeof(p));
    p.seq = (uint16_t)s_st.txPose;
    p.q[0] = 32767;                                   // identidad hasta que exista el EKF a bordo (F_ATT en 0)
    p.sd_att_cdeg = 0xFFFF; p.sd_pos_cm = 0xFFFF; p.sd_alt_cm = 0xFFFF;
    uint16_t fl = 0;

    const int64_t now = time_local_now();
    TimeModel m;
    if (time_snapshot(m) && m.valid()) {
        uint8_t src;
        if (m.source() == TimeModel::SRC_LINK) src = 2;
        else src = m.quality(now) == 0 ? 1 : 3;       // GNSS con PPS reciente, o en retencion
        fl |= (uint16_t)(src << PI_F_TSRC_SHIFT);
        if (m.errEstUs(now) < 1000.0) fl |= PI_F_TIME;
    }

    const MissionStats ms = missionStats();
    const bool haveAlt = ms.baroSrc != 2;
    if (haveAlt) { fl |= PI_F_ALT; p.alt_agl_cm = (int32_t)lroundf(ms.altM * 100.0f); }
    if (ms.state == net::ST_FLY) fl |= PI_F_FLY;

    GnssSample g;
    if (g_gnss.get(g) && g.fix >= 3) {
        fl |= PI_F_GNSS3D | PI_F_POS;
        p.lat_e7 = g.lat_e7; p.lon_e7 = g.lon_e7;
        p.vn_cms = clamp16(g.vn_mmps / 10.0f); p.ve_cms = clamp16(g.ve_mmps / 10.0f); p.vd_cms = clamp16(g.vd_mmps / 10.0f);
        p.sd_pos_cm = g.hacc_mm / 10 > 0xFFFE ? 0xFFFE : (uint16_t)(g.hacc_mm / 10);
        // Suelo MSL = altura GNSS menos la del barometro sobre su p0, promediado; en FLY y RECOVERY queda fijo
        if (haveAlt && g.vacc_mm < GROUND_VACC_MM && ms.state != net::ST_FLY && ms.state != net::ST_RECOVERY) {
            const float est = g.hmsl_mm / 1000.0f - ms.altM;
            s_groundMsl = (s_groundMsl == s_groundMsl) ? s_groundMsl + (est - s_groundMsl) * GROUND_ALPHA : est;
        }
    }
    if (s_groundMsl == s_groundMsl) p.ground_msl_cm = (int32_t)lroundf(s_groundMsl * 100.0f);

    p.flags = fl;
    s_st.lastFlags = fl;
    sendFrame(PI_T_POSE, &p, sizeof(p), &p);         // pone utc_us en p antes de copiarla a la trama
    s_st.txPose++;
}

// ---------- Tarea ----------
static void piTask(void *) {
    TickType_t wake = xTaskGetTickCount();
    for (;;) {
        int avail = Serial0.available();
        while (avail-- > 0) {
            const int c = Serial0.read();
            if (c < 0) break;
            s_st.rxBytes++;
            feed((uint8_t)c);
        }
        if (s_haveStatus && s_status != PI_DESCONOCIDO && millis() - s_lastStatusMs > PI_LATIDO_MS) {
            const uint8_t prev = s_status;
            s_status = PI_DESCONOCIDO;
            s_st.losses++;
            logEvent(PI_DESCONOCIDO, prev, rec::PIK_LOST);
        }
        sendPose();
        vTaskDelayUntil(&wake, pdMS_TO_TICKS(PI_POSE_MS));
    }
}

void piBegin(uint8_t rocketId) {
    memset(&s_st, 0, sizeof(s_st));
    if (rocketId != net::DEMETER) return;             // Hermes no tiene Pi: UART0 queda sin usar
    Serial0.setRxBufferSize(1024);
    Serial0.begin(PI_BAUD, SERIAL_8N1, PI_RX_PIN, PI_TX_PIN);
    s_logQ = xQueueCreate(8, sizeof(PiLog));
    s_active = true;
    xTaskCreatePinnedToCore(piTask, "ext_pi", 4096, nullptr, 2, nullptr, 0);
}

uint8_t piStatus() { return s_status; }

PiStats piStats() {
    PiStats s = s_st;
    s.active = s_active;
    s.status = s_status;
    s.ageMs = s_haveStatus ? millis() - s_lastStatusMs : SIN_LATIDO;
    return s;
}

bool piTakeLog(PiLog &l) { return s_logQ && xQueueReceive(s_logQ, &l, 0) == pdTRUE; }

const char *piStatusName(uint8_t s) {
    switch (s) {
    case 0x00: return "BOOT";
    case 0x01: return "PREFLIGHT";
    case 0x02: return "READY";
    case 0x03: return "ARMED";
    case 0x04: return "STARTING";
    case 0x05: return "INGESTING";
    case 0x06: return "PROCESSING";
    case 0x07: return "COMPLETE";
    case 0x08: return "ASCENT";
    case 0x30: return "RECORDING";
    case 0xE0: return "ABORTED";
    case 0xE1: return "SD_FULL";
    case 0xE2: return "RATE_FALLBACK";
    case 0xE3: return "TELEMETRY_LOST";
    case 0xE4: return "ABORT_REQUESTED";
    case 0xE5: return "CLOCK_UNSYNCED";
    case 0xEF: return "PIPELINE_ERROR";
    case PI_DESCONOCIDO: return "desconocido";
    default: return "?";
    }
}
