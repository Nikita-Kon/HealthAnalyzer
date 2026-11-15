from datetime import date, datetime, time, timedelta

from sqlalchemy import desc, select, func

from app.database import SessionLocal
from app.models import Astronaut, DailyMeasurement, HeartRateSample, SleepScore, TrainingSession, WellnessReport

# Fitbit stores these as interval (minute-level) readings: a day's value is the sum, not the last record
INTERVAL_METRICS = {"steps", "calories", "distance"}
# Rows flagged like this are kept in the DB but must not be used as real values
INVALID_FLAGS = {"invalid_value"}

WELLNESS_FIELDS = (
    "fatigue", "mood", "readiness", "sleep_duration_h",
    "sleep_quality", "soreness", "soreness_area", "stress",
)

def getAstronauts():
    with SessionLocal() as db:
        astronauts = db.scalars(
            select(Astronaut).order_by(Astronaut.id)
        ).all()

    result = [
        {
            "id": astronaut.id,
            "participant_code": astronaut.participant_code,
            "display_name": astronaut.display_name,
            "dataset_source": astronaut.dataset_source
        }
        for astronaut in astronauts
    ]

    return result

def getAstronautById(id):
    with SessionLocal() as db:
        astronaut = db.scalars(
            select(Astronaut).where(Astronaut.id == id)
        ).first()

        if astronaut is None:
            return None

        result = {
            "id": astronaut.id,
            "participant_code": astronaut.participant_code,
            "display_name": astronaut.display_name,
            "dataset_source": astronaut.dataset_source
        }
        return result


def getAstronautByCode(code):
    with SessionLocal() as db:
        astronaut = db.scalars(
            select(Astronaut).where(Astronaut.participant_code == code.lower())
        ).first()

        if astronaut is None:
            return None

        result = {
            "id": astronaut.id,
            "participant_code": astronaut.participant_code,
            "display_name": astronaut.display_name,
            "dataset_source": astronaut.dataset_source
        }
        return result


def findAstronaut(key):
    """Astronaut by participant code ("p01") or numeric id ("1")."""
    key = str(key)
    return getAstronautById(int(key)) if key.isdigit() else getAstronautByCode(key)


def _iso(value):
    return value.isoformat() if value is not None else None


def _start(value):
    """Lower bound (inclusive). Accepts datetime, date or ISO string."""
    if value is None:
        return None
    if isinstance(value, str):
        value = datetime.fromisoformat(value)
    if not isinstance(value, datetime):
        value = datetime.combine(value, time.min)
    return value


def _end(value):
    """Upper bound (exclusive). A bare date means the whole day is included."""
    if value is None:
        return None
    if isinstance(value, str):
        if len(value) == 10:
            value = date.fromisoformat(value)
        else:
            value = datetime.fromisoformat(value)
    if not isinstance(value, datetime):
        return datetime.combine(value + timedelta(days=1), time.min)
    return value + timedelta(microseconds=1)


def _period(statement, column, start, end):
    start, end = _start(start), _end(end)
    if start is not None:
        statement = statement.where(column >= start)
    if end is not None:
        statement = statement.where(column < end)
    return statement


def getAvailableMetrics(astronaut_id):
    with SessionLocal() as db:
        metrics = db.scalars(
            select(DailyMeasurement.metric)
            .where(DailyMeasurement.astronaut_id == astronaut_id)
            .distinct()
            .order_by(DailyMeasurement.metric)
        ).all()

    return list(metrics)


def getMeasurements(astronaut_id, metric, start=None, end=None, limit=1000, offset=0, valid_only=False):
    statement = select(DailyMeasurement).where(
        DailyMeasurement.astronaut_id == astronaut_id,
        DailyMeasurement.metric == metric,
    )
    statement = _period(statement, DailyMeasurement.day, start, end)
    if valid_only:
        statement = statement.where(DailyMeasurement.quality_flag.not_in(INVALID_FLAGS))
    statement = statement.order_by(DailyMeasurement.day).limit(limit).offset(offset)

    with SessionLocal() as db:
        measurements = db.scalars(statement).all()

    result = [
        {
            "day": _iso(measurement.day),
            "metric": measurement.metric,
            "value": measurement.value,
            "unit": measurement.unit,
            "quality_flag": measurement.quality_flag
        }
        for measurement in measurements
    ]

    return result


def getDailyTotals(astronaut_id, metric, start=None, end=None):
    """Per-day sums for interval metrics (steps, calories, distance); invalid rows are skipped."""
    day = func.date(DailyMeasurement.day)
    statement = select(
        day.label("day"),
        func.sum(DailyMeasurement.value).label("value"),
        func.max(DailyMeasurement.unit).label("unit"),
        func.count().label("sample_count"),
    ).where(
        DailyMeasurement.astronaut_id == astronaut_id,
        DailyMeasurement.metric == metric,
        DailyMeasurement.quality_flag.not_in(INVALID_FLAGS),
    )
    statement = _period(statement, DailyMeasurement.day, start, end)
    statement = statement.group_by(day).order_by(day)

    with SessionLocal() as db:
        rows = db.execute(statement).all()

    result = [
        {
            "day": str(row.day),
            "metric": metric,
            "value": row.value,
            "unit": row.unit,
            "sample_count": row.sample_count
        }
        for row in rows
    ]

    return result


def getLatestMeasurements(astronaut_id, as_of=None):
    """Last known valid value of every metric, never later than as_of (for Replay).

    Interval metrics return the sum of their last day up to as_of; measured_at is the last reading in it.
    """
    cutoff = _end(as_of)
    result = {}

    with SessionLocal() as db:
        statement = select(
            DailyMeasurement.metric,
            func.max(DailyMeasurement.day).label("measured_at"),
        ).where(
            DailyMeasurement.astronaut_id == astronaut_id,
            DailyMeasurement.quality_flag.not_in(INVALID_FLAGS),
        )
        if cutoff is not None:
            statement = statement.where(DailyMeasurement.day < cutoff)
        latest = db.execute(statement.group_by(DailyMeasurement.metric)).all()

        for metric, measured_at in latest:
            valid = (
                DailyMeasurement.astronaut_id == astronaut_id,
                DailyMeasurement.metric == metric,
                DailyMeasurement.quality_flag.not_in(INVALID_FLAGS),
            )
            if metric in INTERVAL_METRICS:
                day_start = datetime.combine(measured_at.date(), time.min)
                value, unit = db.execute(
                    select(func.sum(DailyMeasurement.value), func.max(DailyMeasurement.unit))
                    .where(*valid, DailyMeasurement.day >= day_start, DailyMeasurement.day <= measured_at)
                ).one()
            else:
                value, unit = db.execute(
                    select(DailyMeasurement.value, DailyMeasurement.unit)
                    .where(*valid, DailyMeasurement.day == measured_at)
                ).one()

            result[metric] = {
                "value": value,
                "unit": unit,
                "measured_at": _iso(measured_at)
            }

    return result


def getWellnessReports(astronaut_id, start=None, end=None):
    statement = select(WellnessReport).where(WellnessReport.astronaut_id == astronaut_id)
    statement = _period(statement, WellnessReport.effective_time_frame, start, end)
    statement = statement.order_by(WellnessReport.effective_time_frame)

    with SessionLocal() as db:
        reports = db.scalars(statement).all()

    result = [
        {
            "effective_time_frame": _iso(report.effective_time_frame),
            **{field: getattr(report, field) for field in WELLNESS_FIELDS}
        }
        for report in reports
    ]

    return result


def getHeartRateSamples(astronaut_id, start=None, end=None, limit=1000, offset=0):
    statement = select(HeartRateSample).where(HeartRateSample.astronaut_id == astronaut_id)
    statement = _period(statement, HeartRateSample.recorded_at, start, end)
    statement = statement.order_by(HeartRateSample.recorded_at).limit(limit).offset(offset)

    with SessionLocal() as db:
        samples = db.scalars(statement).all()

    result = [
        {
            "recorded_at": _iso(sample.recorded_at),
            "bpm": sample.bpm,
            "confidence": sample.confidence
        }
        for sample in samples
    ]

    return result


def getAvailableDateRange(astronaut_id):
    with SessionLocal() as db:
        first, last = db.execute(
            select(func.min(DailyMeasurement.day), func.max(DailyMeasurement.day))
            .where(DailyMeasurement.astronaut_id == astronaut_id)
        ).one()

    if first is None:
        return None

    result = {
        "start": first.date().isoformat(),
        "end": last.date().isoformat()
    }

    return result


def _fitbit(metric):
    return DailyMeasurement.day, DailyMeasurement.value, (
        DailyMeasurement.metric == metric,
        DailyMeasurement.quality_flag.not_in(INVALID_FLAGS),
    )


# One value per calendar day for every metric the dashboard and analytics use.
# metric: (time column, value column, extra filters, daily aggregate, unit, description)
DAILY_SERIES = {
    "resting_heart_rate": (*_fitbit("resting_heart_rate"), func.avg, "bpm", "Fitbit resting heart rate"),
    "sleep_duration": (WellnessReport.effective_time_frame, WellnessReport.sleep_duration_h, (), func.avg, "hours", "Self-reported sleep duration"),
    "sleep_score": (SleepScore.timestamp, SleepScore.overall_score, (), func.avg, "score", "Fitbit overall sleep score, 0-100"),
    "stress": (WellnessReport.effective_time_frame, WellnessReport.stress, (), func.avg, "scale", "Self-reported stress, 1-5"),
    "mood": (WellnessReport.effective_time_frame, WellnessReport.mood, (), func.avg, "scale", "Self-reported mood, 1-5"),
    "fatigue": (WellnessReport.effective_time_frame, WellnessReport.fatigue, (), func.avg, "scale", "Self-reported fatigue, 1-5"),
    "readiness": (WellnessReport.effective_time_frame, WellnessReport.readiness, (), func.avg, "scale", "Self-reported readiness to train, 0-10"),
    "exercise_duration": (TrainingSession.end_date_time, TrainingSession.duration_min, (), func.sum, "minutes", "Total training time (sRPE reports)"),
    "steps": (*_fitbit("steps"), func.sum, "steps", "Daily step count"),
    "calories": (*_fitbit("calories"), func.sum, "kcal", "Daily calories burned"),
    "distance": (*_fitbit("distance"), func.sum, "cm", "Daily distance"),
}


def getMetricCatalog():
    result = [
        {"metric": metric, "unit": unit, "description": description}
        for metric, (_, _, _, _, unit, description) in DAILY_SERIES.items()
    ]

    return result


def _seriesStatement(astronaut_id, metric, start=None, end=None):
    at, value, filters, aggregate, _, _ = DAILY_SERIES[metric]
    day = func.date(at)
    statement = select(day.label("day"), aggregate(value).label("value")).where(
        at.class_.astronaut_id == astronaut_id,
        at.is_not(None),
        value.is_not(None),
        *filters,
    )
    return _period(statement, at, start, end).group_by(day)


def getMetricSeries(astronaut_id, metric, start=None, end=None):
    """Daily values of one metric: [{"date": "2019-11-01", "value": 62.0}]. None if the metric is unknown."""
    if metric not in DAILY_SERIES:
        return None

    with SessionLocal() as db:
        rows = db.execute(_seriesStatement(astronaut_id, metric, start, end).order_by("day")).all()

    result = [
        {"date": str(row.day), "value": float(row.value)}
        for row in rows
    ]

    return result


def getDailySummary(astronaut_id, as_of=None):
    """Latest daily value of every metric on or before as_of."""
    result = {}

    with SessionLocal() as db:
        for metric, (_, _, _, _, unit, _) in DAILY_SERIES.items():
            row = db.execute(
                _seriesStatement(astronaut_id, metric, end=as_of).order_by(desc("day")).limit(1)
            ).first()
            if row is not None:
                result[metric] = {"value": float(row.value), "unit": unit, "measured_at": str(row.day)}

    return result


def getRecordDateRange(astronaut_id):
    """First and last day with any data across all daily series (used for the Replay range)."""
    days = []

    with SessionLocal() as db:
        for at in (DailyMeasurement.day, HeartRateSample.recorded_at, WellnessReport.effective_time_frame, SleepScore.timestamp, TrainingSession.end_date_time):
            statement = select(at).where(at.class_.astronaut_id == astronaut_id, at.is_not(None))
            first = db.scalar(statement.order_by(at).limit(1))
            last = db.scalar(statement.order_by(at.desc()).limit(1))
            if first is not None:
                days += [first.date().isoformat(), last.date().isoformat()]

    if not days:
        return None

    return {"start": min(days), "end": max(days)}
