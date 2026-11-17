#include "core_bus.h"
#include <esp_heap_caps.h>

Latest<GnssSample> g_gnss;
volatile uint16_t g_vbat_mv = 0;
SemaphoreHandle_t g_sdBusMx = nullptr;

// ---------------- Tiempo ----------------
static TimeModel s_tm;
static Latest<TimeModel> s_tmSnap;
static SemaphoreHandle_t s_tmMx = nullptr;

void time_pps_anchor(int64_t t_local_us, int64_t utc_sec) {
    if (!s_tmMx) return;
    xSemaphoreTake(s_tmMx, portMAX_DELAY);
    s_tm.onPpsAnchor(t_local_us, utc_sec);
    s_tmSnap.set(s_tm);
    xSemaphoreGive(s_tmMx);
}

bool time_link_anchor(int64_t t_local_us, int64_t utc_at_rx_us, int64_t err_floor_us) {
    if (!s_tmMx) return false;
    xSemaphoreTake(s_tmMx, portMAX_DELAY);
    const bool used = s_tm.onLinkAnchor(t_local_us, utc_at_rx_us, err_floor_us);
    s_tmSnap.set(s_tm);
    xSemaphoreGive(s_tmMx);
    return used;
}

bool time_snapshot(TimeModel &out) { return s_tmSnap.get(out); }

int64_t time_to_utc_us(int64_t t_local_us) {
    TimeModel m;
    if (!s_tmSnap.get(m) || !m.valid()) return -1;
    return m.toUtcUs(t_local_us);
}

int64_t time_to_local_us(int64_t utc_us) {
    TimeModel m;
    if (!s_tmSnap.get(m) || !m.valid()) return -1;
    return m.toLocalUs(utc_us);
}

// ---------------- Anillos ----------------
static ByteRing s_ring[RING_COUNT];
static const uint32_t RING_BYTES[RING_COUNT] = { 64 * 1024, 128 * 1024, 32 * 1024, 16 * 1024, 256 * 1024, 32 * 1024 };    // RING_GNSS, RING_IMU, RING_I2C, RING_NET, RING_EXT, RING_EKF

void bus_begin() {
    if (!s_tmMx) s_tmMx = xSemaphoreCreateMutex();
    if (!g_sdBusMx) {
        // Semaforo binario, no mutex: con la herencia de prioridad, cuando el IMU (prio 5) espera el bus, el logger hereda
        // prio 5 y frena a GNSS e I2C en el nucleo 0 mientras dura la escritura SD (pausas de hasta 60 ms, LOG0007).
        g_sdBusMx = xSemaphoreCreateBinary();
        xSemaphoreGive(g_sdBusMx);
    }
    for (int i = 0; i < RING_COUNT; i++) {
        if (s_ring[i].ready()) continue;
        uint32_t cap = RING_BYTES[i];
        uint8_t *mem = (uint8_t *)heap_caps_malloc(cap, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        if (!mem) { cap >>= 2; mem = (uint8_t *)heap_caps_malloc(cap, MALLOC_CAP_8BIT); }   // sin PSRAM: 1/4 en RAM interna
        if (mem) s_ring[i].init(mem, cap);
    }
}

bool bus_log(RingId r, uint8_t type, uint8_t src, int64_t t_us, const void *payload, uint16_t n) {
    if (r >= RING_COUNT || !s_ring[r].ready()) return false;
    if ((uint32_t)n + rec::HDR_SIZE + rec::CRC_SIZE > rec::MAX_LEN) return false;
    uint8_t tmp[rec::MAX_LEN];
    const uint16_t len = rec::build(tmp, type, src, t_us, payload, n);
    return s_ring[r].push(tmp, len);
}

uint32_t bus_ring_used(RingId r)     { return s_ring[r].used(); }
uint32_t bus_ring_drops(RingId r)    { return s_ring[r].drops(); }
uint32_t bus_ring_capacity(RingId r) { return s_ring[r].capacity(); }
uint32_t bus_ring_peek(RingId r, uint8_t *out, uint32_t n) { return s_ring[r].peek(out, n); }
void     bus_ring_consume(RingId r, uint32_t n)            { s_ring[r].consume(n); }
