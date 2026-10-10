#!/usr/bin/env python3
"""Capture one fixed-control COMP1+FE-stats frame per screen level on both cameras."""
import ipaddress
import json
import os
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
PORT = int(os.environ.get("R9_PORT", "8770"))
CAPTURE = Path(os.environ.get("DEMETER_CAPTURE", "/home/admin/.cache/demeter_build/bin/capture_pisp_stats"))
SHUTTER_US = 15000
GAIN = 1.1228
SETTLE_FRAMES = 3
WB = {0: (2.151088, 1.598785), 1: (2.205468, 1.566610)}
LEVELS = [0.01, 0.02, 0.05, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 0.95, 1.00]


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def browser_url():
    try:
        addresses = subprocess.check_output(["hostname", "-I"], text=True).split()
        address = next(ip for ip in addresses if ipaddress.ip_address(ip).is_private)
    except Exception:
        address = "127.0.0.1"
    return f"http://{address}:{PORT}/"


class Controller:
    def __init__(self):
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        self.out = RUNS / stamp
        self.out.mkdir(parents=True, exist_ok=False)
        (HERE / "latest_run.txt").write_text(str(self.out) + "\n")
        self.ready = True
        self.started = False
        self.finished = False
        self.sequence_id = None
        self.lock = threading.Lock()
        self.capture_lock = threading.Lock()
        self.events_path = self.out / "events.jsonl"
        self.capture_csv = self.out / "captures.csv"
        self.write_config()
        self.write_info()
        with self.capture_csv.open("w") as f:
            f.write("level_index,linear_luminance,srgb_code,camera,prefix,exposure_us,analogue_gain,digital_gain\n")

    def write_config(self):
        for c in (0, 1):
            config = {"exposure": {"mode": "manual", "shutter_us": SHUTTER_US, "gain": GAIN},
                      "white_balance": {"mode": "fixed", "gains": list(WB[c])},
                      "focus": {"mode": "infinity"}, "capture": {"settle_frames": SETTLE_FRAMES}}
            (self.out / f"profile_cam{c}.json").write_text(json.dumps(config, indent=2) + "\n")

    def write_info(self):
        lines = ["R9 relative linearity: fixed sensor exposure/gain, offline PiSP develop",
                 f"created_utc={utc_now()}", "resolution=4608x2592 per captured Bayer frame",
                 f"shutter_us={SHUTTER_US} analogue_gain={GAIN} settle_frames={SETTLE_FRAMES}",
                 "white_balance=fixed to per-camera R7 display-white gains", "focus=infinity 0 dpt",
                 "stimulus=full-screen linear luminance converted to sRGB by linearity.html"]
        (self.out / "capture_info.txt").write_text("\n".join(lines) + "\n")

    def log_event(self, data):
        entry = {**data, "server_monotonic_ns": time.monotonic_ns(), "server_wall_utc": utc_now()}
        with self.events_path.open("a") as f:
            f.write(json.dumps(entry, separators=(",", ":")) + "\n")
        return entry

    def capture_level(self, index, luminance, srgb_code, browser_epoch_ms, browser_perf_ms):
        if index < 0 or index >= len(LEVELS) or abs(LEVELS[index] - luminance) > 1e-9:
            raise ValueError("unexpected level index/value")
        with self.capture_lock:
            color_event = self.log_event({"kind": "gray_level_displayed", "sequence_id": self.sequence_id,
                                          "index": index, "linear_luminance": luminance, "srgb_code": srgb_code,
                                          "browser_epoch_ms": browser_epoch_ms,
                                          "browser_performance_ms": browser_perf_ms})
            prefix = self.out / f"L{index+1:02d}_{int(luminance*100):03d}pct"
            metadata = []
            for camera in (0, 1):
                cam_prefix = Path(f"{prefix}_cam{camera}")
                log = self.out / f"L{index+1:02d}_cam{camera}.log"
                command = [str(CAPTURE), "--camera", str(camera), "--out", str(cam_prefix),
                           "--config", str(self.out / f"profile_cam{camera}.json"),
                           "--settle-frames", str(SETTLE_FRAMES), "--exposure-us", str(SHUTTER_US), "--gain", str(GAIN)]
                with log.open("w") as stream:
                    subprocess.run(command, stdout=stream, stderr=subprocess.STDOUT, check=True, timeout=25)
                m = json.loads(Path(f"{cam_prefix}.json").read_text())
                metadata.append({"camera": camera, "prefix": cam_prefix.name,
                                 "exposure_us": m.get("exposure_time_us"), "analogue_gain": m.get("analogue_gain"),
                                 "digital_gain": m.get("digital_gain")})
                with self.capture_csv.open("a") as f:
                    f.write(f"{index},{luminance},{srgb_code},{camera},{cam_prefix.name},{m.get('exposure_time_us')},"
                            f"{m.get('analogue_gain')},{m.get('digital_gain')}\n")
            self.log_event({"kind": "level_capture_complete", "sequence_id": self.sequence_id, "index": index,
                            "display_event_monotonic_ns": color_event["server_monotonic_ns"], "captures": metadata})
            return metadata


class Handler(BaseHTTPRequestHandler):
    controller = None

    def respond(self, status, data):
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
            return self.respond(200, {"ready": c.ready, "started": c.started, "finished": c.finished})
        if path not in ("/", "/linearity.html"):
            return self.respond(404, {"error": "not found"})
        body = (HERE / "linearity.html").read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        try:
            data = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
        except Exception:
            return self.respond(400, {"error": "invalid JSON"})
        c = self.controller
        path = urlparse(self.path).path
        if path == "/api/start":
            with c.lock:
                if c.started or c.finished:
                    return self.respond(409, {"error": "sequence already started or finished"})
                c.started = True
                c.sequence_id = str(uuid.uuid4())
                c.log_event({"kind": "sequence_start", "sequence_id": c.sequence_id,
                             "browser_epoch_ms": data.get("browser_epoch_ms"),
                             "browser_performance_ms": data.get("browser_performance_ms")})
            return self.respond(200, {"sequence_id": c.sequence_id})
        if path == "/api/level":
            if not c.started or c.finished:
                return self.respond(409, {"error": "R9 is not accepting levels"})
            try:
                captured = c.capture_level(int(data["index"]), float(data["linear_luminance"]),
                                           int(data["srgb_code"]), data.get("browser_epoch_ms"),
                                           data.get("browser_performance_ms"))
            except Exception as error:
                c.log_event({"kind": "capture_error", "index": data.get("index"), "error": str(error)})
                return self.respond(500, {"error": str(error)})
            return self.respond(200, {"captures": captured})
        if path == "/api/finish":
            c.finished = True
            c.log_event({"kind": "sequence_finish", "browser_epoch_ms": data.get("browser_epoch_ms"),
                         "browser_performance_ms": data.get("browser_performance_ms")})
            return self.respond(200, {"ok": True})
        return self.respond(404, {"error": "not found"})

    def log_message(self, fmt, *args):
        sys.stdout.write("[http] " + fmt % args + "\n")


def main():
    controller = Controller()
    Handler.controller = controller
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(f"R9 listo: abre {browser_url()} en el MateBook; pantalla en 70%, no cambies brillo.", flush=True)
    print(f"Controles fijos: {SHUTTER_US} us, gain {GAIN}; las capturas se hacen una por una y por camara al entrar cada nivel.", flush=True)
    print("Pulsa INICIAR R9 una sola vez. Cada gris queda visible al menos 10 s y la pagina espera el ACK de ambas capturas.", flush=True)
    try:
        deadline = time.monotonic() + 240
        while not controller.finished and time.monotonic() < deadline:
            time.sleep(.2)
        if not controller.finished:
            controller.log_event({"kind": "operator_or_sequence_timeout"})
    except KeyboardInterrupt:
        controller.log_event({"kind": "operator_abort"})
    finally:
        server.shutdown()
        server.server_close()
    print(f"R9 stimuli captured in {controller.out}")
    print(f"Next: python3 {HERE / 'analyze_r9.py'} {controller.out}")


if __name__ == "__main__":
    main()
