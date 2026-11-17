// log_download.cpp - Protocolo por lineas de texto; la respuesta a READ es una trama binaria:
//   [A5 5A][n u16][off u32][status u8][datos n][crc16 CCITT-FALSE de todo lo anterior]
//   status: 0 datos, 1 fin de archivo, 2 error (el PC reintenta).
//   LIST -> una linea "F nombre tamano" por archivo .BIN, y "END". Es rapido: no mira el contenido.
//   USED nombre -> "F nombre tamano usado".   usado = tamano sin los ceros finales de la preasignacion.
//   SEND nombre offset n -> tramas seguidas de hasta 4 KB, sin esperar pedido por cada una, y al final una de status 1.
//     Cualquier byte recibido corta el envio: asi el PC se recupera de una trama mala y pide desde ahi.
//   RESET -> reinicia.
// Los demas sensores y la radio siguen funcionando; el IMU comparte el bus, por eso cada acceso a SD toma g_sdBusMx.
#include "log_download.h"
#include "core_bus.h"
#include "logger.h"
#include <SD.h>

static const uint32_t CHUNK = 4096;
static const size_t   NAME_MAX_LEN = 64;
static const uint32_t IDLE_RESTART_MS = 120000;  // sin comandos por este tiempo, la placa se reinicia y vuelve a registrar
// Con los 256 B por defecto, HWCDC::write duerme 1 ms cada vez que se llena. Con espacio para varias tramas la interrupcion
// sigue vaciando mientras se lee la SD. Es memoria interna, pero solo se pide aqui: de este modo se sale reiniciando.
static const size_t   USB_TX_RING = 32768, USB_TX_RING_DEFAULT = 256;

static uint8_t  s_frame[9 + CHUNK + 2];
static uint8_t  s_probe[CHUNK];
static File     s_file;
static char     s_name[NAME_MAX_LEN] = "";
static uint32_t s_pos = 0;

static bool isZero(const uint8_t *p, uint32_t n) {
    for (uint32_t i = 0; i < n; i++) if (p[i]) return false;
    return true;
}

// Los datos ocupan el principio del archivo y el resto son ceros: basta una busqueda binaria del primer bloque vacio.
static uint32_t usedBytes(const char *path, uint32_t size) {
    xSemaphoreTake(g_sdBusMx, portMAX_DELAY);
    File f = SD.open(path, FILE_READ);
    xSemaphoreGive(g_sdBusMx);
    if (!f) return size;
    uint32_t lo = 0, hi = (size + CHUNK - 1) / CHUNK;
    while (lo < hi) {
        const uint32_t mid = lo + (hi - lo) / 2;
        xSemaphoreTake(g_sdBusMx, portMAX_DELAY);
        const bool ok = f.seek(mid * CHUNK);
        const int got = ok ? f.read(s_probe, CHUNK) : -1;
        xSemaphoreGive(g_sdBusMx);
        if (got <= 0) { hi = mid; continue; }
        if (isZero(s_probe, (uint32_t)got)) hi = mid;
        else lo = mid + 1;
    }
    xSemaphoreTake(g_sdBusMx, portMAX_DELAY);
    f.close();
    xSemaphoreGive(g_sdBusMx);
    const uint64_t used = (uint64_t)lo * CHUNK;
    return used > size ? size : (uint32_t)used;
}

static void cmdList() {
    xSemaphoreTake(g_sdBusMx, portMAX_DELAY);
    File root = SD.open("/");
    xSemaphoreGive(g_sdBusMx);
    if (root) {
        for (;;) {
            char nm[NAME_MAX_LEN] = "";
            uint32_t size = 0;
            bool dir = false;
            xSemaphoreTake(g_sdBusMx, portMAX_DELAY);
            File f = root.openNextFile();
            const bool more = f;
            if (more) {
                const char *n = f.name(); if (n[0] == '/') n++;
                strncpy(nm, n, sizeof(nm) - 1);
                size = (uint32_t)f.size();
                dir = f.isDirectory();
                f.close();
            }
            xSemaphoreGive(g_sdBusMx);
            if (!more) break;
            const size_t len = strlen(nm);
            if (dir || len < 4 || strcmp(nm + len - 4, ".BIN") != 0) continue;
            Serial.printf("F %s %lu\n", nm, (unsigned long)size);
        }
        xSemaphoreTake(g_sdBusMx, portMAX_DELAY);
        root.close();
        xSemaphoreGive(g_sdBusMx);
    }
    Serial.print("END\n");
    Serial.flush();
}

static void cmdUsed(const char *name) {
    char path[NAME_MAX_LEN + 1];
    snprintf(path, sizeof(path), "/%s", name);
    xSemaphoreTake(g_sdBusMx, portMAX_DELAY);
    File f = SD.open(path, FILE_READ);
    const uint32_t size = f ? (uint32_t)f.size() : 0;
    if (f) f.close();
    xSemaphoreGive(g_sdBusMx);
    Serial.printf("F %s %lu %lu\n", name, (unsigned long)size, (unsigned long)(size ? usedBytes(path, size) : 0));
    Serial.flush();
}

static void sendFrame(uint32_t off, uint8_t status, uint16_t n) {
    s_frame[0] = 0xA5; s_frame[1] = 0x5A;
    s_frame[2] = (uint8_t)n; s_frame[3] = (uint8_t)(n >> 8);
    memcpy(s_frame + 4, &off, 4);
    s_frame[8] = status;
    const uint16_t c = rec::crc16(s_frame, 9u + n);
    s_frame[9 + n] = (uint8_t)c; s_frame[10 + n] = (uint8_t)(c >> 8);
    Serial.write(s_frame, 11u + n);
}

static void closeFile() {
    if (s_file) s_file.close();
    s_name[0] = 0;
}

// Deja los datos en s_frame + 9. Devuelve los bytes leidos, 0 en el fin de archivo, -1 si hubo error.
static int readChunk(const char *name, uint32_t off, uint32_t max) {
    xSemaphoreTake(g_sdBusMx, portMAX_DELAY);
    if (strcmp(name, s_name) != 0 || !s_file) {
        closeFile();
        char path[NAME_MAX_LEN + 1];
        snprintf(path, sizeof(path), "/%s", name);
        s_file = SD.open(path, FILE_READ);
        if (s_file) { strncpy(s_name, name, sizeof(s_name) - 1); s_pos = 0xFFFFFFFFUL; }
    }
    int got = -1;
    if (s_file) {
        const bool ok = (off == s_pos) || s_file.seek(off);
        got = ok ? s_file.read(s_frame + 9, max) : -1;
        if (got > 0) s_pos = off + (uint32_t)got;
        else if (got < 0 || off < (uint32_t)s_file.size()) { got = -1; closeFile(); }    // tras un error, reabrir en el reintento
    }
    xSemaphoreGive(g_sdBusMx);
    return got;
}

static void cmdSend(const char *name, uint32_t off, uint32_t remaining) {
    while (remaining) {
        if (Serial.available()) return;                  // el PC corta el envio; lo recibido se lee como comando
        const int got = readChunk(name, off, remaining < CHUNK ? remaining : CHUNK);
        if (got < 0) { sendFrame(off, 2, 0); return; }
        if (got == 0) break;
        sendFrame(off, 0, (uint16_t)got);
        off += (uint32_t)got;
        remaining -= (uint32_t)got;
        vTaskDelay(1);                                   // leer la SD es por sondeo: ceder CPU; la interrupcion sigue vaciando el anillo USB
    }
    sendFrame(off, 1, 0);
}

void logDownloadServe() {
    const bool stopped = loggerStop(5000);
    Serial.flush();                                      // el anillo se recrea vacio; el bucle principal, unico que escribe, esta aqui
    if (!Serial.setTxBufferSize(USB_TX_RING)) Serial.setTxBufferSize(USB_TX_RING_DEFAULT);
    Serial.printf("TBDL %s\n", stopped ? "OK" : "ERROR");
    Serial.flush();
    char line[NAME_MAX_LEN + 36];
    size_t n = 0;
    uint32_t lastCmd = millis();
    for (;;) {
        if (!Serial.available()) {
            // Un cohete no debe quedar sin registrar por olvidar el reinicio
            if (millis() - lastCmd > IDLE_RESTART_MS) ESP.restart();
            vTaskDelay(1);
            continue;
        }
        lastCmd = millis();
        const int c = Serial.read();
        if (c != '\n' && c != '\r') {
            if (n < sizeof(line) - 1) line[n++] = (char)c;
            continue;
        }
        if (n == 0) continue;
        line[n] = 0; n = 0;

        char name[NAME_MAX_LEN];
        unsigned long off = 0, cnt = 0;
        if (!stopped) Serial.print("TBDL ERROR\n");              // sin logger detenido no se toca la SD
        else if (strcmp(line, "LIST") == 0) cmdList();
        else if (sscanf(line, "USED %63s", name) == 1) cmdUsed(name);
        else if (sscanf(line, "SEND %63s %lu %lu", name, &off, &cnt) == 3) cmdSend(name, (uint32_t)off, (uint32_t)cnt);
        else if (strcmp(line, "RESET") == 0) { Serial.print("TBDL RESET\n"); Serial.flush(); delay(100); ESP.restart(); }
        else if (strcmp(line, "PING") == 0) Serial.print("TBDL OK\n");
        lastCmd = millis();                                      // un envio largo no debe contar como inactividad
    }
}
