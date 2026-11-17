# Demeter UART and Telemetry Contract

This document defines the current Raspberry Pi/LilyGO binary contract. Firmware must use these exact sizes, byte orders, CRC parameters, and units. There is no sequence number or authentication field in protocol version 1.

## Frame

Every frame is:

| Field | Size | Value |
|---|---:|---|
| Sync | 2 bytes | `AA 55` |
| Type | 1 byte | Message type below |
| Length | 1 byte | Payload bytes, 0..255 |
| Payload | Length bytes | Message-specific |
| CRC | 2 bytes | CRC-16/CCITT-FALSE, big-endian |

CRC covers `Type || Length || Payload`, excluding sync. Parameters: polynomial `0x1021`, initial value `0xFFFF`, no reflection, xorout `0x0000`. Check vector: ASCII `123456789` gives `0x29B1`, transmitted as `29 B1`.

The receiver accepts fragmented serial reads, discards invalid frames, and scans forward for the next sync marker. Use 115200 baud by default; the device path defaults to `/dev/serial0`.

## LilyGO To Pi

| Type | Payload | Meaning |
|---|---|---|
| `0x10` | `<Q`: uint64 little-endian Unix UTC milliseconds | Preflight clock sync. Accepted only when telemetryd runs with both `--preflight` and `--allow-clock-set`, during the first 120 seconds by default; requires OS permission to set realtime clock and is applied once per daemon process. |
| `0x21` | `POSE`, 54 B, see below | Pose of the LilyGo EKF at 50 Hz. Replaces `0x20` (Euler angles), which is undefined with the rocket vertical (pitch ±90°). |

### POSE (`0x21`), 54 bytes, `<QHHiiiihhh4h3hHHH`

| Field | Type | Unit / meaning |
|---|---|---|
| `utc_us` | uint64 | Mission UTC (LilyGo GNSS+PPS) of the first byte of this frame. The state is propagated to this instant. |
| `seq` | uint16 | Increments by one per frame (detects loss). |
| `flags` | uint16 | bit0 EKF valid, bit1 attitude, bit2 horizontal position, bit3 altitude, bits4-5 time source (0 none, 1 GNSS+PPS, 2 ground beacon, 3 holdover), bit6 mission time valid (< 1 ms), bit7 GNSS 3D fix, bit8 LilyGo in FLY. |
| `lat_e7`, `lon_e7` | int32 | Degrees × 1e7 (WGS84). |
| `alt_agl_cm` | int32 | Height above the launch point from the barometers (p0 at arming), cm. |
| `ground_msl_cm` | int32 | MSL height of the launch point, cm. MSL height = `alt_agl + ground_msl`. |
| `vn`, `ve`, `vd` | int16 | NED velocity, cm/s. |
| `q[4]` | int16 | Body FRD to NED, Hamilton, scalar first, × 32767. Body: X to the nose, Y right (from tail to nose with the mark up), Z away from the mark. |
| `gyro[3]` | int16 | Body angular rate, 0.1 °/s. |
| `sd_att` | uint16 | Attitude 1-sigma, 0.01°. |
| `sd_pos`, `sd_alt` | uint16 | Horizontal position and altitude 1-sigma, cm. |

**Clock:** telemetryd computes `utc_us + frame_time − Pi receive time` for every POSE, keeps the fastest frame of each 0.25 s, and hands it to chronyd (refclock SOCK `/run/chrony.demeter.sock`, refid `LILY`), which disciplines the Pi clock. Recorder timestamps (`frame_wallclock_ns`) are therefore mission UTC. Postprocessing also measures the residual from `telemetry.jsonl` and corrects each frame with it.
| `0x30` | `<B`: one-byte status code | LilyGO status report. |
| `0xA1` | Empty | `ARM` request |
| `0xA2` | Empty | `START_ASCENT`: begin H.264 ascent capture |
| `0xB1` | Empty | `START_REC` request |
| `0xC1` | Empty | `TOUCHDOWN` event |
| `0xF1` | Empty | `ABORT` request |

`<` means little-endian standard-size fields; float values are IEEE-754 binary32. The eight-byte timestamp is UTC Unix milliseconds, not GPS week/time-of-week. If LilyGO firmware currently uses GPS week/time-of-week, it must convert to UTC Unix milliseconds before transmission.

Commands are idempotent only while their requested state/action is already active; out-of-order commands are rejected and recorded. There is no positive command acknowledgement in v1; Pi state is reported using type `0x30` in the reverse direction.

## Pi To LilyGO

The Pi sends type `0x30` with a one-byte code:

| Code | State |
|---|---|
| `0x00` | Boot |
| `0x01` | Preflight |
| `0x02` | Ready |
| `0x03` | Armed |
| `0x04` | Starting |
| `0x05` | Ingesting |
| `0x06` | Processing |
| `0x07` | Complete |
| `0x08` | Ascent video recording |
| `0x30` | Recording |
| `0xE0` | Aborted |
| `0xE1` | SD full (reserved) |
| `0xE2` | Frame-rate fallback (reserved) |
| `0xE3` | Telemetry lost (reserved) |
| `0xE4` | Abort requested (reserved) |
| `0xE5` | Clock unsynchronized (reserved) |
| `0xEF` | Pipeline error |

Reserved error codes are defined for firmware/UI compatibility; this implementation does not yet detect every condition in that table.

## Mission Capture Phases

`ARM` performs local checks for `rpicam-vid`, the executable `demeter_rec`, writable SD destinations and free space, the `/mnt/ramcam` tmpfs, and a live serial connection confirmed by telemetryd. It also requires at least `3,145,728 kB` (`3 GiB`) of `/proc/meminfo` `MemAvailable`; otherwise ARM is rejected and the FSM moves to `ERROR`. `demeter_ingestd.sh` repeats this check before starting the recorder. After `ARMED`, `START_ASCENT` starts `rpicam-vid` at 1920x1080 H.264/60 FPS and stores its PID. `START_REC` stops and reaps that process before starting the RAW mission script. The RAW target FPS follows the latest valid `0x20` altitude sample:

| Altitude | Target FPS |
|---:|---:|
| `> 400 m` | 2 |
| `> 200 m` through `400 m` | 4 |
| `> 100 m` through `200 m` | 6 |
| `> 50 m` through `100 m` | 8 |
| `<= 50 m` | 10 |

The value is atomically written to `/mnt/ramcam/target_fps.txt`; repeated samples in the same band do not rewrite it.

## Files and Time Correlation

`demeter_telemetryd.py` appends newline-delimited objects with `pi_ts`, `lilygo_ts`, `alt`, `roll`, `pitch`, and `yaw`. The Pi timestamps are Unix seconds as floating-point values. It also atomically updates `/mnt/ramcam/current_telemetry.json`, the snapshot consumed by the recorder.

Because type `0x10` has no GPS-fix or source-age field, firmware must send it only after a valid, fresh GPS fix. The Pi additionally restricts clock changes to the explicit preflight mode and startup window; missiond closes that mode and waits for telemetryd confirmation before it accepts `ARM`. CRC validity alone is not treated as proof of freshness. Run both daemons as the same unprivileged account with serial-device access. Clock setting additionally requires narrowly scoped `CAP_SYS_TIME` for telemetryd.

At each saved frame, the recorder stores `sensor_timestamp_ns` and `frame_wallclock_ns`. The latter maps the camera's monotonic timestamp to UTC using a contemporaneous system-clock/steady-clock pair. The flight supervisor preserves telemetry files while cleaning RAM and copies `telemetry.jsonl` to the mission directory before postprocessing.

Postprocessing (`demeter_pose.frame_record`) takes the frame time at the centre of the exposure (`frame_wallclock_ns + exposure/2`), corrects it with the clock residual, and interpolates position and velocity linearly and attitude with slerp. It writes, per frame, the camera (`eyes_of_demeter/calibration/camaras.json`: camera-to-body rotation and nominal intrinsics), the mission time, the pose with its uncertainty and validity, and the camera orientation in NED (`q_camara_a_ned`, optical axis, angle from nadir, heading). Default maximum sample bracket is 2 seconds (`--max-telemetry-gap-s` changes it). Frames outside a bracket, or across a wider gap, are explicitly marked invalid in their adjacent JPEG `.json` sidecar; no extrapolation is performed. Frame development uses four worker processes with at most eight pending jobs. Per-frame intermediates are placed on the `/mnt/ramcam` tmpfs and removed after each frame; the final JPEG/PNG products remain on SD. Postprocessing fails if the tmpfs is not writable.

The local `mission.jsonl` also records `performance_sample`, `chunk_ingested`, `chunk_postprocess_complete`, and `process_complete` events; these are sent over the local mission socket and are not transmitted over UART. Samples include the maximum readable thermal-zone temperature, `MemAvailable` for context, `/mnt/ramcam` tmpfs capacity and occupancy, SD device, diskstats read/write rates, and active alerts. System samples are taken every 5 seconds by default (`--performance-sample-interval-s`) and at chunk/process completion. The flight preflight independently requires at least 3 GiB of `MemAvailable`; runtime RAM alerts instead track tmpfs occupancy, warning at 80% and critical at 90% of `/mnt/ramcam`. SD transfer target is 80 MiB/s, with warnings below 60 MiB/s for active diskstats reads/writes and synchronized tmpfs-to-SD ingestion. Temperature defaults remain 75 C (warning) and 80 C (critical). Minimum SD thresholds are configurable with missiond's `--sd-min-read-mib-s` and `--sd-min-write-mib-s`; the target is configurable with `--sd-target-mib-s`. SD rates use kernel block-device counters over active intervals; idle intervals do not generate zero-throughput alerts. `chunk_ingested` additionally reports the synchronized tmpfs-to-SD write rate, while postprocess events report logical RAW/stats input and JPEG/PNG output rates; the latter include OS cache and are labeled separately from physical diskstats.

## CSV GCS/SITL

`lilygo_emulator.py --port /tmp/ttyLILYGO` loads `caracterizacionvertical_vuelo.csv` next to the script by default; use `--csv PATH` to select another file. The parser accepts the Spanish `Tiempo` and `Altitud` column names in comment-prefixed headers and requires finite, increasing timestamps and nonnegative altitude.

The emulator sends no telemetry before launch. Menu option `2` sends `CMD_START_ASCENT`, runs the 3-2-1 countdown, then starts the virtual clock and streams the CSV rows at their recorded deltas. Option `T` simulates loss of telemetry TX while the CSV clock and autopilot continue; when TX resumes it sends the current flight sample. Option `A` enables automatic `START_REC` on the first descending sample and `TOUCHDOWN` at ground level. Option `3` and `4` provide manual apogee/touchdown commands. Countdown duration is configurable for tests with `--countdown-seconds`.

Local PTY test setup:

```sh
socat -d -d pty,raw,echo=0,link=/tmp/ttyPI pty,raw,echo=0,link=/tmp/ttyLILYGO
python3 demeter_missiond.py
python3 demeter_telemetryd.py --port /tmp/ttyPI
python3 lilygo_emulator.py --port /tmp/ttyLILYGO
```

Install the UART dependency with `python3 -m pip install -r requirements-telemetry.txt`. Mission and telemetry diagnostics are appended to `/home/admin/demeter_recording/missiond/missiond.log` and `telemetryd.log`; `--diagnostic-log PATH` overrides either location. Entries include timestamps, process IDs, component/action context, exception types, and tracebacks for unexpected failures. The flight supervisor stores recorder and postprocess output in each mission directory, and the interactive GCS reports operational errors to its console. End-to-end tests use a fake video executable and never start the physical camera; the default mission preflight still requires the real mount, writable SD paths, recorder binary, sufficient `MemAvailable`, and `rpicam-vid` executable before accepting `ARM`.
