import json
from pathlib import Path
import queue
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import unittest

from demeter_protocol import CMD_START_REC, CMD_TOUCHDOWN, POSE_UPDATE, StreamDecoder
from lilygo_emulator import FlightRun, FlightSample

ROOT = Path(__file__).resolve().parent
MISSIOND_TEST_BOOTSTRAP = "\n".join((
    "import os, pathlib, sys",
    "from types import SimpleNamespace",
    "from unittest.mock import patch",
    "import demeter_missiond",
    "from demeter_missiond import main",
    "read_text = pathlib.Path.read_text",
    "def simulated_meminfo(path, *args, **kwargs):",
    "    if path == pathlib.Path('/proc/meminfo'):",
    "        return 'MemAvailable: 3500000 kB\\n'",
    "    return read_text(path, *args, **kwargs)",
    "with (patch.object(pathlib.Path, 'read_text', simulated_meminfo),",
    "      patch('os.system', return_value=0),",
    "      patch.object(demeter_missiond, 'probe_sd_write_mib_s', return_value=43.228),",
    "      patch.object(demeter_missiond.shutil, 'disk_usage', return_value=SimpleNamespace(total=3 * 1024**3, used=0, free=128 * 1024**3))):",
    "    sys.argv = ['demeter_missiond.py', *sys.argv[1:]]",
    "    raise SystemExit(main())",
))


def has_ram_tmpfs() -> bool:
    try:
        for line in Path("/proc/mounts").read_text(encoding="utf-8").splitlines():
            fields = line.split()
            if len(fields) >= 3 and fields[1].replace("\\040", " ") == "/mnt/ramcam":
                return fields[2] == "tmpfs"
    except OSError:
        pass
    return False


class MemorySerial:
    def __init__(self) -> None:
        self.writes: list[bytes] = []

    def write(self, data: bytes) -> int:
        self.writes.append(data)
        return len(data)

    def flush(self) -> None:
        return None


class CsvFlightTests(unittest.TestCase):
    def test_transmits_rows_at_four_millisecond_spacing(self):
        port = MemorySerial()
        telemetry_enabled = threading.Event()
        auto_enabled = threading.Event()
        samples = [FlightSample(index * 0.004, float(index)) for index in range(31)]
        flight = FlightRun(samples, port, threading.Lock(), telemetry_enabled, auto_enabled)
        flight.launch()
        flight.thread.join(timeout=2)
        self.assertFalse(flight.thread.is_alive())
        frames = [StreamDecoder().feed(packet)[0] for packet in port.writes]
        self.assertEqual(sum(frame.message_type == POSE_UPDATE for frame in frames), len(samples))

    def test_los_does_not_pause_clock_or_autopilot(self):
        port = MemorySerial()
        telemetry_enabled = threading.Event()
        telemetry_enabled.set()
        auto_enabled = threading.Event()
        auto_enabled.set()
        samples = [
            FlightSample(0.00, 0.0),
            FlightSample(0.05, 5.0),
            FlightSample(0.10, 10.0),
            FlightSample(0.15, 5.0),
            FlightSample(0.20, 0.0),
            FlightSample(0.30, 0.0),
            FlightSample(0.40, 0.0),
        ]
        flight = FlightRun(samples, port, threading.Lock(), telemetry_enabled, auto_enabled)
        flight.launch()
        try:
            threading.Event().wait(0.07)
            telemetry_enabled.clear()
            clock_before = time.monotonic() - flight.started_at
            threading.Event().wait(0.18)
            clock_after = time.monotonic() - flight.started_at
            self.assertGreater(clock_after - clock_before, 0.15)
            self.assertTrue(flight.start_rec_sent, "apogeo debe dispararse durante LOS")
            self.assertTrue(flight.touchdown_sent, "touchdown debe dispararse durante LOS")
            telemetry_enabled.set()
            flight.thread.join(timeout=1)
            self.assertFalse(flight.thread.is_alive())
            frames = [StreamDecoder().feed(packet)[0] for packet in port.writes]
            commands = [frame.message_type for frame in frames if frame.message_type != POSE_UPDATE]
            self.assertEqual(commands, [CMD_START_REC, CMD_TOUCHDOWN])
            self.assertTrue(any(frame.message_type == POSE_UPDATE for frame in frames))
        finally:
            flight.close()


@unittest.skipUnless(shutil.which("socat") and has_ram_tmpfs(), "requiere socat y /mnt/ramcam montado como tmpfs")
class SocatSITLTests(unittest.TestCase):
    def test_arm_ascent_raw_touchdown_and_status_roundtrip(self):
        with tempfile.TemporaryDirectory(prefix="demeter_sitl_") as temporary:
            root = Path(temporary)
            pi_link = root / "ttyPI"
            lilygo_link = root / "ttyLILYGO"
            telemetry_log = root / "telemetry.jsonl"
            snapshot = root / "current_telemetry.json"
            target_fps = root / "target_fps.txt"
            command_socket_path = root / "telemetry.sock"
            event_socket_path = root / "mission.sock"
            state_file = root / "state.json"
            mission_diagnostic_log = root / "missiond.log"
            telemetry_diagnostic_log = root / "telemetryd.log"
            ascent_video = root / "ascent.h264"
            video_started = root / "video-started"
            video_stopped = root / "video-stopped"
            flight_started = root / "raw-started"
            finish_raw = root / "finish-raw"

            csv_path = root / "flight.csv"
            csv_path.write_text(
                "# Tiempo (s),Altitud (m),Velocidad vertical (m/s),Aceleración vertical (m/s²)\n"
                "0,0,0,0\n0.1,100,10,0\n0.2,600,20,0\n0.3,300,-10,0\n0.4,0,-20,0\n",
                encoding="utf-8",
            )
            ingest_script = root / "ingest.sh"
            ingest_script.write_text(
                f"#!/bin/sh\ntouch '{flight_started}'\n"
                f"while [ ! -e '{finish_raw}' ]; do sleep 0.02; done\n"
                "python3 -c 'import json,os,socket; s=socket.socket(socket.AF_UNIX,socket.SOCK_DGRAM); "
                "s.sendto(json.dumps({\"kind\":\"process_complete\",\"process\":\"demeter_postprocess\","
                "\"exit_code\":0,\"frames_ok\":1,\"frame_errors\":0}).encode(),os.environ[\"DEMETER_EVENT_SOCKET\"]); s.close()'\n"
                "exit 0\n",
                encoding="utf-8",
            )
            ingest_script.chmod(0o755)
            postprocess_script = root / "demeter_postprocess.py"
            postprocess_script.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
            postprocess_script.chmod(0o755)
            recorder = root / "demeter_rec"
            recorder.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
            recorder.chmod(0o755)
            rpicam = root / "rpicam-vid"
            rpicam.write_text(
                "#!" + sys.executable + "\n"
                "from pathlib import Path\n"
                "import signal, sys, time\n"
                "output = Path(sys.argv[sys.argv.index('-o') + 1])\n"
                "output.write_bytes(b'fake-mp4')\n"
                f"Path({str(video_started)!r}).touch()\n"
                f"stopped = Path({str(video_stopped)!r})\n"
                "def finish(_sig, _frame):\n"
                "    stopped.touch()\n"
                "    raise SystemExit(0)\n"
                "signal.signal(signal.SIGINT, finish)\n"
                "while True: time.sleep(0.02)\n",
                encoding="utf-8",
            )
            rpicam.chmod(0o755)

            socat = subprocess.Popen(
                [
                    "socat", "-d", "-d",
                    f"pty,raw,echo=0,link={pi_link}",
                    f"pty,raw,echo=0,link={lilygo_link}",
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            mission = None
            daemon = None
            emulator = None
            try:
                deadline = time.monotonic() + 3
                while time.monotonic() < deadline and not (pi_link.exists() and lilygo_link.exists()):
                    if socat.poll() is not None:
                        self.fail("socat terminó antes de crear los enlaces PTY")
                    time.sleep(0.01)
                self.assertTrue(pi_link.exists() and lilygo_link.exists(), "socat no creó ambos PTY")

                mission = subprocess.Popen(
                    [
                        sys.executable, "-c", MISSIOND_TEST_BOOTSTRAP,
                        "--ingest-script", str(ingest_script),
                        "--rpicam-vid", str(rpicam),
                        "--recorder-bin", str(recorder),
                        "--ascent-video", str(ascent_video),
                        "--ram-dir", "/mnt/ramcam",
                        "--recordings-dir", str(root / "recordings"),
                        "--min-free-bytes", "0",
                        "--state-file", str(state_file),
                        "--event-log", str(root / "mission.jsonl"),
                        "--diagnostic-log", str(mission_diagnostic_log),
                        "--event-socket", str(event_socket_path),
                        "--control-socket", str(root / "control.sock"),
                        "--telemetry-socket", str(command_socket_path),
                    ],
                    cwd=ROOT,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                wait_for_state(self, state_file, "BOOT")

                daemon = subprocess.Popen(
                    [
                        sys.executable, str(ROOT / "demeter_telemetryd.py"),
                        "--port", str(pi_link),
                        "--log", str(telemetry_log),
                        "--snapshot", str(snapshot),
                        "--target-fps", str(target_fps),
                        "--diagnostic-log", str(telemetry_diagnostic_log),
                        "--event-socket", str(event_socket_path),
                        "--command-socket", str(command_socket_path),
                    ],
                    cwd=ROOT,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                wait_for_file(self, command_socket_path, daemon, "telemetryd no creó socket IPC")

                output_lines: queue.Queue[str | None] = queue.Queue()
                emulator = subprocess.Popen(
                    [
                        sys.executable, str(ROOT / "lilygo_emulator.py"),
                        "--port", str(lilygo_link), "--csv", str(csv_path),
                        "--countdown-seconds", "0.01",
                    ],
                    cwd=ROOT,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                )
                reader = threading.Thread(
                    target=collect_output,
                    args=(emulator, output_lines),
                    name="sitl-output",
                    daemon=True,
                )
                reader.start()

                wait_output(self, output_lines, "GCS/SITL conectado")
                send_menu(emulator, "0")
                wait_for_state(self, state_file, "READY")
                wait_output(self, output_lines, "CMD_PREFLIGHT (0xA0) enviado")
                wait_output(self, output_lines, "Estado 0x02: READY")
                send_menu(emulator, "1")
                wait_for_state(self, state_file, "ARMED")
                wait_output(self, output_lines, "Estado 0x03: ARMED")

                send_menu(emulator, "2")
                wait_for_state(self, state_file, "ASCENT")
                wait_for_file(self, video_started, mission, "rpicam falso no se inició")
                ascent_outputs = list(ascent_video.parent.glob("ascent_video_*.mp4"))
                self.assertEqual(len(ascent_outputs), 1)
                self.assertRegex(ascent_outputs[0].name, r"^ascent_video_\d{8}_\d{6}\.mp4$")
                self.assertTrue(state_file.with_name("rpicam-vid.pid").exists(), "no se persistió PID ascent")
                wait_output(self, output_lines, "Estado 0x08: ASCENT")

                send_menu(emulator, "3")
                wait_for_file(self, flight_started, mission, "demeter_ingestd no se lanzó")
                wait_for_state(self, state_file, "RECORDING")
                self.assertTrue(video_stopped.exists(), "rpicam-vid no cerró con SIGINT")
                self.assertFalse(state_file.with_name("rpicam-vid.pid").exists(), "PID ascent quedó obsoleto")
                wait_output(self, output_lines, "Estado 0x30: RECORDING")

                send_menu(emulator, "4")
                wait_for_state(self, state_file, "INGESTING")
                finish_raw.touch()
                wait_for_state(self, state_file, "COMPLETE")
                self.assertFalse(Path("/tmp/touchdown_event.flag").exists())

                rows = [json.loads(line) for line in telemetry_log.read_text().splitlines()]
                self.assertGreaterEqual(len(rows), 2)
                self.assertTrue(any(row["alt_agl"] > 400 for row in rows))
                self.assertEqual(target_fps.read_text().strip(), "2")
                self.assertIn("missiond", mission_diagnostic_log.read_text())
                self.assertIn("UART abierto", telemetry_diagnostic_log.read_text())
                mission_events = [json.loads(line) for line in (root / "mission.jsonl").read_text().splitlines()]
                performance = next(
                    event for event in mission_events
                    if event["kind"] == "performance_sample" and event.get("phase") == "preflight"
                )
                self.assertTrue(performance["local_only"])
                self.assertIn("mem_available_kb", performance["metrics"])
                self.assertIn("temperature_c", performance["metrics"])
                self.assertIn("sd_read_mib_s", performance["metrics"])
                self.assertTrue(any(
                    event["kind"] == "process_complete" and event.get("process") == "rpicam-vid"
                    for event in mission_events
                ))
                self.assertTrue(any(
                    event["kind"] == "process_complete" and event.get("process") == "demeter_ingestd.sh"
                    for event in mission_events
                ))

                send_menu(emulator, "Q")
                emulator.wait(timeout=3)
            finally:
                stop_process(emulator)
                stop_process(mission)
                stop_process(daemon)
                stop_process(socat)


def send_menu(process: subprocess.Popen[str], value: str) -> None:
    assert process.stdin is not None
    process.stdin.write(value + "\n")
    process.stdin.flush()


def wait_for_state(test: unittest.TestCase, path: Path, expected: str, timeout: float = 3.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if path.exists() and json.loads(path.read_text()).get("state") == expected:
            return
        time.sleep(0.01)
    test.fail(f"missiond no llegó a {expected}; estado actual: {path.read_text() if path.exists() else 'sin estado'}")


def wait_for_file(
    test: unittest.TestCase,
    path: Path,
    process: subprocess.Popen[bytes] | subprocess.Popen[str],
    message: str,
    timeout: float = 3.0,
) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline and not path.exists():
        if process.poll() is not None:
            test.fail(f"{message}; proceso terminó con {process.returncode}")
        time.sleep(0.01)
    test.assertTrue(path.exists(), message)


def collect_output(process: subprocess.Popen[str], lines: queue.Queue[str | None]) -> None:
    assert process.stdout is not None
    for line in process.stdout:
        lines.put(line)
    lines.put(None)


def wait_output(
    test: unittest.TestCase,
    lines: queue.Queue[str | None],
    marker: str,
    timeout: float = 3.0,
) -> None:
    deadline = time.monotonic() + timeout
    collected = []
    while time.monotonic() < deadline:
        try:
            line = lines.get(timeout=max(0.01, deadline - time.monotonic()))
        except queue.Empty:
            break
        if line is None:
            break
        collected.append(line)
        if marker in line:
            return
    test.fail(f"emulador no imprimió {marker!r}; salida: {''.join(collected)}")


def stop_process(process: subprocess.Popen | None) -> None:
    if process is None:
        return
    if process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=2)
    for stream in (process.stdin, process.stdout):
        if stream is not None:
            stream.close()


if __name__ == "__main__":
    unittest.main()
