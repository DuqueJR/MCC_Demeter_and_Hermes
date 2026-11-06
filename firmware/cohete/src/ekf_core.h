// ekf_core.h - EKF de navegacion a bordo (D-060): estacion/ekf.py en C++11 puro, sin Arduino, para compilarlo tambien en el PC
// y compararlo contra ekf.py sobre los mismos logs (test/host/prueba_ekf.cpp, comparar_ekf.py).
//
// INS de estado de error, 19 errores: actitud, posicion NED, velocidad NED, sesgo del giro, sesgo del acelerometro, factor de escala
// del giro y sesgo del BMP581. Predice a 400 Hz con un IMU virtual (0.8 LSM + 0.2 QMI, solo LSM si el QMI satura o discrepa).
// Corrige con GNSS (posicion horizontal y velocidad; la altura la dan los barometros), BMP581 (BME280 solo de respaldo), rumbo de
// MMC y QMC (con puerta de campo terrestre) y gravedad cuando esta quieto. Pesos por fase del vuelo segun el momento de la mision.
//
// Tiempo real: las muestras entran con su instante local (us). El filtro corre RETRASO_US atrasado para tener todas las medidas
// (GNSS llega 100-250 ms tarde, el QMI va 42 ms atrasado); presente() lleva el estado al instante actual integrando el IMU guardado.
// Arranca solo cuando encuentra 1.5 s quieto (actitud inicial con gravedad y campo, sesgos del giro, p0 de los barometros).
#pragma once
#include <stdint.h>
#include <string.h>

#ifndef EKF_REAL
#define EKF_REAL float              // en la ESP32-S3 solo float tiene FPU; el PC compila tambien con double para compararlo
#endif

namespace ekf {
typedef EKF_REAL Real;

static const int NX = 19, TH = 0, P = 3, V = 6, BG = 9, BA = 12, SG = 15, B_BMP = 18;
static const int64_t DT_US = 2500;                       // 400 Hz
static const int64_t RETRASO_US = 300000;                // el filtro va este tiempo atrasado respecto al presente

// Calibracion que usa el filtro (de cal_blob / calActiva(), o la nominal sin calibracion)
struct ImuCal { bool ok; double R[3][3], sesgo[3], escala[3]; };
struct MagCal { bool ok; double centro[3], A[3][3], R[3][3], radio; };
struct Config {
    ImuCal lsm, qmi;
    double qmi_ganancia[3], qmi_retraso_ms;
    MagCal mmc, qmc;
    bool   calibrado;               // false: montaje nominal, sin magnetometros
};
void configNominal(Config &c);

struct Gnss {                        // una epoca: instante de medicion en el reloj local
    int64_t t_us;
    uint8_t fix;
    double  lat_deg, lon_deg, h_m;
    float   hacc_m, sacc_mps, vn, ve, vd;
};

// Estadisticas por medida (como e.stats de ekf.py)
enum Medida : uint8_t { M_GNSS_PN = 0, M_GNSS_PE, M_GNSS_VN, M_GNSS_VE, M_GNSS_VD, M_BMP, M_BME, M_MMC, M_QMC, M_GRAV, M_COUNT };
struct Stat { uint32_t ok, rej, run, reabre, no_terrestre; double e2; };

enum Fase : uint8_t { F_REPOSO = 0, F_BOOST, F_COAST, F_EYECCION, F_PARACAIDAS, F_ATERRIZAJE, F_COUNT };

struct Estado {
    int64_t t_us;                    // instante del estado
    bool    listo;                   // arranco (encontro el reposo inicial)
    Real    q[4], p[3], v[3], bg[3], ba[3], sg[3], b_bmp;
    Real    sd_th[3], sd_p[3], sd_v[3];
    Real    f_g[3], w_dps[3];        // acel. especifica (g) y giro (dps) en cuerpo, ya corregidos: el ultimo paso
    double  lat0, lon0, h0;          // origen NED (primer GNSS bueno); h0 NaN si aun no hay
    bool    hayOrigen;
    float   alt_baro_m;              // -p[2] + sesgo del BMP: altura sobre el p0
    uint8_t fase;
};

class Navegador {
public:
    Navegador();
    void configurar(const Config &c);
    void tSuelo(float c);                       // temperatura del suelo (D-058) para la altura; NaN = la del BMP en el reposo inicial
    void reiniciar();                           // vuelve a buscar el reposo (al armar: sesgos, p0 y actitud de la rampa)

    // Entradas, en orden de llegada (cada fuente en orden de tiempo). Unidades del chip: g, dps, G, Pa.
    void lsm(int64_t t, const float a_g[3], const float w_dps[3]);
    void qmi(int64_t t, const float a_g[3], const float w_dps[3]);
    void bmp(int64_t t, float pa, float temp_c);
    void bme(int64_t t, float pa);
    void mmc(int64_t t, const float m_G[3]);    // sin las muestras durante la transmision (las descarta quien llama)
    void qmc(int64_t t, const float m_G[3]);
    void gnss(const Gnss &g);
    void momento(int64_t t, uint8_t m);         // net::Moment; M_NONE fuera de FLY, M_ATERRIZAJE en RECOVERY

    // Avanza el filtro hasta ahora - RETRASO_US. Devuelve cuantos pasos dio.
    int  avanzar(int64_t ahora);
    // Estado del filtro (atrasado) y el llevado al presente con el IMU guardado
    const Estado &filtro() const { return e_; }
    bool presente(int64_t ahora, Estado &out) const;
    const Stat &stat(int m) const { return st_[m]; }
    uint32_t pasos() const { return pasos_; }
    float h_escala() const { return (float)hEsc_; }

    // Muestras guardadas (publico para el anillo; no tocar desde fuera)
    struct Imu { int64_t t; float a[3], w[3]; };
    struct Ev  { int64_t t; uint8_t tipo; float v[3]; uint16_t i; };
private:
    void  aCuerpo(const ImuCal &c, const float a[3], const float w[3], float ab[3], float wb[3], bool qmi) const;
    void  magCuerpo(const MagCal &c, const float m[3], float mb[3]) const;
    void  bloqueReposo(int64_t t, const float ab[3], const float wb[3]);
    void  arrancar(int64_t t0);
    bool  imuPaso(int64_t ta, int64_t tb, int64_t &il, int64_t &iq, Real f[3], Real w[3], bool &okF) const;
    void  predecir(const Real w[3], const Real f[3], Real qd_a, Real qd_g);
    void  propagarMedia(Estado &s, const Real w[3], const Real f[3]) const;
    void  actualizar(int m, const Real H[NX], Real y, Real r, int grupo);
    void  inyectar(const Real dx[NX]);
    void  evento(const Ev &e, int64_t tk);
    void  baro(int m, float pa);
    void  rumbo(int m, const float mb[3], double radio);
    void  gravedad(const Real f[3]);
    void  completar(Estado &s) const;
    void  push(const Ev &e);
    void  grupo(uint32_t &j, float &ac, int &n, int paso, float v, int64_t t, uint8_t tipo);

    Config cfg_;
    Real   Pm_[NX][NX];
    Estado e_;
    Stat   st_[M_COUNT];
    double hEsc_, tSuelo_, ref_bmp_, ref_bme_;
    int64_t t0_, tk_, ultBmp_, tPar_;
    uint32_t pasos_;
    uint8_t  momento_, fase_;
    int      stillN_, ultGrav_; bool hayLp_; Real flp_[3];
    Real   bl_[3], bq_[3];                   // sesgos del giro medidos en el reposo inicial (cuerpo, dps)
    // anillos de IMU en cuerpo, sin el sesgo inicial
    static const int NL = 2048, NQ = 1024, NE = 96;
    Imu    l_[NL], q_[NQ];
    int64_t nl_, nq_;                        // escritos
    int64_t il_, iq_;                        // siguiente a consumir por el filtro
    Ev     ev_[NE]; int nev_;
    // grupos de baro y magnetometro
    float  bmpAc_; int bmpN_; uint32_t bmpI_; float bmeAc_; int bmeN_; uint32_t bmeI_; uint32_t mmcI_, qmcI_;
    // busqueda del reposo inicial: bloques de 0.25 s, ventana de 6
    struct Bloque { int64_t t1, t2; uint32_t n, nq, nm, nqm, nb, ne, nt; double sa[3], qa[3], sg[3], qg[3], sgq[3], sm[3], sqm[3], sb, se, st; };
    Bloque bl6_[7]; int nbl_; int64_t blIni_;
    bool   buscando_;
};
} // namespace ekf
