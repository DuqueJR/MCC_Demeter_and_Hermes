// amb_temp.cpp - Temperatura del suelo: muestra en frio, NVS, revision al armar. Ver amb_temp.h y amb_calc.h.
#include "amb_temp.h"
#include <Arduino.h>
#include <Preferences.h>
#include <esp_attr.h>
#include <esp_system.h>
#include <esp_sleep.h>
#include <sys/time.h>
#include <freertos/queue.h>
#include "core_bus.h"
#include "ext_bmp.h"
#include "in_bar.h"
#include "logger.h"

static const uint32_t MAGIC      = 0xA3B17E21u;
static const int64_t  FRESCO_US  = 1500000;
static const uint16_t NVS_VER    = 1;

RTC_NOINIT_ATTR static uint32_t r_magic;
RTC_NOINIT_ATTR static int64_t  r_dormir_us;          // hora del sistema al dormir (gettimeofday sigue en el sueno profundo)

#pragma pack(push, 1)
struct Guardada { uint16_t ver; amb::Muestra m; int64_t utc_ms; };
#pragma pack(pop)

static Preferences   s_prefs;
static QueueHandle_t s_logQ = nullptr;
static Guardada      s_g;
static volatile bool s_hay = false, s_tomando = false, s_deEste = false;
static uint8_t       s_fuente = amb::F_NINGUNA;
static uint32_t      s_t0 = 0, s_ultLectura = 0;
static int64_t       s_tMuestraLocal = 0;              // reloj local de la muestra (para ponerle hora UTC cuando la haya)
static amb::Serie    s_bmp, s_bme;
static bool          s_registraba = false;

static int64_t sysUs() { struct timeval tv; gettimeofday(&tv, nullptr); return (int64_t)tv.tv_sec * 1000000LL + tv.tv_usec; }

static bool utcAhoraMs(int64_t &ms) {
    TimeModel m;
    if (!time_snapshot(m) || !m.valid()) return false;
    ms = m.toUtcUs(time_local_now()) / 1000;
    return true;
}

static bool leer(float &t_bmp, float &t_bme, float &p_bmp) {
    const int64_t now = time_local_now();
    ExtBarSample b; BarSample s;
    t_bmp = (g_ext_bar.get(b) && now - b.t_us < FRESCO_US) ? b.temp_c : NAN;
    p_bmp = !isnan(t_bmp) ? b.press_pa : NAN;
    t_bme = (g_bar.get(s) && now - s.t_us < FRESCO_US) ? s.temp_c : NAN;
    return !isnan(t_bmp) || !isnan(t_bme);
}

static void logEvento(uint8_t evento) {
    if (!s_logQ) return;
    AmbLog l; memset(&l, 0, sizeof(l));
    l.t_us = time_local_now();
    l.r.t_bmp = s_g.m.t_bmp; l.r.t_bme = s_g.m.t_bme; l.r.t_usada = s_g.m.t_usada;
    l.r.pend_bmp = s_g.m.pend_bmp; l.r.pend_bme = s_g.m.pend_bme;
    l.r.utc_ms = s_g.utc_ms;
    l.r.fuente = s_g.m.fuente; l.r.calidad = s_g.m.calidad; l.r.evento = evento; l.r.arm = ambArmBits();
    float tb, te, p; leer(tb, te, p);
    l.r.t_bmp_ahora = tb; l.r.t_bme_ahora = te;
    xQueueSend(s_logQ, &l, 0);
}

static void guardar() {
    s_g.ver = NVS_VER;
    s_prefs.putBytes("s", &s_g, sizeof(s_g));
}

void ambBegin() {
    s_logQ = xQueueCreate(4, sizeof(AmbLog));
    s_prefs.begin("tbamb", false);
    Guardada g;
    if (s_prefs.getBytes("s", &g, sizeof(g)) == sizeof(g) && g.ver == NVS_VER) { s_g = g; s_hay = true; }
    const esp_reset_reason_t rr = esp_reset_reason();
    if (rr == ESP_RST_POWERON) s_fuente = amb::F_ENCENDIDO;
    else if (rr == ESP_RST_DEEPSLEEP && r_magic == MAGIC && sysUs() - r_dormir_us >= (int64_t)amb::FRIO_MIN_S * 1000000LL) s_fuente = amb::F_SUENO;
    r_magic = 0;
    s_tomando = s_fuente != amb::F_NINGUNA;
    s_t0 = millis();
}

void ambStep(uint32_t nowMs) {
    if (s_tomando) {
        const uint32_t dt = nowMs - s_t0;
        if (dt >= amb::VENTANA_INI_MS && nowMs - s_ultLectura >= 1000) {
            s_ultLectura = nowMs;
            const float ts = (dt - amb::VENTANA_INI_MS) / 1000.0f;
            float tb, te, p;
            if (leer(tb, te, p)) {
                if (!isnan(tb)) s_bmp.add(ts, tb);
                if (!isnan(te)) s_bme.add(ts, te);
                if (s_tMuestraLocal == 0) s_tMuestraLocal = time_local_now();
            }
        }
        if (dt >= amb::VENTANA_INI_MS + amb::VENTANA_MS) {
            s_tomando = false;
            if (s_bmp.n >= amb::MIN_LECTURAS || s_bme.n >= amb::MIN_LECTURAS) {
                s_g.m = amb::evaluar(s_bmp, s_bme, s_fuente);
                int64_t u;
                s_g.utc_ms = utcAhoraMs(u) ? u - (time_local_now() - s_tMuestraLocal) / 1000 : 0;
                s_hay = true; s_deEste = true;
                guardar();
                logEvento(1);
            }
        }
    }
    // La hora UTC llega despues (GNSS): se le pone a la muestra de este arranque
    if (s_deEste && s_g.utc_ms == 0) {
        int64_t u;
        if (utcAhoraMs(u)) { s_g.utc_ms = u - (time_local_now() - s_tMuestraLocal) / 1000; guardar(); }
    }
    // Al empezar a registrar, la muestra queda tambien en el archivo (lo de antes de registrar no se guarda)
    const bool reg = loggerRecInfo().recording;
    if (reg && !s_registraba && s_hay) logEvento(3);
    s_registraba = reg;
}

void ambSleep() { r_magic = MAGIC; r_dormir_us = sysUs(); }

float ambTempC() { return s_hay ? s_g.m.t_usada : amb::T_ESTANDAR_C; }

static int64_t edadS() {
    int64_t u;
    return (s_hay && s_g.utc_ms > 0 && utcAhoraMs(u)) ? (u - s_g.utc_ms) / 1000 : -1;
}

uint8_t ambArmBits() {
    float tb, te, p; leer(tb, te, p);
    return amb::revisarArmado(s_hay, s_g.m, edadS(), tb, te);
}

AmbInfo ambInfo() {
    AmbInfo i;
    i.hay = s_hay; i.tomando = s_tomando; i.deEsteArranque = s_deEste; i.m = s_g.m; i.edad_s = edadS();
    leer(i.t_bmp, i.t_bme, i.p_bmp);
    i.armBits = amb::revisarArmado(s_hay, s_g.m, i.edad_s, i.t_bmp, i.t_bme);
    if (!s_hay) memset(&i.m, 0, sizeof(i.m));
    return i;
}

bool ambTakeLog(AmbLog &l) { return s_logQ && xQueueReceive(s_logQ, &l, 0) == pdTRUE; }
