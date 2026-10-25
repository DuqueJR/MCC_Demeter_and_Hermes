ESTADOS MISION PRINICIPAL:

BOOT
PREFLIGHT
ARMED

BOOST
COAST
APOGEE

FREE_FALL
DESCENT

LANDED

ERROR

Frecuencia      915 MHz
Sync Word       0xD3

Bandwidth       250 kHz
SpreadingFactor 7
CodingRate      4/5

CRC             ON
Preamble        8

Payload         63 bytes
Frecuencia TX   10 Hz

TDMA GNSS sincronizado

Rocket ID 1     Demeter
Rocket ID 2     Hermes

Mission ID      uint32

UTC GPS         uint64 ms

desfase de transmisiones: 

0 ms   -> Slot Tierra

25 ms  -> Slot Demeter

50 ms  -> Slot Hermes

75 ms  -> Reserva/Futuro

para evitar colisiones y soportar comunicacion bidireccional con ambos cohetes en simultaneo

usando TDMA con ciclo de 100ms

y se transmite:
============

// DEMETER TELEMETRY V1

// Cohete -> Estación Terrena
// Frecuencia objetivo: 10 Hz
// Tamaño total: 63 bytes

============================================================

typedef struct __attribute__((packed))

{

    // ---------- Identificación y tiempo ----------

    uint64_t timestamp_utc_ms;       // 8 bytes
    uint32_t mission_id;             // 4 bytes
    uint16_t rocket_id;              // 2 bytes

    // ---------- Posición ----------

    int32_t latitude_e7;             // 4 bytes
    int32_t longitude_e7;            // 4 bytes
    int32_t altitude_cm;             // 4 bytes

    // ---------- Velocidad ----------

    int16_t velocity_n_cmps;         // 2 bytes
    int16_t velocity_e_cmps;         // 2 bytes
    int16_t velocity_z_cmps;         // 2 bytes

    // ---------- Actitud ----------

    int16_t q_w;                     // 2 bytes
    int16_t q_x;                     // 2 bytes
    int16_t q_y;                     // 2 bytes
    int16_t q_z;                     // 2 bytes

    // ---------- Dinámica lineal ----------

    int16_t accel_x_mg;              // 2 bytes
    int16_t accel_y_mg;              // 2 bytes
    int16_t accel_z_mg;              // 2 bytes

    // ---------- Dinámica angular ----------

    int16_t gyro_x_cdegps;           // 2 bytes
    int16_t gyro_y_cdegps;           // 2 bytes
    int16_t gyro_z_cdegps;           // 2 bytes

    // ---------- Navegación ----------

    uint16_t nav_correction_cm;      // 2 bytes

    // ---------- Energía ----------

    uint8_t battery_percent;         // 1 byte

    // ---------- Temperaturas ----------

    int8_t esp32_temp_c;             // 1 byte
    int8_t rpi_temp_c;               // 1 byte

    // ---------- Estados ----------

    uint8_t mission_primary_state;   // 1 byte
    uint8_t mission_secondary_state; // 1 byte

    // ---------- Actuadores ----------

    uint16_t actuator_bitmap;        // 2 bytes

    // ---------- Integridad ----------

    uint16_t crc16;                  // 2 bytes

} TelemetryV1;