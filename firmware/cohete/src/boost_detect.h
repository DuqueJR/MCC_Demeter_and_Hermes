// boost_detect.h - Deteccion de BOOST (T-410, maquina_estados.md seccion 6). C++11, sin dependencias de ESP32.
// Inercial: integra el exceso sobre 1 g de |a| (cada muestra del IMU, a su tasa) mientras |a| > BOOST_ACC_MIN_G; BOOST con dv >= boost_dv_mps.
// Barometrico (respaldo): salto de altura de jump_m en jump_s, BOOST_BARO_EVAL evaluaciones seguidas.
#pragma once
#include <stdint.h>
#include "mission_config.h"

enum BoostKind : uint8_t { BOOST_NINGUNO = 0, BOOST_INERCIAL = 1, BOOST_BARO = 2 };   // el valor va en el arg del T_MISSION automatico

// Integrador de velocidad. No guarda nada del ESP32: el que lo alimenta le da el instante de cada muestra.
class BoostIntegrator {
public:
    BoostIntegrator() { setTarget(1e9f); reset(); }       // sin objetivo no dispara: missionBegin lo fija
    void  setTarget(float dvMps) { target_ = dvMps; }
    void  reset() { dv_ = 0; hitDv_ = 0; tPrev_ = 0; tBelow_ = 0; havePrev_ = false; below_ = false; }
    bool  feed(int64_t t_us, float acc_g);                // true al llegar a dv >= objetivo; entonces dv vuelve a 0
    float dv() const    { return dv_; }                   // m/s
    float hitDv() const { return hitDv_; }                // dv al disparar, m/s
private:
    float   target_, dv_, hitDv_;
    int64_t tPrev_, tBelow_;
    bool    havePrev_, below_;
};

// Salto barometrico: guarda las ultimas alturas con su instante y compara con la de hace jump_s.
class BoostBaroJump {
public:
    BoostBaroJump() { configure(10.0f, 0.5f, BOOST_BARO_EVAL); }
    void  configure(float jumpM, float jumpS, uint8_t evals) { jumpM_ = jumpM; jumpS_ = jumpS; evals_ = evals; reset(); }
    void  reset() { head_ = 0; n_ = 0; ok_ = 0; jump_ = 0; }
    bool  feed(int64_t t_us, float altM);                 // true mientras se cumplan evals evaluaciones seguidas
    float jump() const { return jump_; }                  // ultimo salto evaluado, m
private:
    enum { CAP = 64 };                                    // 1,28 s a 50 Hz: cubre jump_s <= 1 s
    float    jumpM_, jumpS_, jump_;
    uint8_t  evals_, ok_, head_, n_;
    int64_t  t_[CAP];
    float    h_[CAP];
};

// Aviso entre nucleos: una palabra atomica (tipo en los 4 bits altos, valor en los 28 bajos). El que publica es uno; el que lee, otro.
class BoostFlag {
public:
    BoostFlag() : w_(0) {}
    void    post(uint8_t kind, uint32_t value);
    uint8_t take(uint32_t &value);                        // BOOST_NINGUNO si no hay aviso; lo borra
private:
    volatile uint32_t w_;
};

// ---- Gancho de los consumidores de los IMU. Cada IMU tiene su propio integrador y su aviso ----
void    boostSetTarget(float dvMps);                      // boost_dv_mps del cohete; lo llama missionBegin
void    boostLsmSample(int64_t t_us, const int16_t a[3], float lsbPerG);   // tarea del LSM6DSO32 (nucleo 1), por cada muestra
void    boostQmiSample(int64_t t_us, const int16_t a[3], float lsbPerG);   // tarea del QMI8658C (nucleo 1), por cada muestra
uint8_t boostTakeLsm(uint32_t &dvCms);                    // tarea de mision: BOOST_INERCIAL y dv en cm/s, o BOOST_NINGUNO
uint8_t boostTakeQmi(uint32_t &dvCms);
