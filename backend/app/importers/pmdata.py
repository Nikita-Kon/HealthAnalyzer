"""Import PMData CSV reports and timestamped Fitbit JSON/CSV measurements.

Run from backend:
    python -m app.importers.pmdata [path/to/pmdata]
    python -m app.importers.pmdata [path/to/pmdata] --dry-run

DailyMeasurement.day stores each original observation timestamp. Measurements
are not aggregated by date and their times are not reset to midnight.

High-frequency heart_rate.json is imported into HeartRateSample. A single
heart_rate.json file may be passed instead of the PMData directory.
exercise.json, sleep.json and time_in_heart_rate_zones.json are not imported.
"""

import argparse
import math
from collections import Counter
from datetime import datetime
from pathlib import Path

import pandas as pd
from sqlalchemy import insert, inspect, select, text

from app.database import Base, SessionLocal, engine
from app.models import (
    Astronaut,
    DailyMeasurement,
    HeartRateSample,
    InjuryReport,
    NutritionReport,
    SleepScore,
    TrainingSession,
    WellnessReport,
)

# pmdata.py is under backend/app/importers/.
DEFAULT_PATH = Path(__file__).resolve().parents[1] / "data" / "pmdata"
DAILY_METRICS = {
    "steps": "steps",
    "distance": "cm",  # Source units; imported without rescaling
    "calories": "kcal",
    "resting_heart_rate": "bpm",
    "lightly_active_minutes": "min",
    "moderately_active_minutes": "min",
    "very_active_minutes": "min",
    "sedentary_minutes": "min",
    "floors": "floors",
}

REPORTS = {
    ("pmsys", "wellness.csv"): (WellnessReport, ("effective_time_frame",)),
    ("fitbit", "sleep_score.csv"): (SleepScore, ("sleep_log_entry_id",)),
    ("pmsys", "srpe.csv"): (TrainingSession, ("source_row",)),
    ("pmsys", "injury.csv"): (InjuryReport, ("source_row",)),
    ("googledocs", "reporting.csv"): (NutritionReport, ("source_row",)),
}

ALIASES = {
    "sleep_duration_h": "sleep_duration",
    "duration_min": "duration",
}

IMAGE_EXTENSIONS = {".jpeg", ".jpg", ".png"}


def clean(value):
    """Convert missing pandas values to None and numpy scalars to Python types."""
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if pd.isna(value):
        return None
    if hasattr(value, "item"):
        return value.item()
    return value


def timestamp(value):
    """Parse a source timestamp as a naive datetime (source wall-clock time)."""
    value = clean(value)
    if value is None or (isinstance(value, str) and not value.strip()):
        raise ValueError("Missing timestamp")
    try:
        parsed = pd.to_datetime(value, errors="raise")
        if pd.isna(parsed):
            raise ValueError("Missing timestamp")
        if parsed.tzinfo is not None:
            parsed = parsed.tz_localize(None)
        return parsed.to_pydatetime()
    except (TypeError, ValueError, OverflowError) as error:
        raise ValueError(f"Invalid timestamp {value!r}: {error}") from error


def convert(value, column):
    """Convert a CSV value based on its SQLAlchemy model column type."""
    value = clean(value)
    if value is None:
        if not column.nullable and column.default is None and column.server_default is None:
            raise ValueError(f"Missing required value: {column.name}")
        return None

    kind = column.type.python_type
    if kind is datetime:
        return timestamp(value)
    if kind is int:
        number = float(value)
        if not math.isfinite(number) or not number.is_integer():
            raise ValueError(f"{column.name} must be an integer: {value!r}")
        return int(number)
    if kind is float:
        number = float(value)
        if not math.isfinite(number):
            raise ValueError(f"{column.name} must be finite: {value!r}")
        return number
    return kind(value)


def read_csv(path):
    try:
        frame = pd.read_csv(path, encoding="utf-8-sig")
    except pd.errors.EmptyDataError:
        return pd.DataFrame()
    frame.columns = frame.columns.str.strip()
    return frame


def report_rows(path, model, counts):
    frame = read_csv(path)
    if frame.empty:
        counts["empty_files_skipped"] += 1
        print(f"WARNING: empty CSV: {path}")
        return

    for index, row in enumerate(frame.to_dict("records"), start=2):
        try:
            if model in (InjuryReport, NutritionReport):
                yield {
                    "source_row": index - 1,
                    "raw_data": {key: clean(value) for key, value in row.items()},
                }
                continue

            values = {}
            for column in model.__table__.columns:
                name = column.name
                if name in ("id", "astronaut_id"):
                    continue
                if name == "source_row":
                    values[name] = index - 1
                    continue
                source = name if name in row else ALIASES.get(name, name)
                if source not in row:
                    if not column.nullable and column.default is None and column.server_default is None:
                        raise ValueError(f"Missing required column: {source}")
                    continue
                values[name] = convert(row[source], column)
            yield values
        except (ValueError, TypeError, OverflowError) as error:
            raise ValueError(f"{path}, CSV row {index}: {error}") from error


def build_daily_rows(path, metric, root, times, values, counts):
    """Preserve source timestamps; keep the last value for exact duplicates."""
    frame = pd.DataFrame({"day": times, "value": values})
    # Parse as a vector for large minute-level exports. Preserve source wall time.
    frame["day"] = pd.to_datetime(frame["day"], format="mixed", errors="raise")
    if frame["day"].isna().any():
        raise ValueError(f"{path}: missing measurement timestamp")
    if frame["day"].dt.tz is not None:
        frame["day"] = frame["day"].dt.tz_localize(None)
    if metric == "resting_heart_rate":
        # JSON uses nested values, while CSV may contain the scalar directly.
        frame["value"] = frame["value"].map(
            lambda value: value.get("value") if isinstance(value, dict) else value
        )
    frame["value"] = pd.to_numeric(frame["value"], errors="raise")
    if frame["value"].isna().any() or not frame["value"].map(math.isfinite).all():
        raise ValueError(f"{path}: missing or non-finite {metric} value")
    if (frame["value"] < 0).any():
        raise ValueError(f"{path}: out-of-range {metric} value")
    duplicates = frame["day"].duplicated(keep=False)
    frame["quality_flag"] = "valid"
    frame.loc[duplicates, "quality_flag"] = "duplicate_source"
    if metric == "resting_heart_rate":
        # Preserve zero readings from the source, but flag them as unusable.
        invalid = frame["value"] == 0
        frame.loc[invalid, "quality_flag"] = "invalid_value"
        counts["invalid_source_values"] += int(invalid.sum())
    duplicate_count = int(frame["day"].duplicated(keep="last").sum())
    if duplicate_count:
        counts["source_timestamps_deduplicated"] += duplicate_count
        print(f"WARNING: {path.relative_to(root)}: {duplicate_count} repeated timestamps (last retained)")
    frame = frame.drop_duplicates("day", keep="last")
    source_file = path.relative_to(root).as_posix()
    for observed_at, value, flag in frame.itertuples(index=False, name=None):
        yield {
            "day": observed_at.to_pydatetime(), "metric": metric,
            "value": float(value), "unit": DAILY_METRICS[metric],
            "source_file": source_file, "quality_flag": flag,
        }


def daily_rows(path, metric, root, counts):
    frame = read_csv(path)
    if frame.empty:
        counts["empty_files_skipped"] += 1
        print(f"WARNING: empty CSV: {path}")
        return
    date_column = next(
        (name for name in ("dateTime", "timestamp", "date", "day") if name in frame.columns),
        None,
    )
    value_column = metric if metric in frame.columns else "value"
    if date_column is None or value_column not in frame.columns:
        raise ValueError(f"{path}: missing date/time or {metric}/value column")
    yield from build_daily_rows(
        path, metric, root, frame[date_column], frame[value_column], counts
    )


def daily_json_rows(path, root, counts):
    metric = path.stem
    try:
        frame = pd.read_json(path, convert_dates=False)
    except ValueError as error:
        raise ValueError(f"{path}: invalid JSON: {error}") from error
    if frame.empty:
        counts["empty_files_skipped"] += 1
        print(f"WARNING: empty JSON: {path}")
        return
    if not {"dateTime", "value"}.issubset(frame.columns):
        raise ValueError(f"{path}: expected dateTime and value fields")
    yield from build_daily_rows(
        path, metric, root, frame["dateTime"], frame["value"], counts
    )


def heart_rate_rows(path, root, counts):
    """Parse nested Fitbit values without averaging or truncating seconds."""
    frame = pd.read_json(path, convert_dates=False)
    if frame.empty:
        counts["empty_files_skipped"] += 1
        return
    if not {"dateTime", "value"}.issubset(frame.columns):
        raise ValueError(f"{path}: expected dateTime and value fields")
    samples = pd.json_normalize(frame["value"])
    if "bpm" not in samples:
        raise ValueError(f"{path}: missing value.bpm")
    times = pd.to_datetime(frame["dateTime"], format="mixed", errors="raise")
    if times.isna().any():
        raise ValueError(f"{path}: missing heart-rate timestamp")
    if times.dt.tz is not None:
        times = times.dt.tz_localize(None)
    bpm = pd.to_numeric(samples["bpm"], errors="raise")
    if bpm.isna().any() or not bpm.map(math.isfinite).all() or (bpm <= 0).any() or (bpm % 1 != 0).any():
        raise ValueError(f"{path}: BPM must be a positive integer")
    confidence = pd.to_numeric(
        samples.get("confidence", pd.Series(None, index=samples.index, dtype=object)),
        errors="raise",
    )
    if not confidence.dropna().isin([0, 1, 2, 3]).all():
        raise ValueError(f"{path}: confidence must be 0, 1, 2, 3 or null")
    parsed = pd.DataFrame({"recorded_at": times, "bpm": bpm, "confidence": confidence})
    duplicate_count = int(parsed["recorded_at"].duplicated(keep="last").sum())
    if duplicate_count:
        counts["source_timestamps_deduplicated"] += duplicate_count
        print(f"WARNING: {path.relative_to(root)}: {duplicate_count} repeated timestamps (last retained)")
    parsed = parsed.drop_duplicates("recorded_at", keep="last")
    for at, rate, certainty in parsed.itertuples(index=False, name=None):
        yield {
            "recorded_at": at.to_pydatetime(), "bpm": int(rate),
            "confidence": None if pd.isna(certainty) else int(certainty),
        }


def ensure_schema(bind):
    """Create tables and add the nullable confidence column to older databases."""
    Base.metadata.create_all(bind=bind)
    columns = {column["name"] for column in inspect(bind).get_columns("heart_rate_samples")}
    if "confidence" not in columns:
        with bind.begin() as connection:
            connection.execute(text("ALTER TABLE heart_rate_samples ADD COLUMN confidence INTEGER"))


def insert_rows(db, model, astronaut_id, rows, keys, counts, metric=None):
    """Insert in batches, skipping existing records by their full unique key."""
    selected_columns = [getattr(model, key) for key in keys]
    statement = select(*selected_columns).where(model.astronaut_id == astronaut_id)
    if metric is not None:
        statement = statement.where(model.metric == metric)
    existing = {tuple(row) for row in db.execute(statement)}
    batch = []
    for values in rows:
        key = tuple(values[name] for name in keys)
        if key in existing:
            counts["duplicates_skipped"] += 1
            continue
        batch.append({"astronaut_id": astronaut_id, **values})
        existing.add(key)
        counts[model.__tablename__] += 1
        if len(batch) == 5000:
            db.execute(insert(model), batch)
            batch.clear()
    if batch:
        db.execute(insert(model), batch)


def import_participant(db, folder, root, source_file=None):
    if len(folder.name) > 10:
        raise ValueError(f"Participant code exceeds 10 characters: {folder.name}")

    counts = Counter()
    astronaut = db.scalar(
        select(Astronaut).where(Astronaut.participant_code == folder.name)
    )
    if astronaut is None:
        astronaut = Astronaut(
            participant_code=folder.name,
            display_name=folder.name,
            dataset_source="pmdata",
        )
        db.add(astronaut)
        db.flush()
        counts["astronauts"] += 1
    elif astronaut.dataset_source != "pmdata":
        raise ValueError(f"Participant {folder.name} belongs to another dataset")

    paths = [source_file] if source_file is not None else sorted(folder.rglob("*"))
    for path in paths:
        if not path.is_file():
            continue
        if path.suffix.lower() in IMAGE_EXTENSIONS:
            counts["ignored_images"] += 1
            continue
        if path.stat().st_size == 0:
            counts["empty_files_skipped"] += 1
            print(f"WARNING: empty file: {path.relative_to(root)}")
            continue

        report = REPORTS.get((path.parent.name, path.name))
        if path.parent.name == "fitbit" and path.name == "heart_rate.json":
            insert_rows(
                db, HeartRateSample, astronaut.id, heart_rate_rows(path, root, counts),
                ("recorded_at",), counts,
            )
        elif report is not None:
            model, keys = report
            insert_rows(
                db, model, astronaut.id, report_rows(path, model, counts), keys, counts
            )
        elif (
            path.parent.name == "fitbit"
            and path.stem in DAILY_METRICS
            and path.suffix.lower() in (".json", ".csv")
        ):
            if path.suffix.lower() == ".json":
                rows = daily_json_rows(path, root, counts)
            else:
                rows = daily_rows(path, path.stem, root, counts)
            insert_rows(
                db, DailyMeasurement, astronaut.id, rows, ("day", "metric"), counts, metric=path.stem
            )
        else:
            counts[f"unsupported_{path.suffix.lower().lstrip('.')}_files"] += 1

    return counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", nargs="?", type=Path, default=DEFAULT_PATH)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and calculate inserts, then roll back them",
    )
    args = parser.parse_args()
    root = args.path.resolve()
    source_file = None
    if root.is_file():
        if root.name != "heart_rate.json" or root.parent.name != "fitbit":
            parser.error("Single-file import expects <participant>/fitbit/heart_rate.json")
        source_file = root
        participants = [root.parent.parent]
        root = root.parent.parent.parent
    elif root.is_dir():
        participants = sorted(
            folder for folder in root.iterdir()
            if folder.is_dir() and (folder / "fitbit").is_dir()
        )
    else:
        parser.error(f"PMData folder not found: {root}")
    if not participants:
        parser.error(f"No participant folders with fitbit/ in {root}")

    ensure_schema(engine)
    totals = Counter()
    for folder in participants:
        with SessionLocal() as db:
            try:
                counts = import_participant(db, folder, root, source_file=source_file)
                db.flush()
                if args.dry_run:
                    db.rollback()
                else:
                    db.commit()
            except Exception:
                db.rollback()
                print(f"ERROR: import failed for {folder.name}; that participant was rolled back")
                raise
        totals.update(counts)
        print(f"{folder.name}: {dict(counts)}")

    mode = "Dry run" if args.dry_run else "Import"
    print(f"{mode} complete: {dict(totals)}")


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    print('Created tables:', ', '.join(Base.metadata.tables))

    main()
