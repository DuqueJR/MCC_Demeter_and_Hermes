#pragma once
// arnes_mision.h - Lo que mission.cpp necesita del resto del firmware, de mentira, para correrlo en el PC con un reloj virtual de 20 ms.
// Lo comparten prueba_mision.cpp (los escenarios de T-410, T-411 y T-413) y replay/prueba_replay.cpp (el banco de replay, T-305): si mission.cpp gana una
// dependencia nueva, se agrega aqui, una sola vez. Cada programa lo incluye en UNA unidad de compilacion (define funciones y variables).
//
// Lo que difiere entre los dos programas entra por ganchos (punteros a funcion, nulos por omision):
//   g_alTick     cada espera de la tarea de mision = un paso de 20 ms (quien lo pone avanza g_nowUs y puede lanzar Parar para terminar)
//   g_alRegistrar loggerRecord(on)        g_alResp  netQueueResp(resp)        g_alPin  digitalWrite(pin, nivel)
// Define ARNES_EXT_BAR_REAL antes de incluirlo si se enlaza el ext_bmp.cpp real (que ya define g_ext_bar).
#include <Arduino.h>
#include <esp_timer.h>
#include <Preferences.h>
#include <driver/gpio.h>
#include <stdint.h>
#include <string.h>
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
#include "logger.h"
#include "net_radio.h"

// ---------- Reloj virtual y colas ----------
static int64_t g_nowUs = 1000000;
int64_t esp_timer_get_time() { return g_nowUs; }
uint32_t millis() { return (uint32_t)(g_nowUs / 1000); }
void vTaskDelay(TickType_t) {}                                 // lo referencia extBmpConfigure (no se llama)

struct Cola { size_t item; std::deque<std::vector<uint8_t> > d; };
static Cola *g_cmdQ = nullptr, *g_logQ = nullptr;
static void (*g_taskFn)(void *) = nullptr;
struct Parar {};
static void (*g_alTick)() = nullptr;
static void (*g_alRegistrar)(bool) = nullptr;
static void (*g_alResp)(const net::CmdResp &) = nullptr;
static void (*g_alPin)(int, int) = nullptr;

QueueHandle_t xQueueCreate(int, int item) {
    Cola *c = new Cola; c->item = (size_t)item;
    if (!g_cmdQ) g_cmdQ = c; else g_logQ = c;                  // missionBegin crea primero la de comandos y luego la del registro
    return c;
}
BaseType_t xQueueSend(QueueHandle_t q, const void *p, TickType_t) {
    Cola *c = (Cola *)q;
    c->d.push_back(std::vector<uint8_t>((const uint8_t *)p, (const uint8_t *)p + c->item));
    return pdTRUE;
}
BaseType_t xQueueReceive(QueueHandle_t q, void *p, TickType_t) {
    Cola *c = (Cola *)q;
    if (c == g_cmdQ && g_alTick) g_alTick();                   // la espera de la tarea de mision = un paso de 20 ms
    if (c->d.empty()) return pdFALSE;
    memcpy(p, c->d.front().data(), c->item);
    c->d.pop_front();
    return pdTRUE;
}
BaseType_t xTaskCreatePinnedToCore(void (*f)(void *), const char *, uint32_t, void *, int, TaskHandle_t *, int) { g_taskFn = f; return pdTRUE; }

// ---------- NVS de mentira: espacio/clave -> bytes (quien quiera que sobreviva a un "reinicio" la vuelca a un archivo) ----------
static std::map<std::string, std::vector<uint8_t> > g_nvs;
static int g_nvsVuelo = 0;                                     // escrituras del registro de vuelo ("tbmis/vuelo")
static std::string clave(const Preferences *p, const char *k) { return std::string(p->ns_) + "/" + k; }
bool Preferences::begin(const char *ns, bool) { ns_ = ns; return true; }
void Preferences::end() {}
size_t Preferences::putBytes(const char *k, const void *v, size_t n) {
    g_nvs[clave(this, k)] = std::vector<uint8_t>((const uint8_t *)v, (const uint8_t *)v + n);
    if (clave(this, k) == "tbmis/vuelo") g_nvsVuelo++;
    return n;
}
size_t Preferences::getBytes(const char *k, void *v, size_t max) {
    std::map<std::string, std::vector<uint8_t> >::iterator it = g_nvs.find(clave(this, k));
    if (it == g_nvs.end()) return 0;
    const size_t n = std::min(max, it->second.size());
    memcpy(v, it->second.data(), n);
    return n;
}
bool Preferences::remove(const char *k) { return g_nvs.erase(clave(this, k)) > 0; }
uint32_t Preferences::getUInt(const char *k, uint32_t d) { uint32_t v = d; getBytes(k, &v, sizeof(v)); return v; }
uint32_t Preferences::getULong(const char *k, uint32_t d) { return getUInt(k, d); }
void Preferences::putULong(const char *k, uint32_t v) { putBytes(k, &v, sizeof(v)); }
uint8_t Preferences::getUChar(const char *k, uint8_t d) { uint8_t v = d; getBytes(k, &v, 1); return v; }
size_t Preferences::putUChar(const char *k, uint8_t v) { return putBytes(k, &v, 1); }
static bool g_horaOk = true;                                   // hay hora UTC (el modelo de tiempo de core_bus): el UTC es el reloj local + 1,7e15 us
static const int64_t UTC_OFFSET_US = 1700000000000000LL;
int64_t time_to_utc_us(int64_t t) { return g_horaOk ? t + UTC_OFFSET_US : -1; }

// ---------- Resto de dependencias de mission.cpp ----------
Latest<ImuSample>    g_ext_imu, g_imu;
#ifndef ARNES_EXT_BAR_REAL
Latest<ExtBarSample> g_ext_bar;
#endif
Latest<BarSample>    g_bar;
Latest<GnssSample>   g_gnss;
volatile uint16_t    g_vbat_mv = 4000;

static std::vector<int> g_rec;                                 // llamadas a loggerRecord: 1 = true, 0 = false
static int  g_prepare = 0;
static int  g_prealloc = -1, g_flying = -1;                    // ultimo valor de loggerAllowPrealloc y de netSetFlying (-1: nunca se llamo)
static net::CmdResp g_resp;
static bool g_haveResp = false;
LoggerStats loggerStats() { LoggerStats l; memset(&l, 0, sizeof(l)); l.state = 2; l.spareState = 2; l.sparePct = 100; return l; }
void loggerRecord(bool on) { g_rec.push_back(on ? 1 : 0); if (g_alRegistrar) g_alRegistrar(on); }
void loggerPrepare() { g_prepare++; }
void loggerAllowPrealloc(bool a) { g_prealloc = a ? 1 : 0; }
void netSetFlying(bool f) { g_flying = f ? 1 : 0; }
static uint8_t g_piStatus = 0x02;                              // la Pi en READY: ARM apto en Demeter (D-055)
uint8_t piStatus() { return g_piStatus; }
static uint8_t g_ambBits = 0;                                  // temperatura del suelo valida: ARM apto (D-058)
float ambTempC() { return 15.0f; }
uint8_t ambArmBits() { return g_ambBits; }
void ambStep(uint32_t) {}
// calibracion a bordo (D-059): sin resultado ni anterior
bool calAnalizando() { return false; }
bool calListo() { return false; }
bool calListoConAvisos() { return false; }
uint8_t calEstado() { return 0; }
bool calHayAnterior() { return false; }
bool calAnalizar() { return true; }
bool calAplicar() { return false; }
void calDescartar() {}
bool calAnterior() { return false; }
void calStep(uint32_t) {}
LoggerRecInfo loggerRecInfo() { LoggerRecInfo i; memset(&i, 0, sizeof(i)); return i; }
void netQueueResp(const net::CmdResp &r) { g_resp = r; g_haveResp = true; if (g_alResp) g_alResp(r); }
DrvStats extDrvStats() { DrvStats d; d.magnet = false; d.detections = 0; return d; }

// ---------- Pines de los actuadores (T-413): cada escritura se registra con la hora virtual ----------
struct PinEv { int64_t ms; int pin, nivel; };
static std::vector<PinEv> g_pins;
static int g_holdEn[64], g_holdDis[64], g_sleepHoldEn = 0, g_sleepHoldDis = 0;
void pinMode(int, int) {}
void digitalWrite(int pin, int nivel) { PinEv e = {g_nowUs / 1000, pin, nivel}; g_pins.push_back(e); if (g_alPin) g_alPin(pin, nivel); }
int  gpio_hold_en(gpio_num_t p) { g_holdEn[p]++; return 0; }
int  gpio_hold_dis(gpio_num_t p) { g_holdDis[p]++; return 0; }
void gpio_deep_sleep_hold_en(void) { g_sleepHoldEn++; }
void gpio_deep_sleep_hold_dis(void) { g_sleepHoldDis++; }
