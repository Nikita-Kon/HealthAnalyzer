from datetime import datetime
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class DailyMeasurement(Base):
    """Fitbit observations at their original timestamps (day retains its time).

    Daily sources stay daily; minute-level sources retain each observation.
    """
    __tablename__ = 'daily_measurements'
    id: Mapped[int] = mapped_column(primary_key=True)
    astronaut_id: Mapped[int] = mapped_column(ForeignKey('astronauts.id'), nullable=False)
    day: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    metric: Mapped[str] = mapped_column(String(64), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(24), nullable=False)
    source_file: Mapped[str] = mapped_column(String(200), nullable=False)
    quality_flag: Mapped[str] = mapped_column(String(20), nullable=False, default='valid')
    astronaut: Mapped['Astronaut'] = relationship(back_populates='daily_measurements')
    __table_args__ = (UniqueConstraint('astronaut_id','day','metric',name='uq_daily_metric'),)


class HeartRateSample(Base):
    """High-resolution Fitbit readings, preserving timestamp, BPM and confidence."""
    __tablename__ = 'heart_rate_samples'
    id: Mapped[int] = mapped_column(primary_key=True)
    astronaut_id: Mapped[int] = mapped_column(ForeignKey('astronauts.id'), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    bpm: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    astronaut: Mapped['Astronaut'] = relationship(back_populates='heart_rate_samples')
    __table_args__ = (UniqueConstraint('astronaut_id','recorded_at',name='uq_heart_rate_sample'),)
