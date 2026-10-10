#!/usr/bin/env python3
"""Develop committed Demeter RAW chunks into JPEG and PNG images."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, BinaryIO

try:
    import cv2
    import numpy as np
except ImportError as exc:
    raise SystemExit(f"Falta una dependencia de imagen (numpy/opencv): {exc}") from exc


WIDTH = 4608
HEIGHT = 2592
CHUNK_NAME = re.compile(r"^chunk_[0-9]{4,}$")
ROOT = Path(__file__).resolve().parent
BUILD = Path(os.environ.get("DEMETER_BUILD_DIR", str(ROOT / ".build")))
RAW2RGB = Path(os.environ.get("PRAW2RGB", str(BUILD / "libpisp-build/src/examples/praw2rgb")))
CONTROLLER_REPLAY = Path(os.environ.get("CONTROLLER_REPLAY", str(BUILD / "bin/controller_replay")))
TUNING = Path(os.environ.get("DEMETER_TUNE", "/usr/share/libcamera/ipa/rpi/pisp/imx708.json"))


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
    result = subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    if result.returncode:
        detail = (result.stderr or "").strip()[-2000:]
        raise RuntimeError(f"{step} terminó con {result.returncode}: {detail}")


def save_images(rgb_path: Path, processed_dir: Path, camera: int, frame_id: int) -> None:
    expected_bytes = WIDTH * HEIGHT * 3
    if rgb_path.stat().st_size != expected_bytes:
        raise ValueError(
            f"salida RGB de tamaño incorrecto: {rgb_path.stat().st_size}, esperado {expected_bytes}"
        )

    rgb = np.fromfile(rgb_path, dtype=np.uint8).reshape((HEIGHT, WIDTH, 3))
    bgr = np.ascontiguousarray(rgb[..., ::-1])
    stem = f"cam{camera}_frame_{frame_id:06d}"
    jpg_path = processed_dir / f"{stem}.jpg"
    png_path = processed_dir / f"{stem}.png"
    jpg_tmp = processed_dir / f".{stem}.tmp.jpg"
    png_tmp = processed_dir / f".{stem}.tmp.png"

    try:
        if not cv2.imwrite(str(jpg_tmp), bgr, [cv2.IMWRITE_JPEG_QUALITY, 95]):
            raise RuntimeError(f"OpenCV no pudo escribir {jpg_tmp}")
        if not cv2.imwrite(str(png_tmp), bgr):
            raise RuntimeError(f"OpenCV no pudo escribir {png_tmp}")
        os.replace(jpg_tmp, jpg_path)
        os.replace(png_tmp, png_path)
    finally:
        jpg_tmp.unlink(missing_ok=True)
        png_tmp.unlink(missing_ok=True)


def develop_frame(
    row: dict[str, Any],
    raw_stream: BinaryIO,
    stats_stream: BinaryIO,
    raw_size: int,
    stats_size: int,
    processed_dir: Path,
    camera: int,
) -> None:
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

    # Private per-frame temp paths avoid races and stale files between mission runs.
    with tempfile.TemporaryDirectory(prefix="demeter_frame_", dir="/tmp") as temp_name:
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
        save_images(Path(f"{output_prefix}.rgb888.raw"), processed_dir, camera, frame_id)


def process_camera(chunk_dir: Path, processed_dir: Path, camera: int) -> tuple[int, int]:
    metadata_path = chunk_dir / f"cam{camera}_metadata.jsonl"
    raw_path = chunk_dir / f"cam{camera}_frames.raw"
    stats_path = chunk_dir / f"cam{camera}_stats.bin"
    if not metadata_path.is_file() or not raw_path.is_file() or not stats_path.is_file():
        print(f"ERROR {chunk_dir.name} cam{camera}: faltan archivos de entrada", file=sys.stderr)
        return 0, 1

    successes = 0
    failures = 0
    raw_size = raw_path.stat().st_size
    stats_size = stats_path.stat().st_size
    try:
        with metadata_path.open(encoding="utf-8") as metadata, raw_path.open("rb") as raw_stream, stats_path.open(
            "rb"
        ) as stats_stream:
            for line_number, line in enumerate(metadata, start=1):
                if not line.strip():
                    continue
                try:
                    row = json.loads(line)
                    if not isinstance(row, dict):
                        raise ValueError("la fila JSONL no es un objeto")
                    develop_frame(
                        row,
                        raw_stream,
                        stats_stream,
                        raw_size,
                        stats_size,
                        processed_dir,
                        camera,
                    )
                    successes += 1
                    if successes % 10 == 0:
                        print(f"{chunk_dir.name} cam{camera}: {successes} frames revelados")
                except Exception as exc:
                    failures += 1
                    print(
                        f"ERROR {chunk_dir.name} cam{camera} línea {line_number}: {exc}",
                        file=sys.stderr,
                    )
    except OSError as exc:
        print(f"ERROR {chunk_dir.name} cam{camera}: {exc}", file=sys.stderr)
        return successes, failures + 1
    return successes, failures


def main() -> int:
    parser = argparse.ArgumentParser(description="Revela chunks RAW de una misión Demeter")
    parser.add_argument("mission_dir", type=Path, help="directorio de la misión guardada en SD")
    args = parser.parse_args()

    mission_dir = args.mission_dir
    if not mission_dir.is_dir():
        parser.error(f"no existe el directorio de misión: {mission_dir}")
    for executable in (RAW2RGB, CONTROLLER_REPLAY, TUNING):
        if not executable.is_file():
            print(f"ERROR: falta el archivo requerido: {executable}", file=sys.stderr)
            return 2

    chunks = sorted(
        path for path in mission_dir.iterdir() if path.is_dir() and CHUNK_NAME.fullmatch(path.name)
    )
    if not chunks:
        print(f"ERROR: no hay directorios chunk_NNNN en {mission_dir}", file=sys.stderr)
        return 2

    processed_dir = mission_dir / "PROCESADO"
    processed_dir.mkdir(parents=True, exist_ok=True)
    total_successes = 0
    total_failures = 0
    for chunk_dir in chunks:
        for camera in (0, 1):
            successes, failures = process_camera(chunk_dir, processed_dir, camera)
            total_successes += successes
            total_failures += failures

    print(
        f"Revelado terminado: {total_successes} imágenes, "
        f"{total_failures} errores. Salida: {processed_dir}"
    )
    return 1 if total_failures else 0


if __name__ == "__main__":
    raise SystemExit(main())