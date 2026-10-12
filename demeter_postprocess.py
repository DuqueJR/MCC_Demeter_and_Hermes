#!/usr/bin/env python3
"""Revelado offline de chunks RAW de Demeter.

Implementa un pipeline productor-consumidor: convierte COMP1 a Bayer16 con
praw2rgb y ejecuta controller_replay secuencialmente por frame; envía el
guardado/codificación JPEG/PNG a un pool acotado de hasta cuatro procesos y
añade sidecars JSON con telemetría interpolada.
El código no garantiza uso de cuatro núcleos ni invoca explícitamente el ISP
físico de la Pi.
"""

from __future__ import annotations

import argparse
from bisect import bisect_left
from concurrent.futures import FIRST_COMPLETED, BrokenExecutor, Future, ProcessPoolExecutor, wait
from datetime import datetime, timezone
import json
import logging
import math
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, BinaryIO

try:
    import cv2
    import numpy as np
except ImportError as exc:
    raise SystemExit(f"Falta una dependencia de imagen (numpy/opencv): {exc}") from exc


WIDTH = 4608
HEIGHT = 2592
LOG = logging.getLogger("demeter_postprocess")
CHUNK_NAME = re.compile(r"^chunk_[0-9]{4,}$")
ROOT = Path(__file__).resolve().parent
BUILD = Path(os.environ.get("DEMETER_BUILD_DIR", str(ROOT / ".build")))
RAW2RGB = Path(os.environ.get("PRAW2RGB", str(BUILD / "libpisp-build/src/examples/praw2rgb")))
CONTROLLER_REPLAY = Path(os.environ.get("CONTROLLER_REPLAY", str(BUILD / "bin/controller_replay")))
TUNING = Path(os.environ.get("DEMETER_TUNE", "/usr/share/libcamera/ipa/rpi/pisp/imx708.json"))
TEMP_ROOT = Path("/mnt/ramcam")
MISSION_EVENT_SOCKET = Path(os.environ.get("DEMETER_EVENT_SOCKET", "/tmp/demeter/mission.sock"))
MAX_WORKERS = 4
MAX_PENDING_FRAMES = MAX_WORKERS * 2


def init_worker() -> None:
    cv2.setNumThreads(1)


def integer_field(row: dict[str, Any], name: str, *, positive: bool = False) -> int:
    value = row.get(name)
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{name} debe ser un entero")
    if value < (1 if positive else 0):
        raise ValueError(f"{name} fuera de rango: {value}")
    return value


def read_at(stream: BinaryIO, offset: int, size: int, file_size: int, label: str) -> bytes:
    if size <= 0 or offset + size > file_size:
        raise ValueError(f"rango inválido para {label}: offset={offset}, bytes={size}")
    stream.seek(offset)
    data = stream.read(size)
    if len(data) != size:
        raise ValueError(f"lectura incompleta de {label}: {len(data)}/{size} bytes")
    return data


def run_checked(command: list[str], step: str) -> None:
    result = subprocess.run(
        command, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, errors="replace"
    )
    if result.returncode:
        stderr = (result.stderr or "").strip()[-4000:]
        raise RuntimeError(
            f"{step} terminó con código {result.returncode}; comando={command!r}; "
            f"stderr_final={stderr!r}"
        )


def emit_mission_event(event: dict[str, Any]) -> None:
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM) as channel:
            channel.sendto(json.dumps(event, separators=(",", ":")).encode(), str(MISSION_EVENT_SOCKET))
    except (FileNotFoundError, ConnectionRefusedError) as exc:
        LOG.debug("missiond no disponible para evento %s (%s)", event.get("kind"), exc)
    except OSError as exc:
        LOG.warning(
            "falló evento local kind=%s socket=%s (%s): %s",
            event.get("kind"), MISSION_EVENT_SOCKET, type(exc).__name__, exc,
        )


def save_images(
    rgb_bytes: bytes,
    jpeg_dir: Path,
    png_dir: Path,
    camera: int,
    frame_id: int,
    frame_sidecar: dict[str, Any],
) -> int:
    expected_bytes = WIDTH * HEIGHT * 3
    if len(rgb_bytes) != expected_bytes:
        raise ValueError(
            f"salida RGB de tamaño incorrecto: {len(rgb_bytes)}, esperado {expected_bytes}"
        )

    rgb = np.frombuffer(rgb_bytes, dtype=np.uint8).reshape((HEIGHT, WIDTH, 3))
    bgr = np.ascontiguousarray(rgb[..., ::-1])
    stem = f"cam{camera}_frame_{frame_id:06d}"
    jpg_path = jpeg_dir / f"{stem}.jpg"
    png_path = png_dir / f"{stem}.png"
    jpg_tmp = jpeg_dir / f".{stem}.tmp.jpg"
    png_tmp = png_dir / f".{stem}.tmp.png"

    try:
        if not cv2.imwrite(str(jpg_tmp), bgr, [cv2.IMWRITE_JPEG_QUALITY, 95]):
            raise RuntimeError(f"OpenCV no pudo escribir {jpg_tmp}")
        if not cv2.imwrite(str(png_tmp), bgr):
            raise RuntimeError(f"OpenCV no pudo escribir {png_tmp}")
        os.replace(jpg_tmp, jpg_path)
        os.replace(png_tmp, png_path)
        sidecar_path = jpeg_dir / f"{stem}.json"
        sidecar_tmp = jpeg_dir / f".{stem}.tmp.json"
        sidecar_tmp.write_text(json.dumps(frame_sidecar, indent=2, allow_nan=False) + "\n", encoding="utf-8")
        os.replace(sidecar_tmp, sidecar_path)
    finally:
        jpg_tmp.unlink(missing_ok=True)
        png_tmp.unlink(missing_ok=True)
        (jpeg_dir / f".{stem}.tmp.json").unlink(missing_ok=True)
    return jpg_path.stat().st_size + png_path.stat().st_size + sidecar_path.stat().st_size


def load_telemetry(path: Path) -> list[dict[str, float]]:
    samples: list[dict[str, float]] = []
    if not path.is_file():
        return samples
    with path.open(encoding="utf-8") as source:
        for line_number, line in enumerate(source, start=1):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
                sample = {name: float(row[name]) for name in ("pi_ts", "lilygo_ts", "alt", "roll", "pitch", "yaw")}
                if not all(math.isfinite(value) for value in sample.values()):
                    raise ValueError("valores NaN/Inf")
                samples.append(sample)
            except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
                LOG.warning(
                    "telemetry.jsonl línea=%d inválida (%s): %s",
                    line_number, type(exc).__name__, exc,
                )
    samples.sort(key=lambda sample: sample["pi_ts"])
    return samples


def interpolate_telemetry(
    samples: list[dict[str, float]], frame_ts: float | None, max_gap_s: float
) -> dict[str, Any]:
    if frame_ts is None or not math.isfinite(frame_ts):
        return {"valid": False, "reason": "frame_clock_unavailable"}
    if not samples:
        return {"valid": False, "reason": "telemetry_unavailable"}
    times = [sample["pi_ts"] for sample in samples]
    index = bisect_left(times, frame_ts)
    if index < len(samples) and abs(times[index] - frame_ts) <= 1e-6:
        sample = samples[index]
        return {"valid": True, "method": "exact", **{key: sample[key] for key in ("alt", "roll", "pitch", "yaw")}}
    if index == 0 or index == len(samples):
        return {"valid": False, "reason": "no_temporal_bracket"}
    before = samples[index - 1]
    after = samples[index]
    gap = after["pi_ts"] - before["pi_ts"]
    if gap <= 0 or gap > max_gap_s:
        return {"valid": False, "reason": "telemetry_gap_exceeded", "bracket_gap_s": gap}
    fraction = (frame_ts - before["pi_ts"]) / gap
    values = {
        key: before[key] + fraction * (after[key] - before[key])
        for key in ("alt", "roll", "pitch")
    }
    yaw_delta = (after["yaw"] - before["yaw"] + 180.0) % 360.0 - 180.0
    values["yaw"] = (before["yaw"] + fraction * yaw_delta) % 360.0
    return {
        "valid": True,
        "method": "linear",
        "pi_ts_before": before["pi_ts"],
        "pi_ts_after": after["pi_ts"],
        "bracket_gap_s": gap,
        **values,
    }


def develop_frame(
    row: dict[str, Any],
    raw_stream: BinaryIO,
    stats_stream: BinaryIO,
    raw_size: int,
    stats_size: int,
    camera: int,
    telemetry: list[dict[str, float]],
    max_telemetry_gap_s: float,
) -> tuple[bytes, dict[str, Any]]:
    width = integer_field(row, "width", positive=True)
    height = integer_field(row, "height", positive=True)
    if (width, height) != (WIDTH, HEIGHT):
        raise ValueError(f"dimensiones no soportadas: {width}x{height}")
    if "camera_index" in row and integer_field(row, "camera_index") != camera:
        raise ValueError("camera_index no coincide con el stream")

    raw_offset = integer_field(row, "raw_offset")
    raw_bytes = integer_field(row, "raw_bytes", positive=True)
    stats_offset = integer_field(row, "stats_offset")
    stats_bytes = integer_field(row, "stats_bytes", positive=True)
    frame_id = integer_field(row, "pair_index") if "pair_index" in row else integer_field(
        row, "frame_sequence"
    )

    raw_data = read_at(raw_stream, raw_offset, raw_bytes, raw_size, "COMP1")
    stats_data = read_at(stats_stream, stats_offset, stats_bytes, stats_size, "stats")

    if not TEMP_ROOT.is_dir() or not os.access(TEMP_ROOT, os.W_OK):
        raise RuntimeError(f"directorio temporal RAM no disponible: {TEMP_ROOT}")

    with tempfile.TemporaryDirectory(prefix="demeter_frame_", dir="/mnt/ramcam") as temp_name:
        temp_dir = Path(temp_name)
        comp1_path = temp_dir / "tmp.comp1"
        bayer16_path = temp_dir / "tmp.bayer16"
        stats_path = temp_dir / "tmp.stats"
        json_path = temp_dir / "tmp.json"
        output_prefix = temp_dir / "tmp_out"

        comp1_path.write_bytes(raw_data)
        stats_path.write_bytes(stats_data)
        json_path.write_text(json.dumps(row, separators=(",", ":")) + "\n", encoding="utf-8")

        run_checked(
            [
                str(RAW2RGB),
                "--input-format",
                f"{WIDTH}:{HEIGHT}:{WIDTH}:PISP_COMP1",
                "--output-format",
                f"{WIDTH}:{HEIGHT}:{WIDTH * 2}:BAYER16",
                str(comp1_path),
                str(bayer16_path),
            ],
            "praw2rgb",
        )
        run_checked(
            [
                str(CONTROLLER_REPLAY),
                str(stats_path),
                str(json_path),
                str(TUNING),
                str(bayer16_path),
                str(output_prefix),
            ],
            "controller_replay",
        )
        rgb_bytes = Path(f"{output_prefix}.rgb888.raw").read_bytes()
        if len(rgb_bytes) != WIDTH * HEIGHT * 3:
            raise ValueError(
                f"salida RGB de tamaño incorrecto: {len(rgb_bytes)}, esperado {WIDTH * HEIGHT * 3}"
            )
        frame_wallclock_ns = row.get("frame_wallclock_ns")
        if isinstance(frame_wallclock_ns, bool) or not isinstance(frame_wallclock_ns, int) or frame_wallclock_ns <= 0:
            frame_wallclock_ns = None
        frame_ts = frame_wallclock_ns / 1_000_000_000 if frame_wallclock_ns is not None else None
        frame_sidecar = {
            "camera_index": camera,
            "frame_id": frame_id,
            "frame_wallclock_ns": frame_wallclock_ns,
            "frame_timestamp_utc": datetime.fromtimestamp(frame_ts, timezone.utc).isoformat() if frame_ts else None,
            "flight_telemetry": interpolate_telemetry(telemetry, frame_ts, max_telemetry_gap_s),
        }
        return rgb_bytes, frame_sidecar


def process_camera(
    chunk_dir: Path,
    jpeg_dir: Path,
    png_dir: Path,
    camera: int,
    telemetry: list[dict[str, float]],
    max_telemetry_gap_s: float,
    executor: ProcessPoolExecutor,
) -> tuple[int, int, dict[str, int | float]]:
    metadata_path = chunk_dir / f"cam{camera}_metadata.jsonl"
    raw_path = chunk_dir / f"cam{camera}_frames.raw"
    stats_path = chunk_dir / f"cam{camera}_stats.bin"
    if not metadata_path.is_file() or not raw_path.is_file() or not stats_path.is_file():
        LOG.error("chunk=%s cámara=%d faltan archivos de entrada", chunk_dir.name, camera)
        return 0, 1, {
            "sd_logical_read_bytes": 0,
            "sd_logical_write_bytes": 0,
            "worker_elapsed_s": 0.0,
            "fatal_errors": 1,
        }

    successes = 0
    failures = 0
    io_totals: dict[str, int | float] = {
        "sd_logical_read_bytes": 0,
        "sd_logical_write_bytes": 0,
        "worker_elapsed_s": 0.0,
        "fatal_errors": 0,
    }
    camera_started = time.monotonic()
    pending: dict[Future[int], tuple[int, int]] = {}

    def collect(completed: set[Future[int]]) -> None:
        nonlocal successes, failures
        for future in completed:
            line_number, input_bytes = pending.pop(future)
            try:
                output_bytes = future.result()
                io_totals["sd_logical_read_bytes"] += input_bytes
                io_totals["sd_logical_write_bytes"] += output_bytes
                successes += 1
                if successes % 10 == 0:
                    LOG.info("chunk=%s cámara=%d frames_revelados=%d", chunk_dir.name, camera, successes)
            except BrokenExecutor:
                raise
            except Exception as exc:
                failures += 1
                LOG.warning(
                    "falló guardado de frame chunk=%s cámara=%d línea=%d (%s): %s",
                    chunk_dir.name, camera, line_number, type(exc).__name__, exc,
                )

    try:
        with (
            metadata_path.open(encoding="utf-8") as metadata,
            raw_path.open("rb") as raw_stream,
            stats_path.open("rb") as stats_stream,
        ):
            raw_size = raw_path.stat().st_size
            stats_size = stats_path.stat().st_size
            for line_number, line in enumerate(metadata, start=1):
                if not line.strip():
                    continue
                try:
                    row = json.loads(line)
                    if not isinstance(row, dict):
                        raise ValueError("la fila JSONL no es un objeto")
                    frame_id = integer_field(row, "pair_index") if "pair_index" in row else integer_field(
                        row, "frame_sequence"
                    )
                    input_bytes = integer_field(row, "raw_bytes", positive=True) + integer_field(
                        row, "stats_bytes", positive=True
                    )
                    output_bytes, frame_sidecar = develop_frame(
                        row,
                        raw_stream,
                        stats_stream,
                        raw_size,
                        stats_size,
                        camera,
                        telemetry,
                        max_telemetry_gap_s,
                    )
                    future = executor.submit(
                        save_images,
                        output_bytes,
                        jpeg_dir,
                        png_dir,
                        camera,
                        frame_id,
                        frame_sidecar,
                    )
                    pending[future] = (line_number, input_bytes)
                    if len(pending) >= MAX_PENDING_FRAMES:
                        completed, _ = wait(pending, return_when=FIRST_COMPLETED)
                        collect(completed)
                except BrokenExecutor:
                    raise
                except Exception as exc:
                    failures += 1
                    LOG.warning(
                        "falló revelado de frame chunk=%s cámara=%d línea=%d (%s): %s",
                        chunk_dir.name, camera, line_number, type(exc).__name__, exc,
                    )
                    continue
    except OSError as exc:
        LOG.exception("falló metadata chunk=%s cámara=%d: %s", chunk_dir.name, camera, exc)
        io_totals["fatal_errors"] = 1
        failures += 1
    while pending:
        completed, _ = wait(pending)
        collect(completed)
    io_totals["camera_elapsed_s"] = round(time.monotonic() - camera_started, 6)
    return successes, failures, io_totals


def main() -> int:
    parser = argparse.ArgumentParser(description="Revela chunks RAW de una misión Demeter")
    parser.add_argument("mission_dir", type=Path, help="directorio de la misión guardada en SD")
    parser.add_argument("--max-telemetry-gap-s", type=float, default=2.0)
    args = parser.parse_args()

    mission_dir = args.mission_dir
    if not mission_dir.is_dir():
        parser.error(f"no existe el directorio de misión: {mission_dir}")
    for executable in (RAW2RGB, CONTROLLER_REPLAY, TUNING):
        if not executable.is_file():
            LOG.error("falta el archivo requerido: %s", executable)
            return 2

    chunks = sorted(
        path for path in mission_dir.iterdir() if path.is_dir() and CHUNK_NAME.fullmatch(path.name)
    )
    if not chunks:
        LOG.error("no hay directorios chunk_NNNN en %s", mission_dir)
        return 2
    if not math.isfinite(args.max_telemetry_gap_s) or args.max_telemetry_gap_s <= 0:
        parser.error("--max-telemetry-gap-s debe ser finito y mayor que cero")
    telemetry = load_telemetry(mission_dir / "telemetry.jsonl")
    if not telemetry:
        LOG.warning("no hay muestras válidas en telemetry.jsonl; los sidecars marcarán telemetría inválida")

    if mission_dir.parent.name == "raw":
        recording_root = mission_dir.parent.parent
        jpeg_dir = recording_root / "jpeg" / mission_dir.name
        png_dir = recording_root / "png" / mission_dir.name
    else:
        processed_dir = mission_dir / "PROCESADO"
        jpeg_dir = processed_dir / "jpeg"
        png_dir = processed_dir / "png"
    jpeg_dir.mkdir(parents=True, exist_ok=True)
    png_dir.mkdir(parents=True, exist_ok=True)
    total_successes = 0
    total_failures = 0
    total_fatal_errors = 0
    if not TEMP_ROOT.is_dir() or not os.access(TEMP_ROOT, os.W_OK):
        LOG.error("tmpfs temporal no disponible/escribible: %s", TEMP_ROOT)
        return 2
    postprocess_started = time.monotonic()
    total_read_bytes = 0
    total_write_bytes = 0
    try:
        with ProcessPoolExecutor(
            max_workers=MAX_WORKERS,
            initializer=init_worker,
        ) as executor:
            for chunk_dir in chunks:
                chunk_started = time.monotonic()
                chunk_read_bytes = 0
                chunk_write_bytes = 0
                for camera in (0, 1):
                    successes, failures, io_totals = process_camera(
                        chunk_dir,
                        jpeg_dir,
                        png_dir,
                        camera,
                        telemetry,
                        args.max_telemetry_gap_s,
                        executor,
                    )
                    total_successes += successes
                    total_failures += failures
                    total_fatal_errors += int(io_totals["fatal_errors"])
                    chunk_read_bytes += int(io_totals["sd_logical_read_bytes"])
                    chunk_write_bytes += int(io_totals["sd_logical_write_bytes"])
                chunk_elapsed = max(time.monotonic() - chunk_started, 1e-6)
                total_read_bytes += chunk_read_bytes
                total_write_bytes += chunk_write_bytes
                chunk_event = {
                    "kind": "chunk_postprocess_complete",
                    "source": "demeter_postprocess",
                    "chunk": chunk_dir.name,
                    "elapsed_s": round(chunk_elapsed, 6),
                    "metrics": {
                        "sd_logical_read_bytes": chunk_read_bytes,
                        "sd_logical_write_bytes": chunk_write_bytes,
                        "sd_logical_read_mib_s": round(chunk_read_bytes / chunk_elapsed / 1048576, 3),
                        "sd_logical_write_mib_s": round(chunk_write_bytes / chunk_elapsed / 1048576, 3),
                        "io_basis": "bytes lógicos de RAW+stats y JPEG+PNG+sidecars; incluye caché del SO",
                    },
                }
                emit_mission_event(chunk_event)
                LOG.info(
                    "chunk=%s completado duración=%.3fs SD_lógica_lectura=%.3f MiB/s SD_lógica_escritura=%.3f MiB/s",
                    chunk_dir.name,
                    chunk_elapsed,
                    chunk_event["metrics"]["sd_logical_read_mib_s"],
                    chunk_event["metrics"]["sd_logical_write_mib_s"],
                )
    except (OSError, RuntimeError) as exc:
        emit_mission_event({
            "kind": "process_complete", "source": "demeter_postprocess",
            "process": "demeter_postprocess", "exit_code": 1,
            "error_type": type(exc).__name__, "error": str(exc),
        })
        LOG.exception("falló pool de postproceso (%s): %s", type(exc).__name__, exc)
        return 1
    finally:
        for temporary_dir in TEMP_ROOT.glob("demeter_frame_*"):
            shutil.rmtree(temporary_dir, ignore_errors=True)

    total_elapsed = max(time.monotonic() - postprocess_started, 1e-6)
    final_status = 1 if total_fatal_errors else 0
    emit_mission_event({
        "kind": "process_complete", "source": "demeter_postprocess",
        "process": "demeter_postprocess", "exit_code": final_status,
        "frames_ok": total_successes, "frame_errors": total_failures,
        "elapsed_s": round(total_elapsed, 6),
        "metrics": {
            "sd_logical_read_bytes": total_read_bytes,
            "sd_logical_write_bytes": total_write_bytes,
            "sd_logical_read_mib_s": round(total_read_bytes / total_elapsed / 1048576, 3),
            "sd_logical_write_mib_s": round(total_write_bytes / total_elapsed / 1048576, 3),
            "io_basis": "bytes lógicos de RAW+stats y JPEG+PNG+sidecars; incluye caché del SO",
        },
    })
    LOG.info(
        "revelado terminado imágenes=%d errores=%d jpeg=%s png=%s",
        total_successes, total_failures, jpeg_dir, png_dir,
    )
    return final_status


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s pid=%(process)d %(message)s",
    )
    try:
        raise SystemExit(main())
    except Exception:
        LOG.exception("fallo fatal en postproceso")
        raise SystemExit(1)