// logger.cpp - Registro en microSD.
//  * No registra desde el arranque: descarta lo que producen los sensores hasta loggerRecord(true). Entonces usa un archivo
//    preasignado sin usar (RES_xxxx.BIN de 32 MB con ceros); si no hay, crea uno nuevo sin preasignar.
//  * Mientras hay tiempo libre y esta permitido, crea en segundo plano el siguiente archivo de reserva.
//  * Escribe bloques de 4 KB; vacia (flush) cada 16 bloques o cada 1 s si hay datos pendientes.
//  * Toma g_sdBusMx en cada operacion de SD (el bus es compartido con el QMI8658).
//  * Escribe con open/write/fsync, no con File: File usa stdio, y un fflush que falla descarta su bufer sin avisar (DEM 0041 y 0057:
//    hasta 4 KB perdidos, unos 100 ms, sin incidente). Asi todo error se ve en el valor devuelto.
#include "logger.h"
#include "core_bus.h"
#include "LoRaBoards.h"
#include <net_proto.h>
#include <SD.h>
#include <Preferences.h>
#include <esp_timer.h>
#include <errno.h>
#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/time.h>
#include <time.h>

#ifndef LOG_TZ
#define LOG_TZ "COT5"          // zona de las fechas de archivo en la SD (FAT guarda hora local); los registros siguen en UTC
#endif

#ifndef SD_HZ
#define SD_HZ 10000000         // sobra para ~16 kB/s y da mas margen de senal (se bajo de 20 MHz por los fallos de CMD13)
#endif

static const uint32_t BLK          = 4096;
static const uint32_t SPARE_SYNC   = 1024UL * 1024UL;   // la reserva se asienta cada MB: es hasta donde se puede retomar
static const uint32_t PREALLOC     = 32UL * 1024UL * 1024UL;
static const uint32_t FLUSH_MS     = 1000;
static const uint32_t FLUSH_BLOCKS = 16;
static const uint32_t HB_MS        = 1000;
static const uint32_t SPARE_MAX_FAILS = 3;
static const uint32_t SPARE_RETRY_MS  = 5000;
static const uint16_t WRITE_BACKOFF_MS[] = {1, 2, 5, 10, 20, 50};
static const uint32_t RECOVER_TRIES = 3;
static const uint32_t SECTOR = 512;
static const uint32_t TYPICAL_BPS = 45000;     // medido: DEM 0067, todos los sensores
static const uint8_t  KEEP_MAX = 8;            // comandos de mision guardados mientras no se registra

static LoggerStats s_s;
static volatile bool s_allowPre = true;
static volatile bool s_stopReq = false, s_recReq = false, s_prepReq = false;
static uint16_t s_rocket = 0;
static uint32_t s_mission = 0, s_boot = 0;

static int      s_f = -1;            // archivo activo
static uint32_t s_filePos = 0;
static bool     s_pre = false;
static uint8_t  s_blk[BLK];
static uint32_t s_fill = 0, s_blocksSinceFlush = 0, s_lastFlushMs = 0;
static bool     s_dirty = false;
static uint8_t  s_tail[SECTOR];      // lo escrito en el sector aun incompleto: FatFs lo tiene en su bufer y lo pierde si el archivo falla

static int      s_sp = -1;           // archivo de reserva en creacion
static int32_t  s_spIdx = -1, s_nextIdx = 0, s_spareReadyIdx = -1;
static char     s_sparePath[48] = "";
static uint8_t  s_keep[KEEP_MAX][rec::HDR_SIZE + sizeof(rec::MissionRec) + rec::CRC_SIZE];
static uint8_t  s_keepN = 0;
static uint32_t s_spWritten = 0, s_spNextTryMs = 0;
static uint8_t  s_zero[BLK];

static char     s_activePath[48] = "";
static bool     s_clockSet = false;

// Nombres: reserva sin usar RES_0012.BIN; en uso DEM_M00_20261101_000419_0012.BIN (cohete, mision, fecha local de inicio, indice).
// Sin hora, en vez de la fecha lleva SINFECHA, y se renombra cuando la hay. Los archivos LOG0012.BIN antiguos se siguen reconociendo.
static void fname(int32_t idx, char *out, size_t n) { snprintf(out, n, "/RES_%04ld.BIN", (long)idx); }

static void activeName(int32_t idx, char *out, size_t n) {
    char date[24] = "SINFECHA";
    if (s_clockSet) {
        const time_t t = time(nullptr);
        struct tm lt;
        localtime_r(&t, &lt);
        strftime(date, sizeof(date), "%Y%m%d_%H%M%S", &lt);
    }
    const char *who = s_rocket == net::DEMETER ? "DEM" : (s_rocket == net::HERMES ? "HER" : "UNK");
    snprintf(out, n, "/%s_M%02lu_%s_%04ld.BIN", who, (unsigned long)s_mission, date, (long)idx);
}

// ---------------- incidentes de SD ----------------
// Se guardan aqui y se escriben despues en el bucle: registrarlos dentro de una escritura fallida seria reentrante.
static const uint8_t EV_MAX = 16;
static rec::EventRec s_ev[EV_MAX];
static uint8_t  s_evN = 0;

static void pushEvent(bool spare, uint8_t code, int err, uint32_t durUs) {
    if (s_evN >= EV_MAX) { s_s.eventsLost++; return; }
    rec::EventRec &e = s_ev[s_evN++];
    e.t_us = esp_timer_get_time(); e.pos = spare ? s_spWritten : s_filePos; e.dur_us = durUs;
    e.err = (int16_t)err; e.file = spare ? 1 : 0; e.code = code;
}

// ---------------- E/S protegida por el mutex del bus ----------------
static int sdOpen(const char *path, int flags) {
    char full[56];
    snprintf(full, sizeof(full), "/sd%s", path);
    return ::open(full, flags, 0666);
}

// n = 0 solo asienta. Se puede repetir con los mismos datos: el reintento tras recuperar el archivo escribe en la misma posicion.
static bool sdWrite(int &fd, const uint8_t *p, size_t n, bool doFlush) {
    // f_write y f_sync validan el archivo con CMD13; si esa consulta falla devuelven EBADF sin hacer nada
    // y el archivo sigue siendo valido: se reintenta en vez de perder el bloque. El fallo puede durar mas de 4 ms
    // (Hermes: 3 reservas perdidas con 4 intentos seguidos), asi que se espera cada vez mas, soltando el bus para el IMU.
    size_t w = 0;
    bool ok = false;
    int64_t t0 = 0, t1 = 0, t2 = 0;
    for (uint32_t i = 0;; i++) {
        int err = 0;
        xSemaphoreTake(g_sdBusMx, portMAX_DELAY);
        t0 = esp_timer_get_time();
        if (w < n) {
            errno = 0;
            const int r = ::write(fd, p + w, n - w);
            if (r > 0) w += (size_t)r;
            err = errno;
        }
        t1 = esp_timer_get_time();
        ok = w == n;
        if (ok && doFlush) {
            errno = 0;
            ok = ::fsync(fd) == 0;
            if (!ok) err = errno;
        }
        t2 = esp_timer_get_time();
        xSemaphoreGive(g_sdBusMx);
        if (ok) break;
        s_s.ioErrs++; s_s.ioErrno = err; s_s.ioWrote = (uint32_t)w;
        pushEvent(&fd == &s_sp, rec::EV_WRITE_FAIL, err, (uint32_t)(t2 - t0));
        if (err == EIO) s_s.ioErrsDisk++;
        if (err == EIO) break;                             // error de disco: FatFs marca el archivo y no se recupera sin reabrir
        if (i >= sizeof(WRITE_BACKOFF_MS) / sizeof(WRITE_BACKOFF_MS[0])) break;
        vTaskDelay(pdMS_TO_TICKS(WRITE_BACKOFF_MS[i]));
    }
    const uint32_t dw = (uint32_t)(t1 - t0), df = (uint32_t)(t2 - t1);
    s_s.writes++;
    if (dw > s_s.writeMaxUs) s_s.writeMaxUs = dw;
    if (dw > 20000) s_s.over20++;
    if (dw > 50000) s_s.over50++;
    if (dw > 100000) s_s.over100++;
    if (doFlush) { s_s.flushes++; if (df > s_s.flushMaxUs) s_s.flushMaxUs = df; }
    return ok;
}

// Cierra y reabre el archivo, y se ubica en pos (o en su tamano real si lo no asentado se perdio).
static bool reopen(int &fd, const char *path, uint32_t &pos) {
    xSemaphoreTake(g_sdBusMx, portMAX_DELAY);
    ::close(fd);
    fd = sdOpen(path, O_RDWR);
    bool ok = false;
    if (fd >= 0) {
        const off_t sz = ::lseek(fd, 0, SEEK_END);
        if (sz >= 0) {
            if (pos > (uint32_t)sz) pos = (uint32_t)sz;
            ok = ::lseek(fd, (off_t)pos, SEEK_SET) == (off_t)pos;
        }
    }
    xSemaphoreGive(g_sdBusMx);
    return ok;
}

static bool recover(int &fd, const char *path, uint32_t &pos, bool spare) {
    const int64_t t0 = esp_timer_get_time();
    s_s.reopens++;
    const bool ok = reopen(fd, path, pos);
    pushEvent(spare, ok ? rec::EV_REOPEN_OK : rec::EV_REOPEN_FAIL, 0, (uint32_t)(esp_timer_get_time() - t0));
    return ok;
}

// ---------------- archivo activo ----------------
static void tailUpdate(const uint8_t *p, uint32_t n) {
    const uint32_t rem = (s_filePos + n) % SECTOR;
    if (n >= rem) memcpy(s_tail, p + n - rem, rem);
    else memcpy(s_tail + s_filePos % SECTOR, p, n);
}

// Tras reabrir, repone el sector incompleto: el bufer de FatFs se perdio con el archivo (DEM 0047 y 0059: hasta 511 B).
// Si el archivo quedo mas corto que before, lo que hay es lo que vale, y se lee para seguir la cuenta.
static bool tailRestore(uint32_t before) {
    const uint32_t rem = s_filePos % SECTOR;
    if (!rem) return true;
    xSemaphoreTake(g_sdBusMx, portMAX_DELAY);
    bool ok = ::lseek(s_f, (off_t)(s_filePos - rem), SEEK_SET) >= 0;
    if (ok) ok = (s_filePos == before ? ::write(s_f, s_tail, rem) : ::read(s_f, s_tail, rem)) == (int)rem;
    xSemaphoreGive(g_sdBusMx);
    return ok;
}

static bool recoverActive() {
    const uint32_t before = s_filePos;
    return recover(s_f, s_activePath, s_filePos, false) && tailRestore(before);
}

static void writeOut(const uint8_t *p, uint32_t n, bool flush) {
    bool ok = sdWrite(s_f, p, n, flush);
    for (uint32_t i = 0; !ok && i < RECOVER_TRIES; i++) ok = recoverActive() && sdWrite(s_f, p, n, flush);
    if (!ok) { s_s.state = 3; s_s.msg = "ERROR de escritura"; return; }
    tailUpdate(p, n);
    s_filePos += n; s_s.bytes += n; s_dirty = !flush;
}

static void appendBytes(const uint8_t *p, uint32_t n) {
    while (n) {
        uint32_t c = BLK - s_fill; if (c > n) c = n;
        memcpy(s_blk + s_fill, p, c); s_fill += c; p += c; n -= c;
        if (s_fill == BLK) {
            const bool fl = (++s_blocksSinceFlush >= FLUSH_BLOCKS);
            writeOut(s_blk, BLK, fl);
            s_fill = 0;
            if (fl) { s_blocksSinceFlush = 0; s_lastFlushMs = millis(); }
        }
    }
}

static void appendRecord(uint8_t type, uint8_t src, const void *payload, uint16_t n) {
    uint8_t tmp[rec::MAX_LEN];
    const uint16_t len = rec::build(tmp, type, src, esp_timer_get_time(), payload, n);
    appendBytes(tmp, len);
}

static void writeFileHeader() {
    rec::FileHdrRec h; memset(&h, 0, sizeof(h));
    memcpy(h.magic, "TBLG", 4); h.version = 1; h.rocket_id = s_rocket; h.mission_id = s_mission;
    h.boot_count = s_boot; h.file_idx = s_s.fileIdx;
    h.utc_us = time_to_utc_us(esp_timer_get_time());
    strncpy(h.fw, __DATE__, sizeof(h.fw) - 1);
    appendRecord(rec::T_FILEHDR, rec::S_SYS, &h, sizeof(h));
}

// srcPath: reserva a reutilizar, o nullptr para crear un archivo nuevo. Si el renombrado falla se usa con su nombre actual.
static bool openActive(int32_t idx, const char *srcPath) {
    const bool prealloc = srcPath != nullptr;
    char path[48]; activeName(idx, path, sizeof(path));
    if (prealloc) {
        if (!SD.rename(srcPath, path)) strncpy(path, srcPath, sizeof(path) - 1);
    }
    s_f = sdOpen(path, prealloc ? O_RDWR : (O_RDWR | O_CREAT | O_TRUNC));
    if (s_f < 0) return false;
    strncpy(s_activePath, path, sizeof(s_activePath) - 1);
    strncpy(s_s.name, path + 1, sizeof(s_s.name) - 1);
    s_s.fileIdx = (uint32_t)idx; s_s.preallocated = prealloc;
    s_pre = prealloc; s_filePos = 0; s_fill = 0; s_blocksSinceFlush = 0; s_lastFlushMs = millis(); s_dirty = false;
    return true;
}

// ---------------- exploracion de archivos ----------------
struct Scan { int32_t maxIdx; int32_t spareIdx; char spare[48]; char junk[4][48]; int nJunk; };

// Indice = los 4 digitos antes de ".BIN", con cualquier prefijo.
static bool fileIndex(const char *nm, unsigned &idx) {
    const size_t n = strlen(nm);
    if (n < 8 || strcmp(nm + n - 4, ".BIN") != 0) return false;
    idx = 0;
    for (const char *d = nm + n - 8; d < nm + n - 4; d++) {
        if (*d < '0' || *d > '9') return false;
        idx = idx * 10 + (unsigned)(*d - '0');
    }
    return true;
}

static void scanFiles(Scan &sc) {
    sc.maxIdx = -1; sc.spareIdx = -1; sc.nJunk = 0;
    File root = SD.open("/");
    if (!root) return;
    for (File f = root.openNextFile(); f; f = root.openNextFile()) {
        if (f.isDirectory()) { f.close(); continue; }
        const char *nm = f.name(); if (nm[0] == '/') nm++;
        unsigned idx = 0;
        if (fileIndex(nm, idx)) {
            const uint32_t size = f.size();
            int first = (size > 0) ? f.read() : -1;
            if ((int32_t)idx > sc.maxIdx) sc.maxIdx = idx;
            if (first == 0 || size == 0) {                       // sin usar
                if (size == PREALLOC) {
                    if (sc.spareIdx < 0 || (int32_t)idx < sc.spareIdx) { sc.spareIdx = idx; snprintf(sc.spare, sizeof(sc.spare), "/%s", nm); }
                } else if (sc.nJunk < 4) snprintf(sc.junk[sc.nJunk++], sizeof(sc.junk[0]), "/%s", nm);   // reserva incompleta: se borra
            }
        }
        f.close();
    }
    root.close();
}

// ---------------- archivo de reserva (segundo plano) ----------------
// Fallo de la reserva: no afecta al archivo activo. Se borra lo parcial y se reintenta con el mismo indice.
static void spareFailed() {
    s_s.spareFails++; s_s.spareState = 0; s_s.sparePct = 0;
    s_spNextTryMs = millis() + SPARE_RETRY_MS;
}

static bool spareStep() {
    if (!s_allowPre || s_s.spareState == 2 || s_s.spareFails >= SPARE_MAX_FAILS) return false;
    if (s_s.spareState == 0) {
        if ((int32_t)(millis() - s_spNextTryMs) < 0) return false;
        char nm[20]; fname(s_nextIdx, nm, sizeof(nm));
        xSemaphoreTake(g_sdBusMx, portMAX_DELAY); s_sp = sdOpen(nm, O_RDWR | O_CREAT | O_TRUNC); xSemaphoreGive(g_sdBusMx);
        if (s_sp < 0) { spareFailed(); return false; }
        s_spIdx = s_nextIdx++; s_spWritten = 0; s_s.spareState = 1; s_s.sparePct = 0;
    }
    if (!sdWrite(s_sp, s_zero, BLK, (s_spWritten + BLK) % SPARE_SYNC == 0)) {
        // Se retoma desde lo ya asentado; solo se abandona si no hubo avance desde el ultimo fallo.
        static uint32_t lastFailPos = 0xFFFFFFFFUL;
        const bool progress = s_spWritten != lastFailPos;
        lastFailPos = s_spWritten;
        char nm[20]; fname(s_spIdx, nm, sizeof(nm));
        if (progress && recover(s_sp, nm, s_spWritten, true)) return true;
        xSemaphoreTake(g_sdBusMx, portMAX_DELAY); ::close(s_sp); SD.remove(nm); xSemaphoreGive(g_sdBusMx);
        s_nextIdx = s_spIdx;
        spareFailed();
        return false;
    }
    s_spWritten += BLK;
    s_s.sparePct = (uint8_t)((uint64_t)s_spWritten * 100 / PREALLOC);
    if (s_spWritten >= PREALLOC) {
        xSemaphoreTake(g_sdBusMx, portMAX_DELAY); ::fsync(s_sp); ::close(s_sp); xSemaphoreGive(g_sdBusMx);
        s_spareReadyIdx = s_spIdx; s_s.spareState = 2; s_s.sparePct = 100;
        fname(s_spIdx, s_sparePath, sizeof(s_sparePath));
    }
    return true;
}

// Abre el siguiente archivo: la reserva si esta lista; si no, uno nuevo sin preasignar.
static bool openNext() {
    const bool useSpare = s_s.spareState == 2;
    xSemaphoreTake(g_sdBusMx, portMAX_DELAY);
    const bool ok = useSpare ? openActive(s_spareReadyIdx, s_sparePath) : openActive(s_nextIdx++, nullptr);
    xSemaphoreGive(g_sdBusMx);
    if (!ok) { s_s.state = 3; s_s.msg = "ERROR abriendo archivo"; return false; }
    if (useSpare) { s_s.spareState = 0; s_s.sparePct = 0; }
    s_s.fileStartMs = millis();
    writeFileHeader();
    return true;
}

static void rollover() {
    if (s_s.spareState != 2) return;                               // sin reserva: se sigue extendiendo el archivo
    xSemaphoreTake(g_sdBusMx, portMAX_DELAY); ::fsync(s_f); ::close(s_f); s_f = -1; xSemaphoreGive(g_sdBusMx);
    if (openNext()) s_s.rollovers++;
}

// ---------------- anillos ----------------
static uint32_t drainRing(RingId r, uint32_t maxBytes) {
    uint8_t rb[rec::MAX_LEN];
    uint32_t moved = 0;
    while (moved < maxBytes) {
        const uint32_t n = bus_ring_peek(r, rb, rec::MAX_LEN);
        if (n < rec::HDR_SIZE + rec::CRC_SIZE) break;
        const uint16_t len = rec::check(rb, n);
        if (!len) { s_s.badRecs++; s_s.resyncs++; bus_ring_consume(r, 1); continue; }
        appendBytes(rb, len);
        bus_ring_consume(r, len);
        moved += len;
    }
    return moved;
}

static void heartbeat() {
    rec::HbRec h; memset(&h, 0, sizeof(h));
    h.uptime_ms = millis();
    for (int i = 0; i < RING_COUNT && i < 4; i++) h.drops[i] = bus_ring_drops((RingId)i);
    h.write_max_us = s_s.writeMaxUs; h.flush_max_us = s_s.flushMaxUs; h.bytes = s_s.bytes;
    TimeModel m; h.time_flags = (time_snapshot(m) && m.valid()) ? m.timeFlags(esp_timer_get_time()) : 0xFF;
    h.spare_state = s_s.spareState; h.spare_pct = s_s.sparePct;
    appendRecord(rec::T_HEARTBEAT, rec::S_SYS, &h, sizeof(h));
}

// La fecha de los archivos sale del reloj del sistema (get_fattime usa time()): se pone una vez, cuando hay hora.
// El siguiente flush deja en el archivo activo la fecha real de su ultima escritura.
static void setSystemClock() {
    TimeModel m;
    if (s_clockSet || !time_snapshot(m) || !m.valid()) return;
    const int64_t utc = m.toUtcUs(esp_timer_get_time());
    timeval tv; tv.tv_sec = (time_t)(utc / 1000000LL); tv.tv_usec = (suseconds_t)(utc % 1000000LL);
    s_clockSet = settimeofday(&tv, nullptr) == 0;
    if (!s_clockSet || s_s.state != 2 || s_f < 0) return;

    // El archivo activo se abrio sin fecha: se renombra ahora. Hay que cerrarlo para hacerlo.
    char path[48]; activeName((int32_t)s_s.fileIdx, path, sizeof(path));
    xSemaphoreTake(g_sdBusMx, portMAX_DELAY);
    ::fsync(s_f); ::close(s_f);
    if (SD.rename(s_activePath, path)) {
        strncpy(s_activePath, path, sizeof(s_activePath) - 1);
        strncpy(s_s.name, path + 1, sizeof(s_s.name) - 1);
    }
    xSemaphoreGive(g_sdBusMx);
    const uint32_t before = s_filePos;
    if (!reopen(s_f, s_activePath, s_filePos) || !tailRestore(before)) { s_s.state = 3; s_s.msg = "ERROR reabriendo tras renombrar"; }
}

// ---------------- sin registrar ----------------
// Lo de los sensores se descarta. De los comandos de mision se guardan los ultimos: dicen como se llego al vuelo.
static void discardRings() {
    uint8_t rb[rec::MAX_LEN];
    for (;;) {
        const uint32_t n = bus_ring_peek(RING_NET, rb, rec::MAX_LEN);
        if (n < rec::HDR_SIZE + rec::CRC_SIZE) break;
        const uint16_t len = rec::check(rb, n);
        if (!len) { bus_ring_consume(RING_NET, 1); continue; }
        if (rb[4] == rec::T_MISSION && len == sizeof(s_keep[0])) {
            if (s_keepN == KEEP_MAX) { memmove(s_keep[0], s_keep[1], sizeof(s_keep[0]) * (KEEP_MAX - 1)); s_keepN--; }
            memcpy(s_keep[s_keepN++], rb, len);
        }
        bus_ring_consume(RING_NET, len);
    }
    for (int r = 0; r < RING_COUNT; r++) {
        if (r != RING_NET) bus_ring_consume((RingId)r, bus_ring_used((RingId)r));
    }
}

static void startRecording() {
    discardRings();                                                // lo viejo no es de este registro
    if (s_f < 0 && !openNext()) return;
    s_s.fileStartMs = millis();
    for (uint8_t i = 0; i < s_keepN; i++) appendBytes(s_keep[i], sizeof(s_keep[i]));
    s_keepN = 0;
    s_s.state = 2; s_s.msg = s_pre ? "registrando (preasignado)" : "registrando (sin preasignar)";
}

static void stopRecording() {
    for (int r = 0; r < RING_COUNT; r++) drainRing((RingId)r, 65536);
    if (s_fill > 0) { writeOut(s_blk, s_fill, true); s_fill = 0; }
    xSemaphoreTake(g_sdBusMx, portMAX_DELAY); ::fsync(s_f); ::close(s_f); s_f = -1; xSemaphoreGive(g_sdBusMx);
    s_filePos = 0; s_dirty = false; s_s.name[0] = 0;
    if (s_s.state == 2) { s_s.state = 5; s_s.msg = "listo, sin registrar"; }
}

// ---------------- tarea ----------------
static const uint32_t STOP_TAIL_MS = 300;      // el registro del comando que termina el archivo llega despues de la orden: debe quedar dentro

static void loggerTask(void *) {
    s_s.state = 1; s_s.msg = "montando SD";
    setenv("TZ", LOG_TZ, 1); tzset();
    SD.end();
    if (!SD.begin(SDCARD_CS, SDCardSPI, SD_HZ)) { s_s.state = 3; s_s.msg = "SD no monta"; vTaskDelete(nullptr); }

    Preferences p; p.begin("tbfw", false);
    s_boot = p.getUInt("boot", 0) + 1; p.putUInt("boot", s_boot); p.end();

    Scan sc; scanFiles(sc);
    for (int i = 0; i < sc.nJunk; i++) SD.remove(sc.junk[i]);

    s_nextIdx = sc.maxIdx + 1;
    if (sc.spareIdx >= 0) {                                        // reserva de un arranque anterior: ya esta lista
        s_spareReadyIdx = sc.spareIdx; s_s.spareState = 2; s_s.sparePct = 100;
        strncpy(s_sparePath, sc.spare, sizeof(s_sparePath) - 1);
    }
    for (int i = 0; i < (int)sizeof(s_zero); i++) s_zero[i] = 0;
    s_s.freeMB = (uint32_t)((SD.totalBytes() - SD.usedBytes()) / (1024ULL * 1024ULL));
    s_s.state = 5; s_s.msg = "listo, sin registrar";

    uint32_t lastHb = millis(), stopFrom = 0;
    for (;;) {
        if (s_stopReq) {
            // Parada limpia para la descarga por USB: lo pendiente al archivo y todo cerrado. Solo sale de aqui con un reinicio.
            if (s_f >= 0 && s_fill > 0) { writeOut(s_blk, s_fill, true); s_fill = 0; }
            xSemaphoreTake(g_sdBusMx, portMAX_DELAY);
            if (s_f >= 0) { ::fsync(s_f); ::close(s_f); }
            if (s_s.spareState == 1) ::close(s_sp);           // reserva incompleta: se borra en el siguiente arranque
            xSemaphoreGive(g_sdBusMx);
            s_s.state = 4; s_s.msg = "detenido";
            vTaskDelete(nullptr);
        }
        if (s_s.state == 5) {
            if (s_recReq) startRecording();
            else if (s_prepReq && s_f < 0 && openNext()) { writeOut(s_blk, s_fill, true); s_fill = 0; }
        } else if (s_s.state == 2 && s_recReq) stopFrom = 0;
        else if (s_s.state == 2) {
            if (!stopFrom) stopFrom = millis() | 1;
            else if (millis() - stopFrom >= STOP_TAIL_MS) { stopRecording(); stopFrom = 0; }
        }
        s_prepReq = false;
        if (s_s.state != 2) {
            discardRings();
            const uint32_t t = millis();
            if (t - lastHb >= HB_MS) { lastHb = t; setSystemClock(); }
            if (!spareStep()) vTaskDelay(pdMS_TO_TICKS(2)); else vTaskDelay(1);
            continue;
        }
        uint32_t moved = 0;
        for (int r = 0; r < RING_COUNT; r++) moved += drainRing((RingId)r, 4096);
        if (s_evN) {
            rec::EventRec ev[EV_MAX];
            const uint8_t n = s_evN;
            memcpy(ev, s_ev, n * sizeof(rec::EventRec));   // escribirlos puede fallar y generar eventos nuevos
            s_evN = 0;
            for (uint8_t i = 0; i < n; i++) appendRecord(rec::T_EVENT, rec::S_SYS, &ev[i], sizeof(ev[i]));
        }

        const uint32_t now = millis();
        if (now - lastHb >= HB_MS) { lastHb = now; heartbeat(); setSystemClock(); }
        if ((s_fill > 0 || s_dirty) && now - s_lastFlushMs >= FLUSH_MS) {
            if (s_fill > 0) { writeOut(s_blk, s_fill, true); s_fill = 0; }
            else writeOut(s_blk, 0, true);
            s_blocksSinceFlush = 0; s_lastFlushMs = now;
        }
        if (s_s.state == 2 && s_pre && s_fill == 0 && s_filePos + BLK > PREALLOC) rollover();

        // Ceder SIEMPRE la CPU: la escritura SD por SPI es por sondeo y no cede; sin esto IDLE0 no corre
        // y el watchdog de tareas (5 s) reinicia el chip.
        if (!moved) { if (!spareStep()) vTaskDelay(pdMS_TO_TICKS(2)); else vTaskDelay(1); }
        else vTaskDelay(1);
    }
}

bool loggerBegin(uint16_t rocketId, uint32_t missionId) {
    s_rocket = rocketId; s_mission = missionId;
    memset(&s_s, 0, sizeof(s_s)); s_s.msg = "sin iniciar";
    xTaskCreatePinnedToCore(loggerTask, "logger", 8192, nullptr, 2, nullptr, 0);
    return true;
}

LoggerStats loggerStats() {
    LoggerStats o = s_s;
    for (int i = 0; i < RING_COUNT && i < 4; i++) o.drops[i] = bus_ring_drops((RingId)i);
    o.filePos = s_filePos;
    return o;
}

void loggerAllowPrealloc(bool allow) { s_allowPre = allow; }
void loggerPrepare() { s_prepReq = true; }
void loggerRecord(bool on) { s_recReq = on; }

LoggerRecInfo loggerRecInfo() {
    LoggerRecInfo i;
    i.recording = s_s.state == 2;
    i.prepared = s_s.state == 5 && s_f >= 0;
    i.name = s_s.name;
    i.pos = s_filePos;
    i.elapsedS = i.recording ? (millis() - s_s.fileStartMs) / 1000 : 0;
    const uint32_t left = i.pos < PREALLOC ? PREALLOC - i.pos : 0;
    const uint32_t bps = i.elapsedS >= 5 && i.pos ? i.pos / i.elapsedS : TYPICAL_BPS;
    i.remainS = left / bps;
    i.pct = (uint8_t)((uint64_t)(PREALLOC - left) * 100 / PREALLOC);
    return i;
}

bool loggerStop(uint32_t timeoutMs) {
    s_stopReq = true;
    for (uint32_t t0 = millis(); millis() - t0 < timeoutMs; vTaskDelay(pdMS_TO_TICKS(10)))
        if (s_s.state == 4) return true;
    return false;
}
