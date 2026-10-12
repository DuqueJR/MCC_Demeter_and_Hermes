import json
from argparse import Namespace
import os
from pathlib import Path
import socket
import tempfile
import threading
import unittest
from unittest.mock import patch

from demeter_missiond import (
    MIN_MEM_AVAILABLE_KB,
    MissionDaemon,
    State,
    arm_system_checks,
    evaluate_performance_alerts,
    parse_args,
    preflight,
    read_performance_metrics,
)
from demeter_protocol import (
    CMD_PREFLIGHT,
    Frame,
    TELEMETRY_STRUCT,
    TELEMETRY_UPDATE,
    StreamDecoder,
    crc16_ccitt_false,
    encode_frame,
)
from demeter_telemetryd import COMMANDS, handle_frame, target_fps_for_altitude, write_target_fps


class ProtocolTests(unittest.TestCase):
    def test_preflight_command_uses_reserved_uart_code(self):
        self.assertEqual(CMD_PREFLIGHT, 0xA0)
        self.assertEqual(COMMANDS["PREFLIGHT"], CMD_PREFLIGHT)
        frame = encode_frame(CMD_PREFLIGHT)
        self.assertEqual(StreamDecoder().feed(frame), [Frame(CMD_PREFLIGHT, b"")])

    def test_crc_and_fragmented_stream(self):
        self.assertEqual(crc16_ccitt_false(b"123456789"), 0x29B1)
        packet = encode_frame(TELEMETRY_UPDATE, b"abc")
        decoder = StreamDecoder()
        self.assertEqual(decoder.feed(packet[:3]), [])
        self.assertEqual(decoder.feed(packet[3:]), [Frame(TELEMETRY_UPDATE, b"abc")])

    def test_crc_error_resynchronizes(self):
        packet = encode_frame(TELEMETRY_UPDATE, b"valid")
        corrupt = bytearray(packet)
        corrupt[-1] ^= 0x01
        decoder = StreamDecoder()
        self.assertEqual(decoder.feed(bytes(corrupt) + packet), [Frame(TELEMETRY_UPDATE, b"valid")])
        self.assertEqual(decoder.crc_errors, 1)


class TelemetryTests(unittest.TestCase):
    def test_jsonl_and_snapshot(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            payload = TELEMETRY_STRUCT.pack(1_700_000_000_123, 100.0, 1.0, -2.0, 359.0)
            handle_frame(
                TELEMETRY_UPDATE,
                payload,
                log_path=root / "telemetry.jsonl",
                snapshot_path=root / "current.json",
                target_fps_path=root / "target_fps.txt",
                event_socket=root / "missing.sock",
                allow_clock_set=False,
                preflight=False,
                synced=False,
            )
            row = json.loads((root / "telemetry.jsonl").read_text())
            self.assertEqual(row["alt"], 100.0)
            self.assertEqual(json.loads((root / "current.json").read_text()), row)
            self.assertEqual((root / "target_fps.txt").read_text(), "6\n")

    def test_adaptive_fps_thresholds_and_write_on_change(self):
        self.assertEqual(
            [target_fps_for_altitude(alt) for alt in (201, 200, 101, 100, 31, 30, 16, 15, 0)],
            [2, 4, 4, 6, 6, 8, 8, 8, 8],
        )
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "target_fps.txt"
            self.assertTrue(write_target_fps(path, 4))
            inode = path.stat().st_ino
            self.assertFalse(write_target_fps(path, 4))
            self.assertNotEqual(path.stat().st_ino, inode)


class MissionTests(unittest.TestCase):
    def test_default_stop_timeout_is_ten_minutes(self):
        with patch("sys.argv", ["demeter_missiond.py"]):
            args = parse_args()
            self.assertEqual(args.stop_timeout, 600.0)
            self.assertEqual(args.ascent_watchdog, 15.0)
            self.assertEqual(args.descent_watchdog, 95.0)
            self.assertEqual(args.chunk_time, 8.0)
            self.assertEqual(
                args.ingest_script,
                Path(__file__).resolve().parent / "eyes_of_demeter" / "demeter_ingestd.sh",
            )
        with patch("sys.argv", ["demeter_missiond.py", "--flight-script", "legacy.sh"]):
            self.assertEqual(parse_args().ingest_script, Path("legacy.sh"))

    def test_performance_snapshot_and_alerts_cover_ram_temperature_and_sd(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            meminfo = root / "meminfo"
            meminfo.write_text("MemTotal: 8000000 kB\nMemAvailable: 3000000 kB\n")
            thermal_root = root / "thermal"
            for zone, sensor_type, millidegrees in (
                ("thermal_zone0", "cpu-thermal", 74000),
                ("thermal_zone1", "gpu-thermal", 76000),
            ):
                zone_path = thermal_root / zone
                zone_path.mkdir(parents=True)
                (zone_path / "type").write_text(sensor_type)
                (zone_path / "temp").write_text(str(millidegrees))
            device = os.stat(root).st_dev
            diskstats = root / "diskstats"
            diskstats.write_text(
                f"{os.major(device)} {os.minor(device)} synthetic 1 0 20 0 2 0 40 0\n"
            )

            ramcam_total = 3 * 1024**3
            ramcam_used = 2_500 * 1024**2
            with patch(
                "demeter_missiond.shutil.disk_usage",
                return_value=Namespace(total=ramcam_total, used=ramcam_used, free=ramcam_total - ramcam_used),
            ):
                metrics = read_performance_metrics(meminfo, thermal_root, root, diskstats, root)

        self.assertEqual(metrics["temperature_c"], 76.0)
        self.assertEqual(metrics["ram_used_percent"], 62.5)
        self.assertEqual(metrics["ramcam_total_bytes"], ramcam_total)
        self.assertEqual(metrics["ramcam_used_bytes"], ramcam_used)
        self.assertEqual(metrics["ramcam_used_percent"], round(100 * ramcam_used / ramcam_total, 2))
        self.assertEqual(metrics["sd_device"], "synthetic")
        self.assertEqual(metrics["sd_read_bytes_total"], 20 * 512)
        self.assertEqual(metrics["sd_write_bytes_total"], 40 * 512)
        metrics["sd_read_mib_s"] = 8.0
        metrics["sd_write_mib_s"] = 4.0
        alerts = evaluate_performance_alerts(metrics, Namespace())
        self.assertEqual(
            {alert["code"] for alert in alerts},
            {"ramcam_usage_high", "temperature_high", "sd_read_throughput_low", "sd_write_throughput_low"},
        )
        self.assertFalse(any(alert["metric"] == "mem_available_kb" for alert in alerts))

    def test_ramcam_runtime_alert_uses_warning_and_critical_percentages(self):
        self.assertEqual(
            [
                [
                    alert["code"]
                    for alert in evaluate_performance_alerts(
                        {"temperature_c": 50.0, "ramcam_used_percent": used}, Namespace()
                    )
                ]
                for used in (79.9, 80.0, 89.9, 90.0)
            ],
            [[], ["ramcam_usage_high"], ["ramcam_usage_high"], ["ramcam_usage_critical"]],
        )

    def test_chunk_ipc_is_written_to_local_mission_log_with_performance_alerts(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            args = Namespace(
                event_log=root / "mission.jsonl",
                control_socket=root / "control.sock",
                event_socket=root / "event.sock",
                telemetry_socket=root / "telemetry.sock",
                state_file=root / "state.json",
                recordings_dir=root,
            )
            initial = {
                "temperature_c": 60.0,
                "temperature_sensors": [],
                "mem_total_kb": 8000000,
                "mem_available_kb": 4000000,
                "ramcam_total_bytes": 3 * 1024**3,
                "ramcam_used_bytes": 1024**3,
                "ramcam_used_percent": 33.33,
                "sd_device": "mmcblk0p2",
                "sd_read_bytes_total": 0,
                "sd_write_bytes_total": 0,
                "metric_errors": [],
            }
            after = {
                **initial,
                "sd_read_bytes_total": 2 * 1024 * 1024,
                "sd_write_bytes_total": 4 * 1024 * 1024,
            }
            mission = MissionDaemon(args)
            try:
                with patch(
                    "demeter_missiond.read_performance_metrics",
                    side_effect=[dict(initial), dict(after), dict(after)],
                ), patch(
                    "demeter_missiond.time.monotonic", side_effect=[100.0, 102.0, 103.0]
                ):
                    mission.record_performance_event("performance_sample", {"phase": "preflight"})
                    mission.state = State.RECORDING
                    mission.handle_event({
                        "kind": "chunk_ingested",
                        "source": "demeter_ingestd",
                        "chunk": "chunk_0001",
                        "metrics": {"sd_ingest_write_mib_s": 4.0},
                    })
                    mission.record_performance_event("performance_sample", {"phase": "idle_interval"})
                events = [json.loads(line) for line in args.event_log.read_text().splitlines()]
            finally:
                mission.event_file.close()
                mission.command_socket.close()
                mission.event_socket.close()

        chunk_event = next(event for event in events if event["kind"] == "chunk_ingested")
        self.assertTrue(chunk_event["local_only"])
        self.assertEqual(chunk_event["chunk"], "chunk_0001")
        self.assertEqual(chunk_event["metrics"]["sd_read_mib_s"], 1.0)
        self.assertEqual(chunk_event["metrics"]["sd_write_mib_s"], 2.0)
        self.assertEqual(
            {alert["code"] for alert in chunk_event["alerts"]},
            {"sd_read_throughput_low", "sd_write_throughput_low", "sd_ingest_write_throughput_low"},
        )
        idle_event = next(event for event in events if event.get("phase") == "idle_interval")
        self.assertIsNone(idle_event["metrics"]["sd_read_mib_s"])
        self.assertIsNone(idle_event["metrics"]["sd_write_mib_s"])
        self.assertFalse(any(alert["metric"].startswith("sd_") for alert in idle_event["alerts"]))

    def test_sd_throughput_alerts_are_suppressed_outside_active_io_states(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            args = Namespace(
                event_log=root / "mission.jsonl",
                control_socket=root / "control.sock",
                event_socket=root / "event.sock",
                telemetry_socket=root / "telemetry.sock",
                state_file=root / "state.json",
                recordings_dir=root,
            )
            metrics = {
                "temperature_c": 60.0,
                "ramcam_used_percent": 20.0,
                "sd_device": "mmcblk0",
                "sd_read_bytes_total": 0,
                "sd_write_bytes_total": 0,
                "metric_errors": [],
            }
            mission = MissionDaemon(args)
            try:
                mission.state = State.READY
                with patch(
                    "demeter_missiond.read_performance_metrics",
                    side_effect=[
                        dict(metrics),
                        {**metrics, "sd_read_bytes_total": 2 * 1024**2, "sd_write_bytes_total": 2 * 1024**2},
                        {**metrics, "sd_read_bytes_total": 4 * 1024**2, "sd_write_bytes_total": 4 * 1024**2},
                    ],
                ), patch(
                    "demeter_missiond.time.monotonic", side_effect=[100.0, 102.0, 104.0]
                ), self.assertNoLogs("demeter_missiond", level="WARNING"):
                    mission.record_performance_event("performance_sample", {"phase": "ready_idle"})
                    mission.record_performance_event("performance_sample", {"phase": "ready_idle"})

                mission.state = State.RECORDING
                with patch(
                    "demeter_missiond.read_performance_metrics",
                    return_value={
                        **metrics,
                        "sd_read_bytes_total": 6 * 1024**2,
                        "sd_write_bytes_total": 6 * 1024**2,
                    },
                ), patch("demeter_missiond.time.monotonic", return_value=106.0), self.assertLogs(
                    "demeter_missiond", level="WARNING"
                ) as captured:
                    mission.record_performance_event("performance_sample", {"phase": "recording"})
                self.assertIn("sd_read_throughput_low", "\n".join(captured.output))
                events = [json.loads(line) for line in args.event_log.read_text().splitlines()]
            finally:
                mission.event_file.close()
                mission.command_socket.close()
                mission.event_socket.close()

        ready_event = next(event for event in events if event.get("phase") == "ready_idle")
        recording_event = next(event for event in events if event.get("phase") == "recording")
        self.assertFalse(any(alert["code"].startswith("sd_") for alert in ready_event["alerts"]))
        self.assertEqual(
            {alert["code"] for alert in recording_event["alerts"]},
            {"sd_read_throughput_low", "sd_write_throughput_low"},
        )

    def test_arm_checks_do_not_reject_existing_ascent_video(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            script = root / "flight.sh"
            script.write_text("#!/bin/sh\nexit 0\n")
            script.chmod(0o755)
            postprocess = root / "demeter_postprocess.py"
            postprocess.write_text("#!/bin/sh\nexit 0\n")
            postprocess.chmod(0o755)
            recorder = root / "demeter_rec"
            recorder.write_text("#!/bin/sh\nexit 0\n")
            recorder.chmod(0o755)
            ascent_video = root / "normal_rec" / "ascent_video_old.mp4"
            ascent_video.parent.mkdir()
            ascent_video.write_bytes(b"existing video")
            args = Namespace(
                ingest_script=script,
                ram_dir=root / "ramcam",
                recordings_dir=root / "recordings",
                min_free_bytes=0,
                rpicam_vid="rpicam-vid",
                recorder_bin=recorder,
                ascent_video=ascent_video,
            )
            with patch("demeter_missiond.preflight", return_value=[]), patch(
                "demeter_missiond.shutil.which", return_value="/usr/bin/rpicam-vid"
            ), patch("demeter_missiond.shutil.disk_usage", return_value=Namespace(free=10**10)):
                self.assertEqual(arm_system_checks(args), [])

    def test_preflight_purges_tmpfs_and_requires_more_than_3_gib_memavailable(self):
        self.assertEqual(MIN_MEM_AVAILABLE_KB, 3_145_728)
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            script = root / "flight.sh"
            script.write_text("#!/bin/sh\nexit 0\n")
            script.chmod(0o755)
            meminfo = root / "meminfo"
            recordings = root / "recordings"
            meminfo.write_text(f"MemAvailable: {MIN_MEM_AVAILABLE_KB} kB\n")
            with patch("demeter_missiond.is_tmpfs_mount", return_value=True), patch(
                "demeter_missiond.TOUCHDOWN_FLAG", root / "touchdown.flag"
            ), patch("demeter_missiond.os.system", return_value=0) as purge:
                failures = preflight(script, root, recordings, 0, meminfo)
                self.assertTrue(any("RAM física insuficiente" in failure for failure in failures))
                purge.assert_called_once()
                self.assertIn("rm -rf", purge.call_args.args[0])
                meminfo.write_text(f"MemAvailable: {MIN_MEM_AVAILABLE_KB + 1} kB\n")
                failures = preflight(script, root, recordings, 0, meminfo)
                self.assertFalse(any("RAM física insuficiente" in failure for failure in failures))
                self.assertEqual(purge.call_count, 2)

    def test_ascent_watchdog_starts_recording(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            args = Namespace(
                event_log=root / "events.jsonl",
                control_socket=root / "control.sock",
                event_socket=root / "events.sock",
                telemetry_socket=root / "telemetry.sock",
                state_file=root / "state.json",
            )
            mission = MissionDaemon(args)
            try:
                mission.set_state(State.PREFLIGHT)
                mission.set_state(State.READY)
                mission.set_state(State.ARMED)
                mission.set_state(State.ASCENT)
                mission.ascent_deadline = 114.9
                mission.last_performance_sample = 115.0
                with patch("demeter_missiond.time.monotonic", return_value=115.0), patch.object(
                    mission, "start_recording"
                ) as start_recording, self.assertLogs("demeter_missiond", level="WARNING") as captured:
                    mission.poll_process()

                start_recording.assert_called_once_with()
                self.assertIn("Watchdog de ascenso disparado", "\n".join(captured.output))
                event = json.loads(args.event_log.read_text().splitlines()[-1])
                self.assertEqual(event["watchdog"], "ascent")
            finally:
                mission.event_file.close()
                mission.command_socket.close()
                mission.event_socket.close()

    def test_descent_watchdog_triggers_touchdown(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            args = Namespace(
                event_log=root / "events.jsonl",
                control_socket=root / "control.sock",
                event_socket=root / "events.sock",
                telemetry_socket=root / "telemetry.sock",
                state_file=root / "state.json",
            )
            mission = MissionDaemon(args)
            try:
                mission.set_state(State.PREFLIGHT)
                mission.set_state(State.READY)
                mission.set_state(State.ARMED)
                mission.set_state(State.ASCENT)
                mission.set_state(State.STARTING)
                mission.set_state(State.RECORDING)
                mission.recording_deadline = 194.9
                mission.last_performance_sample = 195.0
                with patch("demeter_missiond.time.monotonic", return_value=195.0), patch.object(
                    mission, "touchdown"
                ) as touchdown, self.assertLogs("demeter_missiond", level="WARNING") as captured:
                    mission.poll_process()

                touchdown.assert_called_once_with()
                self.assertIn("Watchdog de descenso disparado", "\n".join(captured.output))
                event = json.loads(args.event_log.read_text().splitlines()[-1])
                self.assertEqual(event["watchdog"], "descent")
            finally:
                mission.event_file.close()
                mission.command_socket.close()
                mission.event_socket.close()

    def test_fsm_persists_allowed_transitions(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            args = Namespace(
                event_log=root / "events.jsonl",
                control_socket=root / "control.sock",
                event_socket=root / "events.sock",
                telemetry_socket=root / "missing.sock",
                state_file=root / "state.json",
            )
            mission = MissionDaemon(args)
            try:
                mission.set_state(State.PREFLIGHT)
                mission.set_state(State.READY)
                mission.set_state(State.ARMED)
                mission.set_state(State.ASCENT)
                mission.set_state(State.STARTING)
                mission.set_state(State.RECORDING)
                self.assertEqual(json.loads(args.state_file.read_text())["state"], "RECORDING")
                with self.assertRaises(RuntimeError):
                    mission.set_state(State.COMPLETE)
            finally:
                mission.event_file.close()
                mission.command_socket.close()
                mission.event_socket.close()

    def test_arm_requires_ready_and_preflight_can_recover_error(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            args = Namespace(
                event_log=root / "events.jsonl",
                control_socket=root / "control.sock",
                event_socket=root / "events.sock",
                telemetry_socket=root / "missing.sock",
                state_file=root / "state.json",
            )
            mission = MissionDaemon(args)
            try:
                mission.handle_command("ARM", "test")
                self.assertEqual(mission.state, State.BOOT)

                with patch.object(mission, "record_performance_event"), patch(
                    "demeter_missiond.arm_system_checks", return_value=["músculo ausente"]
                ):
                    mission.handle_command("PREFLIGHT", "test")
                self.assertEqual(mission.state, State.ERROR)
                state = json.loads(args.state_file.read_text())
                self.assertIn("músculo ausente", state["error"])

                with patch.object(mission, "record_performance_event"), patch(
                    "demeter_missiond.arm_system_checks", return_value=[]
                ):
                    mission.handle_command("PREFLIGHT", "test")
                self.assertEqual(mission.state, State.READY)
                self.assertIsNone(mission.last_error)
            finally:
                mission.event_file.close()
                mission.command_socket.close()
                mission.event_socket.close()

    def test_telemetry_control_waits_for_correlated_ack(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            args = Namespace(
                event_log=root / "events.jsonl",
                control_socket=root / "control.sock",
                event_socket=root / "events.sock",
                telemetry_socket=root / "telemetry.sock",
                state_file=root / "state.json",
            )
            mission = MissionDaemon(args)
            peer = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
            mission.command_socket.bind(str(args.control_socket))
            mission.event_socket.bind(str(args.event_socket))
            peer.bind(str(args.telemetry_socket))

            def acknowledge():
                request, _ = peer.recvfrom(8192)
                request_id = json.loads(request)["request_id"]
                peer.sendto(json.dumps({
                    "kind": "telemetry_reset", "request_id": request_id, "ok": True,
                }).encode(), str(args.event_socket))

            worker = threading.Thread(target=acknowledge)
            worker.start()
            try:
                self.assertTrue(mission.send_telemetry_control(
                    {"reset_telemetry": True}, "telemetry_reset"
                ))
                worker.join(timeout=1)
                self.assertFalse(worker.is_alive())
            finally:
                mission.event_file.close()
                mission.command_socket.close()
                mission.event_socket.close()
                peer.close()


if __name__ == "__main__":
    unittest.main()
