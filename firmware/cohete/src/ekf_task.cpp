// ekf_task.cpp - Ver ekf_task.h y ekf_core.h.
#include "ekf_task.h"
#include <Arduino.h>
#include <esp_attr.h>
#include <esp_heap_caps.h>
#include <math.h>
#include <stddef.h>
#include <sys/time.h>
#include <new>
#include <net_proto.h>
#include "ekf_core.h"
#include "in_imu.h"
#include "in_bar.h"
#include "in_mag.h"
#include "ext_bmp.h"
#include "ext_mmc.h"
#include "mission.h"
#include "amb_temp.h"
#include "cal_onboard.h"

Latest<EkfOut> g_ekf;

static const uint32_t CICLO_MS = 5;               // la tarea corre cada 5 ms
static const int64_t  SALIDA_US = 20000;          // g_ekf y T_EKF a 50 Hz
static const int64_t  TX_MARGEN_US = 15000;       // como calib.TX_MARGIN_US
static const float    LSM_ACC_LSB = 1000.0f / 0.976f, LSM_GYR_LSB = 1000.0f / 70.0f;   // como ext_lsm y ekf.py

// ---------- anillos SPSC de muestras de IMU (un productor: su tarea; un consumidor: esta) ----------
struct Mu { int64_t t; int16_t a[3], g[3]; };
template <int N> struct Anillo {
    Mu *b = nullptr; volatile uint32_t w = 0, r = 0; volatile uint32_t drops = 0, in = 0;
    void push(int64_t t, const int16_t a[3], const int16_t g[3]) {
        if (!b) return;
        const uint32_t wi = __atomic_load_n(&w, __ATOMIC_RELAXED);
        if (wi - __atomic_load_n(&r, __ATOMIC_ACQUIRE) >= (uint32_t)N) { drops = drops + 1; return; }
        Mu &m = b[wi % N]; m.t = t; memcpy(m.a, a, 6); memcpy(m.g, g, 6);
        __atomic_store_n(&w, wi + 1, __ATOMIC_RELEASE);
        in = in + 1;
    }
    bool pop(Mu &m) {
        const uint32_t ri = __atomic_load_n(&r, __ATOMIC_RELAXED);
        if (ri == __atomic_load_n(&w, __ATOMIC_ACQUIRE)) return false;
        m = b[ri % N];
        __atomic_store_n(&r, ri + 1, __ATOMIC_RELEASE);
        return true;
    }
};
static Anillo<1024> s_lsm;                         // 0.63 s a 1610 Hz
static Anillo<512>  s_qmi;                         // 1.1 s a 445 Hz
static volatile float s_qAccLsb = 2048.0f, s_qGyrLsb = 32.0f;
static volatile int64_t s_txDesde = INT64_MIN, s_txHasta = INT64_MIN;
static ekf::Navegador *s_nav = nullptr;
static EkfStats s_st;
static uint32_t s_crcCal = 0xFFFFFFFFu;

// ---------- foto para un reinicio en vuelo (RTC_NOINIT: sobrevive a reinicios por software, perro guardian y panico) ----------
struct EkfRtc { uint32_t magic, n; int64_t tv_us; ekf::Foto f; uint32_t crc; };
static RTC_NOINIT_ATTR EkfRtc s_rtc;
static const uint32_t RTC_MAGIC = 0xE4F07A11u;
static const int64_t  FOTO_US = 100000;            // 10 Hz
static uint32_t fnv(const void *p, size_t n) { const uint8_t *b = (const uint8_t *)p; uint32_t h = 2166136261u; for (size_t i = 0; i < n; i++) { h ^= b[i]; h *= 16777619u; } return h; }
// El reloj del sistema sigue contando a traves de un reinicio por software (lo lleva el RTC): mide cuanto tiempo no hubo filtro
static int64_t relojRtc() { struct timeval tv; gettimeofday(&tv, nullptr); return (int64_t)tv.tv_sec * 1000000LL + tv.tv_usec; }
static bool rtcValida() { return s_rtc.magic == RTC_MAGIC && s_rtc.crc == fnv(&s_rtc, offsetof(EkfRtc, crc)); }
static void rtcGuardar(const ekf::Estado &e) {
    EkfRtc r; memset(&r, 0, sizeof(r));
    r.magic = RTC_MAGIC; r.n = s_rtc.magic == RTC_MAGIC ? s_rtc.n + 1 : 1; r.tv_us = relojRtc();
    s_nav->foto(e, r.f);
    r.crc = fnv(&r, offsetof(EkfRtc, crc));
    s_rtc = r;                                     // un reinicio a mitad de la copia deja el CRC mal: se toma como sin foto
}

void ekfLsm(int64_t t, const int16_t a[3], const int16_t g[3]) { s_lsm.push(t, a, g); }
void ekfQmi(int64_t t, const int16_t a[3], const int16_t g[3], float accLsb, float gyrLsb) { s_qAccLsb = accLsb; s_qGyrLsb = gyrLsb; s_qmi.push(t, a, g); }
void ekfTx(int64_t desde, int64_t hasta) { s_txHasta = INT64_MAX; s_txDesde = desde; s_txHasta = hasta; }
static bool enTx(int64_t t) { const int64_t d = s_txDesde, h = s_txHasta; return d != INT64_MIN && t >= d - TX_MARGEN_US && t <= h + TX_MARGEN_US; }

// ---------- calibracion ----------
static void configurar() {
    const calblob::Calibracion &c = calActiva();
    ekf::Config k;
    ekf::configNominal(k);
    if (c.ok) {
        k.calibrado = true;
        const cal::Imu *src[2] = {&c.lsm, &c.qmi};
        ekf::ImuCal *dst[2] = {&k.lsm, &k.qmi};
        for (int s = 0; s < 2; s++) {
            dst[s]->ok = src[s]->ok;
            memcpy(dst[s]->R, src[s]->R, sizeof(dst[s]->R)); memcpy(dst[s]->sesgo, src[s]->sesgo, sizeof(dst[s]->sesgo)); memcpy(dst[s]->escala, src[s]->escala, sizeof(dst[s]->escala));
        }
        for (int i = 0; i < 3; i++) k.qmi_ganancia[i] = c.qmi_ganancia[i] > 0 ? c.qmi_ganancia[i] : 1.0;
        k.qmi_retraso_ms = c.qmi_retraso_ms;
        const cal::Mag *ms[2] = {&c.mmc, &c.qmc};
        ekf::MagCal *md[2] = {&k.mmc, &k.qmc};
        for (int s = 0; s < 2; s++) {
            md[s]->ok = ms[s]->ok && ms[s]->alineado && ms[s]->radio > 0;
            memcpy(md[s]->centro, ms[s]->centro, sizeof(md[s]->centro)); memcpy(md[s]->A, ms[s]->A, sizeof(md[s]->A));
            memcpy(md[s]->R, ms[s]->R, sizeof(md[s]->R)); md[s]->radio = ms[s]->radio;
        }
    }
    s_nav->configurar(k);
    s_nav->tSuelo(ambTempC());
    s_crcCal = c.ok ? c.crc : 0;
    s_st.calibrado = c.ok;
}

// ---------- salida ----------
static void publicar(const ekf::Estado &e) {
    EkfOut o; memset(&o, 0, sizeof(o));
    o.listo = e.listo; o.hayOrigen = e.hayOrigen; o.calibrado = s_st.calibrado; o.fase = e.fase; o.t_us = e.t_us;
    for (int i = 0; i < 4; i++) o.q[i] = e.q[i];
    for (int i = 0; i < 3; i++) { o.v[i] = e.v[i]; o.f_g[i] = e.f_g[i]; o.w_dps[i] = e.w_dps[i]; }
    if (e.hayOrigen) {
        o.lat = e.lat0 + (e.p[0] / 6378137.0) * 180.0 / M_PI;
        o.lon = e.lon0 + (e.p[1] / (6378137.0 * cos(e.lat0 * M_PI / 180.0))) * 180.0 / M_PI;
        o.alt_msl = (float)(e.h0 - e.p[2]);
    }
    o.alt_agl = e.alt_baro_m;
    o.sd_att_deg = (float)(fmaxf(fmaxf(e.sd_th[0], e.sd_th[1]), e.sd_th[2]) * 180.0 / M_PI);
    o.sd_pos_m = sqrtf(e.sd_p[0] * e.sd_p[0] + e.sd_p[1] * e.sd_p[1]);
    o.sd_alt_m = e.sd_p[2];
    g_ekf.set(o);
}

static void registrar(const ekf::Estado &e) {
    rec::EkfRec r; memset(&r, 0, sizeof(r));
    for (int i = 0; i < 4; i++) r.q[i] = e.q[i];
    for (int i = 0; i < 3; i++) {
        r.p[i] = e.p[i]; r.v[i] = e.v[i]; r.bg[i] = (float)(e.bg[i] * 180.0 / M_PI); r.ba[i] = (float)(e.ba[i] / 9.80665); r.sg[i] = e.sg[i];
        r.sd_th[i] = (float)(e.sd_th[i] * 180.0 / M_PI); r.sd_p[i] = e.sd_p[i]; r.sd_v[i] = e.sd_v[i];
    }
    r.b_bmp = e.b_bmp; r.alt_baro = e.alt_baro_m;
    r.lat0 = e.lat0; r.lon0 = e.lon0; r.h0 = (float)e.h0;
    r.fase = e.fase; r.flags = (uint8_t)((e.listo ? 1 : 0) | (e.hayOrigen ? 2 : 0) | (s_st.calibrado ? 4 : 0));
    const uint32_t g = s_nav->stat(ekf::M_GNSS_PN).ok + s_nav->stat(ekf::M_GNSS_VN).ok;
    const uint32_t b = s_nav->stat(ekf::M_BMP).ok + s_nav->stat(ekf::M_BME).ok;
    const uint32_t m = s_nav->stat(ekf::M_MMC).ok + s_nav->stat(ekf::M_QMC).ok;
    uint32_t rj = 0; for (int i = 0; i < ekf::M_COUNT; i++) rj += s_nav->stat(i).rej;
    r.gnss_ok = (uint16_t)g; r.baro_ok = (uint16_t)b; r.mag_ok = (uint16_t)m; r.grav_ok = (uint16_t)s_nav->stat(ekf::M_GRAV).ok; r.rechazos = (uint16_t)rj;
    s_st.gnss = g; s_st.baro = b; s_st.mag = m; s_st.grav = s_nav->stat(ekf::M_GRAV).ok; s_st.rech = rj;
    bus_log(RING_EKF, rec::T_EKF, rec::S_SYS, e.t_us, &r, sizeof(r));
}

// ---------- tarea ----------
static void ekfTask(void *) {
    configurar();
    // Reinicio en vuelo: la mision ya retomo FLY o RECOVERY (missionBegin va antes). No se espera el reposo.
    const MissionStats ms0 = missionStats();
    if ((ms0.state == net::ST_FLY || ms0.state == net::ST_RECOVERY) && (ms0.flags & net::TF_REANUDADO)) {
        if (rtcValida()) {
            double g = (relojRtc() - s_rtc.tv_us) / 1e6;
            if (!(g >= 0 && g < 120)) g = 3.0;         // reloj sin sentido: lo tipico de un reinicio
            s_st.gapS = (float)g;
            s_nav->reanudar(&s_rtc.f, (float)g, 0, 0);
        } else if (ms0.state == net::ST_FLY) {
            float p0[2]; missionP0(p0);
            s_nav->reanudar(nullptr, 0, p0[0], p0[1]);
        }                                               // RECOVERY sin foto: en el suelo, busca el reposo como siempre
    }
    uint8_t estadoPrev = ms0.state, momPrev = 0xFF;
    uint32_t seqBar = 0, seqMmc = 0, seqMag = 0, seqGnss = 0; int64_t tBmp = 0;
    int64_t ultSalida = 0, ultLog = 0, ultFoto = 0;
    TickType_t wake = xTaskGetTickCount();
    for (;;) {
        vTaskDelayUntil(&wake, pdMS_TO_TICKS(CICLO_MS));
        const int64_t t0 = time_local_now();
        const MissionStats ms = missionStats();
        // al armar: de nuevo el reposo (sesgos, p0 y actitud en la rampa) y la temperatura del suelo
        if (ms.state == net::ST_ARMED && estadoPrev == net::ST_TIERRA) { s_nav->reiniciar(); s_nav->tSuelo(ambTempC()); s_st.reinicios++; }
        // calibracion nueva (aplicada por radio o USB): solo fuera de vuelo
        if (ms.state != net::ST_FLY && ms.state != net::ST_ARMED) {
            const calblob::Calibracion &c = calActiva();
            if ((c.ok ? c.crc : 0) != s_crcCal) { configurar(); s_st.reinicios++; }
        }
        estadoPrev = ms.state;
        const bool vuelo = ms.state == net::ST_FLY || ms.state == net::ST_RECOVERY;
        if (!vuelo && s_rtc.magic == RTC_MAGIC) s_rtc.magic = 0;   // en tierra o armado no hay nada que reanudar
        const uint8_t mom = ms.state == net::ST_FLY ? ms.moment : (ms.state == net::ST_RECOVERY ? (uint8_t)net::M_ATERRIZAJE : 0);
        if (mom != momPrev) { s_nav->momento(t0, mom); momPrev = mom; }

        Mu m;
        while (s_lsm.pop(m)) {
            const float a[3] = {m.a[0] / LSM_ACC_LSB, m.a[1] / LSM_ACC_LSB, m.a[2] / LSM_ACC_LSB}, g[3] = {m.g[0] / LSM_GYR_LSB, m.g[1] / LSM_GYR_LSB, m.g[2] / LSM_GYR_LSB};
            s_nav->lsm(m.t, a, g);
        }
        const float qa = s_qAccLsb, qg = s_qGyrLsb;
        while (s_qmi.pop(m)) {
            const float a[3] = {m.a[0] / qa, m.a[1] / qa, m.a[2] / qa}, g[3] = {m.g[0] / qg, m.g[1] / qg, m.g[2] / qg};
            s_nav->qmi(m.t, a, g);
        }
        ExtBarSample eb;
        if (g_ext_bar.get(eb) && eb.t_us != tBmp) { tBmp = eb.t_us; s_nav->bmp(eb.t_us, eb.press_pa, eb.temp_c); }
        BarSample b;
        if (g_bar.get(b) && b.seq != seqBar) { seqBar = b.seq; s_nav->bme(b.t_us, b.press_pa); }
        ExtMagSample em;
        if (g_ext_mag.get(em) && em.seq != seqMmc) {
            seqMmc = em.seq;
            if (!(em.flags & 7) && !enTx(em.t_us) && em.lsb_per_gauss > 0) {
                const float v[3] = {em.raw[0] / em.lsb_per_gauss, em.raw[1] / em.lsb_per_gauss, em.raw[2] / em.lsb_per_gauss};
                s_nav->mmc(em.t_us, v);
            }
        }
        MagSample mg;
        if (g_mag.get(mg) && mg.seq != seqMag) {
            seqMag = mg.seq;
            if (!(mg.flags & 1) && !enTx(mg.t_us) && mg.lsb_per_gauss > 0) {
                const float v[3] = {mg.raw[0] / mg.lsb_per_gauss, mg.raw[1] / mg.lsb_per_gauss, mg.raw[2] / mg.lsb_per_gauss};
                s_nav->qmc(mg.t_us, v);
            }
        }
        GnssSample gs;
        if (g_gnss.get(gs) && gs.seq != seqGnss) {
            seqGnss = gs.seq;
            ekf::Gnss g; g.t_us = gs.t_meas_us > 0 ? gs.t_meas_us : gs.t_rx_us - 60000; g.fix = gs.fix;
            g.lat_deg = gs.lat_e7 * 1e-7; g.lon_deg = gs.lon_e7 * 1e-7; g.h_m = gs.hmsl_mm / 1000.0;
            g.hacc_m = gs.hacc_mm / 1000.0f; g.sacc_mps = gs.sacc_mmps / 1000.0f;
            g.vn = gs.vn_mmps / 1000.0f; g.ve = gs.ve_mmps / 1000.0f; g.vd = gs.vd_mmps / 1000.0f;
            s_nav->gnss(g);
        }

        const int64_t ahora = time_local_now();
        s_st.pasos += (uint32_t)s_nav->avanzar(ahora);
        s_st.listo = s_nav->filtro().listo; s_st.arranque = s_nav->arranque();
        if (ahora - ultSalida >= SALIDA_US) {
            ultSalida = ahora;
            ekf::Estado e;
            s_nav->presente(ahora, e);
            publicar(e);
            if (vuelo && e.listo && ahora - ultFoto >= FOTO_US) { ultFoto = ahora; rtcGuardar(e); }
        }
        const ekf::Estado &f = s_nav->filtro();
        if (f.listo && f.t_us - ultLog >= SALIDA_US) { ultLog = f.t_us; registrar(f); }
        s_st.lsmIn = s_lsm.in; s_st.qmiIn = s_qmi.in; s_st.lsmDrop = s_lsm.drops; s_st.qmiDrop = s_qmi.drops;
        const uint32_t dt = (uint32_t)(time_local_now() - t0);
        if (dt > s_st.cicloMaxUs) s_st.cicloMaxUs = dt;
        s_st.cicloPromUs = s_st.cicloPromUs ? s_st.cicloPromUs + ((int32_t)dt - (int32_t)s_st.cicloPromUs) / 64 : dt;
        if (dt > CICLO_MS * 1000) s_st.lentos++;
    }
}

void ekfBegin() {
    memset(&s_st, 0, sizeof(s_st));
    void *mem = heap_caps_malloc(sizeof(ekf::Navegador), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (!mem) mem = heap_caps_malloc(sizeof(ekf::Navegador), MALLOC_CAP_8BIT);
    if (!mem) { Serial.println("[ekf ] sin memoria: no hay EKF"); return; }
    s_nav = new (mem) ekf::Navegador();
    s_lsm.b = (Mu *)heap_caps_malloc(sizeof(Mu) * 1024, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    s_qmi.b = (Mu *)heap_caps_malloc(sizeof(Mu) * 512, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    xTaskCreatePinnedToCore(ekfTask, "ekf", 8192, nullptr, 3, nullptr, 1);
}

EkfStats ekfStats() { return s_st; }
