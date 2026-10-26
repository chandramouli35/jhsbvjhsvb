from __future__ import annotations

import math

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.config import normalize_gate
from app.main import create_app
from app.services.alignment import build_aligned
from app.services.metrics import error_stats, summary_metrics
from app.services.store import DataStore


def _stamp(value: str) -> pd.Timestamp:
    return pd.Timestamp(value, tz="UTC")


def _fixture() -> tuple[pd.DataFrame, pd.DataFrame]:
    """2 Jan 2026, two hours. Publishes mirror the real WINDFOR clock."""
    actuals = pd.DataFrame(
        [
            ("2026-01-02T00:00:00Z", "2026-01-02", 1, 100.0),
            ("2026-01-02T00:30:00Z", "2026-01-02", 2, 100.0),
            ("2026-01-02T01:00:00Z", "2026-01-02", 3, 80.0),
            ("2026-01-02T01:30:00Z", "2026-01-02", 4, 80.0),
        ],
        columns=["start_time", "settlement_date", "settlement_period", "actual_mw"],
    )
    forecasts = pd.DataFrame(
        [
            ("2026-01-01T07:30:00Z", "2026-01-02T00:00:00Z", 100.0),
            ("2026-01-01T07:30:00Z", "2026-01-02T01:00:00Z", 80.0),
            ("2026-01-01T09:30:00Z", "2026-01-02T00:00:00Z", 110.0),
            ("2026-01-01T09:30:00Z", "2026-01-02T01:00:00Z", 90.0),
            ("2026-01-01T11:30:00Z", "2026-01-02T00:00:00Z", 150.0),
            ("2026-01-01T11:30:00Z", "2026-01-02T01:00:00Z", 70.0),
            ("2026-01-01T22:30:00Z", "2026-01-02T00:00:00Z", 120.0),
            ("2026-01-01T22:30:00Z", "2026-01-02T01:00:00Z", 100.0),
            # Published after hour 01:00 has started. Must not be used for that hour.
            ("2026-01-02T02:30:00Z", "2026-01-02T01:00:00Z", 1.0),
        ],
        columns=["publish_time", "start_time", "generation_mw"],
    )
    return actuals, forecasts


def _day_ahead(gate: str) -> list[float]:
    actuals, forecasts = _fixture()
    aligned = build_aligned(actuals, forecasts, gate)
    return aligned["day_ahead_mw"].tolist()


def test_gate_11_keeps_0930_and_drops_1130():
    assert _day_ahead("11:00") == [110.0, 110.0, 90.0, 90.0]


def test_gate_12_admits_1130():
    assert _day_ahead("12:00") == [150.0, 150.0, 70.0, 70.0]


def test_epex_0920_excludes_0930_and_n2ex_0950_includes_it():
    assert _day_ahead("09:20") == [100.0, 100.0, 80.0, 80.0]
    assert _day_ahead("09:50") == [110.0, 110.0, 90.0, 90.0]


def test_hourly_forecast_is_copied_onto_both_half_hours():
    assert _day_ahead("11:00")[0] == _day_ahead("11:00")[1]
    assert _day_ahead("11:00")[2] == _day_ahead("11:00")[3]


def test_intraday_is_latest_run_after_the_gate_and_before_delivery():
    actuals, forecasts = _fixture()
    aligned = build_aligned(actuals, forecasts, "11:00")
    assert aligned["intraday_mw"].tolist() == [120.0, 120.0, 100.0, 100.0]
    assert aligned["intraday_publish_time"].iloc[2] == _stamp("2026-01-01T22:30:00Z")


def test_publication_after_the_period_start_does_not_leak():
    actuals, forecasts = _fixture()
    aligned = build_aligned(actuals, forecasts, "11:00")
    assert 1.0 not in aligned["day_ahead_mw"].tolist()
    assert 1.0 not in aligned["intraday_mw"].tolist()


def test_error_metrics_and_procurement_energy():
    actual = pd.Series([100.0, 200.0])
    forecast = pd.Series([110.0, 180.0])
    stats = error_stats(actual, forecast)
    assert stats["mae_mw"] == 15
    assert stats["bias_mw"] == -5
    assert stats["mape_pct"] == 10
    assert stats["rmse_mw"] == pytest.approx(math.sqrt(250))
    assert stats["shortfall_mwh"] == 5
    assert stats["surplus_mwh"] == 10


def test_mape_skips_near_zero_actuals():
    stats = error_stats(pd.Series([0.0, 100.0]), pd.Series([10.0, 110.0]))
    assert stats["mape_pct"] == 10


def test_summary_for_the_11_gate():
    actuals, forecasts = _fixture()
    stats = summary_metrics(build_aligned(actuals, forecasts, "11:00"))
    assert stats["mae_mw"] == 10
    assert stats["bias_mw"] == 10
    assert stats["mape_pct"] == 11.25
    assert stats["recommended_thermal_procurement_mwh"] == 20
    assert stats["surplus_mwh"] == 0
    assert stats["day_ahead_vintage"] == "09:30"
    assert stats["intraday_mae_mw"] == 20


def test_summary_endpoint_rounds_a_real_response():
    actuals, forecasts = _fixture()
    store = DataStore()
    store.actuals = actuals
    store.forecasts = forecasts
    store.source = "test"
    with TestClient(create_app(store)) as client:
        response = client.get("/api/summary", params={"start": "2026-01-02", "end": "2026-01-02", "gate": "11:00"})
    assert response.status_code == 200
    body = response.json()
    assert body["mae_mw"] == 10
    assert body["recommended_thermal_procurement_mwh"] == 20
    assert body["latest_forecast_mwh"] == 200
    assert body["day_ahead_vintage"] == "09:30"
    assert body["latest_period"]["day_ahead_publish_time"] == "2026-01-01T09:30:00Z"


def test_gate_normalisation():
    assert normalize_gate("9:50") == "09:50"
    with pytest.raises(ValueError):
        normalize_gate("24:00")


def test_rejects_dates_outside_january():
    store = DataStore()
    store.actuals = _fixture()[0]
    store.forecasts = _fixture()[1]
    store.source = "test"
    with TestClient(create_app(store)) as client:
        response = client.get("/api/summary", params={"start": "2025-12-31", "end": "2026-01-02", "gate": "11:00"})
    assert response.status_code == 400
