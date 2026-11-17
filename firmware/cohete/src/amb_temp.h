// amb_temp.h - Temperatura del suelo (amb_calc.h): muestra en frio al arrancar, guardada en NVS, revisada al armar y usada para la
//   altura barometrica de la mision (y del EKF a bordo cuando exista).
//   "En frio": tras un encendido (ESP_RST_POWERON) o tras dormir al menos amb::FRIO_MIN_S; en otro arranque (reset, USB) se conserva la
//   muestra anterior de la NVS. La hora del sueno se toma con gettimeofday, que sigue corriendo en el sueno profundo.
//   Lo llama la tarea de mision (ambStep, cada 20 ms); el bucle principal llama ambSleep antes de dormir.
#pragma once
#include <stdint.h>
#include "amb_calc.h"
#include "rec_format.h"

struct AmbInfo {
    bool     hay;               // hay una muestra (de este arranque o de la NVS)
    bool     tomando;           // la ventana de la muestra esta abierta
    bool     deEsteArranque;
    amb::Muestra m;
    int64_t  edad_s;            // desde la muestra; -1 si no se sabe (sin hora UTC)
    float    t_bmp, t_bme, p_bmp;   // ahora (NAN si el sensor no responde)
    uint8_t  armBits;           // amb::ArmBits de ahora
};

struct AmbLog { int64_t t_us; rec::AmbRec r; };

void    ambBegin();                     // antes de missionBegin: lee la NVS y decide si este arranque es frio
void    ambStep(uint32_t nowMs);        // tarea de mision
void    ambSleep();                     // justo antes del sueno profundo
float   ambTempC();                     // la temperatura del suelo para la altura (la muestra, o 15 C sin muestra)
uint8_t ambArmBits();                   // 0 si la temperatura sirve para armar
AmbInfo ambInfo();
bool    ambTakeLog(AmbLog &l);
