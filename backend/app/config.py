from __future__ import annotations

import os
import re
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]

ELEXON_BASE_URL = os.getenv("ELEXON_BASE_URL", "https://data.elexon.co.uk/bmrs/api/v1").rstrip("/")
CACHE_DIR = Path(os.getenv("CACHE_DIR", BACKEND_ROOT / "data"))
STATIC_DIR = Path(os.getenv("STATIC_DIR", ""))
SERVE_FRONTEND = os.getenv("SERVE_FRONTEND", "0") == "1"
FORCE_REFRESH = os.getenv("FORCE_REFRESH", "0") == "1"
DEFAULT_GATE = os.getenv("GATE_CLOSURE", "11:00")

DELIVERY_START = "2026-01-01"
DELIVERY_END = "2026-01-31"
PUBLISH_FROM = "2025-12-28T00:00:00Z"
PUBLISH_TO = "2026-02-02T00:00:00Z"

# WINDFOR is an hourly average. Holding that MW across both half-hours
# preserves energy: P MW * 1h = 2 * (P MW * 0.5h).
HALF_HOUR_HOURS = 0.5
MIN_ACTUAL_MW = 1.0

# January 2026 is GMT, so UK settlement time and UTC coincide.
# These are the liquid GB day-ahead gates, plus the two reference cut-offs
# named in the brief (11:00 and 12:00 UTC on D-1).
GATE_PRESETS = (
    {
        "id": "09:20",
        "market": "EPEX SPOT",
        "name": "GB 60-min",
        "detail": "EPEX GB day-ahead hourly auction. Order book closes 09:20 UTC in January.",
    },
    {
        "id": "09:50",
        "market": "N2EX",
        "name": "Day-ahead hourly",
        "detail": "Nord Pool N2EX day-ahead auction. Order book closes 09:50 UTC, after the 09:30 WINDFOR run.",
    },
    {
        "id": "11:00",
        "market": "Reference",
        "name": "11:00 UTC",
        "detail": "Brief reference gate. Keeps the 09:30 WINDFOR run and excludes the 11:30 run.",
    },
    {
        "id": "12:00",
        "market": "Reference",
        "name": "12:00 UTC",
        "detail": "Brief reference gate. Admits the 11:30 WINDFOR run.",
    },
    {
        "id": "15:30",
        "market": "EPEX SPOT",
        "name": "GB 30-min",
        "detail": "EPEX GB day-ahead half-hour auction. A forecast stamped exactly 15:30 is excluded.",
    },
)

_GATE = re.compile(r"^(\d{1,2}):(\d{2})$")


def normalize_gate(value: str) -> str:
    match = _GATE.match(value.strip())
    if not match:
        raise ValueError("Gate must be HH:MM in UTC")
    hour = int(match.group(1))
    minute = int(match.group(2))
    if hour > 23 or minute > 59:
        raise ValueError("Gate must be a valid UTC time")
    return f"{hour:02d}:{minute:02d}"


def gate_offset_minutes(value: str) -> int:
    normalized = normalize_gate(value)
    hour, minute = (int(part) for part in normalized.split(":"))
    return hour * 60 + minute
