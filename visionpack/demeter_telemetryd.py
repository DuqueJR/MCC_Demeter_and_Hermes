#!/usr/bin/env python3
"""LilyGO UART receiver, telemetry logger, and guarded clock synchronization."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import logging
import math
import os
from pathlib import Path
import select
import signal
import socket
import struct
import sys
import tempfile
import time
from typing import Any

from demeter_protocol import (
    CMD_ABORT,
    CMD_ARM,
    CMD_START_REC,
    CMD_TOUCHDOWN,
    PAYLOAD_STATUS,
    PREFLIGHT_SYNC,
    STATUS_STRUCT,
    TELEMETRY_STRUCT,
    TELEMETRY_UPDATE,
    StatusCode,
    StreamDecoder,
    encode_frame,
)

LOG = logging.getLogger("demeter_telemetryd")
STOP = False
COMMANDS = {"ARM": CMD_ARM, "START_REC": CMD_START_REC, "TOUCHDOWN": CMD_TOUCHDOWN, "ABORT": CMD_ABORT}
COMMAND_NAMES = {value: key for key, value in COMMANDS.items()}


def request_stop(_signum: int, _frame: Any) -> None:
    global STOP
    STOP = True


def utc_iso(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp, timezone.utc).isoformat(timespec="milliseconds")


def write_snapshot(path: Path, row: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as output:
            json.dump(row, output, separators=(",", ":"), allow_nan=False)
            output.write("\n")
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary_name, path)
    finally:
        Path(temporary_name).unlink(missing_ok=True)


def emit_event(event_socket: Path, message: dict[str, Any]) -> None:
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM) as channel:
            channel.sendto(json.dumps(message, separators=(",", ":")).encode(), str(event_socket))
    except (FileNotFoundError, ConnectionRefusedError):
        LOG.debug("mission daemon no disponible para evento %s", message.get("kind"))


def _sync_clock(lilygo_ms: int) -> None:
    if not 946684800000 <= lilygo_ms <= 4102444800000:
        raise ValueError("timestamp GPS fuera del rango 2000-2100")
    time.clock_settime(time.CLOCK_REALTIME, lilygo_ms / 1000.0)


def handle_frame(
    message_type: int,
    payload: bytes,
    *,
    log_path: Path,
    snapshot_path: Path,
    event_socket: Path,
    allow_clock_set: bool,
    preflight: bool,
    synced: bool,
    sync_deadline: float | None = None,
) -> bool:
    received = time.time()
    if message_type == PREFLIGHT_SYNC:
        if len(payload) != 8:
            raise ValueError("payload 0x10 debe contener uint64 Unix ms")
        lilygo_ms = struct.unpack("<Q", payload)[0]
        if (
            not preflight
            or not allow_clock_set
            or synced
            or sync_deadline is None
            or time.monotonic() > sync_deadline
        ):
            emit_event(event_socket, {"kind": "clock_sync_rejected", "pi_ts": received})
            return synced
        _sync_clock(lilygo_ms)
        emit_event(event_socket, {
            "kind": "clock_sync", "pi_ts": received,
            "lilygo_ts": lilygo_ms / 1000.0, "utc": utc_iso(lilygo_ms / 1000.0),
        })
        LOG.info("reloj sincronizado desde LilyGO: %s", utc_iso(lilygo_ms / 1000.0))
        return True

    if message_type == TELEMETRY_UPDATE:
        if len(payload) != TELEMETRY_STRUCT.size:
            raise ValueError(f"payload 0x20 debe tener {TELEMETRY_STRUCT.size} bytes")
        lilygo_ms, altitude, roll, pitch, yaw = TELEMETRY_STRUCT.unpack(payload)
        values = (altitude, roll, pitch, yaw)
        if not all(math.isfinite(value) for value in values):
            raise ValueError("telemetría contiene NaN/Inf")
        row = {
            "pi_ts": received,
            "lilygo_ts": lilygo_ms / 1000.0,
            "alt": altitude,
            "roll": roll,
            "pitch": pitch,
            "yaw": yaw,
        }
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with log_path.open("a", encoding="utf-8") as output:
            output.write(json.dumps(row, separators=(",", ":"), allow_nan=False) + "\n")
            output.flush()
        write_snapshot(snapshot_path, row)
        emit_event(event_socket, {"kind": "telemetry", **row})
        return synced

    if message_type == PAYLOAD_STATUS:
        if len(payload) != STATUS_STRUCT.size:
            raise ValueError("payload 0x30 debe contener un byte")
        status = STATUS_STRUCT.unpack(payload)[0]
        emit_event(event_socket, {"kind": "lilygo_status", "status": status, "pi_ts": received})
        return synced

    if message_type in COMMAND_NAMES:
        if payload:
            raise ValueError(f"comando {message_type:#x} debe ir sin payload")
        emit_event(event_socket, {
            "kind": "command", "command": COMMAND_NAMES[message_type], "source": "lilygo",
        })
    return synced


def run(args: argparse.Namespace) -> int:
    if args.baud <= 0 or not math.isfinite(args.sync_window_s) or args.sync_window_s <= 0:
        LOG.error("baud y sync-window-s deben ser finitos y mayores que cero")
        return 2
    try:
        import serial
    except ImportError:
        LOG.error("falta pyserial; instálelo con python3 -m pip install pyserial")
        return 2

    args.log.parent.mkdir(parents=True, exist_ok=True)
    args.command_socket.parent.mkdir(parents=True, exist_ok=True)
    os.umask(0o027)
    args.command_socket.unlink(missing_ok=True)
    command_socket = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
    command_socket.bind(str(args.command_socket))
    command_socket.setblocking(False)
    decoder = StreamDecoder()
    synced = False
    sync_deadline = time.monotonic() + args.sync_window_s if args.preflight else None
    preflight_open = args.preflight
    backoff = 1.0
    try:
        while not STOP:
            try:
                with serial.Serial(args.device, args.baud, timeout=0, write_timeout=2) as port:
                    LOG.info("UART abierto: %s a %d baud", args.device, args.baud)
                    backoff = 1.0
                    while not STOP:
                        ready, _, _ = select.select([port.fileno(), command_socket], [], [], 0.5)
                        if command_socket in ready:
                            raw_command = command_socket.recv(1024)
                            try:
                                command = json.loads(raw_command)
                                if command.get("reset_telemetry") is True:
                                    args.log.parent.mkdir(parents=True, exist_ok=True)
                                    args.log.write_text("", encoding="utf-8")
                                    args.snapshot.unlink(missing_ok=True)
                                    LOG.info("telemetría reiniciada para nueva misión")
                                    emit_event(event_socket=args.event_socket, message={
                                        "kind": "telemetry_reset",
                                        "request_id": command.get("request_id"),
                                        "ok": True,
                                    })
                                elif command.get("preflight_complete") is True:
                                    preflight_open = False
                                    emit_event(event_socket=args.event_socket, message={
                                        "kind": "preflight_closed",
                                        "request_id": command.get("request_id"),
                                        "ok": True,
                                    })
                                    LOG.info("preflight cerrado; no se aceptarán más ajustes de reloj")
                                elif "status" in command:
                                    status = int(command["status"])
                                    port.write(encode_frame(PAYLOAD_STATUS, STATUS_STRUCT.pack(status)))
                                    LOG.info("estado UART enviado: %d", status)
                                else:
                                    frame_type = COMMANDS[command["command"]]
                                    port.write(encode_frame(frame_type))
                                    LOG.info("comando UART enviado: %s", command["command"])
                            except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
                                LOG.warning("comando IPC inválido: %s", exc)
                        if port.fileno() in ready:
                            for frame in decoder.feed(port.read(512)):
                                try:
                                    synced = handle_frame(
                                        frame.message_type, frame.payload, log_path=args.log,
                                        snapshot_path=args.snapshot, event_socket=args.event_socket,
                                        allow_clock_set=args.allow_clock_set, preflight=preflight_open,
                                        synced=synced, sync_deadline=sync_deadline,
                                    )
                                except (ValueError, OSError, OverflowError) as exc:
                                    LOG.warning("trama 0x%02x rechazada: %s", frame.message_type, exc)
            except (OSError, serial.SerialException) as exc:
                LOG.error("UART no disponible (%s); reconexión en %.1fs", exc, backoff)
                time.sleep(backoff)
                backoff = min(backoff * 2, 30.0)
    finally:
        command_socket.close()
        args.command_socket.unlink(missing_ok=True)
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--device", "--port", dest="device", default="/dev/serial0")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--log", type=Path, default=Path("/mnt/ramcam/telemetry.jsonl"))
    parser.add_argument("--snapshot", type=Path, default=Path("/mnt/ramcam/current_telemetry.json"))
    parser.add_argument("--event-socket", type=Path, default=Path("/tmp/demeter/mission.sock"))
    parser.add_argument("--command-socket", type=Path, default=Path("/tmp/demeter/telemetry.sock"))
    parser.add_argument("--preflight", action="store_true", help="permite sincronización solo con --allow-clock-set")
    parser.add_argument("--allow-clock-set", action="store_true", help="requiere CAP_SYS_TIME y solo sincroniza una vez")
    parser.add_argument("--sync-window-s", type=float, default=120.0)
    return parser.parse_args()


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    signal.signal(signal.SIGINT, request_stop)
    signal.signal(signal.SIGTERM, request_stop)
    return run(parse_args())


if __name__ == "__main__":
    sys.exit(main())
