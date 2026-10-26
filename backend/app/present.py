from __future__ import annotations

import math
from datetime import date, datetime

import pandas as pd

from app.config import GATE_PRESETS


def num(value, places: int = 2):
    if value is None or (isinstance(value, float) and (math.isnan(value) or math.isinf(value))):
        return None
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    return round(float(value), places)


def iso_z(value) -> str | None:
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    stamp = pd.Timestamp(value)
    if stamp.tzinfo is None:
        stamp = stamp.tz_localize("UTC")
    else:
        stamp = stamp.tz_convert("UTC")
    return stamp.strftime("%Y-%m-%dT%H:%M:%SZ")


def public_summary(stats: dict, start: date, end: date, gate: str) -> dict:
    latest = stats.get("latest")
    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "gate": gate,
        "gate_closure": f"{gate} UTC on D-1",
        "bias_definition": "day_ahead_forecast_mw - actual_mw",
        "energy_factor_hours": 0.5,
        "periods": stats["periods"],
        "periods_with_day_ahead": stats["periods_with_day_ahead"],
        "periods_with_intraday": stats["periods_with_intraday"],
        "coverage_pct": _coverage(stats),
        "total_actual_generation_mwh": num(stats["total_actual_mwh"]),
        "latest_forecast_mwh": num(stats["total_day_ahead_mwh"]),
        "total_day_ahead_mwh": num(stats["total_day_ahead_mwh"]),
        "mae_mw": num(stats["mae_mw"]),
        "rmse_mw": num(stats["rmse_mw"]),
        "mape_pct": num(stats["mape_pct"]),
        "wape_pct": num(stats["wape_pct"]),
        "bias_mw": num(stats["bias_mw"]),
        "shortfall_mwh": num(stats["shortfall_mwh"]),
        "surplus_mwh": num(stats["surplus_mwh"]),
        "net_delta_mwh": num(stats["net_delta_mwh"]),
        "mean_shortfall_mw": num(stats["mean_shortfall_mw"]),
        "mean_surplus_mw": num(stats["mean_surplus_mw"]),
        "recommended_thermal_procurement_mwh": num(stats["recommended_thermal_procurement_mwh"]),
        "recommended_reserve_mw_p90": num(stats["recommended_reserve_mw_p90"]),
        "shortfall_periods": stats["shortfall_periods"],
        "surplus_periods": stats["surplus_periods"],
        "day_ahead_vintage": stats["day_ahead_vintage"],
        "day_ahead_vintage_share": num(stats["day_ahead_vintage_share"], 4),
        "intraday_mae_mw": num(stats["intraday_mae_mw"]),
        "intraday_bias_mw": num(stats["intraday_bias_mw"]),
        "intraday_mape_pct": num(stats["intraday_mape_pct"]),
        "latest_period": None
        if latest is None
        else {
            "start_time": iso_z(latest["start_time"]),
            "settlement_period": latest["settlement_period"],
            "actual_mw": num(latest["actual_mw"]),
            "day_ahead_mw": num(latest["day_ahead_mw"]),
            "day_ahead_publish_time": iso_z(latest["day_ahead_publish_time"]),
            "intraday_mw": num(latest["intraday_mw"]),
            "intraday_publish_time": iso_z(latest["intraday_publish_time"]),
        },
    }


def public_series(frame: pd.DataFrame) -> list[dict]:
    records = []
    for row in frame.itertuples(index=False):
        records.append(
            {
                "start_time": iso_z(row.start_time),
                "settlement_date": row.settlement_date,
                "settlement_period": int(row.settlement_period),
                "actual_mw": num(row.actual_mw),
                "day_ahead_mw": num(row.day_ahead_mw),
                "day_ahead_publish_time": iso_z(row.day_ahead_publish_time),
                "intraday_mw": num(row.intraday_mw),
                "intraday_publish_time": iso_z(row.intraday_publish_time),
                "error_mw": num(row.error_mw),
                "shortfall_mw": num(row.shortfall_mw),
                "surplus_mw": num(row.surplus_mw),
                "shortfall_mwh": num(row.shortfall_mwh),
                "surplus_mwh": num(row.surplus_mwh),
            }
        )
    return records


def public_vintages(vintages: list[dict]) -> list[dict]:
    published = []
    for vintage in vintages:
        published.append(
            {
                "publish_time": iso_z(vintage["publish_time"]),
                "role": vintage["role"],
                "mw": [None if value is None else round(float(value), 2) for value in vintage["mw"]],
            }
        )
    return published


def public_accuracy(report: dict) -> dict:
    return {
        "distribution": [
            {
                "bin_start_mw": num(row["bin_start_mw"]),
                "bin_end_mw": num(row["bin_end_mw"]),
                "count": row["count"],
            }
            for row in report["distribution"]
        ],
        "daily": [_public_bucket(row, "date") for row in report["daily"]],
        "by_settlement_period": [
            {
                **_public_bucket(row, "settlement_period"),
                "label": row["label"],
            }
            for row in report["by_settlement_period"]
        ],
    }


def public_gate_row(preset: dict, stats: dict, vintage: str | None) -> dict:
    return {
        "gate": preset["id"],
        "market": preset["market"],
        "name": preset["name"],
        "detail": preset["detail"],
        "vintage": vintage,
        "mae_mw": num(stats["mae_mw"]),
        "rmse_mw": num(stats["rmse_mw"]),
        "mape_pct": num(stats["mape_pct"]),
        "bias_mw": num(stats["bias_mw"]),
        "shortfall_mwh": num(stats["shortfall_mwh"]),
        "surplus_mwh": num(stats["surplus_mwh"]),
        "recommended_thermal_procurement_mwh": num(stats["recommended_thermal_procurement_mwh"]),
    }


def meta_payload(store) -> dict:
    loaded = store.loaded_at
    return {
        "dataset": "January 2026 GB national wind",
        "actuals_source": "Elexon FUELHH, fuelType WIND",
        "forecast_source": "Elexon WINDFOR",
        "actuals_resolution": "30 minutes",
        "forecast_native_resolution": "60 minutes",
        "date_min": "2026-01-01",
        "date_max": "2026-01-31",
        "default_gate": "11:00",
        "gates": list(GATE_PRESETS),
        "publish_clocks_utc": store.publish_clocks(),
        "actual_periods": int(len(store.actuals)),
        "forecast_rows": int(len(store.forecasts)),
        "cache_source": store.source,
        "loaded_at": loaded.astimezone(timezone_utc()).strftime("%Y-%m-%dT%H:%M:%SZ") if loaded else None,
        "load_error": store.load_error,
        "units": {
            "power": "MW, average over the settlement period",
            "energy": "MWh = MW x 0.5 h",
        },
        "formulas": {
            "mae": "mean(abs(day_ahead_mw - actual_mw))",
            "rmse": "sqrt(mean((day_ahead_mw - actual_mw)^2))",
            "mape": "mean(abs(day_ahead_mw - actual_mw) / abs(actual_mw)) * 100, actuals below 1 MW excluded",
            "bias": "mean(day_ahead_mw - actual_mw)",
            "shortfall_mwh": "sum(max(day_ahead_mw - actual_mw, 0)) * 0.5",
            "surplus_mwh": "sum(max(actual_mw - day_ahead_mw, 0)) * 0.5",
            "recommended_thermal_procurement_mwh": "shortfall_mwh",
            "recommended_reserve_mw_p90": "90th percentile of half-hourly max(day_ahead_mw - actual_mw, 0)",
        },
    }


def _public_bucket(row: dict, key_name: str) -> dict:
    key = row[key_name]
    if isinstance(key, datetime):
        key = key.date().isoformat()
    return {
        key_name: key,
        "mae_mw": num(row["mae_mw"]),
        "rmse_mw": num(row["rmse_mw"]),
        "mape_pct": num(row["mape_pct"]),
        "bias_mw": num(row["bias_mw"]),
        "actual_mwh": num(row["actual_mwh"]),
        "forecast_mwh": num(row["forecast_mwh"]),
        "shortfall_mwh": num(row["shortfall_mwh"]),
        "surplus_mwh": num(row["surplus_mwh"]),
        "periods": row["periods"],
    }


def _coverage(stats: dict) -> float | None:
    if not stats["periods"]:
        return None
    return round(100 * stats["periods_with_day_ahead"] / stats["periods"], 2)


def timezone_utc():
    from datetime import timezone

    return timezone.utc
