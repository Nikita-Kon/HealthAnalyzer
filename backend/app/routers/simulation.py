"""Server-paced replay of the final three dataset days (process-local sessions)."""
from datetime import datetime, time, timedelta
from threading import Lock
from time import monotonic
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from app.database import SessionLocal
from app.models import Astronaut, DailyMeasurement, HeartRateSample, SleepScore, TrainingSession, WellnessReport
from app.routers.astronauts import findAstronautOr404

router = APIRouter(prefix='/simulation', tags=['Simulation'])
_sessions = {}
_lock = Lock()


def dataset_window():
    dates = []
    with SessionLocal() as db:
        ids = db.scalars(select(Astronaut.id)).all()
        for column in (DailyMeasurement.day, HeartRateSample.recorded_at, SleepScore.timestamp,
                       TrainingSession.end_date_time, WellnessReport.effective_time_frame):
            for astronaut_id in ids:
                statement = select(column).where(column.class_.astronaut_id == astronaut_id, column.is_not(None))
                first = db.scalar(statement.order_by(column).limit(1))
                last = db.scalar(statement.order_by(column.desc()).limit(1))
                if first is not None:
                    dates.extend((first.date(), last.date()))
    if not dates or (max(dates) - min(dates)).days < 3:
        raise HTTPException(409, 'At least four days of data are needed for simulation')
    last_day = max(dates)
    return datetime.combine(last_day - timedelta(days=2), time.min), datetime.combine(last_day + timedelta(days=1), time.min)


@router.post('/start')
def start_simulation():
    start, end = dataset_window()
    token = uuid4().hex
    with _lock:
        # Expired sessions are released. Sessions are intentionally not persisted.
        for key, session in list(_sessions.items()):
            if monotonic() - session[2] > 3 * 86400 + 3600:
                del _sessions[key]
        if len(_sessions) >= 100:
            raise HTTPException(503, 'Too many simulation sessions; try again later')
        _sessions[token] = (start, end, monotonic())
    return {'session_id': token, 'simulated_at': start.isoformat(), 'ends_at': end.isoformat(), 'poll_seconds': 5}


@router.delete('/{session_id}')
def stop_simulation(session_id: str):
    with _lock:
        _sessions.pop(session_id, None)
    return {'status': 'stopped'}


@router.get('/{session_id}/heart-rate/{astronaut_id}')
def poll_heart_rate(session_id: str, astronaut_id: str, after: datetime | None = None,
                    limit: int = Query(10000, ge=1, le=10000)):
    with _lock:
        session = _sessions.get(session_id)
    if session is None:
        raise HTTPException(404, 'Simulation expired or server restarted. Start a new simulation.')
    start, end, began = session
    now = min(start + timedelta(seconds=max(0, monotonic() - began)), end - timedelta(microseconds=1))
    astronaut = findAstronautOr404(astronaut_id)
    if after is not None and after.tzinfo is not None:
        raise HTTPException(422, 'Use source wall-clock timestamps without a timezone')
    statement = select(HeartRateSample).where(
        HeartRateSample.astronaut_id == astronaut['id'],
        HeartRateSample.recorded_at >= start,
        HeartRateSample.recorded_at <= now,
    )
    if after is not None:
        statement = statement.where(HeartRateSample.recorded_at > after)
    else:
        statement = statement.where(HeartRateSample.recorded_at >= max(start, now - timedelta(minutes=15)))
    with SessionLocal() as db:
        rows = db.scalars(statement.order_by(HeartRateSample.recorded_at).limit(limit + 1)).all()
    has_more = len(rows) > limit
    rows = rows[:limit]
    return {
        'simulated_at': now.isoformat(), 'complete': now >= end - timedelta(microseconds=1),
        'has_more': has_more,
        'cursor': rows[-1].recorded_at.isoformat() if has_more else now.isoformat(),
        'data': [{'recorded_at': r.recorded_at.isoformat(), 'bpm': r.bpm, 'confidence': r.confidence} for r in rows],
    }
