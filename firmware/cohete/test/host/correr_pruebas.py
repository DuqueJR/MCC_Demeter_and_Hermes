#!/usr/bin/env python3
"""Pruebas en el PC de la deteccion de BOOST (T-410) y de los actuadores (T-413): genera las entradas, compila prueba_boost.cpp con g++ y comprueba los criterios.

Uso:  python3 firmware/cohete/test/host/correr_pruebas.py [--reposo-min 30] [--semilla 1]
Necesita: g++ y numpy. No toca la placa ni PlatformIO. Escribe en test/host/entradas/ y test/host/build/ (ignorados por git).
Sale con codigo 0 si todos los criterios se cumplen.
"""
import argparse
import struct
import subprocess
import sys
from pathlib import Path

import numpy as np

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[3]
SIMS = RAIZ / "datos" / "simulaciones" / "openrocket"
ENTRADAS = AQUI / "entradas"
BUILD = AQUI / "build"
G0 = 9.80665

SIM_DEMETER = SIMS / "demeter_H135W-8_santa-fe-antioquia_sim2.csv"
SIM_HERMES = SIMS / "hermes_G80-7T_santa-fe-antioquia_pablo.csv"

FS = 1600.0              # tasa del IMU en la prueba (el LSM real corre a 1667 Hz: tambien se prueba)
FS_LSM = 1666.67
SIGMA_G = 0.01           # ruido del LSM en reposo
SIGMA_ALT_M = 0.05       # ruido de la altura barometrica
BOOST_MAX_S = 0.2        # criterio: BOOST antes de 0,2 s desde el despegue
POLL_S = 0.02            # la tarea de mision lee la bandera cada 20 ms (suma a la deteccion en el firmware)


def leer_sim(ruta):
    """(t, altura, aceleracion vertical cinematica m/s2) de una exportacion de OpenRocket (datos/README.md)."""
    filas = []
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        if linea and not linea.startswith("#"):
            c = linea.split(",")
            filas.append((float(c[0]), float(c[1]), float(c[5])))
    a = np.array(filas)
    return a[:, 0], a[:, 1], a[:, 2]


def escribir(nombre, fs, datos):
    datos = np.asarray(datos, dtype=np.float32)
    if datos.ndim == 1:
        datos = datos[:, None]
    ENTRADAS.mkdir(parents=True, exist_ok=True)
    ruta = ENTRADAS / (nombre + ".bin")
    with open(ruta, "wb") as f:
        f.write(struct.pack("<dii", fs, datos.shape[1], datos.shape[0]))
        f.write(datos.tobytes())
    return ruta


def ruido3(rng, n):
    return rng.normal(0.0, SIGMA_G, (n, 3))


def reposo(rng, seg, fs):
    n = int(seg * fs)
    r = ruido3(rng, n)
    r[:, 2] += 1.0
    return r


def sim_inercial(rng, ruta, fs, pad_s=2.0, dur_s=6.0):
    """Fuerza especifica en g: aceleracion cinematica + 1 g en la vertical. 1 g en reposo antes del despegue (t = 0 de la sim)."""
    t, _, av = leer_sim(ruta)
    ti = np.arange(-pad_s, dur_s, 1.0 / fs)
    f = (np.interp(ti, t, av, left=0.0) + G0) / G0
    f = np.where(ti < 0, 1.0, f)
    r = ruido3(rng, len(ti))
    r[:, 2] += f
    return r, pad_s


def sim_baro(rng, ruta, fs, pad_s=3.0, dur_s=8.0):
    t, h, _ = leer_sim(ruta)
    ti = np.arange(-pad_s, dur_s, 1.0 / fs)
    alt = np.interp(ti, t, h, left=0.0)
    return alt + rng.normal(0.0, SIGMA_ALT_M, len(ti)), pad_s


def pulso(rng, fs, g_pico, ms, eje=2, pad_s=2.0):
    """Reposo, un pulso rectangular (el peor caso: toda la energia al nivel del pico) con |a| = g_pico, y reposo."""
    r = reposo(rng, 2 * pad_s + ms / 1000.0, fs)
    i0 = int(pad_s * fs)
    n = int(round(ms / 1000.0 * fs))
    r[i0:i0 + n, :] -= [0, 0, 1.0]
    r[i0:i0 + n, eje] += g_pico
    return r


def sacudida(rng, fs, amp_g, hz, seg, vertical, pad_s=1.0):
    n = int(seg * fs)
    t = np.arange(n) / fs
    s = amp_g * np.sin(2 * np.pi * hz * t)
    r = np.vstack([reposo(rng, pad_s, fs), reposo(rng, seg, fs), reposo(rng, pad_s, fs)])
    i0 = int(pad_s * fs)
    r[i0:i0 + n, 2 if vertical else 0] += s
    return r


def correr(modo, ruta, extra=None):
    cmd = [str(BUILD / "prueba_boost"), modo, str(ruta)] + ([str(extra)] if extra is not None else [])
    out = subprocess.run(cmd, capture_output=True, text=True, check=True).stdout.strip()
    return {k: float(v) for k, v in (p.split("=") for p in out.split())}


def compilar():
    BUILD.mkdir(parents=True, exist_ok=True)
    cmd = ["g++", "-std=c++11", "-O2", "-Wall", "-Wextra", "-o", str(BUILD / "prueba_boost"),
           str(AQUI / "prueba_boost.cpp"), str(AQUI.parent.parent / "src" / "boost_detect.cpp")]
    print("$", " ".join(cmd))
    subprocess.run(cmd, check=True)


def compilar_mision():
    """mission.cpp REAL contra los stubs de test/host/stubs; y -fsyntax-only de los otros tres .cpp que toca T-410."""
    src = AQUI.parent.parent / "src"
    inc = ["-I" + str(AQUI / "stubs"), "-I" + str(src.parent.parent / "common" / "net_proto"), "-I" + str(src.parent.parent / "common"), "-I" + str(src)]
    cmd = ["g++", "-std=gnu++11", "-O1", "-Wall", "-Wextra"] + inc + ["-o", str(BUILD / "prueba_mision"), str(AQUI / "prueba_mision.cpp"),
           str(src / "mission.cpp"), str(src / "boost_detect.cpp"), str(src / "ext_act.cpp")]
    print("$", " ".join(cmd))
    subprocess.run(cmd, check=True)
    # T-413: ordenes de texto de tierra (gnd_cmd.cpp real con stubs)
    tierra = src.parent.parent / "tierra" / "src"
    cmd = ["g++", "-std=gnu++11", "-O1", "-Wall", "-Wextra"] + inc + ["-I" + str(tierra), "-o", str(BUILD / "prueba_tierra"), str(AQUI / "prueba_tierra.cpp"), str(tierra / "gnd_cmd.cpp")]
    print("$", " ".join(cmd))
    subprocess.run(cmd, check=True)
    sintaxis = []
    for f in ("boost_detect.cpp", "mission.cpp", "ext_lsm.cpp", "ext_act.cpp"):
        sintaxis.append(subprocess.run(["g++", "-std=gnu++11", "-fsyntax-only", "-Wall", "-Wextra"] + inc + [str(src / f)], capture_output=True, text=True))
    sintaxis.append(subprocess.run(["g++", "-std=gnu++11", "-fsyntax-only", "-Wall", "-Wextra"] + inc + ["-I" + str(tierra), str(tierra / "gnd_cmd.cpp")], capture_output=True, text=True))
    # Estos incluyen LoRaBoards.h (el de la placa, con Wire.h y XPowersLib): se revisan desde una copia en build/ para que gane el stub
    for f in ("in_imu.cpp", "core_sleep.cpp", "net_radio.cpp", "core_selftest.cpp"):
        copia = BUILD / f
        copia.write_text((src / f).read_text())
        sintaxis.append(subprocess.run(["g++", "-std=gnu++11", "-fsyntax-only", "-Wall", "-Wextra"] + inc + [str(copia)], capture_output=True, text=True))
    return sintaxis


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--reposo-min", type=float, default=30.0)
    ap.add_argument("--semilla", type=int, default=1)
    args = ap.parse_args()
    rng = np.random.default_rng(args.semilla)
    compilar()
    sintaxis = compilar_mision()
    fallos = []
    filas = []

    def anotar(nombre, ok, detalle):
        filas.append((nombre, "OK" if ok else "FALLA", detalle))
        if not ok:
            fallos.append(nombre)

    # --- Positivas inerciales: sims de OpenRocket, a 1600 Hz y a la tasa real del LSM, con 5 semillas de ruido ---
    for cohete, ruta in (("Demeter", SIM_DEMETER), ("Hermes", SIM_HERMES)):
        for fs in (FS, FS_LSM):
            ts, dvs = [], []
            for k in range(5):
                r, pad = sim_inercial(np.random.default_rng(args.semilla + k), ruta, fs)
                res = correr("inercial", escribir("inercial_%s_%d_%d" % (cohete.lower(), round(fs), k), fs, r))
                ts.append(res["t_primero_ms"] / 1000.0 - pad if res["hits"] >= 1 else float("nan"))
                dvs.append(res["dv_primero_mps"])
            peor = max(ts) if not any(np.isnan(ts)) else float("nan")
            ok = (not np.isnan(peor)) and peor + POLL_S < BOOST_MAX_S
            anotar("positiva inercial %s @ %d Hz" % (cohete, round(fs)), ok,
                   "BOOST a %.3f s del despegue (peor de 5 ruidos; con la lectura de 20 ms de la tarea: %.3f s), dv = %.2f m/s" %
                   (peor, peor + POLL_S, np.mean(dvs)))

    # --- Negativas inerciales: cero detecciones ---
    casos = [
        ("golpe de 10 g, 20 ms", pulso(rng, FS, 10.0, 20)),
        ("impacto de 20 g, 10 ms", pulso(rng, FS, 20.0, 10)),
        ("sacudida +-3 g, 5 Hz, 5 s (vertical)", sacudida(rng, FS, 3.0, 5.0, 5.0, True)),
        ("reposo con ruido, %g min" % args.reposo_min, reposo(rng, args.reposo_min * 60.0, FS)),
    ]
    for i, (nombre, r) in enumerate(casos):
        res = correr("inercial", escribir("neg_inercial_%d" % i, FS, r))
        anotar("negativa: " + nombre, res["hits"] == 0, "detecciones = %d, dv maximo = %.2f m/s (objetivo 5)" % (res["hits"], res["dv_max_mps"]))

    # --- Barrido de la sacudida de +-3 g, 5 s, con el eje vertical (|a| = |1 + 3 sen|) y con uno horizontal (|a| = raiz(1 + 9 sen^2)).
    #     De 3 a 20 Hz: cero detecciones (criterio, D-048). A 1 y 2 Hz es movimiento real del cohete (mas de 1 m): solo se informa el dv maximo ---
    for vertical in (True, False):
        for hz in (1.0, 2.0, 3.0, 5.0, 8.0, 10.0, 15.0, 20.0):
            res = correr("inercial", escribir("sacudida_%s_%g" % ("v" if vertical else "h", hz), FS, sacudida(rng, FS, 3.0, hz, 5.0, vertical)))
            nombre = "sacudida +-3 g, %g Hz, 5 s (%s)" % (hz, "vertical" if vertical else "horizontal")
            det = "detecciones = %d, dv maximo = %.2f m/s" % (res["hits"], res["dv_max_mps"])
            if hz >= 3.0:
                anotar("negativa: " + nombre, res["hits"] == 0, det)
            else:
                filas.append(("informativa: " + nombre, "INFO", det))

    # --- Barometrico: perfil de altura de la sim. a 100 Hz; el firmware evalua a 50 Hz ---
    for cohete, ruta in (("Demeter", SIM_DEMETER), ("Hermes", SIM_HERMES)):
        for dec in (1, 2):
            alt, pad = sim_baro(rng, ruta, 100.0)
            res = correr("baro", escribir("baro_%s" % cohete.lower(), 100.0, alt), dec)
            t = res["t_primero_ms"] / 1000.0 - pad
            anotar("positiva barometrica %s @ %d Hz" % (cohete, 100 // dec), res["hits"] >= 1 and t > 0,
                   "BOOST por salto a %.3f s del despegue, salto = %.1f m" % (t, res["salto_primero_m"]))

    n = int(args.reposo_min * 60 * 100)
    deriva = np.cumsum(rng.normal(0, 0.0005, n)) + np.arange(n) / 100.0 * (0.5 / 60.0)   # clima: 0,5 m/min mas un paseo aleatorio
    res = correr("baro", escribir("neg_baro_reposo", 100.0, deriva + rng.normal(0, SIGMA_ALT_M, n)), 2)
    anotar("negativa barometrica: reposo %g min con deriva de clima" % args.reposo_min, res["hits"] == 0, "detecciones = %d, salto maximo = %.2f m" % (res["hits"], res["salto_max_m"]))
    for nombre, ms, alto in (("dato malo de un solo cuadro (+15 m, 10 ms)", 10, 15.0), ("portazo (+12 m, 60 ms)", 60, 12.0)):
        h = rng.normal(0, SIGMA_ALT_M, 1000)
        i0 = 400
        h[i0:i0 + max(1, ms // 10)] += alto
        res = correr("baro", escribir("neg_baro_pulso_%d" % ms, 100.0, h), 2)
        anotar("negativa barometrica: " + nombre, res["hits"] == 0, "detecciones = %d, salto maximo = %.2f m" % (res["hits"], res["salto_max_m"]))
    h = rng.normal(0, SIGMA_ALT_M, 1000)
    h[400:412] += 12.0
    res = correr("baro", escribir("info_baro_pulso_120", 100.0, h), 2)
    filas.append(("informativa: pulso barometrico de +12 m, 120 ms (6 evaluaciones)", "INFO", "detecciones = %d (por diseno: son las 5 evaluaciones de BOOST_BARO_EVAL)" % res["hits"]))

    # --- mission.cpp real con stubs: el gancho de BOOST por estado ---
    for esc, que in (("tierra", "TIERRA: BOOST sin armar -> FLY + TF_BOOST_SIN_ARMAR + registra"),
                     ("armado", "ARMED: BOOST -> FLY, protecciones en vuelo activas, un solo T_MISSION"),
                     ("launch_sin_boost", "LAUNCH sin BOOST: registra, avisa a los 120 s, el BOOST tardio apaga el aviso"),
                     ("baro", "BOOST barometrico (arg 2) con el salto en cm"),
                     ("qmi_con_lsm", "el QMI no cuenta si el LSM esta fresco"),
                     ("qmi_sin_lsm", "el QMI da el BOOST si el LSM no tiene datos")):
        r = subprocess.run([str(BUILD / "prueba_mision"), esc], capture_output=True, text=True)
        anotar("mision: " + que, r.returncode == 0, "ver `build/prueba_mision %s`" % esc if r.returncode else "todas las comprobaciones pasan")
        if r.returncode:
            print(r.stdout)
    # --- Actuadores (T-413): mission.cpp y ext_act.cpp reales, pines registrados con reloj virtual ---
    for esc, que in (("buzzer_patron", "buzzer: patron 500/1500 ms, off al instante, RZ_OP con arg 2, apto en ARMED"),
                     ("buzzer_aterrizaje", "buzzer: suena en ATERRIZAJE y RECOVERY (sin reiniciar el patron), calla en TIERRA"),
                     ("buzzer_recovery", "buzzer: suena al forzar RECOVERY y sigue tras t_post"),
                     ("pi_demeter", "Pi: NO_APTO con el motivo 21; con la confirmacion, pulso de 1500 ms; bits 1 y 2 de actuators"),
                     ("pi_vuelo", "Pi: en FLY con BOOST tambien RZ_EN_VUELO"),
                     ("pi_hermes", "Pi: en Hermes RZ_OP y nunca se pulsa IO45"),
                     ("sueno", "sueno: pines en bajo y retenidos (gpio_hold), nada los reactiva, se liberan al despertar"),
                     ("protocolo", "net_proto.h: ops 10 y 11, motivo 21, RZ_COUNT = 22, textos, constantes de ext_act.h")):
        r = subprocess.run([str(BUILD / "prueba_mision"), esc], capture_output=True, text=True)
        anotar("actuadores: " + que, r.returncode == 0, "ver `build/prueba_mision %s`" % esc if r.returncode else "%d comprobaciones, todas pasan" % r.stdout.count("[OK]"))
        if r.returncode:
            print(r.stdout)
    r = subprocess.run([str(BUILD / "prueba_tierra")], capture_output=True, text=True)
    anotar("tierra: gnd_cmd.cpp real: buzzer on|off, pi encender, confirmacion con el motivo 21", r.returncode == 0,
           "ver `build/prueba_tierra`" if r.returncode else "%d comprobaciones, todas pasan" % r.stdout.count("[OK]"))
    if r.returncode:
        print(r.stdout)
    nr = (AQUI.parent.parent / "src" / "net_radio.cpp").read_text()
    anotar("net_radio.cpp: TELEM.actuators sale de extActBits() (revision de texto: la radio no corre en el PC)", "p.actuators = extActBits();" in nr and '#include "ext_act.h"' in nr, "buildTelem asigna p.actuators")
    nombres = ("boost_detect.cpp", "mission.cpp", "ext_lsm.cpp", "ext_act.cpp", "tierra/gnd_cmd.cpp", "in_imu.cpp", "core_sleep.cpp", "net_radio.cpp", "core_selftest.cpp")
    for nombre, r in zip(nombres, sintaxis):
        anotar("g++ -std=gnu++11 -fsyntax-only %s (con stubs)" % nombre, r.returncode == 0 and "warning" not in r.stderr, r.stderr.strip()[:200] or "sin errores ni avisos")

    ancho = max(len(f[0]) for f in filas)
    print()
    for nombre, est, det in filas:
        print("%-*s  %-6s  %s" % (ancho, nombre, est, det))
    print()
    if fallos:
        print("FALLAS (%d): %s" % (len(fallos), "; ".join(fallos)))
        return 1
    print("Todos los criterios se cumplen.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
