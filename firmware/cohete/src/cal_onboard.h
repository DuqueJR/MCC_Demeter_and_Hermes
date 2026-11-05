// cal_onboard.h - Calibracion a bordo (D-059). Con el cohete cerrado no hay USB: el cohete analiza su propio registro de la guia de
//   calibracion (cal_core: lo mismo que estacion/calib.py), manda el resumen por radio (CAL_RES) y espera la aprobacion (cal aplicar,
//   en dos pasos). La calibracion queda en NVS en dos ranuras: se escribe en la inactiva, se verifica y solo entonces se activa; cal
//   anterior vuelve a la otra. Respaldo: con el cohete abierto, calib.py en el PC y la carga por USB (clave TBCAL).
//   Solo en TIERRA y sin registrar. El analisis corre en una tarea propia (nucleo 0, prioridad 1) que lee la SD con g_sdBusMx.
#pragma once
#include <stdint.h>
#include <stddef.h>
#include "cal_blob.h"
#include "rec_format.h"

enum CalEstado : uint8_t { CE_NADA = 0, CE_PASADA1 = 1, CE_PASADA2 = 2, CE_CALCULANDO = 3, CE_LISTO = 4, CE_ERROR = 5, CE_APLICADA = 6, CE_DESCARTADA = 7 };

struct CalLog { int64_t t_us; rec::CalRec r; };

void        calBegin(uint8_t rocketId);        // lee la NVS: la calibracion activa
bool        calAnalizar();                     // lanza el analisis del ultimo registro; false si ya corre
bool        calAplicar();                      // guarda el resultado listo en NVS y lo activa
void        calDescartar();
bool        calAnterior();                     // activa la otra ranura de la NVS
uint8_t     calEstado();
bool        calAnalizando();
bool        calListo();                        // hay un resultado sin aplicar
bool        calListoConAvisos();
bool        calHayAnterior();
const calblob::Calibracion &calActiva();      // la calibracion en uso (ok = false si no hay)
const char *calArchivo();                      // el registro analizado
size_t      calPaquete(uint8_t *out);          // un CAL_RES cuando toca (0 si no): lo llama la radio
bool        calTakeLog(CalLog &l);
void        calUsbRecibir();                   // tras la clave TBCAL por USB: lee [largo u16][blob] y lo guarda (respaldo con el cohete abierto)
void        calStep(uint32_t nowMs);           // tarea de mision: registra la calibracion al empezar a registrar
