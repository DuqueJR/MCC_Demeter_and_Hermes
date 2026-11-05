// cal_onboard.cpp - Calibracion a bordo: tarea de analisis, NVS en dos ranuras, resumen por radio y carga por USB. Ver cal_onboard.h.
#include "cal_onboard.h"
#include <Arduino.h>
#include <SD.h>
#include <Preferences.h>
#include <freertos/queue.h>
#include <algorithm>
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <net_proto.h>
#include "cal_core.h"
#include "core_bus.h"
#include "logger.h"

static const uint32_t CHUNK = 32768;
static const uint32_t RES_CADA_MS = 4000;          // mientras analiza o hay un resultado sin aplicar: una pagina cada 4 s
static const uint32_t ACTIVA_CADA_MS = 60000;      // siempre: la pagina 0 cada minuto (dice que calibracion esta en uso)
static const uint32_t FIN_REPITE = 3;              // tras aplicar, descartar o un error: la pagina 0 tres veces

static uint8_t            s_rocket = 0;
static Preferences        s_prefs;
static QueueHandle_t      s_logQ = nullptr;
static calblob::Calibracion s_act;                 // en uso
static uint8_t            s_slot = 0;              // ranura activa (0 = "a", 1 = "b")
static volatile uint8_t   s_estado = CE_NADA, s_prog = 0;
static cal::Resultado     s_res;
static uint8_t            s_blob[calblob::MAX];
static uint16_t           s_blobN = 0;
static uint32_t           s_crcRes = 0;
static char               s_archivo[48] = "";
static uint32_t           s_ultPaq = 0, s_ultActiva = 0;
static uint8_t            s_pagina = 0, s_repite = 0;
static bool               s_registraba = false;

static void logEvento(uint8_t evento) {
    if (!s_logQ) return;
    CalLog l; memset(&l, 0, sizeof(l));
    l.t_us = time_local_now();
    l.r.crc_activo = s_act.ok ? s_act.crc : 0; l.r.crc_resultado = s_crcRes; l.r.avisos = s_res.avisos;
    l.r.evento = evento; l.r.estado = s_estado; l.r.n_pos = (uint8_t)s_res.n_pos; l.r.ok = s_res.ok;
    xQueueSend(s_logQ, &l, 0);
}

static const char *clave(uint8_t slot) { return slot ? "b" : "a"; }

static bool cargarRanura(uint8_t slot, calblob::Calibracion &c) {
    uint8_t b[calblob::MAX];
    const size_t n = s_prefs.getBytesLength(clave(slot));
    if (!n || n > sizeof(b) || s_prefs.getBytes(clave(slot), b, n) != n) return false;
    return calblob::leer(b, (uint16_t)n, c, nullptr) && c.rocket == s_rocket;
}

void calBegin(uint8_t rocketId) {
    s_rocket = rocketId;
    s_logQ = xQueueCreate(4, sizeof(CalLog));
    s_prefs.begin("tbcal", false);
    s_slot = s_prefs.getUChar("act", 0) ? 1 : 0;
    memset(&s_act, 0, sizeof(s_act));
    if (!cargarRanura(s_slot, s_act)) {                      // la activa no sirve: la otra
        calblob::Calibracion o;
        if (cargarRanura(1 - s_slot, o)) { s_act = o; s_slot = 1 - s_slot; }
    }
    memset(&s_res, 0, sizeof(s_res));
}

// Guarda un blob en la ranura inactiva, lo relee para verificarlo y solo entonces lo activa
static const char *guardar(const uint8_t *b, uint16_t n) {
    calblob::Calibracion c;
    const char *m = nullptr;
    if (!calblob::leer(b, n, c, &m)) return m;
    if ((m = calblob::revisar(c, s_rocket))) return m;
    const uint8_t dst = 1 - s_slot;
    if (s_prefs.putBytes(clave(dst), b, n) != n) return "no se pudo escribir la NVS";
    calblob::Calibracion v;
    if (!cargarRanura(dst, v) || v.crc != c.crc) return "la NVS no devolvio lo escrito";
    s_prefs.putUChar("act", dst);
    s_slot = dst; s_act = v;
    return nullptr;
}

// ---------- analisis ----------
static void ceder() { vTaskDelay(1); }

// El ultimo registro de este cohete en la SD (indice mas alto). Los nombres son PRE_M00_AAAAMMDD_HHMMSS_NNNN.BIN o PRE_M00_SINFECHA_NNNN.BIN
static bool ultimoRegistro(char *path, size_t cap, uint32_t &size) {
    const char *pre = s_rocket == net::DEMETER ? "DEM_" : "HER_";
    long mejor = -1;
    xSemaphoreTake(g_sdBusMx, portMAX_DELAY);
    File root = SD.open("/");
    xSemaphoreGive(g_sdBusMx);
    if (!root) return false;
    for (;;) {
        char nm[64] = ""; uint32_t sz = 0; bool dir = false;
        xSemaphoreTake(g_sdBusMx, portMAX_DELAY);
        File f = root.openNextFile();
        const bool hay = f;
        if (hay) { const char *n = f.name(); if (n[0] == '/') n++; strncpy(nm, n, sizeof(nm) - 1); sz = (uint32_t)f.size(); dir = f.isDirectory(); f.close(); }
        xSemaphoreGive(g_sdBusMx);
        if (!hay) break;
        const size_t len = strlen(nm);
        if (dir || len < 9 || strncmp(nm, pre, 4) != 0 || strcmp(nm + len - 4, ".BIN") != 0) continue;
        const long idx = strtol(nm + len - 8, nullptr, 10);
        if (idx > mejor) { mejor = idx; snprintf(path, cap, "/%s", nm); size = sz; strncpy(s_archivo, nm, sizeof(s_archivo) - 1); }
    }
    xSemaphoreTake(g_sdBusMx, portMAX_DELAY);
    root.close();
    xSemaphoreGive(g_sdBusMx);
    return mejor >= 0;
}

static bool pasada(const char *path, uint32_t size, cal::Analizador *an, int cual, uint8_t *buf) {
    xSemaphoreTake(g_sdBusMx, portMAX_DELAY);
    File f = SD.open(path, FILE_READ);
    xSemaphoreGive(g_sdBusMx);
    if (!f) return false;
    cal::Lector lec;
    uint32_t leido = 0;
    for (;;) {
        xSemaphoreTake(g_sdBusMx, portMAX_DELAY);
        const int got = f.read(buf, CHUNK);
        xSemaphoreGive(g_sdBusMx);
        if (got <= 0) break;
        leido += (uint32_t)got;
        if (cual == 1) lec.feed(buf, (size_t)got, [an](const uint8_t *r, uint16_t len) { an->pasada1(r, len); });
        else lec.feed(buf, (size_t)got, [an](const uint8_t *r, uint16_t len) { an->pasada2(r, len); });
        s_prog = (uint8_t)((cual == 1 ? 0 : 45) + (size ? 45ull * leido / size : 0));
        vTaskDelay(1);
    }
    xSemaphoreTake(g_sdBusMx, portMAX_DELAY);
    f.close();
    xSemaphoreGive(g_sdBusMx);
    return true;
}

static void calTask(void *) {
    char path[64];
    uint32_t size = 0;
    uint8_t *buf = (uint8_t *)ps_malloc(CHUNK);
    cal::Analizador *an = new cal::Analizador();
    bool ok = buf && an && ultimoRegistro(path, sizeof(path), size);
    if (ok) {
        cal::ceder = ceder;
        an->inicio(s_act.lsm.ok ? &s_act.lsm : nullptr);
        s_estado = CE_PASADA1;
        ok = pasada(path, size, an, 1, buf);
        if (ok) {
            s_estado = CE_CALCULANDO;
            an->finPasada1();
            s_estado = CE_PASADA2;
            ok = pasada(path, size, an, 2, buf);
        }
        if (ok) {
            s_estado = CE_CALCULANDO; s_prog = 95;
            an->finPasada2();
            s_res = an->res();
            calblob::Calibracion c; memset(&c, 0, sizeof(c));
            c.rocket = s_rocket;
            TimeModel m;
            c.utc_s = (time_snapshot(m) && m.valid()) ? (uint32_t)(m.toUtcUs(time_local_now()) / 1000000) : 0;
            c.lsm = s_res.lsm; c.qmi = s_res.qmi; c.mmc = s_res.mmc; c.qmc = s_res.qmc;
            for (int i = 0; i < 3; i++) c.qmi_ganancia[i] = s_res.qmi_giro ? s_res.qmi_ganancia[i] : 1.0;
            c.qmi_retraso_ms = s_res.qmi_giro ? s_res.qmi_retraso_ms : 0;
            s_blobN = calblob::armar(c, s_blob, sizeof(s_blob));
            s_crcRes = s_blobN ? calblob::crc32(s_blob, s_blobN - 4) : 0;
        }
    }
    delete an;
    free(buf);
    s_prog = 100;
    s_estado = (ok && s_blobN) ? CE_LISTO : CE_ERROR;
    s_repite = s_estado == CE_ERROR ? FIN_REPITE : 0;
    logEvento(s_estado == CE_LISTO ? 1 : 6);
    vTaskDelete(nullptr);
}

bool calAnalizando() { return s_estado == CE_PASADA1 || s_estado == CE_PASADA2 || s_estado == CE_CALCULANDO; }

bool calAnalizar() {
    if (calAnalizando()) return false;
    memset(&s_res, 0, sizeof(s_res)); s_blobN = 0; s_crcRes = 0; s_prog = 0; s_archivo[0] = 0;
    s_estado = CE_PASADA1;
    if (xTaskCreatePinnedToCore(calTask, "cal", 12288, nullptr, 1, nullptr, 0) != pdPASS) { s_estado = CE_ERROR; return false; }
    return true;
}

bool calAplicar() {
    if (s_estado != CE_LISTO || !s_blobN) return false;
    if (guardar(s_blob, s_blobN)) { s_estado = CE_ERROR; s_repite = FIN_REPITE; logEvento(6); return false; }
    s_estado = CE_APLICADA; s_repite = FIN_REPITE;
    logEvento(2);
    return true;
}

void calDescartar() { if (s_estado == CE_LISTO || s_estado == CE_ERROR) { s_estado = CE_DESCARTADA; s_repite = FIN_REPITE; } }

bool calHayAnterior() { calblob::Calibracion o; return cargarRanura(1 - s_slot, o); }

bool calAnterior() {
    calblob::Calibracion o;
    if (!cargarRanura(1 - s_slot, o)) return false;
    s_slot = 1 - s_slot; s_act = o;
    s_prefs.putUChar("act", s_slot);
    s_repite = FIN_REPITE;
    logEvento(4);
    return true;
}

uint8_t calEstado() { return s_estado; }
bool calListo() { return s_estado == CE_LISTO; }
bool calListoConAvisos() { return s_estado == CE_LISTO && (s_res.avisos || !s_res.ok); }
const calblob::Calibracion &calActiva() { return s_act; }
const char *calArchivo() { return s_archivo; }
bool calTakeLog(CalLog &l) { return s_logQ && xQueueReceive(s_logQ, &l, 0) == pdTRUE; }

void calStep(uint32_t) {
    const bool reg = loggerRecInfo().recording;
    if (reg && !s_registraba) logEvento(5);                 // cada archivo dice con que calibracion se registro
    s_registraba = reg;
}

// ---------- resumen por radio ----------
static int16_t i16(double v) { return isnan(v) ? INT16_MIN : (int16_t)lround(fmax(-32767.0, fmin(32767.0, v))); }
static uint16_t u16(double v) { return isnan(v) ? 0xFFFF : (uint16_t)lround(fmax(0.0, fmin(65534.0, v))); }

static size_t pagina0(uint8_t *out) {
    net::CalRes0 p; memset(&p, 0, sizeof(p));
    p.type = net::P_CAL_RES; p.rocket_id = s_rocket; p.pagina = 0; p.estado = s_estado; p.progreso = s_prog;
    p.nombradas = s_res.nombradas; p.n_pos = (uint8_t)s_res.n_pos; p.ok = s_res.ok; p.avisos = s_res.avisos;
    p.crc_resultado = s_crcRes; p.crc_activo = s_act.ok || s_act.lsm.ok ? s_act.crc : 0;
    for (int i = 0; i < 3; i++) {
        p.lsm_sesgo_mg[i] = i16(s_res.lsm.sesgo[i] * 1000); p.lsm_escala_e5[i] = i16((s_res.lsm.escala[i] - 1) * 1e5);
        p.qmi_sesgo_mg[i] = i16(s_res.qmi.sesgo[i] * 1000); p.qmi_escala_e5[i] = i16((s_res.qmi.escala[i] - 1) * 1e5);
        p.qmi_gan_e4[i] = u16(s_res.qmi_ganancia[i] * 1e4);
    }
    p.lsm_err_cdeg = u16(s_res.lsm.err_pos * 100); p.qmi_err_cdeg = u16(s_res.qmi.err_pos * 100);
    p.qmi_retraso_ms = (int8_t)lround(s_res.qmi_retraso_ms); p.qmi_giro = s_res.qmi_giro;
    p.qmi_corr_e4 = u16(fmin(s_res.qmi_corr[0], fmin(s_res.qmi_corr[1], s_res.qmi_corr[2])) * 1e4);
    p.crc = net::crc16((const uint8_t *)&p, sizeof(p) - 2);
    memcpy(out, &p, sizeof(p));
    return sizeof(p);
}

static void magRes(const cal::Mag &m, net::CalResMag &o) {
    o.radio_mG = u16(m.radio * 1000); o.maxmin_e3 = u16(m.max_min * 1000); o.residuo_cmG = u16(m.residuo_mG * 100);
    o.cobertura_pct = (uint8_t)lround(fmin(100.0, m.cobertura * 100)); o.flags = (uint8_t)((m.ok ? 1 : 0) | (m.alineado ? 2 : 0) | (m.invertido ? 4 : 0));
    o.descartadas = (uint16_t)std::min(65535, m.descartadas); o.dip_dgr = i16(m.dip_media * 10); o.dip_rango_dgr = u16(m.dip_rango * 10);
    o.dip_n = (uint8_t)m.dip_n; o.giro_res_dgr = u16(m.giro_residual_deg * 10);
}

static size_t pagina1(uint8_t *out) {
    net::CalRes1 p; memset(&p, 0, sizeof(p));
    p.type = net::P_CAL_RES; p.rocket_id = s_rocket; p.pagina = 1;
    magRes(s_res.mmc, p.mmc); magRes(s_res.qmc, p.qmc);
    p.acuerdo_min_dgr = u16(s_res.mag_acuerdo_min * 10); p.acuerdo_max_dgr = u16(s_res.mag_acuerdo_max * 10);
    p.bmp_t0_cC = s_res.bmp.ok ? i16(s_res.bmp.t0 * 100) : INT16_MIN; p.bmp_sube5_cC = s_res.bmp.ok ? i16(s_res.bmp.sube5 * 100) : INT16_MIN;
    p.bme_t0_cC = s_res.bme.ok ? i16(s_res.bme.t0 * 100) : INT16_MIN; p.bme_sube5_cC = s_res.bme.ok ? i16(s_res.bme.sube5 * 100) : INT16_MIN;
    p.crc = net::crc16((const uint8_t *)&p, sizeof(p) - 2);
    memcpy(out, &p, sizeof(p));
    return sizeof(p);
}

size_t calPaquete(uint8_t *out) {
    const uint32_t now = millis();
    const bool vivo = calAnalizando() || s_estado == CE_LISTO;
    if (vivo && now - s_ultPaq >= RES_CADA_MS) {
        s_ultPaq = now;
        const bool p1 = s_estado == CE_LISTO && (s_pagina++ & 1);
        return p1 ? pagina1(out) : pagina0(out);
    }
    if (s_repite && now - s_ultPaq >= RES_CADA_MS) { s_ultPaq = now; s_repite--; return pagina0(out); }
    if (now - s_ultActiva >= ACTIVA_CADA_MS) { s_ultActiva = now; return pagina0(out); }
    return 0;
}

// ---------- respaldo por USB ----------
void calUsbRecibir() {
    const uint32_t t0 = millis();
    uint8_t hdr[2]; size_t k = 0;
    while (k < 2 && millis() - t0 < 3000) { const int c = Serial.read(); if (c >= 0) hdr[k++] = (uint8_t)c; else vTaskDelay(1); }
    const uint16_t n = (uint16_t)(hdr[0] | (hdr[1] << 8));
    if (k < 2 || n < 16 || n > calblob::MAX) { Serial.println("CAL ERROR largo invalido"); return; }
    uint8_t b[calblob::MAX]; k = 0;
    while (k < n && millis() - t0 < 5000) { const int c = Serial.read(); if (c >= 0) b[k++] = (uint8_t)c; else vTaskDelay(1); }
    if (k < n) { Serial.println("CAL ERROR faltan bytes"); return; }
    if (loggerRecInfo().recording || calAnalizando()) { Serial.println("CAL ERROR registrando o analizando: espera"); return; }
    const char *m = guardar(b, n);
    if (m) { Serial.printf("CAL ERROR %s\n", m); return; }
    s_repite = FIN_REPITE;
    logEvento(3);
    Serial.printf("CAL OK %08lX\n", (unsigned long)s_act.crc);
}
