// ext_bmp.h - Barometro externo BMP581 (0x47) en SCX/SDX del LSM6DSO32: se configura y se lee por el sensor hub.
#pragma once
#include <stdint.h>
#include "core_bus.h"

static const uint8_t EXT_BMP_ADDR = 0x47;
static const uint8_t EXT_BMP_ID_REG = 0x01;
static const uint8_t EXT_BMP_DATA_REG = 0x1D;     // temperatura XLSB; se leen 6 bytes hasta presion MSB (0x22)
static const uint8_t EXT_BMP_DATA_LEN = 6;

struct ExtBarSample {
    int64_t t_us;        // reloj local estimado de la lectura del hub
    float   press_pa;
    float   temp_c;
};
extern Latest<ExtBarSample> g_ext_bar;

struct ExtBmpStats {
    bool     ok;
    const char *step;                  // ultimo paso de la configuracion: donde se quedo si fallo
    uint8_t  chipId, status, effOsr;   // effOsr = registro 0x38; bit 7: ODR valida con ese OSR
    uint32_t samples, nacks, bad;      // bad: palabras invalidas o lejos de la mediana (el log las conserva crudas)
    float    press_pa, temp_c;
};

typedef bool (*HubWriteFn)(uint8_t reg, uint8_t val);
typedef bool (*HubReadFn)(uint8_t reg, uint8_t *buf, uint8_t n);

bool extBmpConfigure(HubWriteFn wr, HubReadFn rd);       // deja el sensor midiendo
void extBmpOnWord(const uint8_t *raw, int64_t t_us);     // una palabra del FIFO del LSM
void extBmpOnNack();
ExtBmpStats extBmpStats();
