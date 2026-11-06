#!/usr/bin/env python3
"""replay.py - Banco de replay en el PC (T-305, P-03): corre la logica REAL de deteccion del firmware sobre archivos .BIN y arma el reporte.

Compila prueba_replay.cpp con g++ (boost_detect.cpp + mission.cpp + ext_act.cpp + ext_bmp.cpp reales, con los stubs de test/host/stubs), lo corre sobre cada
.BIN (de T-304, de un vuelo real o de banco) y compara los eventos detectados con la verdad (`<nombre>.verdad.json`, si existe).

Uso:
  python3 replay.py                             los 24 sinteticos de T-304 (los genera si faltan; necesita numpy y scipy)
  python3 replay.py archivo.BIN [mas.BIN]       cada archivo, por separado
  python3 replay.py --consecutivos a.BIN b.BIN  los archivos son un solo registro (FILEHDR con FH_CONTINUA)
  python3 replay.py carpeta/                    todos los .BIN de la carpeta
  opciones: --inicio tierra|armed|launch  --cohete d|h  --arma-en S  --launch-en S  --cola S  --salida DIR  --sin-criterios
Escribe en --salida (por omision test/host/build/replay/, ignorado por git): reporte.md, reporte.csv, reporte.json y un .json por vuelo con todos los eventos.
Sale con 1 si, en algun vuelo con verdad, BOOST no llega en menos de BOOST_MAX_S desde el despegue o hay transiciones falsas.
"""
import argparse
import csv
import json
import os
import re
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent                 # test/host/replay
HOST = AQUI.parent                                     # test/host
SRC = HOST.parents[1] / "src"                          # firmware/cohete/src
RAIZ = HOST.parents[3]
BUILD = HOST / "build"
SALIDA = BUILD / "replay"
SINTETICOS = RAIZ / "estacion" / "vuelos_replay"       # donde estacion/vuelos_replay.py (T-304) deja sus archivos

# --- Las fuentes que se compilan. Para sumar un detector nuevo (T-412: moment_detect.cpp) basta una linea en FUENTES_DETECTORES; ver enganches.h ---
FUENTES_DETECTORES = ["boost_detect.cpp"]
FUENTES_MISION = ["mission.cpp", "ext_act.cpp", "ext_bmp.cpp"]
EXE = BUILD / "prueba_replay"

BOOST_MAX_S = 0.2                                      # maquina_estados.md seccion 6: BOOST en < 0,2 s desde el despegue
N_SINTETICOS = 24                                      # P-03: 2 cohetes x 3 eyecciones x 2 ruidos x 2 semillas

# Columnas del reporte: (nombre, evento de la verdad con el que se compara). T-412 llena las de COAST a RECOVERY; antes salen vacias
COLUMNAS = [("BOOST", "LIFTOFF"), ("COAST", "BURNOUT"), ("APOGEO", "APOGEE"), ("CAIDA", None), ("PARACAIDAS", "PARACAIDAS_ABRE"),
            ("ATERRIZAJE", "GROUND_HIT"), ("RECOVERY", None)]
DESPUES_DE_BOOST = [c for c, _ in COLUMNAS[1:]]
CRITERIO_BOOST = {1: "inercial", 2: "barometrico"}      # arg del T_MISSION automatico (boost_detect.h: BoostKind)
REPOSO_PREVIO_S = 9.0                                  # los sinteticos de T-304 tienen 10 s de reposo en la rampa antes del encendido (--reposo-antes)
APOGEO_MAX_ERR_S = 0.3                                # P-03: error de apogeo < 0,3 s (se evalua cuando exista T-412)


class SinteticosNoDisponibles(Exception):
    pass


# ----------------------------------------------------------------------------------------------------------------------------------------------
# Compilacion y corrida
# ----------------------------------------------------------------------------------------------------------------------------------------------

def _fuentes():
    return [SRC / f for f in FUENTES_DETECTORES + FUENTES_MISION]


def comando_compilar():
    inc = ["-I" + str(HOST / "stubs"), "-I" + str(AQUI), "-I" + str(RAIZ / "firmware" / "common" / "net_proto"), "-I" + str(RAIZ / "firmware" / "common"), "-I" + str(SRC)]
    return ["g++", "-std=gnu++11", "-O1", "-Wall", "-Wextra"] + inc + ["-o", str(EXE), str(AQUI / "prueba_replay.cpp")] + [str(f) for f in _fuentes()]


def compilar(forzar=False, mostrar=True):
    """Compila el banco si falta o si algo cambio (las fuentes, sus cabeceras, los stubs o el propio arnes)."""
    BUILD.mkdir(parents=True, exist_ok=True)
    deps = list(SRC.glob("*.h")) + _fuentes() + list(HOST.glob("stubs/**/*.h")) + list(AQUI.glob("*.cpp")) + list(AQUI.glob("*.h")) + list((RAIZ / "firmware" / "common" / "net_proto").glob("*.h"))
    if not forzar and EXE.exists() and EXE.stat().st_mtime >= max(p.stat().st_mtime for p in deps):
        return EXE
    cmd = comando_compilar()
    if mostrar:
        print("$", " ".join(cmd))
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode or "warning" in r.stderr:
        raise RuntimeError("el banco de replay no compila limpio:\n" + r.stderr)
    return EXE


def verificar_enganches():
    """Los detectores que ext_lsm.cpp o in_imu.cpp llaman por muestra tienen que estar tambien en enganches.h. Devuelve las llamadas que faltan."""
    texto = (AQUI / "enganches.h").read_text(encoding="utf-8")
    faltan = []
    for f in ("ext_lsm.cpp", "in_imu.cpp"):
        for linea in (SRC / f).read_text(encoding="utf-8").splitlines():
            if linea.lstrip().startswith("//"):
                continue
            for nombre in re.findall(r"\b((?:boost|moment)[A-Za-z0-9_]*)\(", linea.split("//")[0]):
                if nombre + "(" not in texto:
                    faltan.append("%s llama a %s() y enganches.h no" % (f, nombre))
    return faltan


def correr(bins, inicio="armed", cohete=None, arma_en=2.0, launch_en=4.0, cola=2.0, exe=None, hasta=None):
    """Corre prueba_replay sobre uno o varios .BIN consecutivos y devuelve su JSON (dict). hasta = solo los primeros S segundos del registro."""
    exe = exe or compilar()
    cmd = [str(exe), "--inicio", inicio, "--arma-en", str(arma_en), "--launch-en", str(launch_en), "--cola", str(cola)]
    if cohete:
        cmd += ["--cohete", cohete]
    if hasta is not None:
        cmd += ["--hasta", str(hasta)]
    cmd += [str(b) for b in bins]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError("prueba_replay fallo (%d) con %s:\n%s" % (r.returncode, " ".join(map(str, bins)), r.stderr))
    return json.loads(r.stdout)


def leer_verdad(bin_):
    ruta = Path(str(bin_)[:-4] + ".verdad.json") if str(bin_).lower().endswith(".bin") else Path(str(bin_) + ".verdad.json")
    if not ruta.exists():
        return None
    return json.loads(ruta.read_text(encoding="utf-8"))


# ----------------------------------------------------------------------------------------------------------------------------------------------
# Analisis de un vuelo
# ----------------------------------------------------------------------------------------------------------------------------------------------

def analizar(res, verdad=None):
    """Del JSON de prueba_replay (y la verdad, si hay): los eventos detectados con su t_us, los errores y las transiciones falsas."""
    ev = res["eventos"]
    cambios = [e for e in ev if e["tipo"] == "cambio"]
    det = {}                                           # columna -> t_us de la primera vez
    for e in cambios:
        for col in DESPUES_DE_BOOST + ["BOOST"]:
            if e["momento"] == col and col not in det:
                det[col] = e["t_us"]
        if e["estado"] == "RECOVERY" and "RECOVERY" not in det:
            det["RECOVERY"] = e["t_us"]
    autos = [e for e in ev if e["tipo"] == "T_MISSION" and e["op"] == 0 and e["arg"] in CRITERIO_BOOST]
    out = dict(det=det, verdad=bool(verdad), boost_auto=len(autos), criterio=None, valor=None, falsas=[], errores={}, retraso_ign_s=None)
    if autos:
        out["criterio"] = CRITERIO_BOOST[autos[0]["arg"]]
        out["valor"] = autos[0]["contador"]            # dv en cm/s (inercial) o salto en cm (barometrico)
        out["t_boost_us"] = autos[0]["t_us"]
    # secuencia de (estado, momento) y retrocesos
    rango, ant, retro = None, None, []
    for e in cambios:
        r = (e["estado_cod"], e["momento_cod"])
        if rango is not None and r < rango:
            retro.append("retroceso %s/%s -> %s/%s a t_us=%d" % (ant[0], ant[1], e["estado"], e["momento"], e["t_us"]))
        if rango is None or r > rango:
            rango = r
        ant = (e["estado"], e["momento"])
    out["secuencia"] = [c for c, _ in COLUMNAS if c in det]
    if len(autos) > 1:
        out["falsas"].append("BOOST repetido: %d T_MISSION automaticos de BOOST" % len(autos))
    out["falsas"] += retro
    if verdad:
        evs = verdad["eventos"]
        t_ign = evs["IGNITION"]["t_us"]
        for col, nombre in COLUMNAS:
            if col in det and nombre:
                out["errores"][col] = (det[col] - evs[nombre]["t_us"]) / 1e6
        if "BOOST" in det:
            out["retraso_ign_s"] = (det["BOOST"] - t_ign) / 1e6
            if det["BOOST"] < t_ign:
                out["falsas"].append("BOOST antes del despegue: %.3f s antes de IGNITION" % ((t_ign - det["BOOST"]) / 1e6))
        # cambios antes del despegue que no sean los del guion del operador (armar; y LAUNCH si se pidio)
        permitido = {("ARMED", "-")} | ({("FLY", "LAUNCH")} if res["inicio"] == "launch" else set())
        for e in cambios:
            if e["t_us"] < t_ign and (e["estado"], e["momento"]) not in permitido and (e["estado"], e["momento"]) != ("TIERRA", "-"):
                out["falsas"].append("cambio a %s/%s antes del despegue (t_us=%d)" % (e["estado"], e["momento"], e["t_us"]))
    return out


# ----------------------------------------------------------------------------------------------------------------------------------------------
# Reporte
# ----------------------------------------------------------------------------------------------------------------------------------------------

def _f(x, d=3):
    return "" if x is None else ("%." + str(d) + "f") % x


def fila(nombre, res, an, verdad):
    f = dict(archivo=nombre, cohete={1: "Demeter", 2: "Hermes"}.get(res["cohete_id"], "?"), inicio=res["inicio"], t_ini_us=res["t_ini_us"], t_fin_us=res["t_fin_us"],
             con_verdad="si" if verdad else "no", t_boost_us=an.get("t_boost_us", ""), criterio=an["criterio"] or "", valor=an["valor"] if an["valor"] is not None else "",
             retraso_ign_s=_f(an["retraso_ign_s"]))
    for col, _ in COLUMNAS:
        f["t_%s_us" % col] = an["det"].get(col, "")
        f["err_%s_s" % col] = _f(an["errores"].get(col))
    f.update(boost_repetidos=max(0, an["boost_auto"] - 1), falsas=len(an["falsas"]), detalle_falsas=" | ".join(an["falsas"]),
             secuencia=">".join(an["secuencia"]), avisos=" | ".join(res["avisos"]))
    return f


def resumen(filas):
    con = [f for f in filas if f["con_verdad"] == "si"]
    ret = [float(f["retraso_ign_s"]) for f in con if f["retraso_ign_s"] != ""]
    nb = sum(1 for f in filas if f["t_boost_us"] != "")
    peor = max(con, key=lambda f: float(f["retraso_ign_s"]) if f["retraso_ign_s"] != "" else 9e9, default=None)
    ap = [abs(float(f["err_APOGEO_s"])) for f in filas if f["err_APOGEO_s"] != ""]
    seq = sum(1 for f in filas if all(c in f["secuencia"].split(">") for c in ("BOOST", "COAST", "APOGEO", "PARACAIDAS", "ATERRIZAJE")))
    return dict(vuelos=len(filas), con_verdad=len(con), con_boost=nb, retraso_max_s=max(ret) if ret else None, retraso_medio_s=(sum(ret) / len(ret)) if ret else None,
                retraso_peor_archivo=peor["archivo"] if peor else None, falsas=sum(f["falsas"] for f in filas), vuelos_con_falsas=sum(1 for f in filas if f["falsas"]),
                boost_repetidos=sum(f["boost_repetidos"] for f in filas), secuencia_completa=seq, apogeo_err_max_s=max(ap) if ap else None, apogeos_medidos=len(ap))


def criterios(filas):
    """Los criterios que ya se pueden comprobar (BOOST y transiciones falsas). Devuelve (lista de fallos, resumen)."""
    r = resumen(filas)
    fallos = []
    for f in filas:
        if f["con_verdad"] != "si":
            continue
        if f["t_boost_us"] == "":
            fallos.append("%s: no hubo BOOST" % f["archivo"])
        elif float(f["retraso_ign_s"]) >= BOOST_MAX_S:
            fallos.append("%s: BOOST a %s s del despegue (limite %g s)" % (f["archivo"], f["retraso_ign_s"], BOOST_MAX_S))
        if f["falsas"]:
            fallos.append("%s: transiciones falsas: %s" % (f["archivo"], f["detalle_falsas"]))
    return fallos, r


def escribir_reportes(vuelos, salida):
    """vuelos = [(nombre, res, an, verdad)]. Escribe reporte.csv, reporte.json, reporte.md y un .json por vuelo en `salida`."""
    salida = Path(salida)
    salida.mkdir(parents=True, exist_ok=True)
    filas = [fila(n, r, a, v) for n, r, a, v in vuelos]
    for n, r, a, v in vuelos:
        (salida / (n + ".json")).write_text(json.dumps(dict(replay=r, analisis=a, verdad=v), indent=1), encoding="utf-8")
    with open(salida / "reporte.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(filas[0].keys()) if filas else [])
        w.writeheader()
        w.writerows(filas)
    fallos, r = criterios(filas)
    (salida / "reporte.json").write_text(json.dumps(dict(tarea="T-305", resumen=r, fallos=fallos, vuelos=filas), indent=1), encoding="utf-8")
    L = ["# Reporte del banco de replay (T-305)", "",
         "Tiempos en s desde el inicio del registro salvo que se diga otra cosa; `error` = detectado - verdad (positivo = tarde). `retraso` = BOOST - IGNITION (el inicio de la fuerza, "
         "como en test/host/correr_pruebas.py); el error de BOOST se mide contra LIFTOFF (el evento de OpenRocket, 0,03 s despues).", "",
         "## Resumen", "",
         "| | |", "| --- | --- |",
         "| Vuelos | %d (con verdad: %d) |" % (r["vuelos"], r["con_verdad"]),
         "| Con BOOST detectado | %d |" % r["con_boost"],
         "| Retraso de BOOST: maximo / medio | %s s / %s s (%s) |" % (_f(r["retraso_max_s"]), _f(r["retraso_medio_s"]), r["retraso_peor_archivo"] or "-"),
         "| Transiciones falsas | %d en %d vuelos (BOOST repetidos: %d) |" % (r["falsas"], r["vuelos_con_falsas"], r["boost_repetidos"]),
         "| Secuencia COAST > APOGEO > PARACAIDAS > ATERRIZAJE completa (T-412) | %d de %d |" % (r["secuencia_completa"], r["vuelos"]),
         "| Error de apogeo, maximo (T-412) | %s |" % (_f(r["apogeo_err_max_s"]) + " s en %d vuelos" % r["apogeos_medidos"] if r["apogeo_err_max_s"] is not None else "sin medir: falta T-412"),
         "", "Criterio comprobable hoy: BOOST en < %g s desde el despegue y cero transiciones falsas. Resultado: **%s**." % (BOOST_MAX_S, "FALLA" if fallos else "se cumple"), ""]
    for x in fallos:
        L.append("- FALLA: " + x)
    L += ["", "## Por vuelo", "",
          "| Archivo | Cohete | Inicio | t BOOST (s) | Criterio | Retraso (s) | Error vs LIFTOFF (s) | Falsas | Secuencia |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"]
    for f in filas:
        tb = "" if f["t_boost_us"] == "" else _f((f["t_boost_us"] - f["t_ini_us"]) / 1e6)
        L.append("| %s | %s | %s | %s | %s | %s | %s | %d | %s |" % (f["archivo"], f["cohete"], f["inicio"], tb, f["criterio"], f["retraso_ign_s"], f["err_BOOST_s"], f["falsas"], f["secuencia"]))
    L += ["", "## Momentos por detectar (T-412)", "",
          "Vacio hasta que exista la deteccion. Error contra el evento verdadero: COAST contra BURNOUT, APOGEO contra APOGEE, PARACAIDAS contra PARACAIDAS_ABRE, ATERRIZAJE contra GROUND_HIT; CAIDA y RECOVERY no tienen verdad.", "",
          "| Archivo | " + " | ".join("%s t (s) | %s err (s)" % (c, c) for c in DESPUES_DE_BOOST) + " |", "| --- |" + " --- | --- |" * len(DESPUES_DE_BOOST)]
    for f in filas:
        L.append("| %s | " % f["archivo"] + " | ".join("%s | %s" % ("" if f["t_%s_us" % c] == "" else _f((f["t_%s_us" % c] - f["t_ini_us"]) / 1e6), f["err_%s_s" % c]) for c in DESPUES_DE_BOOST) + " |")
    L += ["", "## Eventos de cada vuelo", ""]
    for n, rs, a, v in vuelos:
        t0 = rs["t_ini_us"]
        L += ["### " + n, ""]
        if v:
            L.append("Verdad (s): " + ", ".join("%s %.3f" % (k, (x["t_us"] - t0) / 1e6) for k, x in v["eventos"].items()))
            L.append("")
        for e in rs["eventos"]:
            if e["tipo"] in ("inicio", "cambio"):
                L.append("- %.3f s: %s/%s (banderas 0x%02X)%s" % ((e["t_us"] - t0) / 1e6, e["estado"], e["momento"], e["flags"], "" if e["tipo"] == "inicio" else " desde %s" % e["antes"]))
            elif e["tipo"] == "T_MISSION" and e["op"] == 0:
                L.append("- %.3f s: T_MISSION automatico, arg %d%s, contador %d" % ((e["t_us"] - t0) / 1e6, e["arg"], " (BOOST " + CRITERIO_BOOST[e["arg"]] + ")" if e["arg"] in CRITERIO_BOOST else "", e["contador"]))
        for x in a["falsas"]:
            L.append("- **TRANSICION FALSA:** " + x)
        for x in rs["avisos"]:
            L.append("- aviso: " + x)
        L.append("")
    (salida / "reporte.md").write_text("\n".join(L), encoding="utf-8")
    return filas, fallos, r


# ----------------------------------------------------------------------------------------------------------------------------------------------
# Sinteticos de T-304
# ----------------------------------------------------------------------------------------------------------------------------------------------

def asegurar_sinteticos(carpeta=SINTETICOS):
    """Devuelve los .BIN sinteticos. Si faltan, corre estacion/vuelos_replay.py (unos 10 s por archivo; necesita numpy y scipy)."""
    carpeta = Path(carpeta)
    bins = sorted(carpeta.glob("*_SINT_*.BIN"))
    if len(bins) >= N_SINTETICOS:
        return bins
    print("faltan sinteticos (%d de %d): generandolos con estacion/vuelos_replay.py en %s (unos %d min)" % (len(bins), N_SINTETICOS, carpeta, N_SINTETICOS * 10 // 60 + 1))
    r = subprocess.run([sys.executable, str(RAIZ / "estacion" / "vuelos_replay.py"), "--salida", str(carpeta)], capture_output=True, text=True)
    if r.returncode:
        raise SinteticosNoDisponibles("no se pudieron generar los sinteticos (hace falta un Python con numpy y scipy): " + (r.stderr.strip().splitlines() or ["?"])[-1])
    bins = sorted(carpeta.glob("*_SINT_*.BIN"))
    if len(bins) < N_SINTETICOS:
        raise SinteticosNoDisponibles("el generador dejo %d archivos, se esperaban %d" % (len(bins), N_SINTETICOS))
    return bins


def correr_lote(bins, inicio="armed", cohete=None, arma_en=2.0, launch_en=4.0, cola=2.0, exe=None):
    vuelos = []
    for b in bins:
        verdad = leer_verdad(b)
        res = correr([b], inicio, cohete, arma_en, launch_en, cola, exe)
        vuelos.append((Path(b).stem, res, analizar(res, verdad), verdad))
    return vuelos


def para_pruebas(anotar, filas_tabla, sin_replay=False, carpeta=SINTETICOS, salida=SALIDA):
    """Lo que correr_pruebas.py agrega a su tabla: el banco sobre los sinteticos. anotar(nombre, ok, detalle) cuenta como criterio; filas_tabla.append((nombre, estado, detalle)) no."""
    if sin_replay:
        filas_tabla.append(("replay P-03: el banco sobre los sinteticos de T-304", "OMITIDO", "--sin-replay"))
        return
    faltan = verificar_enganches()
    anotar("replay: los detectores que llaman ext_lsm.cpp e in_imu.cpp estan en enganches.h", not faltan, "; ".join(faltan) or "boost* y moment* de los dos consumidores repetidos en el banco")
    try:
        bins = asegurar_sinteticos(carpeta)
    except SinteticosNoDisponibles as e:
        filas_tabla.append(("replay P-03: el banco sobre los sinteticos de T-304", "OMITIDO", str(e)))
        return
    exe = compilar()
    vuelos = correr_lote(bins, exe=exe)
    filas, fallos, r = escribir_reportes(vuelos, salida)
    peor = max(filas, key=lambda f: float(f["retraso_ign_s"]) if f["retraso_ign_s"] != "" else 9e9)
    ok_b = r["con_boost"] == len(filas) and not any("BOOST a" in x or "no hubo BOOST" in x for x in fallos)
    anotar("replay P-03: BOOST en < %g s desde el despegue en los %d vuelos (el cohete armado en la rampa)" % (BOOST_MAX_S, len(filas)), ok_b,
           "retraso maximo %s s (%s), medio %s s" % (_f(r["retraso_max_s"]), peor["archivo"], _f(r["retraso_medio_s"])))
    anotar("replay P-03: cero transiciones falsas en los %d vuelos" % len(filas), r["falsas"] == 0, "%d transiciones falsas en %d vuelos" % (r["falsas"], r["vuelos_con_falsas"]) + ("; " + fallos[-1] if r["falsas"] else ""))
    # Control negativo: el cohete armado en la rampa, solo hasta antes del encendido (10 s despues del inicio del registro): ni BOOST ni ningun otro cambio
    neg = []
    for b in (b for b in bins if "_r3_s01" in b.name and "_en_" in b.name):
        res = correr([b], exe=exe, hasta=REPOSO_PREVIO_S)
        an = analizar(res, leer_verdad(b))
        neg.append((b.stem, "BOOST" in an["det"] or bool(an["falsas"]) or any(e["tipo"] == "T_MISSION" and e["op"] == 0 for e in res["eventos"])))
    anotar("replay P-03: control negativo, el reposo en la rampa armado (%g s antes del encendido) no da BOOST ni cambios" % REPOSO_PREVIO_S, bool(neg) and not any(m for _, m in neg),
           "%d archivos (%s)" % (len(neg), ", ".join(n for n, _ in neg)))
    filas_tabla.append(("informativa P-03: secuencia COAST > APOGEO > PARACAIDAS > ATERRIZAJE", "INFO", "%d de %d vuelos (T-412 todavia no existe: solo se detecta BOOST)" % (r["secuencia_completa"], len(filas))))
    filas_tabla.append(("informativa P-03: error de apogeo < %g s" % APOGEO_MAX_ERR_S, "INFO", "sin medir: falta T-412" if r["apogeo_err_max_s"] is None else "maximo %s s en %d vuelos" % (_f(r["apogeo_err_max_s"]), r["apogeos_medidos"])))
    filas_tabla.append(("informativa P-03: reporte del banco", "INFO", str(Path(salida) / "reporte.md")))


# ----------------------------------------------------------------------------------------------------------------------------------------------

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("rutas", nargs="*", help=".BIN o carpetas; sin nada, los 24 sinteticos de T-304")
    ap.add_argument("--consecutivos", action="store_true", help="los .BIN dados son un solo registro (FILEHDR con FH_CONTINUA)")
    ap.add_argument("--inicio", default="armed", choices=("tierra", "armed", "launch"))
    ap.add_argument("--cohete", choices=("d", "h"), help="por omision, el del FILEHDR")
    ap.add_argument("--arma-en", type=float, default=2.0)
    ap.add_argument("--launch-en", type=float, default=4.0)
    ap.add_argument("--cola", type=float, default=2.0)
    ap.add_argument("--salida", default=str(SALIDA))
    ap.add_argument("--sin-criterios", action="store_true", help="no falla aunque no se cumpla el criterio de BOOST o haya transiciones falsas")
    a = ap.parse_args(argv)
    faltan = verificar_enganches()
    if faltan:
        print("ENGANCHES INCOMPLETOS:\n  " + "\n  ".join(faltan), file=sys.stderr)
        return 1
    exe = compilar()
    if not a.rutas:
        grupos = [[b] for b in asegurar_sinteticos()]
    else:
        bins = []
        for r in a.rutas:
            p = Path(r)
            bins += sorted(p.glob("*.BIN")) + sorted(p.glob("*.bin")) if p.is_dir() else [p]
        grupos = [bins] if a.consecutivos else [[b] for b in bins]
    vuelos = []
    for g in grupos:
        res = correr(g, a.inicio, a.cohete, a.arma_en, a.launch_en, a.cola, exe)
        vuelos.append((Path(g[0]).stem + ("+%d" % (len(g) - 1) if len(g) > 1 else ""), res, analizar(res, leer_verdad(g[0])), leer_verdad(g[0])))
    filas, fallos, r = escribir_reportes(vuelos, a.salida)
    for f in filas:
        print("%-38s %-8s BOOST %s s  retraso %s s  err vs LIFTOFF %s s  %s%s" % (f["archivo"], f["cohete"], _f((f["t_boost_us"] - f["t_ini_us"]) / 1e6) if f["t_boost_us"] != "" else "sin",
                                                                                  f["retraso_ign_s"] or "-", f["err_BOOST_s"] or "-", f["secuencia"] or "sin eventos",
                                                                                  ("  FALSAS: " + f["detalle_falsas"]) if f["falsas"] else ""))
    print("\nvuelos %d (con verdad %d), con BOOST %d; retraso maximo %s s, medio %s s; transiciones falsas %d" % (r["vuelos"], r["con_verdad"], r["con_boost"], _f(r["retraso_max_s"]) or "-", _f(r["retraso_medio_s"]) or "-", r["falsas"]))
    print("reporte: %s" % (Path(a.salida) / "reporte.md"))
    for x in fallos:
        print("FALLA:", x)
    return 1 if fallos and not a.sin_criterios else 0


if __name__ == "__main__":
    sys.exit(main())
