// mission_config.h - Valores de mision por cohete. Se cambian aqui y se recompila: un comando no puede alterarlos en campo.
// Base: simulaciones en common/Simulaciones (Demeter 1.469 kg, Hermes 1.157 kg). Tiempos en s desde BOOST; los margenes son provisionales.
#pragma once
#include <stdint.h>

struct MissionCfg {
    float    boost_dv_mps;     // BOOST: exceso de aceleracion sobre 1 g, integrado con |a| > 2 g
    float    jump_m, jump_s;   // BOOST: salto de altura del BMP en esta ventana
    float    t_burn_max;       // COAST a mas tardar. Sim: Demeter 2.07, Hermes 1.81
    float    t_apogeo_min;     // antes de esto no se acepta apogeo: presion dinamica. Sim: 11.54 y 9.26
    float    t_apogeo_max;     // APOGEO a mas tardar
    float    t_para_max;       // alerta si no hubo choque de apertura. Carga en la sim: 10.07 y 8.81
    float    t_vuelo_max;      // ATERRIZAJE a mas tardar. Sim: 85 y 56
    float    t_abort;          // desde LAUNCH sin BOOST: solo avisa; el registro sigue hasta abortar o BOOST
    float    t_post;           // registro tras aterrizar
    uint16_t vbat_arm_mv;      // por debajo, ARM no es apto. Provisional: falta medir el consumo
};

// Deteccion de BOOST (T-410, constantes.md seccion 4; los de (P) los revisa Pablo)
static const float    BOOST_ACC_MIN_G = 2.0f;    // el integrador de velocidad solo suma con |a| por encima de esto
static const uint32_t BOOST_RESET_MS  = 50;      // |a| <= BOOST_ACC_MIN_G este tiempo seguido: dv = 0
static const uint8_t  BOOST_BARO_EVAL = 5;       // evaluaciones seguidas (50 Hz) del salto barometrico

inline const MissionCfg &missionCfg(uint8_t rocket) {
    static const MissionCfg DEMETER_CFG = {5.0f, 10.0f, 0.5f, 3.0f, 7.0f, 16.0f, 13.0f, 210.0f, 120.0f, 60.0f, 3700};
    static const MissionCfg HERMES_CFG  = {5.0f, 10.0f, 0.5f, 2.7f, 5.5f, 13.0f, 12.0f, 140.0f, 120.0f, 60.0f, 3700};
    return rocket == 2 ? HERMES_CFG : DEMETER_CFG;
}
