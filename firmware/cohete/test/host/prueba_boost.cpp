// prueba_boost.cpp - Arnes en el PC (g++, sin ESP32) de la deteccion de BOOST (T-410): corre boost_detect.cpp sobre un archivo de entrada.
// Lo invoca correr_pruebas.py, que genera los archivos. Uso:
//   prueba_boost inercial <archivo.bin> [lsb_por_g]      3 columnas (ax ay az, en g) a la tasa del archivo; pasa por el mismo gancho que el LSM
//   prueba_boost baro <archivo.bin> [decimar]            1 columna (altura, m); se alimenta cada <decimar> muestras (el firmware lo hace a 50 Hz)
// Formato del archivo: double fs_hz, int32 ncol, int32 nfilas, y luego nfilas*ncol float32.
// Salida (una linea): clave=valor ... ; los tiempos son desde el inicio del archivo, en ms.
#include "../../src/boost_detect.h"
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string>
#include <vector>

struct Entrada { double fs; int ncol; int n; std::vector<float> d; };

static bool leer(const char *ruta, Entrada &e) {
    FILE *f = fopen(ruta, "rb");
    if (!f) return false;
    int32_t ncol = 0, n = 0;
    bool ok = fread(&e.fs, 8, 1, f) == 1 && fread(&ncol, 4, 1, f) == 1 && fread(&n, 4, 1, f) == 1;
    if (ok) {
        e.ncol = ncol; e.n = n; e.d.resize((size_t)n * ncol);
        ok = fread(e.d.data(), 4, e.d.size(), f) == e.d.size();
    }
    fclose(f);
    return ok;
}

static int16_t cuentas(float g, float lsb) {              // el LSM entrega int16: +-32 g, 0,976 mg/LSB
    const float c = roundf(g * lsb);
    return (int16_t)(c > 32767.0f ? 32767.0f : (c < -32768.0f ? -32768.0f : c));
}

static int inercial(const Entrada &e, float lsb) {
    if (e.ncol != 3) { fprintf(stderr, "inercial pide 3 columnas\n"); return 2; }
    boostSetTarget(5.0f);                                   // boost_dv_mps de los dos cohetes
    BoostIntegrator medidor;                                // solo para informar el dv maximo (objetivo infinito: nunca dispara)
    float dvMax = 0;
    int hits = 0;
    double tPrimero = -1, dvPrimero = 0;
    for (int i = 0; i < e.n; i++) {
        const int64_t t_us = (int64_t)llround(i * 1e6 / e.fs);
        const float *r = &e.d[(size_t)i * 3];
        const int16_t a[3] = {cuentas(r[0], lsb), cuentas(r[1], lsb), cuentas(r[2], lsb)};
        boostLsmSample(t_us, a, lsb);
        const float fa[3] = {a[0] / lsb, a[1] / lsb, a[2] / lsb};
        medidor.feed(t_us, sqrtf(fa[0] * fa[0] + fa[1] * fa[1] + fa[2] * fa[2]));
        if (medidor.dv() > dvMax) dvMax = medidor.dv();
        uint32_t v;
        if (boostTakeLsm(v) == BOOST_INERCIAL) {            // la tarea de mision lo lee cada 20 ms; aqui, en cada muestra
            if (!hits) { tPrimero = t_us / 1000.0; dvPrimero = v / 100.0; }
            hits++;
        }
    }
    printf("hits=%d t_primero_ms=%.3f dv_primero_mps=%.2f dv_max_mps=%.2f muestras=%d\n", hits, tPrimero, dvPrimero, dvMax, e.n);
    return 0;
}

static int baro(const Entrada &e, int decimar) {
    if (e.ncol != 1) { fprintf(stderr, "baro pide 1 columna\n"); return 2; }
    BoostBaroJump j;
    j.configure(10.0f, 0.5f, BOOST_BARO_EVAL);              // jump_m y jump_s de los dos cohetes
    int episodios = 0;
    bool arriba = false;
    double tPrimero = -1, saltoPrimero = 0, saltoMax = 0;
    for (int i = 0; i < e.n; i += decimar) {
        const int64_t t_us = (int64_t)llround(i * 1e6 / e.fs);
        const bool hit = j.feed(t_us, e.d[i]);
        if (j.jump() > saltoMax) saltoMax = j.jump();
        if (hit && !arriba) { if (!episodios) { tPrimero = t_us / 1000.0; saltoPrimero = j.jump(); } episodios++; }
        arriba = hit;
    }
    printf("hits=%d t_primero_ms=%.3f salto_primero_m=%.2f salto_max_m=%.2f\n", episodios, tPrimero, saltoPrimero, saltoMax);
    return 0;
}

int main(int argc, char **argv) {
    if (argc < 3) { fprintf(stderr, "uso: prueba_boost inercial|baro archivo [lsb|decimar]\n"); return 2; }
    Entrada e;
    if (!leer(argv[2], e)) { fprintf(stderr, "no se pudo leer %s\n", argv[2]); return 2; }
    const std::string modo = argv[1];
    if (modo == "inercial") return inercial(e, argc > 3 ? (float)atof(argv[3]) : 1000.0f / 0.976f);   // ACC_LSB_PER_G de ext_lsm.cpp
    if (modo == "baro") return baro(e, argc > 3 ? atoi(argv[3]) : 1);
    fprintf(stderr, "modo desconocido: %s\n", argv[1]);
    return 2;
}
