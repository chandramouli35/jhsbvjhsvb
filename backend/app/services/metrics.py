from __future__ import annotations

import math

import numpy as np
import pandas as pd

from app.config import HALF_HOUR_HOURS, MIN_ACTUAL_MW


def error_stats(actual: pd.Series, forecast: pd.Series) -> dict:
    """MAE, RMSE, MAPE and bias of forecast minus actual, plus the energy gap."""
    err = forecast.astype(float) - actual.astype(float)
    abs_err = err.abs()
    valid = actual.abs() >= MIN_ACTUAL_MW
    mape = None
    if bool(valid.any()):
        mape = float((abs_err[valid] / actual[valid].abs()).mean() * 100)
    actual_abs = float(actual.abs().sum())
    wape = float(abs_err.sum() / actual_abs * 100) if actual_abs else None
    shortfall = err.clip(lower=0)
    surplus = (-err).clip(lower=0)
    return {
        "mae_mw": float(abs_err.mean()),
        "rmse_mw": float(math.sqrt(float((err**2).mean()))),
        "mape_pct": mape,
        "wape_pct": wape,
        "bias_mw": float(err.mean()),
        "shortfall_mwh": float(shortfall.sum() * HALF_HOUR_HOURS),
        "surplus_mwh": float(surplus.sum() * HALF_HOUR_HOURS),
        "actual_mwh": float(actual.sum() * HALF_HOUR_HOURS),
        "forecast_mwh": float(forecast.sum() * HALF_HOUR_HOURS),
        "mean_shortfall_mw": float(shortfall.mean()),
        "mean_surplus_mw": float(surplus.mean()),
        "reserve_mw_p90": float(shortfall.quantile(0.9)),
        "shortfall_periods": int((err > 0).sum()),
        "surplus_periods": int((err < 0).sum()),
        "count": int(len(actual)),
    }


def summary_metrics(frame: pd.DataFrame) -> dict:
    matched = frame.dropna(subset=["actual_mw", "day_ahead_mw"]).copy()
    actual_mwh = float(frame["actual_mw"].sum() * HALF_HOUR_HOURS) if not frame.empty else 0.0
    if matched.empty:
        return {
            "periods": int(len(frame)),
            "periods_with_day_ahead": 0,
            "periods_with_intraday": int(frame["intraday_mw"].notna().sum()) if "intraday_mw" in frame else 0,
            "total_actual_mwh": actual_mwh,
            "total_day_ahead_mwh": None,
            "mae_mw": None,
            "rmse_mw": None,
            "mape_pct": None,
            "wape_pct": None,
            "bias_mw": None,
            "shortfall_mwh": None,
            "surplus_mwh": None,
            "net_delta_mwh": None,
            "mean_shortfall_mw": None,
            "mean_surplus_mw": None,
            "recommended_thermal_procurement_mwh": None,
            "recommended_reserve_mw_p90": None,
            "shortfall_periods": 0,
            "surplus_periods": 0,
            "day_ahead_vintage": None,
            "day_ahead_vintage_share": None,
            "intraday_mae_mw": None,
            "intraday_bias_mw": None,
            "intraday_mape_pct": None,
            "latest": None,
        }

    stats = error_stats(matched["actual_mw"], matched["day_ahead_mw"])
    clocks = matched["day_ahead_publish_time"].dropna().dt.strftime("%H:%M")
    vintage = None if clocks.empty else str(clocks.mode().iloc[0])
    share = None if vintage is None else float((clocks == vintage).mean())

    intraday = matched.dropna(subset=["intraday_mw"])
    intraday_mae = intraday_bias = intraday_mape = None
    if not intraday.empty:
        intra_stats = error_stats(intraday["actual_mw"], intraday["intraday_mw"])
        intraday_mae = intra_stats["mae_mw"]
        intraday_bias = intra_stats["bias_mw"]
        intraday_mape = intra_stats["mape_pct"]

    last = matched.iloc[-1]
    latest_intraday = None if pd.isna(last["intraday_mw"]) else float(last["intraday_mw"])
    return {
        "periods": int(len(frame)),
        "periods_with_day_ahead": stats["count"],
        "periods_with_intraday": int(frame["intraday_mw"].notna().sum()),
        "total_actual_mwh": actual_mwh,
        "total_day_ahead_mwh": stats["forecast_mwh"],
        "mae_mw": stats["mae_mw"],
        "rmse_mw": stats["rmse_mw"],
        "mape_pct": stats["mape_pct"],
        "wape_pct": stats["wape_pct"],
        "bias_mw": stats["bias_mw"],
        "shortfall_mwh": stats["shortfall_mwh"],
        "surplus_mwh": stats["surplus_mwh"],
        "net_delta_mwh": float(stats["forecast_mwh"] - stats["actual_mwh"]),
        "mean_shortfall_mw": stats["mean_shortfall_mw"],
        "mean_surplus_mw": stats["mean_surplus_mw"],
        "recommended_thermal_procurement_mwh": stats["shortfall_mwh"],
        "recommended_reserve_mw_p90": stats["reserve_mw_p90"],
        "shortfall_periods": stats["shortfall_periods"],
        "surplus_periods": stats["surplus_periods"],
        "day_ahead_vintage": vintage,
        "day_ahead_vintage_share": share,
        "intraday_mae_mw": intraday_mae,
        "intraday_bias_mw": intraday_bias,
        "intraday_mape_pct": intraday_mape,
        "latest": {
            "start_time": last["start_time"],
            "settlement_period": int(last["settlement_period"]),
            "actual_mw": float(last["actual_mw"]),
            "day_ahead_mw": float(last["day_ahead_mw"]),
            "day_ahead_publish_time": last["day_ahead_publish_time"],
            "intraday_mw": latest_intraday,
            "intraday_publish_time": last["intraday_publish_time"],
        },
    }


def accuracy_report(frame: pd.DataFrame) -> dict:
    matched = frame.dropna(subset=["actual_mw", "day_ahead_mw"]).copy()
    if matched.empty:
        return {"distribution": [], "daily": [], "by_settlement_period": []}

    err = matched["day_ahead_mw"] - matched["actual_mw"]
    bin_count = int(min(16, max(len(matched), 1)))
    counts, edges = np.histogram(err.to_numpy(dtype=float), bins=bin_count)
    distribution = [
        {
            "bin_start_mw": float(edges[index]),
            "bin_end_mw": float(edges[index + 1]),
            "count": int(counts[index]),
        }
        for index in range(len(counts))
        if int(counts[index]) > 0
    ]

    daily = [_bucket(day, group, "date") for day, group in matched.groupby("settlement_date", sort=True)]
    by_period = [
        _bucket(int(period), group, "settlement_period")
        for period, group in matched.groupby("settlement_period", sort=True)
    ]
    for row in by_period:
        row["label"] = settlement_label(row["settlement_period"])
    return {
        "distribution": distribution,
        "daily": daily,
        "by_settlement_period": by_period,
    }


def settlement_label(period: int) -> str:
    start_minutes = (int(period) - 1) * 30
    hour, minute = divmod(start_minutes, 60)
    return f"{hour:02d}:{minute:02d}"


def _bucket(key, group: pd.DataFrame, key_name: str) -> dict:
    stats = error_stats(group["actual_mw"], group["day_ahead_mw"])
    return {
        key_name: key,
        "mae_mw": stats["mae_mw"],
        "rmse_mw": stats["rmse_mw"],
        "mape_pct": stats["mape_pct"],
        "bias_mw": stats["bias_mw"],
        "actual_mwh": stats["actual_mwh"],
        "forecast_mwh": stats["forecast_mwh"],
        "shortfall_mwh": stats["shortfall_mwh"],
        "surplus_mwh": stats["surplus_mwh"],
        "periods": stats["count"],
    }
