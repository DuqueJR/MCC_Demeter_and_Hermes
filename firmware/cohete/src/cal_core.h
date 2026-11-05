// cal_core.h - Calibracion a bordo (C++11 puro, sin Arduino: se compila y se prueba en el PC contra estacion/calib.py).
//   Es estacion/calib.py llevado al cohete: con el cohete cerrado no hay USB, asi que el cohete analiza su propio registro de la guia
//   (6 posiciones quietas y giro en todas las direcciones) y manda por radio un resumen para aprobarlo (Pablo, 2026-11-05).
//   Mismas reglas y umbrales que calib.py; diferencias de implementacion, para que quepa en la ESP32 (decenas de MB de registro):
//     - dos pasadas sobre el archivo y resumenes por ventana de 0.5 s en vez de guardar todas las muestras;
//     - la media de cada posicion sale de las ventanas completas dentro del tramo (calib.py usa las muestras);
//     - el giro para alinear los magnetometros sale de ventanas de 100 ms;
//     - retraso y ganancia del giro del QMI se miden en el tramo de giro (despues de la ultima posicion).
//   Cuerpo FRD: X nariz, Y derecha (de la cola a la nariz con la marca arriba), Z opuesto a la marca.
//   Salida (igual que calib.py): acel_cal = (crudo_g - sesgo) / escala por eje; v_cuerpo = R * v_chip;
//   mag_cal = A * (crudo_G - centro) en ejes del chip del magnetometro; R lleva esos ejes a cuerpo.
#pragma once
#include <stdint.h>
#include <stddef.h>
#include <vector>

namespace cal {

static const int NPOS = 6;

// En la ESP32 los bucles largos deben ceder CPU (vTaskDelay) o salta el watchdog del IDLE0: el cohete pone aqui su funcion.
extern void (*ceder)();

// Avisos (bits): los mismos casos que los textos de calib.py. ok = sin avisos y con los cuatro sensores calibrados.
enum Aviso : uint32_t {
    AV_SIN_LSM = 1u << 0, AV_POCAS_POS = 1u << 1, AV_LSM_SIN_DATOS = 1u << 2, AV_QMI_SIN_DATOS = 1u << 3,
    AV_LSM_POS_MAL = 1u << 4, AV_QMI_POS_MAL = 1u << 5, AV_QMI_CORR = 1u << 6,
    // por magnetometro: base 8 (MMC) o 16 (QMC)
    AVM_SIN_DATOS = 1u << 0, AVM_FALLA_AJUSTE = 1u << 1, AVM_COBERTURA = 1u << 2, AVM_RESIDUO = 1u << 3, AVM_DESCARTADAS = 1u << 4,
    AVM_POCO_GIRO = 1u << 5, AVM_POSICIONES = 1u << 6, AVM_INCLINACION = 1u << 7,
    AV_MAG_DIFIEREN = 1u << 24, AV_MAG_NO_COMPARABLES = 1u << 25,
};
static const int AV_MMC_BASE = 8, AV_QMC_BASE = 16;

struct Imu {
    bool   ok;
    double R[3][3], sesgo[3], escala[3], err_pos;
};
struct Mag {
    bool   ok, alineado;
    double centro[3], A[3][3], radio, max_min, residuo_mG, cobertura;
    int    muestras, descartadas;
    double R_imu[3][3], R[3][3];          // magnetometro -> ejes del LSM, y -> cuerpo
    double dip_media, dip_rango, giro_residual_deg;
    int    dip_n;
    bool   invertido;                     // determinante -1: salida invertida respecto a una rotacion pura
};
struct Curva { bool ok, tau_fiable; double t0, final_, tau_min, sube5, sube10, sube30, duracion_min; };
struct Resultado {
    int      n_pos;
    uint8_t  nombradas;                   // 0 orden de aparicion, 1 calibracion anterior, 2 montaje nominal, 3 geometria
    Imu      lsm, qmi;
    double   qmi_retraso_ms, qmi_ganancia[3], qmi_corr[3];
    bool     qmi_giro;
    Mag      mmc, qmc;
    double   mag_acuerdo_min, mag_acuerdo_max;
    double   calentamiento_s;             // lo quieto al inicio (curva de calentamiento) que no cuenta como posicion ni para los magnetometros
    Curva    bmp, bme;
    uint32_t avisos;
    bool     ok;
    // conteos
    uint32_t n_lsm, n_qmi, n_mmc, n_qmc;
};

// Recorre registros rec (rec_format.h) de un flujo en trozos; llama f(rec, len) por cada registro valido.
class Lector {
public:
    template <typename F> void feed(const uint8_t *d, size_t n, F f);
private:
    std::vector<uint8_t> buf_;
};

class Analizador {
public:
    // prev: la calibracion del LSM vigente (para nombrar las posiciones); nullptr = montaje nominal
    void   inicio(const Imu *prev);
    void   pasada1(const uint8_t *rec, uint16_t len);
    void   finPasada1();
    void   pasada2(const uint8_t *rec, uint16_t len);
    void   finPasada2();
    const Resultado &res() const { return r_; }

    struct Ventana { uint32_t n; double s[3], q[3], g[3]; int64_t tf, tl; };
    struct Muestra { float t, v[3]; };
    struct Pose { int64_t t1, t2; double u[3]; };
private:
    void ventana(std::vector<Ventana> &w, int64_t &t0, int64_t t, const double a[3], const double *g);
    void posesDe(const std::vector<Ventana> &w, std::vector<Pose> &out, int64_t &tGuia);
    bool media(const std::vector<Ventana> &w, const Pose &p, double m[3]);
    void imu(const std::vector<Ventana> &w, Imu &c, bool esLsm, uint32_t avSinDatos, uint32_t avMal);
    void magnetometro(std::vector<Muestra> &m, Mag &c, int base);
    void curva(const std::vector<double> &s, const std::vector<uint32_t> &n, Curva &c);

    Resultado r_;
    Imu prev_; bool hayPrev_;
    std::vector<Ventana> wl_, wq_;               // ventanas de 0.5 s: LSM (acel y giro) y QMI (acel)
    int64_t tl0_, tq0_, t0_;                     // origenes; t0_ para los tiempos en float
    int64_t tGuia_;                              // inicio de la guia: fin del calentamiento (INT64_MIN si no hubo)
    std::vector<double> gb_s_[3]; std::vector<uint32_t> gb_n_;   // giro del LSM en ventanas de 100 ms (dps, chip)
    std::vector<Muestra> mmc_, qmc_;
    std::vector<int64_t> txA_, txB_;             // ventanas de transmision (para descartar el magnetometro)
    std::vector<double> tb_s_, te_s_; std::vector<uint32_t> tb_n_, te_n_;   // temperaturas en ventanas de 10 s
    float bmpPrev_[2]; int bmpPrevN_;            // mediana de 3 del BMP
    std::vector<Pose> poses_;                    // nombradas como calib::POSES
    double ups_[NPOS][3];                        // acelerometro del LSM calibrado en cada posicion (chip)
    bool   hayUps_;
    double magPos_mmc[NPOS][3], magPos_qmc[NPOS][3];             // campo en cuerpo en cada posicion limpia (MMC contra QMC)
    bool   magHay_mmc[NPOS], magHay_qmc[NPOS];
    double sesgoGiro_[3];
    // pasada 2: magnetometros (desde tGuia_) y tramo de giro para el retraso y la ganancia del QMI
    int64_t segA_, segB_;
    std::vector<float> l5_[3]; std::vector<uint32_t> l5n_;      // LSM en ventanas de 5 ms
    std::vector<Muestra> q2_;                                   // QMI crudo en el tramo
};

// ---------- plantilla del lector ----------
uint16_t recCheck(const uint8_t *r, uint32_t avail);
template <typename F> void Lector::feed(const uint8_t *d, size_t n, F f) {
    buf_.insert(buf_.end(), d, d + n);
    size_t i = 0;
    while (buf_.size() - i >= 16) {
        if (!(buf_[i] == 0xA5 && buf_[i + 1] == 0x5A)) { i++; continue; }
        const uint16_t len = (uint16_t)(buf_[i + 2] | (buf_[i + 3] << 8));
        if (len < 16 || len > 512) { i++; continue; }
        if (buf_.size() - i < len) break;                      // registro partido: espera el siguiente trozo
        if (recCheck(&buf_[i], (uint32_t)(buf_.size() - i))) { f(&buf_[i], len); i += len; }
        else i++;
    }
    buf_.erase(buf_.begin(), buf_.begin() + i);
}

} // namespace cal
