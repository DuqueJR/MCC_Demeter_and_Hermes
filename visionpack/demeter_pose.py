#!/usr/bin/env python3
"""Pose de la LilyGo para el VisionPack: trama POSE (0x21), cuaterniones, reloj de mision y camaras.

Convenciones (las del firmware y el EKF):
- NED; cuerpo FRD: X hacia la nariz, Y a la derecha (mirando de la cola a la nariz con la marca arriba), Z opuesto a la marca.
- Cuaternion Hamilton, escalar primero, de cuerpo a NED: v_ned = q * v_cuerpo * q^-1.
- Camara al estilo OpenCV: x a la derecha de la imagen, y hacia abajo de la imagen, z por el eje optico.

Lo comparten demeter_telemetryd.py (decodifica y alimenta chrony), demeter_postprocess.py (pose de cada cuadro)
y lilygo_emulator.py (genera tramas).
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import math
from pathlib import Path
import socket
import struct
from typing import Any, Sequence

from demeter_protocol import POSE_UPDATE as POSE

# utc_us, seq, flags, lat_e7, lon_e7, alt_agl_cm, suelo_msl_cm, vn, ve, vd (cm/s), q[4] (x32767), giro[3] (0.1 dps),
# sd_actitud (0.01 grados), sd_pos (cm), sd_alt (cm)
POSE_STRUCT = struct.Struct("<QHHiiiihhh4h3hHHH")
POSE_FRAME_BYTES = 2 + 2 + POSE_STRUCT.size + 2

F_EKF = 1 << 0           # el filtro corre y converge
F_ATT = 1 << 1           # actitud valida
F_POS = 1 << 2           # posicion horizontal valida
F_ALT = 1 << 3           # altura valida (barometros con su p0)
F_TIME_SRC_SHIFT = 4     # bits 4-5: fuente de la hora
F_TIME_SRC_MASK = 3 << F_TIME_SRC_SHIFT
F_TIME = 1 << 6          # hora de mision valida (error < 1 ms)
F_GNSS3D = 1 << 7        # GNSS con fix 3D
F_FLY = 1 << 8           # la LilyGo esta en FLY
TIME_SOURCES = ("ninguna", "gnss_pps", "baliza_tierra", "retencion")

Q_SCALE = 32767.0


def decode_flags(flags: int) -> dict[str, Any]:
    return {
        "ekf": bool(flags & F_EKF), "actitud": bool(flags & F_ATT), "posicion": bool(flags & F_POS),
        "altura": bool(flags & F_ALT), "hora": bool(flags & F_TIME), "gnss_3d": bool(flags & F_GNSS3D),
        "en_vuelo": bool(flags & F_FLY), "fuente_hora": TIME_SOURCES[(flags & F_TIME_SRC_MASK) >> F_TIME_SRC_SHIFT],
    }


def q_normalize(q: Sequence[float]) -> list[float]:
    n = math.sqrt(sum(c * c for c in q))
    if not math.isfinite(n) or n < 1e-6:
        raise ValueError("cuaternion nulo o invalido")
    return [c / n for c in q]


def q_mul(a: Sequence[float], b: Sequence[float]) -> list[float]:
    aw, ax, ay, az = a
    bw, bx, by, bz = b
    return [aw * bw - ax * bx - ay * by - az * bz,
            aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw]


def q_rotate(q: Sequence[float], v: Sequence[float]) -> list[float]:
    w, x, y, z = q
    p = q_mul(q_mul(q, [0.0, *v]), [w, -x, -y, -z])
    return p[1:]


def q_from_matrix(m: Sequence[Sequence[float]]) -> list[float]:
    """Matriz de rotacion (filas) a cuaternion, escalar primero."""
    tr = m[0][0] + m[1][1] + m[2][2]
    if tr > 0:
        s = math.sqrt(tr + 1.0) * 2
        q = [0.25 * s, (m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s]
    elif m[0][0] > m[1][1] and m[0][0] > m[2][2]:
        s = math.sqrt(1.0 + m[0][0] - m[1][1] - m[2][2]) * 2
        q = [(m[2][1] - m[1][2]) / s, 0.25 * s, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s]
    elif m[1][1] > m[2][2]:
        s = math.sqrt(1.0 + m[1][1] - m[0][0] - m[2][2]) * 2
        q = [(m[0][2] - m[2][0]) / s, (m[0][1] + m[1][0]) / s, 0.25 * s, (m[1][2] + m[2][1]) / s]
    else:
        s = math.sqrt(1.0 + m[2][2] - m[0][0] - m[1][1]) * 2
        q = [(m[1][0] - m[0][1]) / s, (m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, 0.25 * s]
    q = q_normalize(q)
    return q if q[0] >= 0 else [-c for c in q]


def slerp(a: Sequence[float], b: Sequence[float], f: float) -> list[float]:
    """Interpolacion esferica. Euler no sirve aqui: con el cohete vertical el pitch vale +-90 y roll/yaw no existen."""
    dot = sum(x * y for x, y in zip(a, b))
    if dot < 0:
        b, dot = [-c for c in b], -dot
    if dot > 0.9995:
        return q_normalize([x + f * (y - x) for x, y in zip(a, b)])
    th = math.acos(min(1.0, dot))
    s = math.sin(th)
    wa, wb = math.sin((1 - f) * th) / s, math.sin(f * th) / s
    return [wa * x + wb * y for x, y in zip(a, b)]


# ---------------- trama ----------------

def encode_pose(utc_us: int, seq: int, flags: int, lat_deg: float, lon_deg: float, alt_agl_m: float, ground_msl_m: float,
                v_ned_mps: Sequence[float], q_body_ned: Sequence[float], gyro_body_dps: Sequence[float],
                sd_att_deg: float, sd_pos_m: float, sd_alt_m: float) -> bytes:
    q = q_normalize(q_body_ned)
    clamp16 = lambda v: max(-32768, min(32767, int(round(v))))
    clampu = lambda v: max(0, min(65535, int(round(v))))
    return POSE_STRUCT.pack(
        utc_us, seq & 0xFFFF, flags & 0xFFFF, int(round(lat_deg * 1e7)), int(round(lon_deg * 1e7)),
        int(round(alt_agl_m * 100)), int(round(ground_msl_m * 100)), *(clamp16(v * 100) for v in v_ned_mps),
        *(clamp16(c * Q_SCALE) for c in q), *(clamp16(g * 10) for g in gyro_body_dps),
        clampu(sd_att_deg * 100), clampu(sd_pos_m * 100), clampu(sd_alt_m * 100))


def decode_pose(payload: bytes) -> dict[str, Any]:
    if len(payload) != POSE_STRUCT.size:
        raise ValueError(f"payload 0x21 debe tener {POSE_STRUCT.size} bytes")
    (utc_us, seq, flags, lat, lon, agl, ground, vn, ve, vd, qw, qx, qy, qz, gx, gy, gz,
     sd_att, sd_pos, sd_alt) = POSE_STRUCT.unpack(payload)
    q = q_normalize([qw / Q_SCALE, qx / Q_SCALE, qy / Q_SCALE, qz / Q_SCALE])
    return {
        "utc_us": utc_us, "seq": seq, "flags": flags,
        "lat": lat / 1e7, "lon": lon / 1e7, "alt_agl": agl / 100.0, "alt_msl": (agl + ground) / 100.0,
        "suelo_msl": ground / 100.0, "v_ned": [vn / 100.0, ve / 100.0, vd / 100.0], "q": q,
        "giro_dps": [gx / 10.0, gy / 10.0, gz / 10.0],
        "sd_actitud_deg": sd_att / 100.0, "sd_pos_m": sd_pos / 100.0, "sd_alt_m": sd_alt / 100.0,
    }


# ---------------- reloj de mision ----------------

def frame_seconds(baud: int, n_bytes: int = POSE_FRAME_BYTES) -> float:
    """Lo que tarda la trama en llegar completa: utc_us marca el primer byte."""
    return n_bytes * 10.0 / baud


def clock_offset_s(utc_us: int, pi_rx_s: float, baud: int) -> float:
    """Hora de mision menos reloj de la Pi, al recibir. Sesgada hacia abajo por la latencia de lectura:
    por eso se toma el maximo de una ventana (la trama que llego mas rapido)."""
    return utc_us / 1e6 + frame_seconds(baud) - pi_rx_s


class ChronyFeeder:
    """Entrega a chronyd (refclock SOCK) el mejor desfase de cada ventana. chronyd disciplina el reloj de la Pi."""

    MAGIC = 0x534F434B
    SAMPLE = struct.Struct("@qqdiiii")    # struct timeval, double offset, int pulse, int leap, int pad, int magic

    def __init__(self, path: Path, window_s: float = 0.25) -> None:
        self.path = str(path)
        self.window_s = window_s
        self.best: tuple[float, float] | None = None    # (offset, pi_rx)
        self.t0: float | None = None
        self.sent = 0
        self.errors = 0
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)

    def add(self, offset_s: float, pi_rx_s: float) -> bool:
        if self.t0 is None:
            self.t0 = pi_rx_s
        if self.best is None or offset_s > self.best[0]:
            self.best = (offset_s, pi_rx_s)
        if pi_rx_s - self.t0 < self.window_s:
            return False
        offset, rx = self.best
        self.best, self.t0 = None, None
        sec = int(math.floor(rx))
        try:
            self.sock.sendto(self.SAMPLE.pack(sec, int((rx - sec) * 1e6), offset, 0, 0, 0, self.MAGIC), self.path)
            self.sent += 1
            return True
        except OSError:
            self.errors += 1
            return False

    def close(self) -> None:
        self.sock.close()


def mission_offset_at(samples: Sequence[dict[str, Any]], pi_ts: float, baud: int, window_s: float = 5.0) -> float | None:
    """Desfase residual (hora de mision - reloj de la Pi) cerca de pi_ts, con el mejor caso de +-window_s.
    Con chrony funcionando es casi 0; si chrony no estaba, corrige todo el desfase."""
    best = None
    for s in samples:
        if abs(s["pi_ts"] - pi_ts) <= window_s and s["flags"] & F_TIME:
            o = clock_offset_s(s["utc_us"], s["pi_ts"], baud)
            best = o if best is None or o > best else best
    return best


# ---------------- camaras ----------------

def load_cameras(path: Path) -> dict[int, dict[str, Any]]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    out = {}
    for cam in data["camaras"]:
        r = cam["R_camara_a_cuerpo"]                   # columnas: ejes x, y, z de la camara en cuerpo FRD
        cam = dict(cam, q_camara_cuerpo=q_from_matrix(r), version=data.get("version"), archivo=Path(path).name)
        out[int(cam["indice"])] = cam
    return out


def intrinsics_for(cam: dict[str, Any], width: int, height: int) -> dict[str, Any]:
    nom = cam["intrinsecos_nominales"]
    scale = width / float(nom["ancho_px"])
    return {"fx_px": nom["fx_px"] * scale, "fy_px": nom["fy_px"] * scale, "cx_px": width / 2.0, "cy_px": height / 2.0,
            "ancho_px": width, "alto_px": height, "distorsion": nom.get("distorsion"), "calibrado": nom.get("calibrado", False)}


# ---------------- pose de un cuadro ----------------

def interpolate_pose(samples: Sequence[dict[str, Any]], t_utc_us: int, max_gap_s: float) -> dict[str, Any]:
    """samples ordenados por utc_us. Interpola posicion y velocidad lineal, actitud con slerp. No extrapola."""
    if not samples:
        return {"valida": False, "motivo": "sin_telemetria"}
    lo, hi = 0, len(samples)
    while lo < hi:
        mid = (lo + hi) // 2
        if samples[mid]["utc_us"] < t_utc_us:
            lo = mid + 1
        else:
            hi = mid
    if lo < len(samples) and samples[lo]["utc_us"] == t_utc_us:
        a = b = samples[lo]
        f = 0.0
    elif lo == 0 or lo == len(samples):
        return {"valida": False, "motivo": "fuera_de_la_telemetria"}
    else:
        a, b = samples[lo - 1], samples[lo]
        gap = (b["utc_us"] - a["utc_us"]) / 1e6
        if gap <= 0 or gap > max_gap_s:
            return {"valida": False, "motivo": "hueco_en_la_telemetria", "hueco_s": gap}
        f = (t_utc_us - a["utc_us"]) / (b["utc_us"] - a["utc_us"])
    lin = lambda k: a[k] + f * (b[k] - a[k])
    flags = a["flags"] & b["flags"]
    ok = decode_flags(flags)
    return {
        "valida": ok["ekf"] and ok["actitud"] and ok["hora"],
        "metodo": "exacta" if a is b else "slerp",
        "seq_antes": a["seq"], "seq_despues": b["seq"],
        "hueco_s": (b["utc_us"] - a["utc_us"]) / 1e6,
        "lat_deg": lin("lat"), "lon_deg": lin("lon"),
        "alt_agl_m": lin("alt_agl"), "alt_msl_m": lin("alt_msl"),
        "v_ned_mps": [x + f * (y - x) for x, y in zip(a["v_ned"], b["v_ned"])],
        "q_cuerpo_a_ned": slerp(a["q"], b["q"], f),
        "giro_cuerpo_dps": [x + f * (y - x) for x, y in zip(a["giro_dps"], b["giro_dps"])],
        "sd_actitud_deg": max(a["sd_actitud_deg"], b["sd_actitud_deg"]),
        "sd_pos_m": max(a["sd_pos_m"], b["sd_pos_m"]), "sd_alt_m": max(a["sd_alt_m"], b["sd_alt_m"]),
        "estado": ok,
    }


def camera_in_ned(pose: dict[str, Any], cam: dict[str, Any]) -> dict[str, Any]:
    q = q_mul(pose["q_cuerpo_a_ned"], cam["q_camara_cuerpo"])
    axis = q_rotate(q, [0.0, 0.0, 1.0])
    horiz = math.hypot(axis[0], axis[1])
    return {
        "q_camara_a_ned": q,
        "eje_optico_ned": axis,
        "angulo_desde_nadir_deg": math.degrees(math.atan2(horiz, axis[2])),
        "rumbo_eje_deg": (math.degrees(math.atan2(axis[1], axis[0])) % 360.0) if horiz > 1e-6 else None,
    }


def frame_record(row: dict[str, Any], camera: int, cameras: dict[int, dict[str, Any]], samples: Sequence[dict[str, Any]],
                 baud: int, max_gap_s: float) -> dict[str, Any]:
    """Lo que necesita vision artificial de un cuadro: hora de mision, pose y camara."""
    wall_ns = row.get("frame_wallclock_ns")
    exp_us = row.get("exposure_time_us")
    out: dict[str, Any] = {"tiempo": {"frame_wallclock_ns": wall_ns, "exposicion_us": exp_us}}
    cam = cameras.get(camera)
    if cam is not None:
        out["camara"] = {"indice": camera, "nombre": cam["nombre"], "calibracion": f'{cam["archivo"]} v{cam["version"]}',
                         "extrinsecos_confirmados": cam.get("confirmado", False),
                         "q_camara_a_cuerpo": cam["q_camara_cuerpo"],
                         "intrinsecos": intrinsics_for(cam, int(row.get("width", 0) or cam["intrinsecos_nominales"]["ancho_px"]),
                                                       int(row.get("height", 0) or cam["intrinsecos_nominales"]["alto_px"]))}
    if not isinstance(wall_ns, int) or isinstance(wall_ns, bool) or wall_ns <= 0:
        out["pose"] = {"valida": False, "motivo": "cuadro_sin_hora"}
        return out
    # SensorTimestamp es el inicio de la exposicion de la primera fila: se usa el centro de la exposicion
    mid_ns = wall_ns + int((exp_us or 0) * 500)
    resid = mission_offset_at(samples, mid_ns / 1e9, baud)
    t_ns = mid_ns + int(round((resid or 0.0) * 1e9))
    out["tiempo"].update({"centro_exposicion_utc_ns": t_ns, "residuo_reloj_ms": None if resid is None else resid * 1e3,
                          "hora_de_mision": resid is not None,
                          "utc": datetime.fromtimestamp(t_ns / 1e9, timezone.utc).isoformat(timespec="microseconds")})
    pose = interpolate_pose(samples, t_ns // 1000, max_gap_s)
    if resid is None and pose.get("valida"):
        pose["valida"] = False
        pose["motivo"] = "sin_hora_de_mision_cerca_del_cuadro"
    out["pose"] = pose
    if pose.get("q_cuerpo_a_ned") and cam is not None:
        out["camara_en_ned"] = camera_in_ned(pose, cam)
    return out


def load_pose_log(path: Path) -> list[dict[str, Any]]:
    rows = []
    if not Path(path).is_file():
        return rows
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            r = json.loads(line)
            if "utc_us" in r and "q" in r:
                rows.append(r)
        except ValueError:
            pass
    rows.sort(key=lambda r: r["utc_us"])
    return rows

