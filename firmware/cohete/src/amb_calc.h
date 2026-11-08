// amb_calc.h - Temperatura del suelo para la altura barometrica (C++11 puro, sin Arduino: se prueba en el PC).
//   La altura barometrica depende de la temperatura del aire: con la atmosfera estandar (15 C) y 31 C en el sitio, la altura sale ~5.5 %
//   alta (37 m a 670 m). La temperatura sale del BMP581 (Pablo, 2026-11-05): se toma "en frio", en los primeros segundos tras encender o
//   tras un sueno largo, antes de que la electronica, la radio a 22 dBm y la Pi la calienten. El BME280, en la placa, sirve de contraste.
//   Umbrales PROVISIONALES: se ajustan con la curva de calentamiento medida con el cohete cerrado (parte de la calibracion guiada).
#pragma once
#include <stdint.h>
#include <math.h>

namespace amb {

static const float    T_ESTANDAR_C     = 15.0f;   // sin muestra: atmosfera estandar
static const uint32_t FRIO_MIN_S       = 1800;    // dormida o apagada al menos esto: la electronica ya esta a la temperatura del aire
static const uint32_t VENTANA_INI_MS   = 3000;    // la muestra empieza a los 3 s del arranque (sensores listos)
static const uint32_t VENTANA_MS       = 20000;   // y dura 20 s, a una lectura por segundo
static const uint8_t  MIN_LECTURAS     = 8;
static const float    DIF_MAX_C        = 2.0f;    // BMP contra BME en la muestra (en banco: el BME lee 0.5-1.5 C mas)
static const float    PENDIENTE_MAX_CMIN = 0.10f; // C/min: si sube mas rapido, ya se esta calentando
static const float    ARM_DIF_C        = 6.0f;    // al armar: el BMP de ahora contra la muestra (calentamiento + cambio del dia)
static const float    ARM_BMP_BME_C    = 4.0f;    // al armar: BMP contra BME de ahora
static const uint32_t ARM_VIEJA_S      = 12 * 3600;

enum Fuente : uint8_t { F_NINGUNA = 0, F_SUENO = 1, F_ENCENDIDO = 2, F_MANO = 3 };   // F_MANO: por el comando de calibracion (NVS)
enum Calidad : uint8_t { Q_BUENA = 0, Q_DUDOSA = 1 };

// Acumula una serie (tiempo en s, valor) para la media de los primeros segundos y la pendiente por minimos cuadrados.
struct Serie {
    float st = 0, sv = 0, stt = 0, stv = 0, v0 = 0;
    uint8_t n = 0, n0 = 0;
    void add(float t, float v) {
        st += t; sv += v; stt += t * t; stv += t * v; n++;
        if (t < 3.5f) { v0 += v; n0++; }                    // los primeros ~3 s: la temperatura antes de calentarse
    }
    float primeros() const { return n0 ? v0 / n0 : (n ? sv / n : NAN); }
    float pendienteCmin() const {                          // C por minuto
        const float d = n * stt - st * st;
        return (n >= 3 && d > 1e-6f) ? 60.0f * (n * stv - st * sv) / d : 0.0f;
    }
};

struct Muestra {
    float    t_bmp, t_bme, t_usada, pend_bmp, pend_bme;   // C, C, C, C/min, C/min (NAN si el sensor no respondio)
    uint8_t  fuente, calidad, n_bmp, n_bme;
};

// Con las dos series de la ventana, la muestra: el BMP si es coherente con el BME y no se esta calentando; si no, la menor de las dos
// (el calentamiento solo sube la temperatura) y marcada dudosa.
inline Muestra evaluar(const Serie &bmp, const Serie &bme, uint8_t fuente) {
    Muestra m;
    m.t_bmp = bmp.n >= MIN_LECTURAS ? bmp.primeros() : NAN;
    m.t_bme = bme.n >= MIN_LECTURAS ? bme.primeros() : NAN;
    m.pend_bmp = bmp.n >= MIN_LECTURAS ? bmp.pendienteCmin() : NAN;
    m.pend_bme = bme.n >= MIN_LECTURAS ? bme.pendienteCmin() : NAN;
    m.fuente = fuente; m.n_bmp = bmp.n; m.n_bme = bme.n;
    const bool hayBmp = !isnan(m.t_bmp), hayBme = !isnan(m.t_bme);
    if (hayBmp && hayBme && fabsf(m.t_bmp - m.t_bme) <= DIF_MAX_C && fabsf(m.pend_bmp) <= PENDIENTE_MAX_CMIN) {
        m.t_usada = m.t_bmp; m.calidad = Q_BUENA;
    } else {
        m.calidad = Q_DUDOSA;
        m.t_usada = hayBmp && hayBme ? fminf(m.t_bmp, m.t_bme) : (hayBmp ? m.t_bmp : (hayBme ? m.t_bme : T_ESTANDAR_C));
    }
    return m;
}

// Motivos para no armar (bits de abajo; mission los convierte en RZ_TEMP): sin muestra, dudosa, vieja, o el BMP de ahora muy lejos
// de la muestra o del BME de ahora.
enum ArmBits : uint8_t { AB_SIN = 1, AB_DUDOSA = 2, AB_VIEJA = 4, AB_DERIVA = 8, AB_BMP_BME = 16 };
// Solo lo que es de la muestra guardada pide confirmar al armar (RZ_TEMP): no cambia mientras se arma. AB_DERIVA y AB_BMP_BME comparan
// lecturas de ahora, que suben y bajan con el calentamiento de la electronica y el sol: eran inestables y la confirmacion fallaba
// porque los motivos cambiaban entre el pedido y el "si" (D-063). Quedan como avisos en tierra.
static const uint8_t AB_BLOQUEA = AB_SIN | AB_DUDOSA | AB_VIEJA;
inline uint8_t revisarArmado(bool hay, const Muestra &m, int64_t edad_s, float t_bmp_ahora, float t_bme_ahora) {
    if (!hay) return AB_SIN;
    uint8_t b = 0;
    if (m.calidad != Q_BUENA && m.fuente != F_MANO) b |= AB_DUDOSA;
    if (edad_s >= 0 && edad_s > (int64_t)ARM_VIEJA_S) b |= AB_VIEJA;
    if (!isnan(t_bmp_ahora) && fabsf(t_bmp_ahora - m.t_usada) > ARM_DIF_C) b |= AB_DERIVA;
    if (!isnan(t_bmp_ahora) && !isnan(t_bme_ahora) && fabsf(t_bmp_ahora - t_bme_ahora) > ARM_BMP_BME_C) b |= AB_BMP_BME;
    return b;
}

// Altura barometrica sobre p0 con la temperatura del suelo (formula hipsometrica con gradiente estandar de 6.5 C/km)
inline float altura(float p, float p0, float t_suelo_c) {
    return (t_suelo_c + 273.15f) / 0.0065f * (1.0f - powf(p / p0, 0.190263f));
}

} // namespace amb
