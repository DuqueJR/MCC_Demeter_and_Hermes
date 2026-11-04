#!/usr/bin/env python3
"""Interactive SITL emulator for the Demeter LilyGO flight computer."""

from __future__ import annotations

import argparse
from bisect import bisect_right
import csv
import logging
import math
import signal
import sys
import threading
import time
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    import serial
except ImportError as exc:
    raise SystemExit("Falta pyserial; instálelo con python3 -m pip install pyserial") from exc

from demeter_protocol import (
    CMD_ABORT,
    CMD_ARM,
    CMD_PREFLIGHT,
    CMD_START_ASCENT,
    CMD_START_REC,
    CMD_TOUCHDOWN,
    PAYLOAD_STATUS,
    POSE_UPDATE,
    STATUS_STRUCT,
    StatusCode,
    StreamDecoder,
    encode_frame,
)

import demeter_pose as dp

ROOT = Path(__file__).resolve().parent
SITE_LAT, SITE_LON, SITE_MSL_M = 6.5560, -75.8270, 510.0     # sitio de la simulacion (Santa Fe de Antioquia, aprox.)
EMU_FLAGS = (dp.F_EKF | dp.F_ATT | dp.F_POS | dp.F_ALT | dp.F_TIME | (1 << dp.F_TIME_SRC_SHIFT) | dp.F_GNSS3D | dp.F_FLY)
_seq = [0]
LOG = logging.getLogger("lilygo_emulator")
STATUS_NAMES = {int(status): status.name for status in StatusCode}
STOP = threading.Event()


@dataclass(frozen=True)
class FlightSample:
    time_s: float
    altitude_m: float
    roll_deg: float = 0.0
    pitch_deg: float = 0.0
    yaw_deg: float = 0.0


def request_stop(_signum: int, _frame: Any) -> None:
    STOP.set()
    raise KeyboardInterrupt


def normalize_header(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    ascii_text = decomposed.encode("ascii", "ignore").decode("ascii").casefold()
    return "".join(character for character in ascii_text if character.isalnum())


def load_flight_csv(path: Path) -> list[FlightSample]:
    header: list[str] | None = None
    time_column: int | None = None
    altitude_column: int | None = None
    velocity_column: int | None = None
    samples: list[FlightSample] = []
    try:
        source = path.open(encoding="utf-8-sig", newline="")
    except OSError as exc:
        raise ValueError(f"no se pudo abrir CSV {path}: {exc}") from exc

    with source:
        for line_number, raw_line in enumerate(source, start=1):
            stripped = raw_line.strip()
            if not stripped:
                continue
            candidate = stripped.lstrip("# ").strip() if stripped.startswith("#") else stripped
            fields = next(csv.reader([candidate]))
            normalized = [normalize_header(field) for field in fields]
            time_index = next((i for i, field in enumerate(normalized) if field.startswith("tiempo") or field in ("time", "times")), None)
            altitude_index = next((i for i, field in enumerate(normalized) if field.startswith("altitud") or field.startswith("altitude")), None)
            if time_index is not None and altitude_index is not None:
                header = normalized
                time_column = time_index
                altitude_column = altitude_index
                velocity_column = next((i for i, field in enumerate(header) if "velocidadvertical" in field), None)
                continue
            if stripped.startswith("#"):
                continue
            if header is None:
                raise ValueError(f"no se encontró cabecera Tiempo/Altitud antes de línea {line_number}")
            if len(fields) < len(header):
                raise ValueError(f"línea {line_number}: se esperaban {len(header)} columnas y llegaron {len(fields)}")
            try:
                values = [float(value.strip()) for value in fields]
            except ValueError as exc:
                raise ValueError(f"línea {line_number}: dato numérico inválido: {exc}") from exc
            if not all(math.isfinite(value) for value in values):
                raise ValueError(f"línea {line_number}: NaN/Inf no permitido")
            assert time_column is not None and altitude_column is not None
            time_s = values[time_column]
            altitude_m = values[altitude_column]
            velocity = values[velocity_column] if velocity_column is not None else 0.0
            if time_s < 0 or altitude_m < 0:
                raise ValueError(f"línea {line_number}: tiempo y altitud deben ser no negativos")
            pitch = math.degrees(math.atan2(velocity, 25.0))
            if samples and time_s <= samples[-1].time_s:
                raise ValueError(f"línea {line_number}: Tiempo debe ser estrictamente creciente")
            samples.append(FlightSample(time_s, altitude_m, 0.0, pitch, 0.0))

    if len(samples) < 2:
        raise ValueError("el CSV debe contener al menos dos muestras")
    return samples


def telemetry_payload(sample: FlightSample, timestamp_ms: int | None = None) -> bytes:
    """Trama POSE (0x21) con la altitud del CSV y el cohete inclinado solo en pitch (roll y yaw 0)."""
    utc_us = time.time_ns() // 1000 if timestamp_ms is None else timestamp_ms * 1000
    values = (sample.altitude_m, sample.roll_deg, sample.pitch_deg, sample.yaw_deg)
    if not all(math.isfinite(value) for value in values):
        raise ValueError("muestra CSV contiene NaN/Inf")
    half = math.radians(sample.pitch_deg) / 2
    _seq[0] = (_seq[0] + 1) & 0xFFFF
    return dp.encode_pose(utc_us, _seq[0], EMU_FLAGS, SITE_LAT, SITE_LON, sample.altitude_m, SITE_MSL_M,
                          (0.0, 0.0, 0.0), (math.cos(half), 0.0, math.sin(half), 0.0), (0.0, 0.0, 0.0), 1.0, 2.0, 0.5)


def send_packet(port: serial.Serial, write_lock: threading.Lock, packet: bytes) -> None:
    with write_lock:
        port.write(packet)
        port.flush()


def receive_status(port: serial.Serial, stop: threading.Event) -> None:
    decoder = StreamDecoder()
    while not stop.is_set():
        try:
            incoming = port.read(256)
        except (serial.SerialException, OSError) as exc:
            if not stop.is_set():
                LOG.exception("RX UART falló en %s (%s): %s", port.port, type(exc).__name__, exc)
            return
        if not incoming:
            continue
        for frame in decoder.feed(incoming):
            if frame.message_type != PAYLOAD_STATUS:
                LOG.warning("RX recibió tipo de trama no esperado: 0x%02X", frame.message_type)
                continue
            if len(frame.payload) != STATUS_STRUCT.size:
                LOG.warning("RX estado inválido: payload=%d bytes; esperado=%d", len(frame.payload), STATUS_STRUCT.size)
                continue
            status = STATUS_STRUCT.unpack(frame.payload)[0]
            name = STATUS_NAMES.get(status, "UNKNOWN")
            print(f"\n[Pi -> LilyGO] Estado 0x{status:02X}: {name}", flush=True)


class FlightRun:
    def __init__(
        self,
        samples: list[FlightSample],
        port: serial.Serial,
        write_lock: threading.Lock,
        telemetry_enabled: threading.Event,
        auto_enabled: threading.Event,
    ) -> None:
        self.samples = samples
        self.sample_times = [sample.time_s for sample in samples]
        self.port = port
        self.write_lock = write_lock
        self.telemetry_enabled = telemetry_enabled
        self.auto_enabled = auto_enabled
        self.stop = threading.Event()
        self.condition = threading.Condition()
        self.wake_generation = 0
        self.started_at: float | None = None
        self.thread: threading.Thread | None = None
        self.command_state_lock = threading.Lock()
        self.start_rec_sent = False
        self.touchdown_sent = False
        self.transmission_errors = 0
        self.failure: Exception | None = None

    @property
    def active(self) -> bool:
        return self.thread is not None and self.thread.is_alive()

    def launch(self) -> None:
        self.stop.clear()
        self.start_rec_sent = False
        self.touchdown_sent = False
        self.transmission_errors = 0
        self.started_at = time.monotonic()
        self.set_telemetry_enabled(True)
        self.thread = threading.Thread(target=self._run, name="gcs-csv-flight", daemon=False)
        self.thread.start()

    def set_telemetry_enabled(self, enabled: bool) -> None:
        with self.condition:
            if enabled:
                self.telemetry_enabled.set()
            else:
                self.telemetry_enabled.clear()
            self.wake_generation += 1
            self.condition.notify_all()

    def _send_command(self, message_type: int, label: str) -> None:
        send_packet(self.port, self.write_lock, encode_frame(message_type))
        print(f"\n[GCS -> Pi] {label} enviado", flush=True)

    def trigger_start_rec(self, label: str = "CMD_START_REC") -> bool:
        with self.command_state_lock:
            if self.start_rec_sent:
                return False
            self._send_command(CMD_START_REC, label)
            self.start_rec_sent = True
            return True

    def trigger_touchdown(self, label: str = "CMD_TOUCHDOWN") -> bool:
        with self.command_state_lock:
            if self.touchdown_sent:
                return False
            self._send_command(CMD_TOUCHDOWN, label)
            self.touchdown_sent = True
            return True

    def _autopilot_step(self, index: int) -> None:
        if not self.auto_enabled.is_set() or index <= 0:
            return
        previous = self.samples[index - 1]
        current = self.samples[index]
        if not self.start_rec_sent and current.altitude_m < previous.altitude_m:
            self.trigger_start_rec("CMD_START_REC (apogeo detectado)")
        if (
            self.start_rec_sent
            and not self.touchdown_sent
            and current.altitude_m <= 0.1
            and previous.altitude_m > current.altitude_m
        ):
            self.trigger_touchdown("CMD_TOUCHDOWN (suelo detectado)")

    def _run(self) -> None:
        assert self.started_at is not None
        processed_index = -1
        was_transmitting = False
        last_display = 0.0
        try:
            while not self.stop.is_set() and not STOP.is_set():
                elapsed = max(0.0, time.monotonic() - self.started_at)
                index = max(0, bisect_right(self.sample_times, elapsed) - 1)
                new_indices = range(processed_index + 1, index + 1)
                for crossed_index in new_indices:
                    self._autopilot_step(crossed_index)
                transmitting = self.telemetry_enabled.is_set()
                if transmitting:
                    send_indices = [index] if not was_transmitting else range(processed_index + 1, index + 1)
                    for send_index in send_indices:
                        sample_to_send = self.samples[send_index]
                        try:
                            send_packet(
                                self.port,
                                self.write_lock,
                                encode_frame(POSE_UPDATE, telemetry_payload(sample_to_send)),
                            )
                            self.transmission_errors = 0
                        except (serial.SerialException, OSError) as exc:
                            self.transmission_errors += 1
                            self.failure = exc
                            if self.transmission_errors == 1:
                                LOG.exception(
                                    "TX UART falló en muestra %d (%s): %s",
                                    send_index, type(exc).__name__, exc,
                                )
                was_transmitting = transmitting
                processed_index = max(processed_index, index)
                sample = self.samples[index]

                if elapsed - last_display >= 0.5:
                    print(
                        f"\n[GCS] t={elapsed:6.2f}s alt={sample.altitude_m:8.2f}m "
                        f"({index + 1}/{len(self.samples)})"
                        f"{' LOS' if not self.telemetry_enabled.is_set() else ''}",
                        flush=True,
                    )
                    last_display = elapsed

                if index == len(self.samples) - 1 and elapsed >= self.samples[-1].time_s:
                    if (
                        self.auto_enabled.is_set()
                        and self.start_rec_sent
                        and not self.touchdown_sent
                        and sample.altitude_m <= 0.1
                    ):
                        self.trigger_touchdown("CMD_TOUCHDOWN (fin CSV)")
                    print("\n[GCS] Simulación CSV finalizada; reloj detenido", flush=True)
                    self.set_telemetry_enabled(False)
                    return

                next_index = processed_index + 1
                until_next = max(
                    0.0,
                    self.started_at + self.samples[next_index].time_s - time.monotonic(),
                )
                with self.condition:
                    generation = self.wake_generation
                    self.condition.wait_for(
                        lambda: generation != self.wake_generation or self.stop.is_set() or STOP.is_set(),
                        timeout=until_next,
                    )
        except (serial.SerialException, OSError, ValueError) as exc:
            self.failure = exc
            if not self.stop.is_set():
                LOG.exception("simulación detenida en t=%.3fs (%s): %s", elapsed, type(exc).__name__, exc)
            self.stop.set()
        except Exception as exc:
            self.failure = exc
            LOG.exception("fallo inesperado en el hilo de vuelo CSV")
            self.stop.set()

    def close(self, timeout: float = 2.0) -> None:
        self.stop.set()
        with self.condition:
            self.wake_generation += 1
            self.condition.notify_all()
        if self.thread:
            self.thread.join(timeout=timeout)
            if self.thread.is_alive():
                raise RuntimeError("el hilo de vuelo CSV no finalizó")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", required=True, help="PTY/puerto serial conectado al daemon de la Pi")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--csv", type=Path, default=ROOT / "caracterizacionvertical_vuelo.csv")
    parser.add_argument("--countdown-seconds", type=float, default=1.0, help="duración de cada cuenta regresiva")
    return parser.parse_args()


def run(args: argparse.Namespace) -> int:
    STOP.clear()
    if args.baud <= 0:
        print("--baud debe ser mayor que cero", file=sys.stderr)
        return 2
    if not math.isfinite(args.countdown_seconds) or args.countdown_seconds < 0:
        print("--countdown-seconds debe ser finito y no negativo", file=sys.stderr)
        return 2
    try:
        samples = load_flight_csv(args.csv)
    except (OSError, ValueError) as exc:
        LOG.error("CSV inválido path=%s (%s): %s", args.csv, type(exc).__name__, exc)
        return 2
    apogee = max(samples, key=lambda sample: sample.altitude_m)

    try:
        port = serial.Serial(args.port, args.baud, timeout=0.1, write_timeout=2)
    except (serial.SerialException, OSError) as exc:
        LOG.error("no se pudo abrir UART port=%s baud=%d (%s): %s", args.port, args.baud, type(exc).__name__, exc)
        return 2

    write_lock = threading.Lock()
    telemetry_enabled = threading.Event()
    auto_enabled = threading.Event()
    rx_thread = threading.Thread(target=receive_status, args=(port, STOP), name="lilygo-rx", daemon=True)
    flight: FlightRun | None = None
    rx_thread.start()
    print(
        f"GCS/SITL conectado en {args.port} a {args.baud} baud; "
        f"CSV={args.csv} ({len(samples)} muestras, apogeo {apogee.altitude_m:.1f} m "
        f"a {apogee.time_s:.3f} s, touchdown {samples[-1].time_s:.3f} s)",
        flush=True,
    )

    def send_menu_command(message_type: int, label: str) -> None:
        send_packet(port, write_lock, encode_frame(message_type))
        print(f"[GCS -> Pi] {label} enviado", flush=True)

    try:
        while not STOP.is_set():
            print("[0] Enviar CMD_PREFLIGHT (0xA0)")
            print("\n[1] Enviar CMD_ARM")
            print("[2] SIMULAR LANZAMIENTO (ASCENT + CSV + reloj de vuelo)")
            print("[3] Enviar CMD_START_REC manual (apogeo)")
            print("[4] Enviar CMD_TOUCHDOWN")
            print("[T] Activar/Silenciar TX de telemetría (simular LOS)")
            print("[A] Habilitar/Deshabilitar piloto automático")
            print("[X] Enviar CMD_ABORT")
            print("[Q] Salir")
            try:
                choice = input("Opción: ").strip()
            except EOFError:
                break
            except KeyboardInterrupt:
                break
            choice = choice.upper()
            if choice == "Q":
                break
            if choice == "0":
                send_menu_command(CMD_PREFLIGHT, "CMD_PREFLIGHT (0xA0)")
            elif choice == "1":
                send_menu_command(CMD_ARM, "CMD_ARM")
            elif choice == "2":
                if flight is not None:
                    print("Esta instancia SITL ya ejecutó su vuelo; reiníciala para repetir")
                    continue
                send_menu_command(CMD_START_ASCENT, "CMD_START_ASCENT")
                for countdown in (3, 2, 1):
                    print(f"{countdown}..", flush=True)
                    if STOP.wait(args.countdown_seconds):
                        break
                if STOP.is_set():
                    break
                print("Despegue!", flush=True)
                flight = FlightRun(samples, port, write_lock, telemetry_enabled, auto_enabled)
                flight.launch()
            elif choice == "3":
                if not flight or not flight.active:
                    print("Primero inicia el vuelo con la opción 2")
                elif flight.trigger_start_rec("CMD_START_REC (manual)"):
                    print("START_REC manual enviado")
                else:
                    print("CMD_START_REC ya fue enviado")
            elif choice == "4":
                if not flight or not flight.started_at:
                    print("No hay vuelo activo")
                elif not flight.start_rec_sent:
                    print("START_REC aún no se ha disparado; TOUCHDOWN no procede")
                elif flight.trigger_touchdown("CMD_TOUCHDOWN (manual)"):
                    print("Touchdown manual enviado")
                else:
                    print("CMD_TOUCHDOWN ya fue enviado")
            elif choice == "T":
                if not flight or not flight.active:
                    print("LOS solo se puede alternar durante un vuelo activo")
                elif telemetry_enabled.is_set():
                    flight.set_telemetry_enabled(False)
                    print("[GCS] TX silenciado (LOS); reloj y piloto automático continúan", flush=True)
                else:
                    flight.set_telemetry_enabled(True)
                    print("[GCS] TX reactivado; se transmite la muestra del tiempo de vuelo actual", flush=True)
            elif choice == "A":
                if auto_enabled.is_set():
                    auto_enabled.clear()
                    print("Piloto automático deshabilitado")
                else:
                    auto_enabled.set()
                    print("Piloto automático habilitado: apogeo y touchdown automáticos")
            elif choice == "X":
                send_menu_command(CMD_ABORT, "CMD_ABORT")
                if flight:
                    flight.set_telemetry_enabled(False)
                    flight.close()
                    flight = None
            else:
                print("Opción no válida; usa 0, 1, 2, 3, 4, T, A o X")
                continue
    except (serial.SerialException, OSError, ValueError) as exc:
        print(f"Error de operación GCS: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nInterrupción recibida; cerrando emulador")
    finally:
        STOP.set()
        if flight:
            try:
                flight.set_telemetry_enabled(False)
                flight.close(timeout=5.0)
            except RuntimeError as exc:
                print(f"No se pudo cerrar el reloj de vuelo: {exc}", file=sys.stderr)
        rx_thread.join(timeout=1)
        if port.is_open:
            port.close()
    return 1 if flight and flight.failure else 0


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s pid=%(process)d %(message)s",
    )
    signal.signal(signal.SIGINT, request_stop)
    signal.signal(signal.SIGTERM, request_stop)
    try:
        return run(parse_args())
    except Exception:
        LOG.exception("fallo fatal en GCS/SITL")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
