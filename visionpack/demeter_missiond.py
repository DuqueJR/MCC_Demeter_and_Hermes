#!/usr/bin/env python3
"""Demonio principal y FSM del payload Demeter.

Orquesta el ciclo de vuelo, ejecuta la auditoría muscular de preflight, aplica
watchdogs autónomos ante pérdida de señal y supervisa procesos hijos. Permite reintentar
PREFLIGHT desde ERROR o ABORTED; la recuperación de procesos y señales es de
mejor esfuerzo, no un mecanismo de reinicio del sistema operativo.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
from enum import Enum
import json
import logging
import math
import os
from pathlib import Path
import shutil
import signal
import shlex
import socket
import subprocess
import sys
import tempfile
import time
import uuid
from typing import Any

from demeter_protocol import StatusCode

LOG = logging.getLogger("demeter_missiond")
STOP = False
TOUCHDOWN_FLAG = Path("/tmp/touchdown_event.flag")
MIN_MEM_AVAILABLE_KB = 1024 * 1024
ASCENT_WATCHDOG_S = 15.0
RECORDING_WATCHDOG_S = 95.0
STATUS_EVERY_S = 1.0         # latido hacia la LilyGo: PAYLOAD_STATUS cada segundo, ademas de en cada cambio (sin latido, la LilyGo lo da por desconocido a los 3 s)
RAW_PAIR_BUDGET_MIB = 24.0
PROCESSED_PAIR_BUDGET_MIB = 30.0
SD_WRITE_SAFETY_FACTOR = 0.9
# TEMPORAL: ignora el cap de fps del presupuesto para probar 8 fps con el tmpfs como buffer.
TEMP_DISABLE_FPS_CAP = True
TMPFS_BUFFER_FRACTION = 0.75
MISSION_STORAGE_SAFETY_FACTOR = 1.25
MISSION_STORAGE_RESERVE_BYTES = 1024**3
MISSION_MEMORY_RESERVE_KB = 1024 * 1024
SD_WRITE_PROBE_BYTES = 256 * 1024**2
RAMCAM_WARNING_PERCENT = 80.0
RAMCAM_CRITICAL_PERCENT = 90.0
SD_TARGET_MIB_S = 80.0
SD_MIN_MIB_S = 60.0
PERFORMANCE_SAMPLE_INTERVAL_S = 5.0


class State(str, Enum):
    BOOT = "BOOT"
    PREFLIGHT = "PREFLIGHT"
    READY = "READY"
    ARMED = "ARMED"
    ASCENT = "ASCENT"
    STARTING = "STARTING"
    RECORDING = "RECORDING"
    INGESTING = "INGESTING"
    PROCESSING = "PROCESSING"
    COMPLETE = "COMPLETE"
    ABORTED = "ABORTED"
    ERROR = "ERROR"


STATUS = {
    State.BOOT: StatusCode.BOOT,
    State.PREFLIGHT: StatusCode.PREFLIGHT,
    State.READY: StatusCode.READY,
    State.ARMED: StatusCode.ARMED,
    State.ASCENT: StatusCode.ASCENT,
    State.STARTING: StatusCode.STARTING,
    State.RECORDING: StatusCode.RECORDING,
    State.INGESTING: StatusCode.INGESTING,
    State.PROCESSING: StatusCode.PROCESSING,
    State.COMPLETE: StatusCode.COMPLETE,
    State.ABORTED: StatusCode.ABORTED,
    State.ERROR: StatusCode.PIPELINE_ERROR,
}
TRANSITIONS = {
    State.BOOT: {State.PREFLIGHT, State.ERROR},
    State.PREFLIGHT: {State.READY, State.ERROR, State.ABORTED},
    State.READY: {State.ARMED, State.ABORTED, State.ERROR},
    State.ARMED: {State.ASCENT, State.ABORTED, State.ERROR},
    State.ASCENT: {State.STARTING, State.ABORTED, State.ERROR},
    State.STARTING: {State.RECORDING, State.ABORTED, State.ERROR},
    State.RECORDING: {State.INGESTING, State.PROCESSING, State.ABORTED, State.ERROR},
    State.INGESTING: {State.PROCESSING, State.COMPLETE, State.ABORTED, State.ERROR},
    State.PROCESSING: {State.COMPLETE, State.ABORTED, State.ERROR},
    State.COMPLETE: set(),
    State.ERROR: {State.PREFLIGHT},
    State.ABORTED: {State.PREFLIGHT},
}


def request_stop(_signum: int, _frame: Any) -> None:
    global STOP
    STOP = True


def atomic_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as output:
            json.dump(value, output, indent=2, allow_nan=False)
            output.write("\n")
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary_name, path)
    finally:
        Path(temporary_name).unlink(missing_ok=True)


def is_tmpfs_mount(path: Path) -> bool:
    if not path.is_dir() or not os.path.ismount(path):
        return False
    try:
        for line in Path("/proc/mounts").read_text(encoding="utf-8").splitlines():
            fields = line.split()
            if len(fields) >= 3 and fields[1].replace("\\040", " ") == str(path):
                return fields[2] == "tmpfs"
    except OSError:
        return False
    return False


def calculate_mission_resource_budget(
    sd_write_mib_s: float,
    tmpfs_bytes: int,
    descent_watchdog_s: float,
    raw_pair_mib: float = RAW_PAIR_BUDGET_MIB,
    processed_pair_mib: float = PROCESSED_PAIR_BUDGET_MIB,
) -> dict[str, int | float]:
    values = (sd_write_mib_s, descent_watchdog_s, raw_pair_mib, processed_pair_mib)
    if not all(math.isfinite(value) and value > 0 for value in values) or tmpfs_bytes <= 0:
        raise ValueError("presupuesto de misión requiere tasas, duración y tmpfs positivos")

    safe_sd_write_mib_s = sd_write_mib_s * SD_WRITE_SAFETY_FACTOR
    buffer_budget_mib = tmpfs_bytes * TMPFS_BUFFER_FRACTION / 1024**2
    max_fps = min(
        10,
        math.floor((safe_sd_write_mib_s + buffer_budget_mib / descent_watchdog_s) / raw_pair_mib),
    )
    projected_backlog_mib = max(0.0, max_fps * raw_pair_mib - safe_sd_write_mib_s) * descent_watchdog_s
    pair_count = max_fps * descent_watchdog_s
    required_free_bytes = math.ceil(
        pair_count * (raw_pair_mib + processed_pair_mib) * 1024**2
        * MISSION_STORAGE_SAFETY_FACTOR
        + MISSION_STORAGE_RESERVE_BYTES
    )
    required_mem_available_kb = math.ceil(
        projected_backlog_mib * 1024 + MISSION_MEMORY_RESERVE_KB
    )
    return {
        "max_target_fps": max_fps,
        "sd_probe_mib_s": round(sd_write_mib_s, 3),
        "safe_sd_write_mib_s": round(safe_sd_write_mib_s, 3),
        "tmpfs_buffer_budget_bytes": int(buffer_budget_mib * 1024**2),
        "projected_tmpfs_backlog_bytes": int(projected_backlog_mib * 1024**2),
        "required_mem_available_kb": required_mem_available_kb,
        "projected_pairs": int(pair_count),
        "required_free_bytes": required_free_bytes,
        "budget_duration_s": descent_watchdog_s,
    }


def probe_sd_write_mib_s(directory: Path, bytes_to_write: int = SD_WRITE_PROBE_BYTES) -> float:
    if bytes_to_write <= 0:
        raise ValueError("bytes_to_write debe ser positivo")
    fd, temporary_name = tempfile.mkstemp(prefix=".demeter_sd_probe_", dir=directory)
    block = b"\0" * min(4 * 1024**2, bytes_to_write)
    remaining = bytes_to_write
    started = time.monotonic()
    try:
        while remaining:
            written = os.write(fd, block[:min(len(block), remaining)])
            if written <= 0:
                raise OSError("escritura de sonda SD sin progreso")
            remaining -= written
        os.fsync(fd)
        elapsed = max(time.monotonic() - started, 1e-6)
        return bytes_to_write / elapsed / 1024**2
    finally:
        os.close(fd)
        Path(temporary_name).unlink(missing_ok=True)


def preflight(
    script: Path,
    ram_dir: Path,
    recordings_dir: Path,
    min_free_bytes: int,
    meminfo_path: Path = Path("/proc/meminfo"),
    min_mem_available_kb: int = MIN_MEM_AVAILABLE_KB,
) -> list[str]:
    failures: list[str] = []
    if is_tmpfs_mount(ram_dir):
        ram_dir_arg = shlex.quote(str(ram_dir))
        purge_status = os.system(
            f"rm -rf -- {ram_dir_arg}/* {ram_dir_arg}/.[!.]* {ram_dir_arg}/..?* 2>/dev/null"
        )
        if purge_status != 0:
            failures.append(f"no se pudo purgar el tmpfs {ram_dir} (status={purge_status})")
    else:
        failures.append(f"{ram_dir} no es un montaje tmpfs")
    try:
        mem_available_kb = None
        for line in meminfo_path.read_text(encoding="ascii").splitlines():
            if line.startswith("MemAvailable:"):
                mem_available_kb = int(line.split()[1])
                break
        if mem_available_kb is None:
            failures.append("RAM insuficiente: MemAvailable no aparece en /proc/meminfo")
        elif mem_available_kb < min_mem_available_kb:
            failures.append(
                f"RAM física insuficiente: MemAvailable={mem_available_kb} kB; "
                f"se requieren al menos {min_mem_available_kb} kB"
            )
    except (OSError, ValueError, IndexError):
        failures.append("RAM física insuficiente: no se pudo leer MemAvailable")
    if not script.is_file() or not os.access(script, os.X_OK):
        failures.append(f"script de vuelo no ejecutable: {script}")
    try:
        recordings_dir.mkdir(parents=True, exist_ok=True)
        if not os.access(recordings_dir, os.W_OK):
            failures.append(f"directorio de grabaciones no escribible: {recordings_dir}")
        elif shutil.disk_usage(recordings_dir).free < min_free_bytes:
            failures.append(f"espacio libre inferior a {min_free_bytes} bytes en {recordings_dir}")
    except OSError as exc:
        failures.append(f"directorio de grabaciones no disponible: {exc}")
    if TOUCHDOWN_FLAG.exists():
        failures.append(f"flag touchdown obsoleto presente: {TOUCHDOWN_FLAG}")
    return failures


def read_performance_metrics(
    meminfo_path: Path = Path("/proc/meminfo"),
    thermal_root: Path = Path("/sys/class/thermal"),
    storage_path: Path | None = None,
    diskstats_path: Path = Path("/proc/diskstats"),
    ramcam_path: Path = Path("/mnt/ramcam"),
) -> dict[str, Any]:
    metrics: dict[str, Any] = {
        "sampled_at": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
        "mem_total_kb": None,
        "mem_available_kb": None,
        "ram_used_percent": None,
        "ramcam_total_bytes": None,
        "ramcam_used_bytes": None,
        "ramcam_used_percent": None,
        "temperature_c": None,
        "temperature_sensors": [],
        "sd_device": None,
        "sd_read_bytes_total": None,
        "sd_write_bytes_total": None,
        "metric_errors": [],
    }
    try:
        for line in meminfo_path.read_text(encoding="ascii").splitlines():
            fields = line.split()
            if len(fields) >= 2 and fields[0] in ("MemTotal:", "MemAvailable:"):
                metrics["mem_total_kb" if fields[0] == "MemTotal:" else "mem_available_kb"] = int(fields[1])
        total = metrics["mem_total_kb"]
        available = metrics["mem_available_kb"]
        if isinstance(total, int) and total > 0 and isinstance(available, int):
            metrics["ram_used_percent"] = round(100.0 * (total - available) / total, 2)
        else:
            metrics["metric_errors"].append("MemTotal/MemAvailable ausente o inválido")
    except (OSError, ValueError, IndexError) as exc:
        metrics["metric_errors"].append(f"meminfo: {type(exc).__name__}: {exc}")

    try:
        ramcam_usage = shutil.disk_usage(ramcam_path)
        metrics["ramcam_total_bytes"] = ramcam_usage.total
        metrics["ramcam_used_bytes"] = ramcam_usage.used
        if ramcam_usage.total > 0:
            metrics["ramcam_used_percent"] = round(100.0 * ramcam_usage.used / ramcam_usage.total, 2)
        else:
            metrics["metric_errors"].append(f"capacidad nula en {ramcam_path}")
    except OSError as exc:
        metrics["metric_errors"].append(f"ramcam: {type(exc).__name__}: {exc}")

    sensors: list[dict[str, Any]] = []
    for temperature_path in sorted(thermal_root.glob("thermal_zone*/temp")):
        try:
            millidegrees = int(temperature_path.read_text(encoding="ascii").strip())
            sensor_type_path = temperature_path.with_name("type")
            sensor_type = sensor_type_path.read_text(encoding="ascii").strip() if sensor_type_path.exists() else "unknown"
            sensors.append({
                "zone": temperature_path.parent.name,
                "type": sensor_type,
                "temperature_c": round(millidegrees / 1000.0, 2),
            })
        except (OSError, ValueError) as exc:
            metrics["metric_errors"].append(
                f"{temperature_path}: {type(exc).__name__}: {exc}"
            )
    metrics["temperature_sensors"] = sensors
    if sensors:
        metrics["temperature_c"] = max(sensor["temperature_c"] for sensor in sensors)
    else:
        metrics["metric_errors"].append(f"sin sensores térmicos legibles en {thermal_root}")

    if storage_path is not None:
        try:
            device = os.stat(storage_path).st_dev
            device_major = os.major(device)
            device_minor = os.minor(device)
            for line in diskstats_path.read_text(encoding="ascii").splitlines():
                fields = line.split()
                if len(fields) >= 10 and fields[0] == str(device_major) and fields[1] == str(device_minor):
                    metrics["sd_device"] = fields[2]
                    metrics["sd_read_bytes_total"] = int(fields[5]) * 512
                    metrics["sd_write_bytes_total"] = int(fields[9]) * 512
                    break
            if metrics["sd_device"] is None:
                metrics["metric_errors"].append(
                    f"dispositivo {device_major}:{device_minor} no aparece en /proc/diskstats"
                )
        except (OSError, ValueError, IndexError) as exc:
            metrics["metric_errors"].append(f"diskstats: {type(exc).__name__}: {exc}")
    return metrics


def evaluate_performance_alerts(metrics: dict[str, Any], args: argparse.Namespace) -> list[dict[str, Any]]:
    alerts: list[dict[str, Any]] = []
    temperature = metrics.get("temperature_c")
    if isinstance(temperature, (int, float)) and not isinstance(temperature, bool):
        critical = getattr(args, "temperature_critical_c", 80.0)
        warning = getattr(args, "temperature_warning_c", 75.0)
        if temperature >= critical:
            alerts.append({"metric": "temperature_c", "code": "temperature_critical", "severity": "critical", "value": temperature, "threshold": critical})
        elif temperature >= warning:
            alerts.append({"metric": "temperature_c", "code": "temperature_high", "severity": "warning", "value": temperature, "threshold": warning})
    else:
        alerts.append({"metric": "temperature_c", "code": "temperature_unavailable", "severity": "warning", "value": None})

    ramcam_used = metrics.get("ramcam_used_percent")
    if isinstance(ramcam_used, (int, float)) and not isinstance(ramcam_used, bool) and math.isfinite(ramcam_used):
        if ramcam_used >= RAMCAM_CRITICAL_PERCENT:
            alerts.append({"metric": "ramcam_used_percent", "code": "ramcam_usage_critical", "severity": "critical", "value": ramcam_used, "threshold": RAMCAM_CRITICAL_PERCENT})
        elif ramcam_used >= RAMCAM_WARNING_PERCENT:
            alerts.append({"metric": "ramcam_used_percent", "code": "ramcam_usage_high", "severity": "warning", "value": ramcam_used, "threshold": RAMCAM_WARNING_PERCENT})
    else:
        alerts.append({"metric": "ramcam_used_percent", "code": "ramcam_metric_unavailable", "severity": "warning", "value": None})

    for direction, option in (("read", "sd_min_read_mib_s"), ("write", "sd_min_write_mib_s")):
        key = f"sd_{direction}_mib_s"
        rate = metrics.get(key)
        if isinstance(rate, (int, float)) and not isinstance(rate, bool) and math.isfinite(rate):
            threshold = getattr(args, option, SD_MIN_MIB_S)
            if rate < threshold:
                alerts.append({
                    "metric": key, "code": f"sd_{direction}_throughput_low",
                    "severity": "warning", "value": rate, "threshold": threshold,
                    "target": getattr(args, "sd_target_mib_s", SD_TARGET_MIB_S),
                })
    ingest_rate = metrics.get("sd_ingest_write_mib_s")
    if isinstance(ingest_rate, (int, float)) and not isinstance(ingest_rate, bool) and math.isfinite(ingest_rate):
        threshold = getattr(args, "sd_min_write_mib_s", SD_MIN_MIB_S)
        if ingest_rate < threshold:
            alerts.append({
                "metric": "sd_ingest_write_mib_s", "code": "sd_ingest_write_throughput_low",
                "severity": "warning", "value": ingest_rate, "threshold": threshold,
                "target": getattr(args, "sd_target_mib_s", SD_TARGET_MIB_S),
            })
    return alerts


def classify_mission_result(wrapper_exit_code: int, processes: dict[str, dict[str, Any]]) -> tuple[str, str]:
    recorder = processes.get("demeter_rec", {})
    postprocess = processes.get("demeter_postprocess", {})
    frames_ok = int(postprocess.get("frames_ok") or 0)
    frame_errors = int(postprocess.get("frame_errors") or 0)
    postprocess_ok = postprocess.get("exit_code") == 0 and frames_ok > 0
    if postprocess_ok and recorder.get("failure_reason") == "tmpfs_enospc":
        return "DEGRADED", f"tmpfs agotado; se revelaron {frames_ok} imágenes de chunks íntegros"
    if postprocess_ok and (frame_errors > 0 or recorder.get("exit_code", 0) != 0):
        return "DEGRADED", f"pipeline parcial: {frames_ok} imágenes correctas, {frame_errors} con error"
    if wrapper_exit_code == 0 and postprocess_ok and frame_errors == 0:
        return "COMPLETE", f"captura y revelado correctos: {frames_ok} imágenes"
    if not postprocess_ok:
        return "ERROR", "el postprocesamiento no produjo una salida utilizable"
    return "ERROR", f"demeter_ingestd terminó con estado {wrapper_exit_code}"


def arm_system_checks(args: argparse.Namespace) -> list[str]:
    failures = preflight(args.ingest_script, args.ram_dir, args.recordings_dir, args.min_free_bytes)
    rpicam = shutil.which(str(args.rpicam_vid))
    if not rpicam or not os.access(rpicam, os.X_OK):
        failures.append(f"rpicam-vid no disponible o no ejecutable: {args.rpicam_vid}")
    if not args.recorder_bin.is_file() or not os.access(args.recorder_bin, os.X_OK):
        failures.append(f"demeter_rec no disponible o no ejecutable: {args.recorder_bin}")
    postprocess_script = args.ingest_script.parent / "demeter_postprocess.py"
    if not postprocess_script.is_file() or not os.access(postprocess_script, os.X_OK):
        failures.append(f"demeter_postprocess.py no disponible o no ejecutable: {postprocess_script}")
    try:
        args.ascent_video.parent.mkdir(parents=True, exist_ok=True)
        if not os.access(args.ascent_video.parent, os.W_OK):
            failures.append(f"directorio del video de ascenso no escribible: {args.ascent_video.parent}")
        elif shutil.disk_usage(args.ascent_video.parent).free < args.min_free_bytes:
            failures.append(f"espacio libre insuficiente para video en {args.ascent_video.parent}")
    except OSError as exc:
        failures.append(f"destino del video de ascenso no disponible: {exc}")
    if is_tmpfs_mount(args.ram_dir):
        try:
            sd_write_mib_s = probe_sd_write_mib_s(args.recordings_dir)
            ramcam_total_bytes = shutil.disk_usage(args.ram_dir).total
            budget = calculate_mission_resource_budget(
                sd_write_mib_s,
                ramcam_total_bytes,
                args.descent_watchdog,
            )
            args.resource_budget = budget
            args.max_target_fps = int(budget["max_target_fps"])
            mem_available_kb = read_performance_metrics(ramcam_path=args.ram_dir).get("mem_available_kb")
            if args.max_target_fps < 1:
                failures.append(
                    f"SD/tmpfs no sostiene ni 1 FPS durante {args.descent_watchdog:g}s"
                )
            if not isinstance(mem_available_kb, int) or mem_available_kb < budget["required_mem_available_kb"]:
                failures.append(
                    "RAM disponible insuficiente para el backlog proyectado: "
                    f"MemAvailable={mem_available_kb} kB; se requieren "
                    f">= {budget['required_mem_available_kb']} kB"
                )
            free_bytes = shutil.disk_usage(args.recordings_dir).free
            if free_bytes < budget["required_free_bytes"]:
                failures.append(
                    "espacio SD insuficiente para captura+revelado al límite de "
                    f"{args.descent_watchdog:g}s: libres={free_bytes} bytes; "
                    f"requeridos>={budget['required_free_bytes']} bytes "
                    f"(cap={args.max_target_fps} FPS, sonda={sd_write_mib_s:.1f} MiB/s)"
                )
            if TEMP_DISABLE_FPS_CAP:
                LOG.warning("cap de fps del presupuesto (%d) ignorado temporalmente", args.max_target_fps)
                args.max_target_fps = 10
            LOG.info(
                "presupuesto ARM watchdog=%.1fs SD_probe=%.2fMiB/s tmpfs=%.2fGiB "
                "cap=%dFPS backlog=%.0fMiB free_required=%.2fGiB",
                args.descent_watchdog, sd_write_mib_s, ramcam_total_bytes / 1024**3,
                args.max_target_fps, budget["projected_tmpfs_backlog_bytes"] / 1024**2,
                budget["required_free_bytes"] / 1024**3,
            )
        except (OSError, ValueError) as exc:
            failures.append(f"no se pudo calcular presupuesto SD/tmpfs: {type(exc).__name__}: {exc}")
    return failures


class MissionDaemon:
    def __init__(self, args: argparse.Namespace) -> None:
        self.args = args
        self.state = State.BOOT
        self.process: subprocess.Popen[bytes] | None = None
        self.video_process: subprocess.Popen[bytes] | None = None
        self.video_pid: int | None = None
        self.ascent_deadline: float | None = None
        self.recording_deadline: float | None = None
        self.owns_touchdown_flag = False
        self.changed_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
        self.last_error: str | None = None
        self.last_status_sent = 0.0
        self.last_performance_sample = 0.0
        self.active_performance_alerts: dict[str, str] = {}
        self.previous_sd_counters: tuple[str, int, int, float] | None = None
        self.last_preflight_duration_s: float | None = None
        self.last_preflight_metrics: dict[str, Any] | None = None
        self.mission_id: str | None = None
        self.mission_start_epoch: float | None = None
        self.mission_start_monotonic: float | None = None
        self.mission_events: list[dict[str, Any]] = []
        self.mission_recording_dir: Path | None = None
        self.mission_report_written = False
        self.process_started_monotonic: dict[str, float] = {}
        self.event_log = args.event_log
        self.event_log.parent.mkdir(parents=True, exist_ok=True)
        self.flight_log = args.event_log.with_name("flight.log")
        self.ascent_pid_file = args.state_file.with_name("rpicam-vid.pid")
        self.flight_log_offset = self.flight_log.stat().st_size if self.flight_log.exists() else 0
        self.event_file = self.event_log.open("a", encoding="utf-8")
        self.command_socket = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
        self.event_socket = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)

    def record_event(self, event: dict[str, Any]) -> None:
        monotonic_ts = event.get("monotonic_ts")
        if not isinstance(monotonic_ts, (int, float)):
            monotonic_ts = time.monotonic()
        row = {
            "pi_ts": time.time(), "monotonic_ts": monotonic_ts, "state": self.state.value,
            **({"mission_id": self.mission_id} if self.mission_id else {}), **event,
        }
        self.event_file.write(json.dumps(row, separators=(",", ":"), allow_nan=False) + "\n")
        self.event_file.flush()
        if self.mission_id:
            self.mission_events.append(row)

    def begin_mission(self) -> None:
        now = datetime.now(timezone.utc)
        self.mission_id = now.strftime("%Y%m%d_%H%M%S_%f")
        self.mission_start_epoch = now.timestamp()
        self.mission_start_monotonic = time.monotonic()
        self.mission_events = []
        self.mission_recording_dir = None
        self.mission_report_written = False
        self.process_started_monotonic = {}
        self.record_event({"kind": "mission_started", "mission_id": self.mission_id})

    def record_performance_event(self, kind: str, details: dict[str, Any] | None = None) -> None:
        details = dict(details or {})
        external_metrics = details.pop("metrics", {})
        storage_path = getattr(self.args, "recordings_dir", None)
        metrics = read_performance_metrics(
            storage_path=storage_path,
            ramcam_path=getattr(self.args, "ram_dir", Path("/mnt/ramcam")),
        )
        sampled_at = time.monotonic()
        device = metrics.get("sd_device")
        read_total = metrics.get("sd_read_bytes_total")
        write_total = metrics.get("sd_write_bytes_total")
        metrics["sd_read_mib_s"] = None
        metrics["sd_write_mib_s"] = None
        metrics["sd_io_interval_s"] = None
        if (
            isinstance(device, str)
            and isinstance(read_total, int)
            and isinstance(write_total, int)
            and self.previous_sd_counters is not None
        ):
            previous_device, previous_read, previous_write, previous_at = self.previous_sd_counters
            elapsed = sampled_at - previous_at
            if device == previous_device and elapsed >= 0.5:
                read_delta = max(0, read_total - previous_read)
                write_delta = max(0, write_total - previous_write)
                metrics["sd_io_interval_s"] = round(elapsed, 3)
                metrics["sd_read_interval_bytes"] = read_delta
                metrics["sd_write_interval_bytes"] = write_delta
                if read_delta:
                    metrics["sd_read_mib_s"] = round(read_delta / elapsed / 1048576, 3)
                if write_delta:
                    metrics["sd_write_mib_s"] = round(write_delta / elapsed / 1048576, 3)
        if isinstance(device, str) and isinstance(read_total, int) and isinstance(write_total, int):
            self.previous_sd_counters = (device, read_total, write_total, sampled_at)
        if isinstance(external_metrics, dict):
            metrics.update(external_metrics)
        alerts = evaluate_performance_alerts(metrics, self.args)
        if kind == "performance_sample" and details.get("phase") == "preflight":
            self.last_preflight_metrics = metrics
        if self.state not in (State.RECORDING, State.INGESTING, State.PROCESSING):
            sd_io_alert_codes = {
                "sd_read_throughput_low",
                "sd_write_throughput_low",
                "sd_ingest_write_throughput_low",
            }
            alerts = [alert for alert in alerts if alert.get("code") not in sd_io_alert_codes]
        if kind == "chunk_transfer_failed":
            alerts.append({
                "metric": "chunk_transfer", "code": "chunk_transfer_failed",
                "severity": "error", "phase": details.get("phase"),
                "exit_code": details.get("exit_code"),
            })
        if kind == "chunk_postprocess_complete" and details.get("frame_errors", 0):
            alerts.append({
                "metric": "chunk_postprocess", "code": "chunk_frame_errors",
                "severity": "error", "value": details["frame_errors"],
            })
        if kind == "process_complete" and isinstance(details.get("exit_code"), int) and details["exit_code"] != 0:
            recorder_enospc = (
                details.get("process") == "demeter_rec"
                and details.get("failure_reason") == "tmpfs_enospc"
            )
            alerts.append({
                "metric": "process_exit",
                "code": "capture_truncated_tmpfs_full" if recorder_enospc else "process_failed",
                "severity": "warning" if recorder_enospc else "error",
                "process": details.get("process"),
                "exit_code": details["exit_code"],
            })
        self.record_event({
            "kind": kind,
            "monotonic_ts": sampled_at,
            "local_only": True,
            **details,
            "metrics": metrics,
            "alerts": alerts,
        })
        for alert in alerts:
            if alert["severity"] == "error":
                LOG.error("alerta de misión kind=%s details=%s", kind, alert)
            elif alert["severity"] == "warning":
                LOG.warning("alerta de misión kind=%s details=%s", kind, alert)

        alert_by_metric = {alert["metric"]: alert for alert in alerts}
        evaluated_metrics = {"temperature_c", "ramcam_used_percent"}
        evaluated_metrics.update(
            metric for metric in ("sd_read_mib_s", "sd_write_mib_s", "sd_ingest_write_mib_s")
            if metrics.get(metric) is not None
        )
        for metric in evaluated_metrics:
            alert = alert_by_metric.get(metric)
            previous_code = self.active_performance_alerts.get(metric)
            if alert:
                current_code = str(alert["code"])
                if current_code != previous_code:
                    LOG.warning(
                        "alerta de rendimiento metric=%s code=%s severity=%s value=%s threshold=%s event=%s",
                        metric, current_code, alert["severity"], alert["value"], alert.get("threshold"), kind,
                    )
                self.active_performance_alerts[metric] = current_code
            elif previous_code:
                LOG.info("alerta de rendimiento resuelta metric=%s previous=%s", metric, previous_code)
                self.active_performance_alerts.pop(metric, None)
        if kind != "performance_sample":
            LOG.info(
                "evento rendimiento kind=%s chunk=%s process=%s alerts=%d",
                kind, details.get("chunk"), details.get("process"), len(alerts),
            )

    def publish_status(self, quiet: bool = False) -> None:
        self.last_status_sent = time.monotonic()
        message = json.dumps({"status": int(STATUS[self.state])}, separators=(",", ":")).encode()
        try:
            self.command_socket.sendto(message, str(self.args.telemetry_socket))
        except OSError as exc:
            if quiet:       # latido: sin telemetryd no hay a quien avisar; ya se aviso en el ultimo cambio de estado
                return
            LOG.warning(
                "no se pudo publicar estado=%s a telemetryd en %s (%s): %s",
                self.state.value, self.args.telemetry_socket, type(exc).__name__, exc,
            )

    def send_telemetry_control(self, message: dict[str, Any], expected_kind: str) -> bool:
        request_id = str(uuid.uuid4())
        message["request_id"] = request_id
        try:
            self.command_socket.sendto(json.dumps(message).encode(), str(self.args.telemetry_socket))
        except OSError as exc:
            LOG.error(
                "falló control kind=%s request_id=%s hacia %s (%s): %s",
                expected_kind, request_id, self.args.telemetry_socket, type(exc).__name__, exc,
            )
            return False
        deadline = time.monotonic() + 5.0
        while time.monotonic() < deadline:
            readable, _, _ = select_select([self.event_socket], deadline - time.monotonic())
            if not readable:
                break
            try:
                response = json.loads(self.event_socket.recv(8192))
            except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
                LOG.warning("respuesta JSON inválida de telemetryd (%s): %s", type(exc).__name__, exc)
                continue
            if response.get("kind") == expected_kind and response.get("request_id") == request_id:
                return response.get("ok") is True and response.get("serial_connected", True) is True
            if isinstance(response, dict):
                self.handle_event(response)
        LOG.error("telemetryd no confirmó kind=%s request_id=%s antes del timeout", expected_kind, request_id)
        return False

    def set_state(self, state: State, reason: str = "") -> None:
        if state == self.state:
            return
        if state not in TRANSITIONS[self.state]:
            raise RuntimeError(f"transición FSM inválida: {self.state.value} -> {state.value}")
        previous = self.state
        self.state = state
        self.changed_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
        self.record_event({"kind": "state", "from": previous.value, "to": state.value, "reason": reason})
        atomic_json(self.args.state_file, {
            "state": state.value, "status": int(STATUS[state]), "changed_at": self.changed_at,
            "reason": reason, "error": self.last_error,
            "video_pid": self.video_pid,
            "flight_pid": self.process.pid if self.process and self.process.poll() is None else None,
        })
        self.publish_status()
        LOG.info("estado %s -> %s%s", previous.value, state.value, f" ({reason})" if reason else "")

    def fail(self, reason: str) -> None:
        self.last_error = reason
        if self.state not in (State.ERROR, State.COMPLETE, State.ABORTED):
            self.set_state(State.ERROR, reason)
        self.finalize_mission("ERROR", reason)

    def preflight(self) -> None:
        if self.state not in (State.BOOT, State.ERROR, State.ABORTED):
            raise ValueError(f"PREFLIGHT no permitido en estado {self.state.value}")
        preflight_started = time.monotonic()
        self.last_error = None
        self.set_state(State.PREFLIGHT, "CMD_PREFLIGHT")
        self.record_performance_event("performance_sample", {"phase": "preflight"})
        failures = arm_system_checks(self.args)
        self.last_preflight_duration_s = time.monotonic() - preflight_started
        if failures:
            reason = "; ".join(failures)
            self.fail(reason)
            raise RuntimeError(reason)
        self.set_state(State.READY, "preflight local correcto")

    def arm(self) -> None:
        if self.state != State.READY:
            raise ValueError(f"ARM no permitido en estado {self.state.value}")
        if not self.send_telemetry_control({"health_check": True}, "telemetry_health"):
            raise RuntimeError("telemetryd no confirmó que el puerto serial está abierto")
        if not self.send_telemetry_control({"preflight_complete": True}, "preflight_closed"):
            raise RuntimeError("telemetryd no confirmó el cierre de preflight; se evita armar")
        self.begin_mission()
        self.set_state(State.ARMED, "comando ARM")

    def start_ascent(self) -> None:
        if self.state == State.ASCENT and self.video_process and self.video_process.poll() is None:
            return
        if self.state != State.ARMED:
            raise ValueError(f"START_ASCENT no permitido en estado {self.state.value}")
        rpicam = shutil.which(str(self.args.rpicam_vid))
        if not rpicam:
            raise RuntimeError(f"no se encontró {self.args.rpicam_vid}")
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        ascent_video_dir = self.args.ascent_video.parent
        ascent_video_dir.mkdir(parents=True, exist_ok=True)
        ascent_video_path = ascent_video_dir / f"ascent_video_{ts}.mp4"
        output = self.flight_log.open("ab")
        try:
            self.video_process = subprocess.Popen(
                [
                    rpicam,
                    "--camera", "0",
                    "--width", "1920",
                    "--height", "1080",
                    "--framerate", "60",
                    "--codec", "libav",
                    "--libav-format", "mp4",
                    "--inline",
                    "--listen",
                    "-o", str(ascent_video_path),
                    "-t", "0",
                ],
                stdin=subprocess.DEVNULL,
                stdout=output,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )
        finally:
            output.close()
        self.video_pid = self.video_process.pid
        self.process_started_monotonic["rpicam-vid"] = time.monotonic()
        self.record_event({
            "kind": "process_started", "process": "rpicam-vid", "pid": self.video_pid,
        })
        self.ascent_pid_file.parent.mkdir(parents=True, exist_ok=True)
        self.ascent_pid_file.write_text(f"{self.video_pid}\n", encoding="ascii")
        self.set_state(State.ASCENT, f"rpicam-vid PID {self.video_pid}")
        self.ascent_deadline = time.monotonic() + self.args.ascent_watchdog

    def stop_ascent_video(self) -> None:
        process = self.video_process
        if process is None:
            return
        if process.poll() is None:
            try:
                process.send_signal(signal.SIGINT)
            except ProcessLookupError:
                pass
            try:
                process.wait(timeout=1.0)
            except subprocess.TimeoutExpired:
                try:
                    process.send_signal(signal.SIGTERM)
                except ProcessLookupError:
                    pass
                try:
                    process.wait(timeout=2.0)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=2.0)
        self.video_process = None
        self.video_pid = None
        self.ascent_pid_file.unlink(missing_ok=True)
        self.record_performance_event("process_complete", {
            "process": "rpicam-vid", "exit_code": process.returncode,
            "elapsed_s": round(time.monotonic() - self.process_started_monotonic.pop("rpicam-vid", time.monotonic()), 3),
            "completion_reason": "missiond_stop",
        })

    def start_recording(self) -> None:
        if self.state == State.RECORDING and self.process and self.process.poll() is None:
            return
        if self.state != State.ASCENT:
            raise ValueError(f"START_REC no permitido en estado {self.state.value}")
        if self.video_process is None or self.video_process.poll() is not None:
            raise RuntimeError("el proceso de video de ascenso no está activo")
        self.stop_ascent_video()
        self.ascent_deadline = None
        self.set_state(State.STARTING, "video de ascenso cerrado; preparando RAW")
        env = os.environ.copy()
        env["DEMETER_RECORDINGS_DIR"] = str(self.args.recordings_dir)
        env["DEMETER_EVENT_SOCKET"] = str(self.args.event_socket)
        env["DEMETER_WAIT_POSTPROCESS"] = "1"
        env["DEMETER_MAX_TIME"] = str(self.args.descent_watchdog)
        env["DEMETER_CHUNK_TIME"] = str(self.args.chunk_time)
        env["DEMETER_MAX_TARGET_FPS"] = str(getattr(self.args, "max_target_fps", 2))
        if self.mission_id:
            env["DEMETER_MISSION_ID"] = self.mission_id
        if not self.send_telemetry_control({"reset_telemetry": True}, "telemetry_reset"):
            raise RuntimeError("telemetryd no está disponible; se evita capturar con un snapshot obsoleto")
        self.flight_log_offset = self.flight_log.stat().st_size if self.flight_log.exists() else 0
        with self.flight_log.open("ab") as flight_output:
            self.process = subprocess.Popen(
                [str(self.args.ingest_script)], cwd=str(self.args.ingest_script.parent), env=env,
                stdin=subprocess.DEVNULL, stdout=flight_output, stderr=subprocess.STDOUT,
                start_new_session=True,
            )
        self.process_started_monotonic["demeter_ingestd.sh"] = time.monotonic()
        self.record_event({
            "kind": "process_started", "process": "demeter_ingestd.sh", "pid": self.process.pid,
        })
        self.set_state(State.RECORDING, f"flight PID {self.process.pid}")
        self.recording_deadline = time.monotonic() + self.args.descent_watchdog

    def touchdown(self) -> None:
        if self.state in (State.INGESTING, State.PROCESSING, State.COMPLETE):
            return
        if self.state != State.RECORDING:
            raise ValueError(f"TOUCHDOWN no permitido en estado {self.state.value}")
        TOUCHDOWN_FLAG.touch(exist_ok=False)
        self.owns_touchdown_flag = True
        self.recording_deadline = None
        self.set_state(State.INGESTING, "comando TOUCHDOWN")

    def abort(self) -> None:
        if self.state in (State.ABORTED, State.COMPLETE, State.ERROR):
            return
        if self.video_process:
            self.stop_ascent_video()
        force_killed = False
        if self.process and self.process.poll() is None:
            try:
                self.process.send_signal(signal.SIGINT)
            except ProcessLookupError:
                pass
            try:
                self.process.wait(timeout=self.args.stop_timeout)
            except subprocess.TimeoutExpired:
                try:
                    self.process.send_signal(signal.SIGTERM)
                except ProcessLookupError:
                    pass
                try:
                    self.process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.process.kill()
                    self.process.wait(timeout=2)
                    force_killed = True
        if self.owns_touchdown_flag:
            TOUCHDOWN_FLAG.unlink(missing_ok=True)
            self.owns_touchdown_flag = False
        reason = "ABORT; proceso detenido con SIGINT/SIGTERM"
        if force_killed:
            reason += "; SIGKILL de recuperación tras timeout"
        self.set_state(State.ABORTED, reason)
        self.finalize_mission("ABORTED", reason)

    def handle_command(self, command: str, source: str) -> None:
        self.record_event({"kind": "command", "command": command, "source": source})
        try:
            if command == "PREFLIGHT":
                self.preflight()
            elif command == "ARM":
                self.arm()
            elif command == "START_ASCENT":
                self.start_ascent()
            elif command == "START_REC":
                self.start_recording()
            elif command == "TOUCHDOWN":
                self.touchdown()
            elif command == "ABORT":
                self.abort()
            else:
                raise ValueError(f"comando desconocido: {command}")
        except (ValueError, OSError, RuntimeError) as exc:
            self.record_event({
                "kind": "command_rejected", "command": command,
                "error_type": type(exc).__name__, "error": str(exc),
            })
            LOG.warning("comando %s rechazado (%s): %s", command, type(exc).__name__, exc)
            should_fail = (
                (command == "ARM" and self.state == State.READY)
                or (command == "START_ASCENT" and self.state == State.ARMED)
                or (command == "START_REC" and self.state in (State.ASCENT, State.STARTING))
                or (command == "PREFLIGHT" and self.state == State.PREFLIGHT)
            )
            if should_fail:
                self.fail(str(exc))
        except Exception as exc:
            self.record_event({
                "kind": "command_failed", "command": command,
                "error_type": type(exc).__name__, "error": str(exc),
            })
            LOG.exception("fallo inesperado ejecutando comando %s", command)
            if self.state not in (State.ERROR, State.COMPLETE, State.ABORTED):
                self.fail(f"fallo interno en {command}: {type(exc).__name__}: {exc}")

    def handle_event(self, event: dict[str, Any]) -> None:
        kind = event.get("kind")
        if kind == "command":
            command = event.get("command")
            if isinstance(command, str):
                self.handle_command(command, str(event.get("source", "lilygo")))
        elif kind == "mission_started":
            mission_dir = event.get("mission_dir")
            if isinstance(mission_dir, str):
                self.mission_recording_dir = Path(mission_dir)
            self.record_event(event)
        elif kind == "process_started":
            process = event.get("process")
            if isinstance(process, str):
                self.process_started_monotonic.setdefault(process, time.monotonic())
            self.record_event(event)
        elif kind in (
            "telemetry", "lilygo_status", "clock_sync", "clock_sync_rejected",
            "telemetry_reset", "telemetry_health", "preflight_closed",
        ):
            self.record_event(event)
        elif kind in (
            "chunk_ingested", "chunk_postprocess_complete", "postprocess_complete",
            "process_complete", "chunk_transfer_failed",
        ):
            details = dict(event)
            details.pop("kind", None)
            self.record_performance_event(kind, details)
        else:
            self.record_event({"kind": "unknown_event", "event": event})

    def mission_processes(self) -> dict[str, dict[str, Any]]:
        processes: dict[str, dict[str, Any]] = {}
        for event in self.mission_events:
            process = event.get("process")
            if not isinstance(process, str):
                continue
            if event.get("kind") == "process_started":
                processes.setdefault(process, {}).update({
                    "pid": event.get("pid"),
                    "started_at": event.get("pi_ts"),
                    "started_monotonic": event.get("monotonic_ts"),
                    "max_target_fps": event.get("max_target_fps"),
                })
            elif event.get("kind") == "process_complete":
                entry = processes.setdefault(process, {})
                entry.update({
                    "exit_code": event.get("exit_code"),
                    "ended_at": event.get("pi_ts"),
                    "elapsed_s": event.get("elapsed_s"),
                })
                for key in ("failure_reason", "frames_ok", "frame_errors", "completion_reason"):
                    if key in event:
                        entry[key] = event[key]
                if entry.get("elapsed_s") is None and isinstance(entry.get("started_monotonic"), (int, float)):
                    ended = event.get("monotonic_ts")
                    if isinstance(ended, (int, float)):
                        entry["elapsed_s"] = round(max(0.0, ended - entry["started_monotonic"]), 3)
                entry.pop("started_monotonic", None)
        return processes

    def mission_resource_summary(self) -> dict[str, Any]:
        fields = {
            "ramcam_used_percent": max,
            "ramcam_used_bytes": max,
            "mem_available_kb": min,
            "temperature_c": max,
            "sd_read_mib_s": min,
            "sd_write_mib_s": min,
            "sd_ingest_write_mib_s": min,
        }
        grouped: dict[str, list[dict[str, Any]]] = {}
        for event in self.mission_events:
            if event.get("kind") not in ("performance_sample", "chunk_ingested", "chunk_postprocess_complete"):
                continue
            metrics = event.get("metrics")
            if isinstance(metrics, dict):
                grouped.setdefault(str(event.get("state", "UNKNOWN")), []).append(metrics)

        def summarize(samples: list[dict[str, Any]]) -> dict[str, Any]:
            summary: dict[str, Any] = {"samples": len(samples)}
            for field, reducer in fields.items():
                values = [sample[field] for sample in samples if isinstance(sample.get(field), (int, float))]
                if values:
                    summary[field] = reducer(values)
            return summary

        result: dict[str, Any] = {"overall": summarize([m for group in grouped.values() for m in group])}
        result["by_state"] = {state: summarize(samples) for state, samples in grouped.items()}
        if self.last_preflight_metrics:
            result["preflight"] = {
                key: self.last_preflight_metrics.get(key)
                for key in ("mem_available_kb", "ramcam_total_bytes", "temperature_c")
            }
        if getattr(self.args, "resource_budget", None):
            result["arm_budget"] = self.args.resource_budget
        return result

    def mission_chunks(self) -> list[dict[str, Any]]:
        chunks: dict[str, dict[str, Any]] = {}
        for event in self.mission_events:
            chunk = event.get("chunk")
            if not isinstance(chunk, str):
                continue
            entry = chunks.setdefault(chunk, {"chunk": chunk})
            kind = event.get("kind")
            if kind == "chunk_ingested":
                entry["ingested"] = event.get("source_removed") is True
                metrics = event.get("metrics")
                if isinstance(metrics, dict):
                    entry["ingest_metrics"] = metrics
            elif kind == "chunk_postprocess_complete":
                entry["postprocess_elapsed_s"] = event.get("elapsed_s")
                entry["postprocess_metrics"] = event.get("metrics", {})
            elif kind == "chunk_transfer_failed":
                entry.setdefault("transfer_failures", []).append({
                    "phase": event.get("phase"), "exit_code": event.get("exit_code"),
                })
        return [chunks[name] for name in sorted(chunks)]

    def finalize_mission(self, outcome: str, reason: str) -> None:
        if not self.mission_id or self.mission_report_written:
            return
        now_epoch = time.time()
        now_monotonic = time.monotonic()
        previous_state = "READY"
        previous_monotonic = self.mission_start_monotonic or now_monotonic
        stages: list[dict[str, Any]] = []
        for event in self.mission_events:
            if event.get("kind") != "state" or not isinstance(event.get("to"), str):
                continue
            event_monotonic = event.get("monotonic_ts", previous_monotonic)
            stages.append({
                "state": previous_state,
                "duration_s": round(max(0.0, event_monotonic - previous_monotonic), 3),
                "ended_at": event.get("pi_ts"),
                "reason": event.get("reason"),
            })
            previous_state = event["to"]
            previous_monotonic = event_monotonic
        stages.append({
            "state": previous_state,
            "duration_s": round(max(0.0, now_monotonic - previous_monotonic), 3),
            "ended_at": now_epoch,
        })
        processes = self.mission_processes()
        report = {
            "schema_version": 1,
            "mission_id": self.mission_id,
            "outcome": outcome,
            "reason": reason,
            "started_at": self.mission_start_epoch,
            "ended_at": now_epoch,
            "duration_s": round(max(0.0, now_monotonic - (self.mission_start_monotonic or now_monotonic)), 3),
            "preflight_duration_s": self.last_preflight_duration_s,
            "recording_dir": str(self.mission_recording_dir) if self.mission_recording_dir else None,
            "stages": stages,
            "processes": processes,
            "chunks": self.mission_chunks(),
            "resources": self.mission_resource_summary(),
            "watchdogs": [
                {"watchdog": event.get("watchdog"), "action": event.get("action"), "at": event.get("pi_ts")}
                for event in self.mission_events if event.get("kind") == "watchdog"
            ],
            "performance_alerts": [
                {"kind": event.get("kind"), "alerts": event.get("alerts", [])}
                for event in self.mission_events if event.get("alerts")
            ],
            "warnings": [
                {"kind": event.get("kind"), "process": event.get("process"),
                 "failure_reason": event.get("failure_reason"), "exit_code": event.get("exit_code"),
                 "chunk": event.get("chunk"), "phase": event.get("phase")}
                for event in self.mission_events
                if (event.get("kind") == "process_complete" and event.get("exit_code") not in (None, 0))
                or event.get("kind") == "chunk_transfer_failed"
            ],
        }
        report_dir = self.mission_recording_dir if self.mission_recording_dir and self.mission_recording_dir.is_dir() else self.event_log.parent
        report_paths = [report_dir / ("mission_report.json" if report_dir == self.mission_recording_dir else f"mission_{self.mission_id}_report.json")]
        fallback_path = self.event_log.parent / f"mission_{self.mission_id}_report.json"
        if fallback_path != report_paths[0]:
            report_paths.append(fallback_path)
        report_path: Path | None = None
        for candidate in report_paths:
            try:
                atomic_json(candidate, report)
                report_path = candidate
                break
            except OSError as exc:
                LOG.error("no se pudo escribir informe de misión en %s (%s): %s", candidate, type(exc).__name__, exc)
        if report_path is None:
            return
        self.mission_report_written = True
        LOG.info(
            "informe de misión id=%s outcome=%s duración=%.1fs procesos=%d informe=%s motivo=%s",
            self.mission_id, outcome, report["duration_s"], len(processes), report_path, reason,
        )
        for process, details in processes.items():
            LOG.info(
                "informe proceso misión=%s proceso=%s exit=%s duración=%ss",
                self.mission_id, process, details.get("exit_code"), details.get("elapsed_s"),
            )
        for stage in stages:
            LOG.info("informe etapa misión=%s estado=%s duración=%.1fs", self.mission_id, stage["state"], stage["duration_s"])

    def poll_process(self) -> None:
        now = time.monotonic()
        interval = getattr(self.args, "performance_sample_interval_s", PERFORMANCE_SAMPLE_INTERVAL_S)
        if now - self.last_performance_sample >= interval:
            self.record_performance_event("performance_sample", {"phase": "mission_runtime"})
            self.last_performance_sample = now
        if (
            self.state == State.ASCENT
            and self.ascent_deadline is not None
            and now > self.ascent_deadline
        ):
            message = "Watchdog de ascenso disparado"
            LOG.warning(message)
            self.record_event({"kind": "watchdog", "watchdog": "ascent", "action": "start_recording"})
            try:
                self.start_recording()
            except Exception as exc:
                self.fail(f"{message}: no se pudo iniciar grabación: {type(exc).__name__}: {exc}")
            return
        if (
            self.state == State.RECORDING
            and self.recording_deadline is not None
            and now > self.recording_deadline
        ):
            message = "Watchdog de descenso disparado"
            LOG.warning(message)
            self.record_event({"kind": "watchdog", "watchdog": "descent", "action": "touchdown"})
            try:
                self.touchdown()
            except Exception as exc:
                self.fail(f"{message}: no se pudo registrar touchdown: {type(exc).__name__}: {exc}")
            return
        if self.state == State.ASCENT and self.video_process and self.video_process.poll() is not None:
            status = self.video_process.returncode
            self.record_event({"kind": "ascent_video_exit", "returncode": status})
            self.record_performance_event("process_complete", {
                "process": "rpicam-vid", "exit_code": status,
                "completion_reason": "unexpected_exit",
            })
            self.video_process = None
            self.video_pid = None
            self.ascent_pid_file.unlink(missing_ok=True)
            self.fail(f"rpicam-vid terminó durante ascenso con estado {status}")
        if self.process and self.process.poll() is None:
            try:
                with self.flight_log.open("rb") as output:
                    output.seek(self.flight_log_offset)
                    new_output = output.read()
                    self.flight_log_offset = output.tell()
                if b"Revelado iniciado" in new_output and self.state in (State.RECORDING, State.INGESTING):
                    self.set_state(State.PROCESSING, "postproceso iniciado")
            except OSError as exc:
                LOG.warning("no se pudo observar progreso de vuelo: %s", exc)
        if not self.process or self.process.poll() is None:
            return
        status = self.process.returncode
        if self.owns_touchdown_flag:
            TOUCHDOWN_FLAG.unlink(missing_ok=True)
            self.owns_touchdown_flag = False
        try:
            with self.flight_log.open("rb") as output:
                output.seek(max(0, self.flight_log.stat().st_size - 4000))
                detail = output.read().decode(errors="replace")
        except OSError as exc:
            LOG.error("no se pudo leer el log del vuelo %s (%s): %s", self.flight_log, type(exc).__name__, exc)
            detail = ""
        self.record_performance_event("process_complete", {
            "process": "demeter_ingestd.sh", "exit_code": status, "log_tail": detail,
        })
        self.record_event({"kind": "flight_exit", "returncode": status, "log_tail": detail})
        processes = self.mission_processes()
        outcome, reason = classify_mission_result(status, processes)
        if outcome == "ERROR":
            self.fail(f"{reason}; demeter_ingestd exit={status}: {detail.strip()}")
        else:
            if self.state in (State.INGESTING, State.RECORDING):
                self.set_state(State.PROCESSING, "captura cerrada; postproceso finalizado")
            self.set_state(State.COMPLETE, f"misión {outcome}: {reason}")
            self.finalize_mission(outcome, reason)
        self.process = None

    def run(self) -> int:
        if (
            self.args.min_free_bytes < 0
            or self.args.stop_timeout <= 0
            or not math.isfinite(self.args.ascent_watchdog)
            or self.args.ascent_watchdog <= 0
            or not math.isfinite(self.args.descent_watchdog)
            or self.args.descent_watchdog <= 0
            or not math.isfinite(self.args.chunk_time)
            or self.args.chunk_time <= 0
        ):
            LOG.error("timeouts deben ser finitos y positivos, y min-free-bytes no negativo")
            return 2
        os.umask(0o027)
        self.args.control_socket.parent.mkdir(parents=True, exist_ok=True)
        self.args.event_socket.parent.mkdir(parents=True, exist_ok=True)
        for path in (self.args.control_socket, self.args.event_socket):
            path.unlink(missing_ok=True)
        self.command_socket.bind(str(self.args.control_socket))
        self.event_socket.bind(str(self.args.event_socket))
        self.command_socket.setblocking(False)
        self.event_socket.setblocking(False)
        self.record_event({"kind": "state", "from": None, "to": State.BOOT.value, "reason": "esperando CMD_PREFLIGHT"})
        atomic_json(self.args.state_file, {
            "state": State.BOOT.value, "status": int(STATUS[State.BOOT]),
            "changed_at": self.changed_at, "reason": "esperando CMD_PREFLIGHT",
            "error": None, "video_pid": None, "flight_pid": None,
        })
        self.publish_status()
        try:
            while not STOP and self.state != State.COMPLETE:
                readable, _, _ = select_select([self.command_socket, self.event_socket], 0.5)
                for channel in readable:
                    try:
                        raw = channel.recv(8192)
                        value = json.loads(raw)
                        if not isinstance(value, dict):
                            raise ValueError("evento JSON debe ser objeto")
                        if channel is self.command_socket:
                            command = value.get("command")
                            if isinstance(command, str):
                                self.handle_command(command, "local")
                            else:
                                self.record_event({"kind": "invalid_control", "value": value})
                        else:
                            self.handle_event(value)
                    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
                        LOG.warning("mensaje IPC inválido en %s (%s): %s", channel.getsockname(), type(exc).__name__, exc)
                self.poll_process()
                if time.monotonic() - self.last_status_sent >= STATUS_EVERY_S:
                    self.publish_status(quiet=True)
            # En BOOT no hay mision ni procesos: parar es solo salir (BOOT -> ABORTED no es transicion valida)
            if STOP and self.state not in (State.BOOT, State.COMPLETE, State.ABORTED, State.ERROR):
                self.abort()
        finally:
            if self.video_process:
                self.stop_ascent_video()
            if self.process and self.process.poll() is None:
                try:
                    self.process.send_signal(signal.SIGINT)
                except ProcessLookupError:
                    pass
                try:
                    self.process.wait(timeout=self.args.stop_timeout)
                except subprocess.TimeoutExpired:
                    try:
                        self.process.send_signal(signal.SIGTERM)
                    except ProcessLookupError:
                        pass
                    try:
                        self.process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        self.process.kill()
                        self.process.wait(timeout=2)
            self.command_socket.close()
            self.event_socket.close()
            self.event_file.close()
            self.args.control_socket.unlink(missing_ok=True)
            self.args.event_socket.unlink(missing_ok=True)
        return 1 if self.state == State.ERROR else 0


def select_select(readers: list[socket.socket], timeout: float) -> tuple[list[socket.socket], list[Any], list[Any]]:
    import select
    return select.select(readers, [], [], timeout)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--ingest-script", "--flight-script", dest="ingest_script", type=Path,
        default=Path(__file__).resolve().parent / "eyes_of_demeter" / "demeter_ingestd.sh",
    )
    parser.add_argument("--rpicam-vid", default="rpicam-vid")
    parser.add_argument("--recorder-bin", type=Path, default=Path(__file__).resolve().parent / "eyes_of_demeter" / ".build" / "bin" / "demeter_rec")
    parser.add_argument(
        "--ascent-video", type=Path,
        default=Path("/home/admin/demeter_recording/normal_rec/ascent_video.mp4"),
    )
    parser.add_argument("--ram-dir", type=Path, default=Path("/mnt/ramcam"))
    parser.add_argument("--recordings-dir", type=Path, default=Path("/home/admin/demeter_recording/scientific_rec/raw"))
    parser.add_argument("--min-free-bytes", type=int, default=5 * 1024**3)
    parser.add_argument("--ascent-watchdog", type=float, default=ASCENT_WATCHDOG_S)
    parser.add_argument("--descent-watchdog", type=float, default=RECORDING_WATCHDOG_S)
    parser.add_argument("--chunk-time", type=float, default=8.0)
    state_root = Path("/home/admin/demeter_recording/missiond")
    parser.add_argument("--state-file", type=Path, default=state_root / "state.json")
    parser.add_argument("--event-log", type=Path, default=state_root / "mission.jsonl")
    parser.add_argument("--diagnostic-log", type=Path, default=state_root / "missiond.log")
    parser.add_argument("--event-socket", type=Path, default=Path("/tmp/demeter/mission.sock"))
    parser.add_argument("--control-socket", type=Path, default=Path("/tmp/demeter/control.sock"))
    parser.add_argument("--telemetry-socket", type=Path, default=Path("/tmp/demeter/telemetry.sock"))
    parser.add_argument("--stop-timeout", type=float, default=600.0)
    parser.add_argument("--temperature-warning-c", type=float, default=75.0)
    parser.add_argument("--temperature-critical-c", type=float, default=80.0)
    parser.add_argument("--sd-min-read-mib-s", type=float, default=SD_MIN_MIB_S)
    parser.add_argument("--sd-min-write-mib-s", type=float, default=SD_MIN_MIB_S)
    parser.add_argument("--sd-target-mib-s", type=float, default=SD_TARGET_MIB_S)
    parser.add_argument("--performance-sample-interval-s", type=float, default=5.0)
    return parser.parse_args()


def configure_logging(path: Path) -> None:
    handlers: list[logging.Handler] = [logging.StreamHandler()]
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(path, encoding="utf-8"))
    except OSError as exc:
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s %(levelname)s %(name)s pid=%(process)d %(message)s",
            handlers=handlers,
            force=True,
        )
        LOG.error("no se pudo abrir diagnostic-log=%s (%s): %s; queda stderr", path, type(exc).__name__, exc)
        return
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s pid=%(process)d %(message)s",
        handlers=handlers,
        force=True,
    )


def main() -> int:
    signal.signal(signal.SIGINT, request_stop)
    signal.signal(signal.SIGTERM, request_stop)
    try:
        args = parse_args()
        thresholds = (
            args.temperature_warning_c, args.temperature_critical_c,
            args.sd_min_read_mib_s, args.sd_min_write_mib_s, args.sd_target_mib_s,
            args.performance_sample_interval_s,
        )
        if (
            not all(math.isfinite(value) for value in thresholds)
            or args.temperature_warning_c < 0
            or args.temperature_critical_c <= args.temperature_warning_c
            or args.sd_min_read_mib_s < 0
            or args.sd_min_write_mib_s < 0
            or args.sd_target_mib_s <= 0
            or args.performance_sample_interval_s <= 0
        ):
            LOG.error("umbrales de rendimiento inválidos; revise temperatura, tasas SD e intervalo")
            return 2
        configure_logging(args.diagnostic_log)
        return MissionDaemon(args).run()
    except Exception:
        LOG.exception("fallo fatal en missiond")
        return 1


if __name__ == "__main__":
    sys.exit(main())
