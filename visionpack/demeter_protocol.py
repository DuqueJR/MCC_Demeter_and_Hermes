#!/usr/bin/env python3
"""Binary UART protocol shared by the Demeter VisionPack daemons."""

from __future__ import annotations

from dataclasses import dataclass
from enum import IntEnum
import struct
from typing import Iterable

SYNC = b"\xaa\x55"
MAX_PAYLOAD = 0xFF
PREFLIGHT_SYNC = 0x10
TELEMETRY_UPDATE = 0x20
PAYLOAD_STATUS = 0x30
CMD_PREFLIGHT = 0xA0
CMD_ARM = 0xA1
CMD_START_ASCENT = 0xA2
CMD_START_REC = 0xB1
CMD_TOUCHDOWN = 0xC1
CMD_ABORT = 0xF1

PREFLIGHT_SYNC_STRUCT = struct.Struct("<Q")
TELEMETRY_STRUCT = struct.Struct("<Qffff")
STATUS_STRUCT = struct.Struct("<B")


class StatusCode(IntEnum):
    BOOT = 0x00
    PREFLIGHT = 0x01
    READY = 0x02
    ARMED = 0x03
    STARTING = 0x04
    ASCENT = 0x08
    RECORDING = 0x30
    INGESTING = 0x05
    PROCESSING = 0x06
    COMPLETE = 0x07
    ABORTED = 0xE0
    SD_FULL = 0xE1
    RATE_FALLBACK = 0xE2
    TELEMETRY_LOST = 0xE3
    ABORT_REQUESTED = 0xE4
    CLOCK_UNSYNCED = 0xE5
    PIPELINE_ERROR = 0xEF


@dataclass(frozen=True)
class Frame:
    message_type: int
    payload: bytes


def crc16_ccitt_false(data: bytes | bytearray | memoryview) -> int:
    """CRC-16/CCITT-FALSE: poly=0x1021, init=0xffff, no reflection/xorout."""
    crc = 0xFFFF
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return crc


def encode_frame(message_type: int, payload: bytes = b"") -> bytes:
    if not 0 <= message_type <= 0xFF:
        raise ValueError("message_type must fit in one byte")
    if len(payload) > MAX_PAYLOAD:
        raise ValueError("payload exceeds the one-byte protocol length")
    body = bytes((message_type, len(payload))) + payload
    return SYNC + body + struct.pack(">H", crc16_ccitt_false(body))


class StreamDecoder:
    """Incremental frame parser; invalid CRCs are silently discarded and resynced."""

    def __init__(self) -> None:
        self._buffer = bytearray()
        self.crc_errors = 0
        self.discarded_bytes = 0

    def feed(self, data: bytes | bytearray | memoryview) -> list[Frame]:
        try:
            if data:
                self._buffer.extend(data)
            frames: list[Frame] = []
            while True:
                sync_at = self._buffer.find(SYNC)
                if sync_at < 0:
                    keep = 1 if self._buffer.endswith(SYNC[:1]) else 0
                    self.discarded_bytes += len(self._buffer) - keep
                    if keep:
                        self._buffer[:] = self._buffer[-1:]
                    else:
                        self._buffer.clear()
                    break
                if sync_at:
                    self.discarded_bytes += sync_at
                    del self._buffer[:sync_at]
                if len(self._buffer) < 4:
                    break
                payload_length = self._buffer[3]
                frame_length = 2 + 2 + payload_length + 2
                if len(self._buffer) < frame_length:
                    break
                body_end = frame_length - 2
                body = self._buffer[2:body_end]
                expected_crc = struct.unpack_from(">H", self._buffer, body_end)[0]
                if crc16_ccitt_false(body) != expected_crc:
                    self.crc_errors += 1
                    self.discarded_bytes += 1
                    del self._buffer[0]
                    continue
                frames.append(Frame(self._buffer[2], bytes(self._buffer[4:body_end])))
                del self._buffer[:frame_length]
            return frames
        except Exception:
            # A malformed read must not kill the serial daemon.
            self._buffer.clear()
            self.discarded_bytes += 1
            return []


def iter_frames(chunks: Iterable[bytes]) -> Iterable[Frame]:
    decoder = StreamDecoder()
    for chunk in chunks:
        yield from decoder.feed(chunk)
