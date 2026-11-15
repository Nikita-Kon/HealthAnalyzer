import os
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATA_DIR = Path(__file__).resolve().parent.parent / 'app/data'
DATA_DIR.mkdir(parents=True, exist_ok=True)
DEFAULT_DATABASE_URL = f"sqlite:///{(DATA_DIR / 'health.db').as_posix()}"
DATABASE_URL = os.getenv('DATABASE_URL', DEFAULT_DATABASE_URL)

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith('sqlite') else {})

if DATABASE_URL.startswith('sqlite'):
    @event.listens_for(engine, 'connect')
    def enable_foreign_keys(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute('PRAGMA foreign_keys=ON')
        cursor.close()

SessionLocal = sessionmaker(bind=engine, autoflush=False)

class Base(DeclarativeBase):
    pass


def get_db():
    with SessionLocal() as session:
        yield session

# =======
# import sqlite3
# from pathlib import Path
#
# DB_PATH = Path(os.getenv("HEALTHANALYZER_DB", Path(__file__).resolve().parents[2] / "healthanalyzer.sqlite3"))
#
#
# def get_connection():
#     DB_PATH.parent.mkdir(parents=True, exist_ok=True)
#     conn = sqlite3.connect(DB_PATH)
#     conn.row_factory = sqlite3.Row
#     conn.execute("PRAGMA foreign_keys=ON")
#     conn.executescript("""
#     CREATE TABLE IF NOT EXISTS astronauts (
#       id INTEGER PRIMARY KEY, participant_code TEXT UNIQUE NOT NULL,
#       display_name TEXT NOT NULL, dataset_source TEXT NOT NULL);
#     CREATE TABLE IF NOT EXISTS measurements (
#       id INTEGER PRIMARY KEY, astronaut_id INTEGER NOT NULL REFERENCES astronauts(id),
#       metric TEXT NOT NULL, value REAL NOT NULL, unit TEXT, measured_at TEXT NOT NULL,
#       source_file TEXT, source_record_id TEXT, quality_flag TEXT NOT NULL DEFAULT 'valid',
#       UNIQUE(astronaut_id, metric, measured_at));
#     CREATE INDEX IF NOT EXISTS idx_measurements_lookup ON measurements(astronaut_id, metric, measured_at);
#     """)
#     return conn
# >>>>>>> origin/master
