import os
import sqlite3
from pathlib import Path

DB_PATH = Path(os.getenv("HEALTHANALYZER_DB", Path(__file__).resolve().parents[2] / "healthanalyzer.sqlite3"))


def get_connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS astronauts (
      id INTEGER PRIMARY KEY, participant_code TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL, dataset_source TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS measurements (
      id INTEGER PRIMARY KEY, astronaut_id INTEGER NOT NULL REFERENCES astronauts(id),
      metric TEXT NOT NULL, value REAL NOT NULL, unit TEXT, measured_at TEXT NOT NULL,
      source_file TEXT, source_record_id TEXT, quality_flag TEXT NOT NULL DEFAULT 'valid',
      UNIQUE(astronaut_id, metric, measured_at));
    CREATE INDEX IF NOT EXISTS idx_measurements_lookup ON measurements(astronaut_id, metric, measured_at);
    """)
    return conn
