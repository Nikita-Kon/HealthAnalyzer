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
