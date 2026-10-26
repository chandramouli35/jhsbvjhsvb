from __future__ import annotations

import pandas as pd

from app.config import gate_offset_minutes

HALF_HOUR = pd.Timedelta(minutes=30)


def build_aligned(
    actuals: pd.DataFrame,
    forecasts: pd.DataFrame,
    gate: str,
) -> pd.DataFrame:
    """Align half-hourly actuals with the day-ahead and intraday wind forecasts.

    Day-ahead baseline, for every settlement period on delivery day D:
    the latest WINDFOR value published strictly before `gate` on D-1.

    Intraday revision: the latest publication at or after that gate and
    strictly before the settlement period starts. Later runs are not
    treated as information the day-ahead desk could have bid on.
    """
    base = _prepare_actuals(actuals)
    expanded = _expand_forecasts(forecasts)
    offset = pd.Timedelta(minutes=gate_offset_minutes(gate))
    base["cutoff"] = base["delivery_midnight"] - pd.Timedelta(days=1) + offset

    empty_da = pd.DataFrame(columns=["start_time", "day_ahead_mw", "day_ahead_publish_time"])
    empty_id = pd.DataFrame(columns=["start_time", "intraday_mw", "intraday_publish_time"])

    if expanded.empty:
        day_ahead, intraday = empty_da, empty_id
    else:
        merged = base[["start_time", "cutoff"]].merge(
            expanded[["start_time", "publish_time", "generation_mw"]],
            on="start_time",
            how="left",
        )
        published = merged["publish_time"].notna()
        day_ahead = _latest(
            merged.loc[published & (merged["publish_time"] < merged["cutoff"])],
            "day_ahead",
        )
        intraday = _latest(
            merged.loc[
                published
                & (merged["publish_time"] >= merged["cutoff"])
                & (merged["publish_time"] < merged["start_time"])
            ],
            "intraday",
        )

    out = base.drop(columns=["delivery_midnight", "cutoff"]).merge(day_ahead, on="start_time", how="left")
    out = out.merge(intraday, on="start_time", how="left")
    out["error_mw"] = out["day_ahead_mw"] - out["actual_mw"]
    out["shortfall_mw"] = out["error_mw"].clip(lower=0)
    out["surplus_mw"] = (-out["error_mw"]).clip(lower=0)
    out["shortfall_mwh"] = out["shortfall_mw"] * 0.5
    out["surplus_mwh"] = out["surplus_mw"] * 0.5
    return out.sort_values("start_time").reset_index(drop=True)


def forecast_vintages(forecasts: pd.DataFrame, aligned: pd.DataFrame) -> list[dict]:
    """Published runs covering a short window, aligned to the actuals index."""
    if aligned.empty or forecasts.empty:
        return []

    expanded = _expand_forecasts(forecasts)
    starts = aligned["start_time"]
    covered = expanded[expanded["start_time"].isin(set(starts))].copy()
    if covered.empty:
        return []

    gate_runs = {_iso(value) for value in aligned["day_ahead_publish_time"].dropna().unique()}
    intraday_runs = {_iso(value) for value in aligned["intraday_publish_time"].dropna().unique()}
    index = [_iso(value) for value in starts]
    vintages: list[dict] = []

    for publish_time, group in covered.groupby("publish_time", sort=True):
        by_start = {_iso(moment): mw for moment, mw in zip(group["start_time"], group["generation_mw"], strict=False)}
        publish_key = _iso(publish_time)
        if publish_key in gate_runs:
            role = "gate"
        elif publish_key in intraday_runs:
            role = "intraday"
        else:
            role = "earlier"
        series = []
        seen = False
        for moment in index:
            value = by_start.get(moment)
            if value is None or pd.isna(value):
                series.append(None)
            else:
                seen = True
                series.append(float(value))
        if seen:
            vintages.append(
                {
                    "publish_time": publish_time,
                    "role": role,
                    "mw": series,
                }
            )
    return vintages


def _prepare_actuals(actuals: pd.DataFrame) -> pd.DataFrame:
    frame = actuals.copy()
    frame["start_time"] = pd.to_datetime(frame["start_time"], utc=True)
    frame["actual_mw"] = pd.to_numeric(frame["actual_mw"], errors="coerce")
    frame = frame.dropna(subset=["start_time", "actual_mw"])
    frame = frame.sort_values("start_time").drop_duplicates("start_time", keep="last")
    frame["delivery_midnight"] = frame["start_time"].dt.tz_convert("UTC").dt.normalize()
    if "settlement_date" not in frame.columns:
        frame["settlement_date"] = frame["start_time"].dt.strftime("%Y-%m-%d")
    else:
        frame["settlement_date"] = frame["settlement_date"].astype(str).str.slice(0, 10)
    if "settlement_period" not in frame.columns:
        frame["settlement_period"] = _settlement_period(frame["start_time"])
    frame["settlement_period"] = frame["settlement_period"].astype(int)
    return frame.reset_index(drop=True)


def _expand_forecasts(forecasts: pd.DataFrame) -> pd.DataFrame:
    if forecasts.empty:
        return pd.DataFrame(columns=["publish_time", "start_time", "generation_mw"])

    frame = forecasts.copy()
    frame["publish_time"] = pd.to_datetime(frame["publish_time"], utc=True)
    frame["start_time"] = pd.to_datetime(frame["start_time"], utc=True)
    frame["generation_mw"] = pd.to_numeric(frame["generation_mw"], errors="coerce")
    frame = frame.dropna(subset=["publish_time", "start_time", "generation_mw"])

    on_the_hour = frame[["publish_time", "start_time", "generation_mw"]]
    half_past = on_the_hour.copy()
    half_past["start_time"] = half_past["start_time"] + HALF_HOUR
    expanded = pd.concat([on_the_hour, half_past], ignore_index=True)
    expanded = expanded.drop_duplicates(subset=["publish_time", "start_time"], keep="last")
    return expanded.reset_index(drop=True)


def _latest(frame: pd.DataFrame, prefix: str) -> pd.DataFrame:
    columns = ["start_time", f"{prefix}_mw", f"{prefix}_publish_time"]
    if frame.empty:
        return pd.DataFrame(columns=columns)
    ordered = frame.reset_index(drop=True)
    picked = ordered.loc[ordered.groupby("start_time")["publish_time"].idxmax()]
    picked = picked[["start_time", "generation_mw", "publish_time"]].rename(
        columns={
            "generation_mw": f"{prefix}_mw",
            "publish_time": f"{prefix}_publish_time",
        }
    )
    return picked.reset_index(drop=True)


def _settlement_period(start_time: pd.Series) -> pd.Series:
    return start_time.dt.hour * 2 + start_time.dt.minute // 30 + 1


def _iso(value) -> str:
    stamp = pd.Timestamp(value)
    if stamp.tzinfo is None:
        stamp = stamp.tz_localize("UTC")
    else:
        stamp = stamp.tz_convert("UTC")
    return stamp.strftime("%Y-%m-%dT%H:%M:%SZ")
