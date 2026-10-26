from __future__ import annotations

import logging
import time

import httpx

from app.config import ELEXON_BASE_URL, PUBLISH_FROM, PUBLISH_TO

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(90.0, connect=20.0)
_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "windgate-desk/1.0",
}


def _rows(payload: object) -> list[dict]:
    if isinstance(payload, dict):
        data = payload.get("data", [])
        return data if isinstance(data, list) else []
    if isinstance(payload, list):
        return payload
    return []


def _get(client: httpx.Client, path: str, params: dict) -> list[dict]:
    url = f"{ELEXON_BASE_URL}{path}"
    last_error: Exception | None = None
    for attempt in range(5):
        response = client.get(url, params=params, headers=_HEADERS)
        if response.status_code == 429 or response.status_code >= 500:
            delay = 1.5 * (attempt + 1)
            logger.warning("Elexon %s returned %s; retrying in %.1fs", path, response.status_code, delay)
            time.sleep(delay)
            last_error = httpx.HTTPStatusError(
                f"{response.status_code} from {path}",
                request=response.request,
                response=response,
            )
            continue
        response.raise_for_status()
        rows = _rows(response.json())
        logger.info("Fetched %s rows from %s", len(rows), path)
        return rows
    if last_error:
        raise last_error
    raise RuntimeError(f"Elexon request failed for {path}")


def fetch_wind_actuals(client: httpx.Client | None = None) -> list[dict]:
    """Half-hourly national generation outturn, fuelType WIND, January 2026."""
    owns_client = client is None
    client = client or httpx.Client(timeout=_TIMEOUT)
    try:
        return _get(
            client,
            "/datasets/FUELHH/stream",
            {
                "settlementDateFrom": "2026-01-01",
                "settlementDateTo": "2026-01-31",
                "fuelType": "WIND",
            },
        )
    finally:
        if owns_client:
            client.close()


def fetch_wind_forecasts(client: httpx.Client | None = None) -> list[dict]:
    """Every WINDFOR publication that can cover a January 2026 settlement period.

    The stream filters on publish time, not delivery time. Forecasts for
    1 January are issued from late December, so the window starts on 28 December.
    """
    owns_client = client is None
    client = client or httpx.Client(timeout=_TIMEOUT)
    try:
        return _get(
            client,
            "/datasets/WINDFOR/stream",
            {
                "publishDateTimeFrom": PUBLISH_FROM,
                "publishDateTimeTo": PUBLISH_TO,
            },
        )
    finally:
        if owns_client:
            client.close()
