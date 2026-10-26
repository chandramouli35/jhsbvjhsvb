from __future__ import annotations

from datetime import date

from fastapi import APIRouter, HTTPException, Query, Request

from app.config import DELIVERY_END, DELIVERY_START, GATE_PRESETS, normalize_gate
from app.present import (
    iso_z,
    meta_payload,
    public_accuracy,
    public_gate_row,
    public_series,
    public_summary,
    public_vintages,
)
from app.services.alignment import forecast_vintages
from app.services.metrics import accuracy_report, summary_metrics
from app.services.store import DataStore

router = APIRouter()

_MIN = date.fromisoformat(DELIVERY_START)
_MAX = date.fromisoformat(DELIVERY_END)


def _store(request: Request) -> DataStore:
    store: DataStore = request.app.state.store
    if store.load_error or store.actuals.empty:
        detail = store.load_error or "January 2026 wind data is not loaded"
        raise HTTPException(status_code=503, detail=detail)
    return store


def _gate(gate: str) -> str:
    try:
        return normalize_gate(gate)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _range(start: date, end: date) -> tuple[date, date]:
    if start < _MIN or end > _MAX or start > end:
        raise HTTPException(
            status_code=400,
            detail="start and end must fall within January 2026 and start must not be after end",
        )
    return start, end


@router.get("/health")
def health(request: Request) -> dict:
    store: DataStore = request.app.state.store
    return {
        "status": "ok" if not store.load_error else "degraded",
        "dataset": store.source,
        "actual_periods": int(len(store.actuals)),
        "forecast_rows": int(len(store.forecasts)),
        "loaded_at": iso_z(store.loaded_at) if store.loaded_at else None,
        "error": store.load_error,
    }


@router.get("/meta")
def meta(request: Request) -> dict:
    return meta_payload(_store(request))


@router.get("/summary")
def summary(
    request: Request,
    start: date = Query(default=_MIN),
    end: date = Query(default=_MAX),
    gate: str = Query(default="11:00", description="Day-ahead gate closure on D-1, UTC HH:MM"),
) -> dict:
    start, end = _range(start, end)
    gate = _gate(gate)
    frame = _store(request).window(gate, start.isoformat(), end.isoformat())
    return public_summary(summary_metrics(frame), start, end, gate)


@router.get("/timeseries")
def timeseries(
    request: Request,
    start: date = Query(default=_MIN),
    end: date = Query(default=_MAX),
    gate: str = Query(default="11:00"),
) -> dict:
    start, end = _range(start, end)
    gate = _gate(gate)
    store = _store(request)
    frame = store.window(gate, start.isoformat(), end.isoformat())
    vintages = []
    if (end - start).days <= 2:
        vintages = public_vintages(forecast_vintages(store.forecasts, frame))
    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "gate": gate,
        "points": public_series(frame),
        "vintages": vintages,
    }


@router.get("/accuracy")
def accuracy(
    request: Request,
    start: date = Query(default=_MIN),
    end: date = Query(default=_MAX),
    gate: str = Query(default="11:00"),
) -> dict:
    start, end = _range(start, end)
    gate = _gate(gate)
    frame = _store(request).window(gate, start.isoformat(), end.isoformat())
    payload = public_accuracy(accuracy_report(frame))
    payload["start"] = start.isoformat()
    payload["end"] = end.isoformat()
    payload["gate"] = gate
    return payload


@router.get("/gates")
def gates(
    request: Request,
    start: date = Query(default=_MIN),
    end: date = Query(default=_MAX),
) -> dict:
    start, end = _range(start, end)
    store = _store(request)
    rows = []
    for preset in GATE_PRESETS:
        frame = store.window(preset["id"], start.isoformat(), end.isoformat())
        stats = summary_metrics(frame)
        rows.append(public_gate_row(preset, stats, stats["day_ahead_vintage"]))
    return {"start": start.isoformat(), "end": end.isoformat(), "gates": rows}
