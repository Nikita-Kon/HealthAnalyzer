from datetime import date, datetime

from fastapi import APIRouter, HTTPException, Query

from app.routers.astronauts import findAstronautOr404
from app.services import dbQuery

router = APIRouter(tags=["Measurements"])


@router.get("/metrics")
def get_metrics():
    return {"data": dbQuery.getMetricCatalog()}


@router.get("/astronauts/{astronaut_id}/measurements")
def get_measurements(
    astronaut_id: str,
    metric: str,
    from_date: date | None = None,
    to_date: date | None = None,
    limit: int = Query(1000, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    astronaut = findAstronautOr404(astronaut_id)
    series = dbQuery.getMetricSeries(astronaut["id"], metric, from_date, to_date)
    if series is None:
        raise HTTPException(404, f"Unknown metric {metric}")
    return {
        "participant_id": astronaut["participant_code"],
        "metric": metric,
        "unit": dbQuery.DAILY_SERIES[metric][4],
        "data": series[offset:offset + limit],
        "total": len(series),
        "limit": limit,
        "offset": offset,
    }


@router.get("/astronauts/{astronaut_id}/summary")
def get_summary(astronaut_id: str, as_of: date):
    astronaut = findAstronautOr404(astronaut_id)
    return {
        "participant_id": astronaut["participant_code"],
        "as_of": as_of.isoformat(),
        "metrics": dbQuery.getDailySummary(astronaut["id"], as_of),
    }


@router.get("/astronauts/{astronaut_id}/raw/measurements")
def get_raw_measurements(
    astronaut_id: str,
    metric: str,
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = Query(1000, ge=1, le=10000),
    offset: int = Query(0, ge=0),
):
    astronaut = findAstronautOr404(astronaut_id)
    return dbQuery.getMeasurements(astronaut["id"], metric, start, end, limit, offset)


@router.get("/astronauts/{astronaut_id}/latest")
def get_latest(astronaut_id: str, as_of: datetime | None = None):
    astronaut = findAstronautOr404(astronaut_id)
    return dbQuery.getLatestMeasurements(astronaut["id"], as_of)


@router.get("/astronauts/{astronaut_id}/wellness")
def get_wellness(astronaut_id: str, start: datetime | None = None, end: datetime | None = None):
    astronaut = findAstronautOr404(astronaut_id)
    return dbQuery.getWellnessReports(astronaut["id"], start, end)


@router.get("/astronauts/{astronaut_id}/heart-rate")
def get_heart_rate(
    astronaut_id: str,
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = Query(1000, ge=1, le=10000),
    offset: int = Query(0, ge=0),
):
    astronaut = findAstronautOr404(astronaut_id)
    return dbQuery.getHeartRateSamples(astronaut["id"], start, end, limit, offset)


@router.get("/astronauts/{astronaut_id}/date-range")
def get_date_range(astronaut_id: str):
    astronaut = findAstronautOr404(astronaut_id)
    return dbQuery.getRecordDateRange(astronaut["id"])
