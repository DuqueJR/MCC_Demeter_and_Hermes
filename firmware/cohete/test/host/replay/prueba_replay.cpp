// prueba_replay.cpp - Banco de replay en el PC (T-305, P-03): lee uno o varios .BIN en el formato `rec` (un registro de vuelo, de banco o los
// sinteticos de T-304) y corre sobre sus muestras la logica REAL del firmware: boost_detect.cpp + mission.cpp (su tarea a 50 Hz, sobre un reloj
// virtual de 20 ms) + ext_act.cpp + ext_bmp.cpp (la mediana del BMP581), con los mismos stubs de test/host/stubs que prueba_mision.cpp.
//
// Uso:  prueba_replay [opciones] archivo.BIN [archivo2.BIN ...]       (varios archivos = un solo registro consecutivo, FILEHDR con FH_CONTINUA)
//   --cohete d|h|1|2     el cohete (por omision, el rocket_id del FILEHDR)
//   --inicio tierra|armed|launch
//        armed (por omision): el operador arma en la rampa a los --arma-en s del primer registro (ARM + confirmacion, como la estacion)
//        launch: ademas manda LAUNCH a los --launch-en s (el cohete ya esta en FLY, momento LAUNCH, cuando llega el BOOST)
//        tierra: no manda nada (el BOOST llega en TIERRA y levanta TF_BOOST_SIN_ARMAR)
//   --arma-en S (2.0)  --launch-en S (4.0)  --cola S (2.0: segundos que se sigue despues del ultimo registro)
//   --hasta S            descarta los registros posteriores a S segundos del primero (controles negativos: solo el reposo antes del despegue)
//   --json archivo       escribe el resultado ahi (por omision, a la salida estandar)
// Salida: un JSON con los archivos, los contadores, y la lista de eventos con su t_us (cambios de estado, de momento y de banderas, cada T_MISSION,
// cada respuesta de comando, el registro de la SD y el buzzer). El reporte lo arma replay.py.
//
// Como alimenta a la mision (en el orden de t_us de la cabecera: el instante en que el registro estuvo disponible):
//   T_EXT_LSM -> lo mismo que lsmTask de ext_lsm.cpp: cada palabra TAG_ACC al detector (enganches.h), el BMP581 por extBmpOnWord (real), g_ext_imu.
//   T_IMU     -> lo mismo que imuTask de in_imu.cpp: cada muestra al detector del QMI y g_imu.
//   T_BAR     -> g_bar, como in_bar.cpp.     T_PVT -> g_gnss (fix y hora de llegada).     El resto de los registros no los consume la mision.
#include <Arduino.h>
#include <esp_timer.h>
#include <Preferences.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string>
#include <algorithm>
#include <deque>
#include <map>
#include <vector>
#include "mission.h"
#include "core_bus.h"
#include "in_imu.h"
#include "in_bar.h"
#include "ext_lsm.h"
#include "ext_bmp.h"
#include "ext_drv.h"
#include "ext_act.h"
#include <driver/gpio.h>
#include "logger.h"
#include "net_radio.h"
#include "boost_detect.h"
#include "rec_format.h"
#include "enganches.h"

using namespace net;

// ---------- Reloj virtual, colas y las dependencias de mission.cpp: stubs/arnes_mision.h (lo comparte prueba_mision.cpp) ----------
#define ARNES_EXT_BAR_REAL                                     // g_ext_bar lo define el ext_bmp.cpp real
#include "arnes_mision.h"
static void tickDelReloj();                                    // definido mas abajo: lo que el banco hace en cada espera de la tarea de mision

// ---------- Lo propio del banco: cada efecto de la mision se anota como evento con la hora virtual ----------
static std::vector<std::string> g_eventos;                     // JSON de cada evento, en orden
static void evento(const char *fmt, ...) __attribute__((format(printf, 1, 2)));
static void evento(const char *fmt, ...) {
    char b[512];
    va_list ap; va_start(ap, fmt); vsnprintf(b, sizeof(b), fmt, ap); va_end(ap);
    g_eventos.push_back(b);
}
static void alRegistrar(bool on) { evento("{\"t_us\":%lld,\"tipo\":\"registro\",\"valor\":%d}", (long long)g_nowUs, on ? 1 : 0); }
static void alResp(const CmdResp &r) {
    evento("{\"t_us\":%lld,\"tipo\":\"respuesta\",\"op\":%u,\"arg\":%u,\"resultado\":%u,\"motivos\":%u,\"contador\":%u}",
           (long long)g_nowUs, r.op, r.arg, r.result, (unsigned)r.reasons, (unsigned)r.counter);
}
static int g_nivelPin[64];
static void alPin(int pin, int nivel) {                        // solo los flancos
    if (pin < 0 || pin >= 64 || g_nivelPin[pin] == nivel) return;
    g_nivelPin[pin] = nivel;
    evento("{\"t_us\":%lld,\"tipo\":\"pin\",\"pin\":%d,\"nivel\":%d}", (long long)g_nowUs, pin, nivel);
}


// ---------- Nombres (los de net_proto.h) ----------
static const char *nEstado(uint8_t s) {
    switch (s) { case ST_TIERRA: return "TIERRA"; case ST_ARMED: return "ARMED"; case ST_FLY: return "FLY"; case ST_RECOVERY: return "RECOVERY"; default: return "?"; }
}
static const char *nMomento(uint8_t m) {
    switch (m) { case M_NONE: return "-"; case M_LAUNCH: return "LAUNCH"; case M_BOOST: return "BOOST"; case M_COAST: return "COAST"; case M_APOGEO: return "APOGEO";
                 case M_CAIDA: return "CAIDA"; case M_PARACAIDAS: return "PARACAIDAS"; case M_ATERRIZAJE: return "ATERRIZAJE"; default: return "?"; }
}

// ---------- Los registros del .BIN ----------
struct Reg { int64_t t; uint8_t type, src; const uint8_t *p; uint16_t n; size_t orden; };
static std::vector<std::vector<uint8_t> > g_bufs;              // el contenido de cada archivo (los punteros de Reg apuntan aqui)
static std::vector<Reg> g_regs;
static size_t g_sig = 0;                                       // el siguiente registro por consumir
static int64_t g_tIni = 0, g_tFin = 0;
static long g_resync = 0, g_recsPorTipo[256];
struct ArchInfo { std::string ruta; size_t bytes; long registros, saltados; int rocket; uint32_t idx, boot, mision; uint8_t flags; bool tieneHdr; char env[17], git[13], fw[17]; };
static std::vector<ArchInfo> g_archivos;
static std::vector<std::string> g_avisos;                      // JSON de cada aviso (texto)

static std::string esc(const std::string &s) {
    std::string o;
    for (size_t i = 0; i < s.size(); i++) { const char c = s[i]; if (c == '"' || c == '\\') { o += '\\'; o += c; } else if ((unsigned char)c < 0x20) o += ' '; else o += c; }
    return o;
}
static void aviso(const std::string &t) { g_avisos.push_back("\"" + esc(t) + "\""); }

static bool cargar(const char *ruta, bool primero) {
    FILE *f = fopen(ruta, "rb");
    if (!f) { fprintf(stderr, "no puedo abrir %s\n", ruta); return false; }
    g_bufs.push_back(std::vector<uint8_t>());
    std::vector<uint8_t> &b = g_bufs.back();
    uint8_t tmp[65536]; size_t k;
    while ((k = fread(tmp, 1, sizeof(tmp), f)) > 0) b.insert(b.end(), tmp, tmp + k);
    fclose(f);
    ArchInfo ai = ArchInfo();                                  // inicializacion por valor: todo en cero
    ai.ruta = ruta; ai.bytes = b.size();
    size_t pos = 0;
    while (pos + rec::HDR_SIZE + rec::CRC_SIZE <= b.size()) {
        const uint16_t len = rec::check(b.data() + pos, (uint32_t)(b.size() - pos));
        if (!len) { pos++; ai.saltados++; continue; }          // el flujo es autodelimitado: se busca el siguiente A5 5A con CRC valido
        rec::Hdr h; memcpy(&h, b.data() + pos, sizeof(h));
        Reg r; r.t = h.t_us; r.type = h.type; r.src = h.src; r.p = b.data() + pos + rec::HDR_SIZE; r.n = (uint16_t)(len - rec::HDR_SIZE - rec::CRC_SIZE); r.orden = g_regs.size();
        if (h.type == rec::T_FILEHDR && r.n >= sizeof(rec::FileHdrRec)) {
            rec::FileHdrRec fh; memcpy(&fh, r.p, sizeof(fh));
            if (memcmp(fh.magic, "TBLG", 4) == 0 && !ai.tieneHdr) {
                ai.tieneHdr = true; ai.rocket = fh.rocket_id; ai.idx = fh.file_idx; ai.boot = fh.boot_count; ai.mision = fh.mission_id; ai.flags = fh.flags;
                memcpy(ai.env, fh.env, 16); memcpy(ai.git, fh.git, 12); memcpy(ai.fw, fh.fw, 16);
            }
        }
        g_regs.push_back(r);
        g_recsPorTipo[h.type]++;
        ai.registros++;
        pos += len;
    }
    g_resync += ai.saltados;
    if (!primero && ai.tieneHdr && !(ai.flags & rec::FH_CONTINUA)) {
        fprintf(stderr, "%s: su FILEHDR no trae FH_CONTINUA: es otro registro, no sigue al anterior (el reloj local se reinicia en cada arranque). Pasalo por separado.\n", ruta);
        return false;
    }
    g_archivos.push_back(ai);
    return true;
}

// ---------- Alimentacion de la mision con los registros ----------
static void procesar(const Reg &r) {
    switch (r.type) {
    case rec::T_EXT_LSM: {                                     // ext_lsm.cpp: lsmTask, segunda pasada
        if (r.n < sizeof(rec::ExtLsmRec)) break;
        rec::ExtLsmRec h; memcpy(&h, r.p, sizeof(h));
        const uint8_t *w = r.p + sizeof(h);
        const uint32_t cnt = std::min<uint32_t>(h.cnt, (uint32_t)((r.n - sizeof(h)) / WORD_B));
        const double per = h.period_us > 1.0f ? (double)h.period_us : (double)LSM_PERIODO_NOMINAL_US;
        const float lsb = lsmLsbPorG(h.acc_fs_g);
        static ImuSample s; static bool haveA = false, haveG = false;
        uint64_t n = 0;                                        // ranuras de aceleracion vistas en este registro
        for (uint32_t i = 0; i < cnt; i++, w += WORD_B) {
            const int64_t tn = (int64_t)llround((double)h.t_first_us + (double)n * per);   // s_clk.timeOf(n) con el periodo estimado del lote
            switch (w[0] >> 3) {
            case TAG_ACC:  memcpy(s.a, w + 1, 6); haveA = true; engancheMuestraLsm(tn, s.a, lsb); n++; break;
            case TAG_GYRO: memcpy(s.g, w + 1, 6); haveG = true; break;
            case TAG_HUB0: extBmpOnWord(w + 1, tn); break;
            case TAG_HUB_NACK: extBmpOnNack(); break;
            default: break;
            }
        }
        if (haveA && haveG && n) {
            s.n = h.n0 + n - 1; s.t_us = (int64_t)llround((double)h.t_first_us + (double)(n - 1) * per);
            s.acc_lsb_per_g = lsb; s.gyr_lsb_per_dps = GYR_LSB_PER_DPS_LSM;
            g_ext_imu.set(s);
        }
        break;
    }
    case rec::T_IMU: {                                         // in_imu.cpp: imuTask
        if (r.n < sizeof(rec::ImuRec)) break;
        rec::ImuRec h; memcpy(&h, r.p, sizeof(h));
        const uint8_t *m = r.p + sizeof(h);
        const uint32_t cnt = std::min<uint32_t>(h.cnt, (uint32_t)((r.n - sizeof(h)) / QMI_SAMPLE_B));
        const double per = h.period_us > 1.0 ? h.period_us : 1e6 / QMI_HZ_NOMINAL;
        const float lsb = qmiLsbPorG(h.acc_fs_g);
        int64_t tn = 0;
        for (uint32_t k = 0; k < cnt; k++) {
            int16_t a[3];
            memcpy(a, m + k * QMI_SAMPLE_B, 6);
            tn = (int64_t)llround((double)h.t_first_us + (double)k * per);
            engancheMuestraQmi(tn, a, lsb);
        }
        if (cnt) {
            ImuSample s; memset(&s, 0, sizeof(s));
            s.n = h.n0 + cnt - 1; s.t_us = tn;
            memcpy(s.a, m + (cnt - 1) * QMI_SAMPLE_B, 6); memcpy(s.g, m + (cnt - 1) * QMI_SAMPLE_B + 6, 6);
            s.acc_lsb_per_g = lsb; s.gyr_lsb_per_dps = 32768.0f / (h.gyr_fs_dps ? h.gyr_fs_dps : 1024);
            g_imu.set(s);
        }
        break;
    }
    case rec::T_BAR: {                                         // in_bar.cpp: el BME280
        if (r.n < sizeof(rec::BarRec)) break;
        rec::BarRec h; memcpy(&h, r.p, sizeof(h));
        static uint32_t seq = 0;
        BarSample s; memset(&s, 0, sizeof(s));
        s.t_us = h.t_trig_us + P_CENTER_US; s.seq = ++seq;
        s.press_pa = h.press_pa; s.temp_c = h.temp_c; s.hum_pct = h.hum_pct;
        g_bar.set(s);
        break;
    }
    case rec::T_PVT: {                                         // gnss_m10s.cpp: solo lo que lee la mision (fix y hora de llegada)
        if (r.n < 24) break;
        GnssSample g; memset(&g, 0, sizeof(g));
        g.t_rx_us = r.t; g.fix = r.p[20]; g.flags = r.p[21]; g.nsv = r.p[23];
        g_gnss.set(g);
        break;
    }
    default: break;
    }
}

static void alimentar(int64_t hasta) {
    while (g_sig < g_regs.size() && g_regs[g_sig].t <= hasta) procesar(g_regs[g_sig++]);
}

// ---------- Guion del operador y observacion de la mision ----------
static std::string g_inicio = "armed";
static double g_armaS = 2.0, g_lanzaS = 4.0, g_colaS = 2.0, g_hastaS = -1.0;
static int  g_fase = 0, g_intentos = 0, g_tick = 0, g_maxTicks = 0;
static int64_t g_t0 = 0;
static uint32_t g_cmdCounter = 0, g_motivosArmado = 0;
static bool g_obsInit = false;
static uint8_t g_estPrev = 0, g_momPrev = 0, g_flagsPrev = 0;

static void cmd(uint8_t op, uint8_t arg = 0, uint32_t reasons = 0) {
    Cmd c; memset(&c, 0, sizeof(c));
    c.type = P_CMD; c.op = op; c.arg = arg; c.counter = ++g_cmdCounter; c.reasons = reasons;
    g_haveResp = false;
    missionOnCmd(c);
}

static void guion(int64_t rel_us) {
    const double s = (double)rel_us / 1e6;
    const MissionStats m = missionStats();
    switch (g_fase) {
    case 0:                                                    // armar: el primer paso (CONFIRMA, o NO_APTO con motivos)
        if (g_inicio != "tierra" && s >= g_armaS) { cmd(OP_ARM); g_fase = 1; }
        break;
    case 1:                                                    // el segundo paso, con los mismos motivos, como el "si" del operador
        if (g_haveResp && (g_resp.result == CR_CONFIRMA || g_resp.result == CR_NO_APTO)) { g_motivosArmado = g_resp.reasons; cmd((uint8_t)(OP_ARM | OP_CONFIRM), 0, g_resp.reasons); g_fase = 2; }
        else { aviso("ARM: la estacion no recibio CONFIRMA ni NO_APTO; el replay sigue sin armar"); g_fase = 9; }
        break;
    case 2:
        if (m.state == ST_ARMED) {
            if (g_motivosArmado) { char b[160]; snprintf(b, sizeof(b), "armado FORZADO con los motivos 0x%X (RZ_*): en la rampa real habria que confirmarlos", (unsigned)g_motivosArmado); aviso(b); }
            g_fase = 3;
        } else if (g_haveResp && (g_resp.result == CR_CONFIRMA || g_resp.result == CR_NO_APTO) && g_intentos++ < 3) {
            g_motivosArmado = g_resp.reasons; cmd((uint8_t)(OP_ARM | OP_CONFIRM), 0, g_resp.reasons);        // la situacion cambio entre los dos pasos
        } else { aviso("ARM: no quedo en ARMED; el replay sigue sin armar"); g_fase = 9; }
        break;
    case 3:
        if (g_inicio == "launch") { if (s >= g_lanzaS && m.state == ST_ARMED) { cmd(OP_LAUNCH); g_fase = 4; } }
        else g_fase = 4;
        break;
    default: break;
    }
}

static void observar() {                                       // tras el paso de la tarea de mision que acaba de correr, a la hora g_nowUs
    MissionLog l;
    while (missionTakeLog(l))
        evento("{\"t_us\":%lld,\"tipo\":\"T_MISSION\",\"op\":%u,\"arg\":%u,\"resultado\":%u,\"de\":\"%s\",\"a\":\"%s\",\"momento\":\"%s\",\"flags\":%u,\"contador\":%u,\"motivos\":%u}",
               (long long)l.t_us, l.r.op, l.r.arg, l.r.result, nEstado(l.r.from), nEstado(l.r.to), nMomento(l.r.moment), l.r.flags, (unsigned)l.r.counter, (unsigned)l.r.reasons);
    const MissionStats m = missionStats();
    const bool cambio = !g_obsInit || m.state != g_estPrev || m.moment != g_momPrev || m.flags != g_flagsPrev;
    if (cambio)
        evento("{\"t_us\":%lld,\"tipo\":\"%s\",\"estado\":\"%s\",\"momento\":\"%s\",\"estado_cod\":%u,\"momento_cod\":%u,\"flags\":%u,\"antes\":\"%s/%s\"}",
               (long long)g_nowUs, g_obsInit ? "cambio" : "inicio", nEstado(m.state), nMomento(m.moment), m.state, m.moment, m.flags,
               g_obsInit ? nEstado(g_estPrev) : "-", g_obsInit ? nMomento(g_momPrev) : "-");
    g_obsInit = true; g_estPrev = m.state; g_momPrev = m.moment; g_flagsPrev = m.flags;
}

static void tickDelReloj() {
    observar();
    if (g_sig >= g_regs.size() && g_nowUs >= g_tFin + (int64_t)(g_colaS * 1e6)) throw Parar();
    if (++g_tick > g_maxTicks) throw Parar();
    g_nowUs += 20000;
    alimentar(g_nowUs);
    guion(g_nowUs - g_t0);
}

// ---------- Salida ----------
static void imprimir(FILE *o, int rocket) {
    fprintf(o, "{\n \"version\":1,\"tarea\":\"T-305\",\"cohete_id\":%d,\"inicio\":\"%s\",\"arma_en_s\":%g,\"launch_en_s\":%g,\"cola_s\":%g,\n", rocket, g_inicio.c_str(), g_armaS, g_lanzaS, g_colaS);
    fprintf(o, " \"t_ini_us\":%lld,\"t_fin_us\":%lld,\"ticks\":%d,\"resync_saltados\":%ld,\n", (long long)g_tIni, (long long)g_tFin, g_tick, g_resync);
    fprintf(o, " \"archivos\":[");
    for (size_t i = 0; i < g_archivos.size(); i++) {
        const ArchInfo &a = g_archivos[i];
        fprintf(o, "%s\n  {\"ruta\":\"%s\",\"bytes\":%zu,\"registros\":%ld,\"saltados\":%ld,\"filehdr\":%s,\"rocket_id\":%d,\"file_idx\":%u,\"boot\":%u,\"continua\":%s,\"env\":\"%s\",\"git\":\"%s\"}",
                i ? "," : "", esc(a.ruta).c_str(), a.bytes, a.registros, a.saltados, a.tieneHdr ? "true" : "false", a.rocket, (unsigned)a.idx, (unsigned)a.boot,
                (a.flags & rec::FH_CONTINUA) ? "true" : "false", esc(a.env).c_str(), esc(a.git).c_str());
    }
    fprintf(o, "\n ],\n \"registros_por_tipo\":{");
    bool primero = true;
    for (int t = 0; t < 256; t++) if (g_recsPorTipo[t]) { fprintf(o, "%s\"%d\":%ld", primero ? "" : ",", t, g_recsPorTipo[t]); primero = false; }
    fprintf(o, "},\n \"avisos\":[");
    for (size_t i = 0; i < g_avisos.size(); i++) fprintf(o, "%s%s", i ? "," : "", g_avisos[i].c_str());
    fprintf(o, "],\n \"log_mision\":[");                       // los T_MISSION que trae el propio .BIN (de un vuelo o banco real; los sinteticos no tienen)
    primero = true;
    for (size_t i = 0; i < g_regs.size(); i++) {
        const Reg &r = g_regs[i];
        if (r.type != rec::T_MISSION || r.n < sizeof(rec::MissionRec)) continue;
        rec::MissionRec m; memcpy(&m, r.p, sizeof(m));
        fprintf(o, "%s\n  {\"t_us\":%lld,\"op\":%u,\"arg\":%u,\"resultado\":%u,\"de\":\"%s\",\"a\":\"%s\",\"momento\":\"%s\",\"flags\":%u,\"contador\":%u,\"motivos\":%u}",
                primero ? "" : ",", (long long)r.t, m.op, m.arg, m.result, nEstado(m.from), nEstado(m.to), nMomento(m.moment), m.flags, (unsigned)m.counter, (unsigned)m.reasons);
        primero = false;
    }
    fprintf(o, "\n ],\n \"eventos\":[");
    for (size_t i = 0; i < g_eventos.size(); i++) fprintf(o, "%s\n  %s", i ? "," : "", g_eventos[i].c_str());
    fprintf(o, "\n ]\n}\n");
}

int main(int argc, char **argv) {
    std::vector<const char *> rutas;
    const char *json = nullptr;
    int rocket = 0;
    for (int i = 1; i < argc; i++) {
        const std::string a = argv[i];
        const bool val = i + 1 < argc;
        if (a == "--cohete" && val) { const std::string v = argv[++i]; rocket = (v == "d" || v == "1") ? 1 : ((v == "h" || v == "2") ? 2 : -1); }
        else if (a == "--inicio" && val) g_inicio = argv[++i];
        else if (a == "--arma-en" && val) g_armaS = atof(argv[++i]);
        else if (a == "--launch-en" && val) g_lanzaS = atof(argv[++i]);
        else if (a == "--cola" && val) g_colaS = atof(argv[++i]);
        else if (a == "--hasta" && val) g_hastaS = atof(argv[++i]);
        else if (a == "--json" && val) json = argv[++i];
        else if (a.compare(0, 2, "--") == 0) { fprintf(stderr, "opcion desconocida: %s\n", a.c_str()); return 2; }
        else rutas.push_back(argv[i]);
    }
    if (rutas.empty() || rocket < 0 || (g_inicio != "tierra" && g_inicio != "armed" && g_inicio != "launch")) {
        fprintf(stderr, "uso: prueba_replay [--cohete d|h] [--inicio tierra|armed|launch] [--arma-en S] [--launch-en S] [--cola S] [--hasta S] [--json salida.json] archivo.BIN [mas.BIN ...]\n");
        return 2;
    }
    for (size_t i = 0; i < rutas.size(); i++) if (!cargar(rutas[i], i == 0)) return 3;
    if (g_regs.empty()) { fprintf(stderr, "ningun registro valido en los archivos\n"); return 3; }
    std::stable_sort(g_regs.begin(), g_regs.end(), [](const Reg &a, const Reg &b) { return a.t < b.t; });     // en orden de t_us, como las ve la mision
    g_tIni = g_regs.front().t;
    if (g_hastaS >= 0) {                                       // control negativo: solo los primeros S segundos
        const int64_t lim = g_tIni + (int64_t)(g_hastaS * 1e6);
        while (!g_regs.empty() && g_regs.back().t > lim) g_regs.pop_back();
    }
    g_tFin = g_regs.back().t;
    if (!rocket) {
        rocket = g_archivos[0].rocket;
        if (rocket != 1 && rocket != 2) { aviso("el FILEHDR no dice el cohete: se usa Demeter (--cohete lo cambia)"); rocket = 1; }
    } else if (g_archivos[0].tieneHdr && g_archivos[0].rocket != rocket) aviso("--cohete no coincide con el rocket_id del FILEHDR");
    if (g_resync) aviso("hubo bytes sin registro valido (se saltaron hasta el siguiente A5 5A con CRC bueno)");

    g_t0 = g_tIni;
    g_nowUs = (g_tIni / 20000) * 20000;                        // el reloj virtual arranca en la rejilla de 20 ms, en el primer registro
    g_maxTicks = (int)((g_tFin - g_tIni) / 20000 + (int64_t)(g_colaS * 50.0) + 100);
    g_nvs["tbfw/boot"] = std::vector<uint8_t>(4, 0);
    g_alTick = tickDelReloj; g_alRegistrar = alRegistrar; g_alResp = alResp; g_alPin = alPin;
    extActBegin();                                             // como el arranque: los pines salen en bajo antes de missionBegin
    missionBegin((uint8_t)rocket);
    try { g_taskFn(nullptr); } catch (const Parar &) {}
    observar();

    FILE *o = json ? fopen(json, "w") : stdout;
    if (!o) { fprintf(stderr, "no puedo escribir %s\n", json); return 3; }
    imprimir(o, rocket);
    if (json) fclose(o);
    return 0;
}
