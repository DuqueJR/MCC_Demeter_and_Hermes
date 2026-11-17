#!/usr/bin/env python3
"""Own the R8 web stimulus and the two synchronized official-AE reference captures."""
import json
import ipaddress
import os
import signal
import subprocess
import sys
import threading
import time
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent
RUNS = HERE / "runs"
PORT = int(os.environ.get("R8_PORT", "8766"))
DURATION_MS = 360000
START_WAIT_S = 180
SEQUENCE_WAIT_S = 145
BITRATE_BPS = 1500000
FPS = 10
AWB = {0: (2.151088, 1.598785), 1: (2.205468, 1.566610)}


def browser_url():
    try:
        addresses = subprocess.check_output(["hostname", "-I"], text=True).split()
        address = next(ip for ip in addresses if ipaddress.ip_address(ip).is_private)
    except Exception:
        address = "127.0.0.1"
    return f"http://{address}:{PORT}/"


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


class Controller:
    def __init__(self):
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        self.out = RUNS / stamp
        self.out.mkdir(parents=True, exist_ok=False)
        (HERE / "latest_run.txt").write_text(str(self.out) + "\n")
        self.ready = False
        self.started = False
        self.started_event = threading.Event()
        self.finished = threading.Event()
        self.sequence_id = None
        self.processes = {}
        self.lock = threading.Lock()
        self.events_path = self.out / "events.jsonl"
        self.write_info()

    def write_info(self):
        lines = ["R8 official-AE reference controlled by Pi web application",
             f"created_utc={utc_now()}", f"resolution=2304x1296 fps={FPS} capture_timeout_s={DURATION_MS // 1000} codec=h264",
             f"capture_timeout_s={DURATION_MS // 1000} h264_bitrate_bps={BITRATE_BPS}",
                 "exposure=auto-sport metering=centre ev=0", "awb=fixed to per-camera R7 display-white gains",
                 "capture=dual rpicam-vid sync server/client; video marker detection remains independent verification"]
        (self.out / "capture_info.txt").write_text("\n".join(lines) + "\n")

    def log_event(self, data):
        entry = {**data, "server_monotonic_ns": time.monotonic_ns(), "server_wall_utc": utc_now()}
        with self.events_path.open("a") as f:
            f.write(json.dumps(entry, separators=(",", ":")) + "\n")
        return entry

    def camera_command(self, camera):
        rpicam = os.environ.get("RPICAM_VID", "rpicam-vid")
        r, b = AWB[camera]
        return [rpicam, "--camera", str(camera), "--sync", "server" if camera == 0 else "client",
                "--width", "2304", "--height", "1296", "--framerate", str(FPS),
                "--timeout", str(DURATION_MS), "--codec", "h264", "--bitrate", str(BITRATE_BPS), "--flush",
                "--exposure", "sport", "--metering", "centre", "--ev", "0",
                "--autofocus-mode", "manual", "--lens-position", "0",
                "--awbgains", f"{r:.6f},{b:.6f}",
                "--metadata", str(self.out / f"cam{camera}_metadata.json"), "--metadata-format", "json",
                "--save-pts", str(self.out / f"cam{camera}.pts"),
                "--output", str(self.out / f"cam{camera}.h264")]

    def start_cameras(self, timeout=30):
        for camera in (0, 1):
            log = (self.out / f"cam{camera}.log").open("w")
            self.processes[camera] = subprocess.Popen(self.camera_command(camera), stdout=log, stderr=subprocess.STDOUT)
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            failed = [c for c, p in self.processes.items() if p.poll() is not None]
            if failed:
                self.stop_cameras()
                raise RuntimeError(f"Camera processes exited before ready: {failed}; inspect {self.out}/*.log")
            sizes = [(self.out / f"cam{c}.h264").stat().st_size if (self.out / f"cam{c}.h264").exists() else 0
                     for c in (0, 1)]
            if min(sizes) > 1024:
                self.ready = True
                self.log_event({"kind": "capture_ready", "file_bytes": sizes})
                return
            time.sleep(.1)
        self.stop_cameras()
        raise TimeoutError(f"Timed out waiting for both cameras; inspect {self.out}/*.log")

    def stop_cameras(self):
        for process in self.processes.values():
            if process.poll() is None:
                process.send_signal(signal.SIGINT)
        for process in self.processes.values():
            if process.poll() is None:
                try:
                    process.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    process.terminate()
        for c, process in self.processes.items():
            (self.out / f"cam{c}_exit.txt").write_text(f"returncode={process.wait()}\n")


class Handler(BaseHTTPRequestHandler):
    controller = None

    def send_json(self, status, data):
        payload = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/status":
            c = self.controller
            return self.send_json(200, {"ready": c.ready, "started": c.started, "finished": c.finished.is_set()})
        if path not in ("/", "/stimulus.html"):
            return self.send_json(404, {"error": "not found"})
        payload = (HERE / "stimulus.html").read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            data = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
        except Exception:
            return self.send_json(400, {"error": "invalid JSON"})
        c = self.controller
        if path == "/api/start":
            with c.lock:
                if not c.ready:
                    return self.send_json(409, {"error": "capture not ready"})
                if c.started:
                    return self.send_json(409, {"error": "sequence already started"})
                c.started = True
                c.sequence_id = str(uuid.uuid4())
                event = c.log_event({"kind": "sequence_start_request", "sequence_id": c.sequence_id,
                                     "browser_epoch_ms": data.get("browser_epoch_ms"),
                                     "browser_performance_ms": data.get("browser_performance_ms")})
                c.started_event.set()
            return self.send_json(200, {"sequence_id": c.sequence_id, "server_monotonic_ns": event["server_monotonic_ns"]})
        if path == "/api/event":
            if not c.started:
                return self.send_json(409, {"error": "sequence not started"})
            event = c.log_event({"kind": "stimulus_step", "sequence_id": c.sequence_id,
                                 "name": data.get("name"), "mode": data.get("mode"),
                                 "color": data.get("color"), "linear_luminance": data.get("linear_luminance"),
                                 "browser_elapsed_ms": data.get("browser_elapsed_ms"),
                                 "browser_epoch_ms": data.get("browser_epoch_ms")})
            if data.get("name") == "IDLE":
                c.finished.set()
            return self.send_json(200, {"server_monotonic_ns": event["server_monotonic_ns"]})
        return self.send_json(404, {"error": "not found"})

    def log_message(self, fmt, *args):
        sys.stdout.write("[http] " + fmt % args + "\n")


def main():
    controller = Controller()
    Handler.controller = controller
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    print(f"R8 controller: starting both cameras; run directory {controller.out}", flush=True)
    try:
        controller.start_cameras()
        print(f"CAPTURA LISTA. Abre {browser_url()} en el MateBook y pulsa INICIAR R8.", flush=True)
        print("Keep the MateBook at 70% brightness and do not touch it until black IDLE appears.", flush=True)
        if not controller.started_event.wait(timeout=START_WAIT_S):
            controller.log_event({"kind": "operator_start_timeout"})
        else:
            controller.finished.wait(timeout=SEQUENCE_WAIT_S)
        if controller.finished.is_set():
            time.sleep(.5)
            controller.log_event({"kind": "capture_stop_after_idle"})
        else:
            controller.log_event({"kind": "capture_timeout_or_missing_end"})
    except KeyboardInterrupt:
        controller.log_event({"kind": "operator_abort"})
    except Exception as error:
        controller.log_event({"kind": "controller_error", "error": str(error)})
        raise
    finally:
        controller.stop_cameras()
        (controller.out / "capture_info.txt").open("a").write(f"ended_utc={utc_now()}\n")
        server.shutdown()
        server.server_close()
    print(f"Capture complete: {controller.out}")
    print(f"Analyze with: {HERE / 'analyze_r8.py'} {controller.out}")


if __name__ == "__main__":
    main()
