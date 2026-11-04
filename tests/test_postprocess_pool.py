import json
import io
import socket
import tempfile
import unittest
from concurrent.futures import Future
from pathlib import Path
import sys
from unittest.mock import patch

from demeter_postprocess import (
    MAX_PENDING_FRAMES,
    emit_mission_event,
    develop_frame,
    process_camera,
    run_checked,
    save_images,
)


class CompletedFuture(Future):
    def __init__(self, executor, result=200, error=None):
        super().__init__()
        self.executor = executor
        self.released = False
        if error is None:
            self.set_result(result)
        else:
            self.set_exception(error)

    def result(self, timeout=None):
        if not self.released:
            self.executor.pending -= 1
            self.released = True
        return super().result(timeout)


class CountingExecutor:
    def __init__(self):
        self.pending = 0
        self.max_pending = 0
        self.submitted = 0
        self.functions = []
        self.arguments = []

    def submit(self, function, *args):
        self.pending += 1
        self.submitted += 1
        self.max_pending = max(self.max_pending, self.pending)
        self.functions.append(function)
        self.arguments.append(args)
        return CompletedFuture(self)


class FailFirstExecutor(CountingExecutor):
    def submit(self, function, *args):
        future = super().submit(function, *args)
        if self.submitted == 1:
            return CompletedFuture(self, error=ValueError("truncated frame"))
        return future


class PostprocessPoolTests(unittest.TestCase):
    def test_develop_frame_disables_sharpen_by_default(self):
        with tempfile.TemporaryDirectory() as temporary:
            temporary_path = Path(temporary)
            original_temp_directory = tempfile.TemporaryDirectory
            commands = []

            def fake_run_checked(command, label):
                commands.append((command, label))
                if label == "praw2rgb":
                    Path(command[-1]).write_bytes(b"bayer")
                else:
                    Path(f"{command[5]}.rgb888.raw").write_bytes(bytes(24))

            with (
                patch("demeter_postprocess.WIDTH", 4),
                patch("demeter_postprocess.HEIGHT", 2),
                patch("demeter_postprocess.TEMP_ROOT", temporary_path),
                patch(
                    "demeter_postprocess.tempfile.TemporaryDirectory",
                    side_effect=lambda prefix, dir: original_temp_directory(
                        prefix=prefix, dir=temporary_path
                    ),
                ),
                patch("demeter_postprocess.run_checked", side_effect=fake_run_checked),
            ):
                develop_frame(
                    {
                        "width": 4,
                        "height": 2,
                        "raw_offset": 0,
                        "raw_bytes": 4,
                        "stats_offset": 0,
                        "stats_bytes": 4,
                        "pair_index": 0,
                        "camera_index": 0,
                    },
                    io.BytesIO(b"raw!"),
                    io.BytesIO(b"stat"),
                    4,
                    4,
                    0,
                    [],
                    1.0,
                )

        replay_command, replay_label = commands[1]
        self.assertEqual(replay_label, "controller_replay")
        self.assertIn("--disable-sharpen", replay_command)

    def test_chunk_event_uses_local_unix_socket(self):
        with tempfile.TemporaryDirectory() as temporary:
            socket_path = Path(temporary) / "mission.sock"
            receiver = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
            receiver.bind(str(socket_path))
            receiver.settimeout(1.0)
            try:
                with patch("demeter_postprocess.MISSION_EVENT_SOCKET", socket_path):
                    emit_mission_event({
                        "kind": "chunk_postprocess_complete",
                        "chunk": "chunk_0001",
                        "metrics": {"sd_logical_read_mib_s": 12.5},
                    })
                message, _ = receiver.recvfrom(8192)
            finally:
                receiver.close()

        self.assertEqual(json.loads(message)["kind"], "chunk_postprocess_complete")
        self.assertEqual(json.loads(message)["metrics"]["sd_logical_read_mib_s"], 12.5)

    def test_subprocess_error_keeps_command_status_and_stderr(self):
        command = [
            sys.executable,
            "-c",
            "import sys; print('stdout detail'); print('stderr detail', file=sys.stderr); sys.exit(7)",
        ]

        with self.assertRaisesRegex(RuntimeError, "código 7") as raised:
            run_checked(command, "synthetic-step")

        self.assertIn("stderr detail", str(raised.exception))
        self.assertIn(repr(command), str(raised.exception))

    def test_frame_jobs_are_submitted_with_a_bounded_pending_queue(self):
        with tempfile.TemporaryDirectory() as temporary:
            chunk_dir = Path(temporary) / "chunk_0000"
            chunk_dir.mkdir()
            (chunk_dir / "cam0_metadata.jsonl").write_text(
                '{"frame":\n'
                + "".join(
                    json.dumps({"pair_index": index, "raw_bytes": 100, "stats_bytes": 20}) + "\n"
                    for index in range(17)
                ),
                encoding="utf-8",
            )
            (chunk_dir / "cam0_frames.raw").touch()
            (chunk_dir / "cam0_stats.bin").touch()
            executor = CountingExecutor()

            with patch("demeter_postprocess.develop_frame", return_value=(b"rgb", {})):
                successes, failures, io_totals = process_camera(
                    chunk_dir,
                    Path(temporary) / "jpeg",
                    Path(temporary) / "png",
                    0,
                    [],
                    2.0,
                    executor,
                )

        self.assertEqual((successes, failures), (17, 1))
        self.assertEqual(executor.submitted, 17)
        self.assertEqual(executor.max_pending, MAX_PENDING_FRAMES)
        self.assertEqual(executor.pending, 0)
        self.assertTrue(all(function is save_images for function in executor.functions))
        self.assertEqual(io_totals["sd_logical_read_bytes"], 2040)
        self.assertEqual(io_totals["sd_logical_write_bytes"], 3400)

    def test_truncated_frame_is_counted_without_stopping_the_pool(self):
        with tempfile.TemporaryDirectory() as temporary:
            chunk_dir = Path(temporary) / "chunk_0000"
            chunk_dir.mkdir()
            (chunk_dir / "cam0_metadata.jsonl").write_text(
                '{"pair_index":0,"raw_bytes":100,"stats_bytes":20}\n'
                '{"pair_index":1,"raw_bytes":100,"stats_bytes":20}\n',
                encoding="utf-8",
            )
            (chunk_dir / "cam0_frames.raw").touch()
            (chunk_dir / "cam0_stats.bin").touch()

            executor = FailFirstExecutor()
            with patch("demeter_postprocess.develop_frame", return_value=(b"rgb", {})):
                successes, failures, io_totals = process_camera(
                    chunk_dir,
                    Path(temporary) / "jpeg",
                    Path(temporary) / "png",
                    0,
                    [],
                    2.0,
                    executor,
                )

        self.assertEqual((successes, failures), (1, 1))
        self.assertEqual(io_totals["fatal_errors"], 0)
        self.assertEqual(io_totals["sd_logical_read_bytes"], 120)
        self.assertEqual(io_totals["sd_logical_write_bytes"], 200)


if __name__ == "__main__":
    unittest.main()