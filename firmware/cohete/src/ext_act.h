// ext_act.h - Actuadores de IO45 y IO46 (T-413). Este modulo es el dueno de los dos pines.
//   IO46: MOSFET del buzzer activo de 5 V. Nivel alto = suena. Patron BUZZER_ON_MS / BUZZER_OFF_MS, sin bloquear.
//   IO45: MOSFET en paralelo al boton de encendido de la Pi (J2). Nivel alto PI_PULSO_MS = una pulsacion. Solo Demeter lo usa.
// Hilos: todo lo llama la tarea de mision (nucleo 0), que da la hora en cada vuelta de 20 ms. Solo extActSleep() lo llama el bucle
// principal, justo antes de dormir. Los dos pines salen en bajo al arrancar.
#pragma once
#include <stdint.h>

// Pines (buses_y_pines.md, seccion 1.2)
static const uint8_t  EXT_ACT_BUZZER_PIN = 46;
static const uint8_t  EXT_ACT_PI_PIN     = 45;

// Tiempos (constantes.md, seccion 4; los de (P) los revisa Pablo). Mismo nombre que en constantes.md.
static const uint32_t PI_PULSO_MS    = 1500;    // pulso de PWR_ON hacia la Pi (P)
static const uint32_t BUZZER_ON_MS   = 500;     // patron del buzzer en RECOVERY o ATERRIZAJE (P)
static const uint32_t BUZZER_OFF_MS  = 1500;

// Bits de TELEM.actuators (protocolo_paquetes.md, seccion 2)
static const uint16_t ACT_BUZZER_ACTIVO  = 1u << 0;   // el patron del buzzer corre
static const uint16_t ACT_PI_EN_CURSO    = 1u << 1;   // el pulso de la Pi esta en alto
static const uint16_t ACT_PI_ENVIADO     = 1u << 2;   // se envio algun pulso a la Pi desde el arranque
// Bits 3-7 de TELEM.actuators: motivo del error de la Pi (ErrorCode de demeter_protocol.py, D-056). Bits 8-15: estado de la Pi por la UART (ext_pi.h, StatusCode de demeter_protocol.py; 0xFF = desconocido o Hermes)

void     extActBegin();                           // pines en bajo; libera el hold de un sueno profundo anterior. Antes de missionBegin
void     extActBuzzer(bool on, uint32_t nowMs);   // on: empieza el patron (si ya corre, no lo reinicia). off: lo apaga ya
void     extActPiPulse(uint32_t nowMs);           // pulso de PI_PULSO_MS en IO45. Si ya hay uno en curso, no lo alarga
void     extActStep(uint32_t nowMs);              // avanza el patron y el pulso. Cada vuelta de la tarea de mision
uint16_t extActBits();                            // para TELEM.actuators
void     extActSleep();                           // apaga todo, impide reactivarlo y retiene los pines en bajo durante el sueno profundo
