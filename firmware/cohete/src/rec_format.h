// rec_format.h - Formato de registro (SD y anillos). C++11, sin dependencias de ESP32.
//
//  [magic 2][len 2][type 1][src 1][t_us 8]  [payload len-16]  [crc16 2]      (little endian)
//   magic = A5 5A, len = bytes totales del registro, t_us = reloj local monotono (esp_timer) en us,
//   crc16 = CCITT-FALSE (0x1021, init 0xFFFF) sobre cabecera + payload.
//  El flujo es autodelimitado: si se corrompe un tramo, se busca el siguiente A5 5A con CRC valido.
#pragma once
#include <stdint.h>
#include <stddef.h>
#include <string.h>

namespace rec {

static const uint16_t MAGIC    = 0x5AA5;
static const uint16_t HDR_SIZE = 14;
static const uint16_t CRC_SIZE = 2;
static const uint16_t MAX_LEN  = 512;

enum Type : uint8_t { T_PVT = 1, T_PPS = 2, T_LINK = 3, T_HEARTBEAT = 4, T_FILEHDR = 5, T_IMU = 6, T_MAG = 7, T_BAR = 8, T_BARCAL = 9, T_EXT_LSM = 10, T_EXT_MMC = 11, T_MISSION = 12, T_PI = 13, T_AMB = 14, T_CAL = 15, T_EKF = 16, T_EVENT = 250 };
enum Src  : uint8_t { S_IN_IMU = 0, S_IN_MAG = 1, S_IN_BAR = 2, S_IN_GNSS = 3, S_IN_RTC = 4, S_IN_PMU = 5,
                      S_EX_IMU = 6, S_EX_BAR = 7, S_EX_MAG = 8, S_SYS = 15 };

#pragma pack(push, 1)
struct Hdr { uint16_t magic; uint16_t len; uint8_t type; uint8_t src; int64_t t_us; };
// payload de T_PPS (flanco PPS y su asociacion)
struct PpsRec { int64_t t_edge_us; int64_t utc_sec; uint8_t used; uint8_t fix; uint16_t pad; uint32_t tacc_ns; };
// payload de T_HEARTBEAT (1 por segundo, escrito por el logger)
struct HbRec { uint32_t uptime_ms; uint32_t drops[4]; uint32_t write_max_us; uint32_t flush_max_us; uint32_t bytes;
               uint8_t time_flags; uint8_t spare_state; uint8_t spare_pct; uint8_t pad; };
// payload de T_FILEHDR (primer registro de cada archivo)
struct FileHdrRec { char magic[4]; uint16_t version; uint16_t rocket_id; uint32_t mission_id; uint32_t boot_count;
                    uint32_t file_idx; int64_t utc_us; char fw[16];          // fw = fecha de compilacion
                    char env[16]; char git[12]; int8_t tx_dbm; uint8_t flags; uint8_t pad[2]; };   // v2: entorno de PlatformIO, commit (+ = con cambios), potencia LoRa
// v3: flags bit0 FH_CONTINUA = el archivo sigue al anterior del mismo registro (cambio de archivo al llenarse), no empieza uno nuevo
enum FileHdrFlags : uint8_t { FH_CONTINUA = 1 };
// payload de T_IMU: lote crudo del FIFO del QMI8658 (cnt muestras de 6 x int16: ax ay az gx gy gz, ejes del chip)
//   n0 = indice absoluto de la primera muestra (salta si se perdieron muestras: IF_GAP); t_isr = instante local de la interrupcion del lote (tambien en la cabecera);
//   t_first = instante local ESTIMADO de la primera muestra; period = periodo estimado (us); dev_ts = sin uso (el registro del chip lee 0 en modo FIFO).
struct ImuRec { uint32_t n0; uint16_t cnt; uint8_t flags; uint8_t acc_fs_g; int64_t t_isr_us; int64_t t_first_us;
                double period_us; uint32_t dev_ts; uint16_t read_us; uint16_t gyr_fs_dps; };
enum ImuFlags : uint8_t { IF_FULL = 1, IF_EST_OK = 2, IF_POLLED = 4, IF_CONT = 8, IF_REJECT = 16, IF_GAP = 32 };
// payload de T_EXT_LSM: lote crudo del FIFO del LSM6DSO32, cnt palabras de 7 bytes (tag + 6 datos): acel, giro, marca del chip y BMP581 por el hub.
//   n0 = indice de la primera ranura; t_first = instante local estimado de esa ranura; t_us de la cabecera = interrupcion del lote. IF_FULL = FIFO sobrescrito.
struct ExtLsmRec { uint32_t n0; uint16_t cnt; uint8_t flags; uint8_t acc_fs_g; int64_t t_first_us; float period_us; uint16_t read_us; uint16_t gyr_fs_dps; };
// payload de T_EVENT: incidente de SD. t_us = cuando ocurrio (la cabecera dice cuando se pudo escribir); pos = posicion en ese archivo;
//   dur_us = duracion de la operacion; err = errno; file: 0 activo, 1 reserva.
struct EventRec { int64_t t_us; uint32_t pos; uint32_t dur_us; int16_t err; uint8_t file; uint8_t code; };
enum EventCode : uint8_t { EV_WRITE_FAIL = 1, EV_REOPEN_OK = 2, EV_REOPEN_FAIL = 3 };
// payload de T_MISSION: comando atendido o cambio de estado. op 0 = automatico; to = estado despues; reasons = bits de net::Reason.
struct MissionRec { uint32_t counter; uint32_t reasons; uint8_t op; uint8_t arg; uint8_t result; uint8_t from; uint8_t to; uint8_t moment; uint8_t flags; uint8_t pad; };
// payload de T_PI: la UART con la Pi de Demeter (ext_pi). kind: PIK_CHANGE = la Pi informo otro estado, PIK_LOST = se perdio su latido
//   (status = PI_DESCONOCIDO, 0xFF), PIK_CMD = se le mando un comando (prev = el comando, pad = el intento, status = el estado de la Pi).
//   prev = el estado anterior en los otros; en PIK_CHANGE, pad = el motivo del error de la Pi (D-056). Contadores acumulados desde el arranque.
struct PiRec { uint8_t status; uint8_t prev; uint8_t kind; uint8_t pad; uint32_t rx_frames; uint32_t crc_err; uint32_t tx_pose; };
enum PiKind : uint8_t { PIK_CHANGE = 1, PIK_LOST = 2, PIK_CMD = 3 };
// payload de T_AMB: temperatura del suelo (amb_temp). evento 1 = muestra tomada en frio, 3 = copia al empezar a registrar.
//   t_bmp/t_bme = media de los primeros segundos de la ventana; pend_* en C/min; t_usada = la que usa la altura barometrica;
//   utc_ms = hora de la muestra (0 sin hora); fuente amb::Fuente; calidad amb::Calidad; arm = amb::ArmBits en ese instante;
//   t_*_ahora = lecturas de ese instante (NaN sin sensor).
struct AmbRec { float t_bmp; float t_bme; float t_usada; float pend_bmp; float pend_bme; int64_t utc_ms; float t_bmp_ahora; float t_bme_ahora;
                uint8_t fuente; uint8_t calidad; uint8_t evento; uint8_t arm; };
// payload de T_CAL: calibracion a bordo (cal_onboard, D-059). evento 1 resultado listo, 2 aplicada por radio, 3 aplicada por USB,
//   4 vuelta a la anterior, 5 copia al empezar a registrar, 6 error del analisis. crc_activo = la calibracion en uso desde ese momento.
struct CalRec { uint32_t crc_activo; uint32_t crc_resultado; uint32_t avisos; uint8_t evento; uint8_t estado; uint8_t n_pos; uint8_t ok; };
// payload de T_EKF: estado del EKF a bordo (ekf_task, D-060) a 50 Hz; t_us de la cabecera = instante del estado (el filtro va ~300 ms
//   atrasado: es su mejor estimacion). q cuerpo FRD -> NED (Hamilton); p NED (m) desde el origen; v NED (m/s); bg (dps), ba (g), sg (fraccion);
//   b_bmp (m); sd_* 1 sigma (grados, m, m/s); origen (lat0, lon0 en grados, h0 MSL en m). flags: bit0 listo, bit1 hay origen, bit2 calibrado.
struct EkfRec { float q[4], p[3], v[3], bg[3], ba[3], sg[3], b_bmp, alt_baro, sd_th[3], sd_p[3], sd_v[3];
                double lat0, lon0; float h0; uint8_t fase, flags; uint16_t gnss_ok, baro_ok, mag_ok, grav_ok, rechazos; };
static_assert(sizeof(EkfRec) == 152, "EkfRec mide 152 B: tblog.EKF_FMT");
// payload de T_LINK: un evento de radio; t_us de la cabecera = fin de TX o RX. slot 0xFF = fuera de ranuras (baliza lenta).
struct LinkRec { uint8_t dir; uint8_t slot; uint8_t len; uint8_t pad; int16_t rssi_x10; int16_t snr_x10; int32_t late_us; uint32_t air_us; };
enum LinkDir : uint8_t { LD_TX = 0, LD_RX = 1 };
// payload de T_MAG: QMC6309 crudo, ejes del chip; t_us de la cabecera = deteccion de DRDY.
struct MagRec { int16_t x, y, z; uint8_t flags; uint8_t fs_gauss; };
enum MagFlags : uint8_t { MF_OVFL = 1 };
// payload de T_EXT_MMC: MMC5983MA, 16384 cuentas/G con el cero en 0, ejes del chip; t_us de la cabecera = deteccion del dato listo.
//   MMCF_CAL_*: medicion suelta del par SET/RESET al iniciar, no es del flujo a 100 Hz.
struct ExtMmcRec { int32_t x, y, z; uint8_t flags; uint8_t pad; };
enum MmcFlags : uint8_t { MMCF_SAT = 1, MMCF_CAL_SET = 2, MMCF_CAL_RESET = 4 };
// payload de T_BAR: BME280 crudo y compensado; t_us de la cabecera = fin de la medicion, t_trig = inicio.
struct BarRec { int64_t t_trig_us; uint32_t adc_p; uint32_t adc_t; uint16_t adc_h; uint16_t pad; float press_pa; float temp_c; float hum_pct; };
// payload de T_BARCAL: calibracion del BME280 tal como sale del chip (0x88..0xA1 y 0xE1..0xE7).
struct BarCalRec { uint8_t chip_id; uint8_t addr; uint8_t cal1[26]; uint8_t cal2[7]; };
#pragma pack(pop)

inline uint16_t crc16(const uint8_t *d, size_t n, uint16_t c = 0xFFFF) {
    static const uint16_t T[16] = {0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50A5, 0x60C6, 0x70E7,
                                   0x8108, 0x9129, 0xA14A, 0xB16B, 0xC18C, 0xD1AD, 0xE1CE, 0xF1EF};
    while (n--) {
        const uint8_t b = *d++;
        c = (uint16_t)((c << 4) ^ T[((c >> 12) ^ (b >> 4)) & 0x0F]);
        c = (uint16_t)((c << 4) ^ T[((c >> 12) ^ b) & 0x0F]);
    }
    return c;
}

// Construye un registro en out (>= HDR_SIZE+n+CRC_SIZE bytes). Devuelve su longitud.
inline uint16_t build(uint8_t *out, uint8_t type, uint8_t src, int64_t t_us, const void *payload, uint16_t n) {
    const uint16_t len = (uint16_t)(HDR_SIZE + n + CRC_SIZE);
    Hdr h; h.magic = MAGIC; h.len = len; h.type = type; h.src = src; h.t_us = t_us;
    memcpy(out, &h, HDR_SIZE);
    if (n) memcpy(out + HDR_SIZE, payload, n);
    const uint16_t c = crc16(out, (size_t)HDR_SIZE + n);
    out[HDR_SIZE + n] = (uint8_t)c;
    out[HDR_SIZE + n + 1] = (uint8_t)(c >> 8);
    return len;
}

// Devuelve la longitud si en r hay un registro completo y valido; 0 si no.
inline uint16_t check(const uint8_t *r, uint32_t avail) {
    if (avail < (uint32_t)(HDR_SIZE + CRC_SIZE)) return 0;
    if ((uint16_t)(r[0] | (r[1] << 8)) != MAGIC) return 0;
    const uint16_t len = (uint16_t)(r[2] | (r[3] << 8));
    if (len < HDR_SIZE + CRC_SIZE || len > MAX_LEN || len > avail) return 0;
    const uint16_t c = crc16(r, (size_t)len - CRC_SIZE);
    if ((uint16_t)(r[len - 2] | (r[len - 1] << 8)) != c) return 0;
    return len;
}

} // namespace rec
