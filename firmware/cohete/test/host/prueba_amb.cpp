// prueba_amb.cpp - Prueba en el PC de amb_calc.h (D-058): la muestra de temperatura del suelo en frio, el contraste BMP/BME, la revision al
// armar y la altura barometrica con la temperatura del suelo.
#include <stdio.h>
#include "amb_calc.h"

using namespace amb;

static int g_fallas = 0;
#define CHECK(cond, msg) do { const bool ok_ = (cond); printf("  [%s] %s\n", ok_ ? "OK" : "FALLA", msg); if (!ok_) g_fallas++; } while (0)
static bool cerca(float a, float b, float tol) { return fabsf(a - b) <= tol; }

// Serie de 20 lecturas (una por segundo) que empieza en t0 y sube pendiente C/min
static Serie serie(float t0, float pend, int n = 20) {
    Serie s;
    for (int i = 0; i < n; i++) s.add((float)i, t0 + pend * i / 60.0f);
    return s;
}

int main() {
    printf("muestra en frio\n");
    {
        const Muestra m = evaluar(serie(28.0f, 0.02f), serie(29.0f, 0.03f), F_SUENO);
        CHECK(m.calidad == Q_BUENA && cerca(m.t_usada, 28.0f, 0.01f), "BMP y BME coherentes y estables: se usa el BMP");
        CHECK(cerca(m.pend_bmp, 0.02f, 0.002f), "la pendiente sale en C/min");
        CHECK(m.fuente == F_SUENO && m.n_bmp == 20, "fuente y numero de lecturas");
    }
    {
        const Muestra m = evaluar(serie(28.0f, 0.0f), serie(31.0f, 0.0f), F_ENCENDIDO);
        CHECK(m.calidad == Q_DUDOSA && cerca(m.t_usada, 28.0f, 0.01f), "BMP y BME a 3 C: dudosa, y se usa la menor");
    }
    {
        const Muestra m = evaluar(serie(31.0f, 0.0f), serie(28.0f, 0.0f), F_ENCENDIDO);
        CHECK(m.calidad == Q_DUDOSA && cerca(m.t_usada, 28.0f, 0.01f), "si el BMP es el caliente, tambien la menor (el BME)");
    }
    {
        const Muestra m = evaluar(serie(28.0f, 0.5f), serie(28.5f, 0.5f), F_ENCENDIDO);
        CHECK(m.calidad == Q_DUDOSA, "subiendo 0.5 C/min: se esta calentando, dudosa");
    }
    {
        const Muestra m = evaluar(serie(28.0f, 0.0f), Serie(), F_ENCENDIDO);
        CHECK(m.calidad == Q_DUDOSA && cerca(m.t_usada, 28.0f, 0.01f), "sin BME: dudosa (sin contraste), con el BMP");
    }
    {
        const Muestra m = evaluar(serie(28.0f, 0.0f, 5), serie(28.5f, 0.0f, 5), F_ENCENDIDO);
        CHECK(m.calidad == Q_DUDOSA && cerca(m.t_usada, T_ESTANDAR_C, 0.01f), "pocas lecturas: dudosa, atmosfera estandar");
    }
    {
        Serie s;
        for (int i = 0; i < 20; i++) s.add((float)i, i < 4 ? 28.0f : 30.0f);
        CHECK(cerca(s.primeros(), 28.0f, 0.01f), "la temperatura es la de los primeros segundos, antes de calentarse");
    }

    printf("revision al armar\n");
    const Muestra buena = evaluar(serie(28.0f, 0.0f), serie(28.8f, 0.0f), F_SUENO);
    CHECK(revisarArmado(false, buena, -1, 28.0f, 29.0f) == AB_SIN, "sin muestra: no apto");
    CHECK(revisarArmado(true, buena, 3600, 29.5f, 30.5f) == 0, "muestra buena de hace 1 h y BMP 1.5 C arriba: apto");
    CHECK(revisarArmado(true, buena, -1, 29.5f, 30.5f) == 0, "sin hora UTC (edad desconocida): no se juzga la edad");
    CHECK(revisarArmado(true, buena, 13 * 3600, 28.0f, 28.5f) == AB_VIEJA, "muestra de hace 13 h: vieja");
    CHECK(revisarArmado(true, buena, 60, 35.0f, 35.5f) == AB_DERIVA, "BMP 7 C por encima de la muestra: deriva");
    CHECK(revisarArmado(true, buena, 60, 28.0f, 33.0f) == AB_BMP_BME, "BMP y BME de ahora a 5 C: discrepan");
    const Muestra dudosa = evaluar(serie(28.0f, 0.0f), serie(31.0f, 0.0f), F_ENCENDIDO);
    CHECK(revisarArmado(true, dudosa, 60, 28.0f, 29.0f) == AB_DUDOSA, "muestra dudosa: no apto");
    Muestra mano = dudosa; mano.fuente = F_MANO;
    CHECK(revisarArmado(true, mano, 60, 28.0f, 29.0f) == 0, "puesta a mano (comando de calibracion): no se marca dudosa");
    CHECK(revisarArmado(true, buena, 60, NAN, NAN) == 0, "sin sensores ahora: solo cuenta la muestra (los demas motivos de ARM lo cubren)");

    printf("altura barometrica\n");
    const float p0 = 95500.0f;
    const float p670 = p0 * powf(1.0f - 670.0f * 0.0065f / 288.15f, 1.0f / 0.190263f);   // 670 m en la atmosfera estandar
    CHECK(cerca(altura(p670, p0, 15.0f), 670.0f, 0.5f), "a 15 C, la atmosfera estandar: 670 m");
    const float h31 = altura(p670, p0, 31.0f);
    CHECK(cerca(h31 / 670.0f, (31.0f + 273.15f) / 288.15f, 0.001f), "a 31 C la misma presion es 5.5 % mas altura");
    CHECK(cerca(altura(p0, p0, 25.0f), 0.0f, 1e-3f), "en p0, cero");
    CHECK(cerca((altura(p670, p0, 29.0f) - altura(p670, p0, 28.0f)), 670.0f / 288.15f, 0.05f), "1 C de error son ~2.3 m a 670 m");

    printf("%s: %d fallas\n", g_fallas ? "FALLA" : "OK", g_fallas);
    return g_fallas ? 1 : 0;
}
