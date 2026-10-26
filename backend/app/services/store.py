from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx
import pandas as pd

from app.config import CACHE_DIR, FORCE_REFRESH
from app.services.alignment import build_aligned
from app.services.elexon_client import fetch_wind_actuals, fetch_wind_forecasts

logger = logging.getLogger(__name__)

_ACTUAL_COLUMNS = {
    "startTime": "start_time",
    "settlementDate": "settlement_date",
    "settlementPeriod": "settlement_period",
    "fuelType": "fuel_type",
    "generation": "actual_mw",
}
_FORECAST_COLUMNS = {
    "startTime": "start_time",
    "publishTime": "publish_time",
    "generation": "generation_mw",
}


class DataStore:
    """January 2026 FUELHH and WINDFOR, cached so the desk does not re-hit Elexon."""

    def __init__(self, cache_dir=CACHE_DIR):
        self.cache_dir = cache_dir
        self.actuals = pd.DataFrame()
        self.forecasts = pd.DataFrame()
        self.source = "empty"
        self.loaded_at: datetime | None = None
        self.load_error: str | None = None
        self._frames: dict[str, pd.DataFrame] = {}

    def load(self) -> None:
        actual_path = self.cache_dir / "actuals.parquet"
        forecast_path = self.cache_dir / "forecasts.parquet"
        if not FORCE_REFRESH and actual_path.exists() and forecast_path.exists():
            actuals = _normalise_actuals(pd.read_parquet(actual_path))
            forecasts = _normalise_forecasts(pd.read_parquet(forecast_path))
            if len(actuals) >= 1400 and len(forecasts) >= 1000:
                self.actuals = actuals
                self.forecasts = forecasts
                self.source = "cache"
                self.loaded_at = datetime.now(timezone.utc)
                self.load_error = None
                self._frames.clear()
                logger.info(
                    "Loaded cache: %s actuals, %s forecasts",
                    len(actuals),
                    len(forecasts),
                )
                return
        self.refresh()

    def refresh(self) -> None:
        with httpx.Client(timeout=httpx.Timeout(90.0, connect=20.0)) as client:
            actuals = _normalise_actuals(pd.DataFrame(fetch_wind_actuals(client)))
            forecasts = _normalise_forecasts(pd.DataFrame(fetch_wind_forecasts(client)))
        if actuals.empty or forecasts.empty:
            raise RuntimeError("Elexon returned no January 2026 wind actuals or forecasts")
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        _write_parquet(actuals, self.cache_dir / "actuals.parquet")
        _write_parquet(forecasts, self.cache_dir / "forecasts.parquet")
        self.actuals = actuals
        self.forecasts = forecasts
        self.source = "elexon"
        self.loaded_at = datetime.now(timezone.utc)
        self.load_error = None
        self._frames.clear()
        logger.info("Cached %s actuals and %s forecasts", len(actuals), len(forecasts))

    def aligned(self, gate: str) -> pd.DataFrame:
        if gate not in self._frames:
            frame = build_aligned(self.actuals, self.forecasts, gate)
            missing = int(frame["day_ahead_mw"].isna().sum()) if not frame.empty else 0
            if missing:
                logger.warning("Gate %s has no pre-cutoff forecast for %s settlement periods", gate, missing)
            self._frames[gate] = frame
        return self._frames[gate]

    def window(self, gate: str, start: str, end: str) -> pd.DataFrame:
        frame = self.aligned(gate)
        mask = (frame["settlement_date"] >= start) & (frame["settlement_date"] <= end)
        return frame.loc[mask].reset_index(drop=True)

    def publish_clocks(self) -> list[str]:
        if self.forecasts.empty:
            return []
        return sorted(self.forecasts["publish_time"].dt.strftime("%H:%M").unique().tolist())


def _normalise_actuals(frame: pd.DataFrame) -> pd.DataFrame:
    frame = frame.rename(columns=_ACTUAL_COLUMNS)
    if "fuel_type" in frame.columns:
        frame = frame[frame["fuel_type"].astype(str).str.upper() == "WIND"]
    frame["start_time"] = pd.to_datetime(frame["start_time"], utc=True)
    frame["actual_mw"] = pd.to_numeric(frame["actual_mw"], errors="coerce")
    frame = frame.dropna(subset=["start_time", "actual_mw"])
    if "settlement_date" in frame.columns:
        frame["settlement_date"] = frame["settlement_date"].astype(str).str.slice(0, 10)
    else:
        frame["settlement_date"] = frame["start_time"].dt.strftime("%Y-%m-%d")
    computed = frame["start_time"].dt.hour * 2 + frame["start_time"].dt.minute // 30 + 1
    if "settlement_period" in frame.columns:
        frame["settlement_period"] = pd.to_numeric(frame["settlement_period"], errors="coerce").fillna(computed)
    else:
        frame["settlement_period"] = computed
    frame["settlement_period"] = frame["settlement_period"].astype(int)
    keep = ["start_time", "settlement_date", "settlement_period", "actual_mw"]
    frame = frame[keep].sort_values("start_time").drop_duplicates("start_time", keep="last")
    return frame.reset_index(drop=True)


def _normalise_forecasts(frame: pd.DataFrame) -> pd.DataFrame:
    frame = frame.rename(columns=_FORECAST_COLUMNS)
    frame["publish_time"] = pd.to_datetime(frame["publish_time"], utc=True)
    frame["start_time"] = pd.to_datetime(frame["start_time"], utc=True)
    frame["generation_mw"] = pd.to_numeric(frame["generation_mw"], errors="coerce")
    frame = frame.dropna(subset=["publish_time", "start_time", "generation_mw"])
    keep = ["publish_time", "start_time", "generation_mw"]
    frame = (
        frame[keep]
        .groupby(["publish_time", "start_time"], as_index=False)["generation_mw"]
        .mean()
        .sort_values(["publish_time", "start_time"])
    )
    return frame.reset_index(drop=True)


def _write_parquet(frame: pd.DataFrame, path) -> None:
    temporary = path.with_suffix(".parquet.tmp")
    frame.to_parquet(temporary, index=False)
    path.unlink(missing_ok=True)
    temporary.replace(path)
