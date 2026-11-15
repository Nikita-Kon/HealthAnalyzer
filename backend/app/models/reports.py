from datetime import datetime
from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class WellnessReport(Base):
    """pmsys/wellness.csv: source contains one report timestamp and 8 fields."""
    __tablename__ = 'wellness_reports'
    id: Mapped[int] = mapped_column(primary_key=True)
    astronaut_id: Mapped[int] = mapped_column(ForeignKey('astronauts.id'), nullable=False)
    effective_time_frame: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    fatigue: Mapped[int | None] = mapped_column(Integer)
    mood: Mapped[int | None] = mapped_column(Integer)
    readiness: Mapped[int | None] = mapped_column(Integer)
    sleep_duration_h: Mapped[float | None] = mapped_column(Float)
    sleep_quality: Mapped[int | None] = mapped_column(Integer)
    soreness: Mapped[int | None] = mapped_column(Integer)
    soreness_area: Mapped[str | None] = mapped_column(String(500))
    stress: Mapped[int | None] = mapped_column(Integer)
    astronaut: Mapped['Astronaut'] = relationship(back_populates='wellness_reports')
    __table_args__ = (UniqueConstraint('astronaut_id','effective_time_frame',name='uq_wellness_report'),)


class SleepScore(Base):
    """fitbit/sleep_score.csv: all nine confirmed source columns preserved."""
    __tablename__ = 'sleep_scores'
    id: Mapped[int] = mapped_column(primary_key=True)
    astronaut_id: Mapped[int] = mapped_column(ForeignKey('astronauts.id'), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    sleep_log_entry_id: Mapped[int] = mapped_column(Integer, nullable=False)
    overall_score: Mapped[int | None] = mapped_column(Integer)
    composition_score: Mapped[int | None] = mapped_column(Integer)
    revitalization_score: Mapped[int | None] = mapped_column(Integer)
    duration_score: Mapped[int | None] = mapped_column(Integer)
    deep_sleep_in_minutes: Mapped[int | None] = mapped_column(Integer)
    resting_heart_rate: Mapped[int | None] = mapped_column(Integer)
    restlessness: Mapped[float | None] = mapped_column(Float)
    astronaut: Mapped['Astronaut'] = relationship(back_populates='sleep_scores')
    __table_args__ = (UniqueConstraint('astronaut_id','sleep_log_entry_id',name='uq_sleep_log'),)


class TrainingSession(Base):
    """pmsys/srpe.csv: one row per training report."""
    __tablename__ = 'training_sessions'
    id: Mapped[int] = mapped_column(primary_key=True)
    astronaut_id: Mapped[int] = mapped_column(ForeignKey('astronauts.id'), nullable=False)
    source_row: Mapped[int] = mapped_column(Integer, nullable=False)
    end_date_time: Mapped[datetime | None] = mapped_column(DateTime)
    activity_names: Mapped[str | None] = mapped_column(String(500))
    perceived_exertion: Mapped[float | None] = mapped_column(Float)
    duration_min: Mapped[float | None] = mapped_column(Float)
    astronaut: Mapped['Astronaut'] = relationship(back_populates='training_sessions')
    __table_args__ = (UniqueConstraint('astronaut_id','source_row',name='uq_srpe_source_row'),)


class InjuryReport(Base):
    """pmsys/injury.csv: preserve raw columns until actual CSV header is inspected."""
    __tablename__ = 'injury_reports'
    id: Mapped[int] = mapped_column(primary_key=True)
    astronaut_id: Mapped[int] = mapped_column(ForeignKey('astronauts.id'), nullable=False)
    source_row: Mapped[int] = mapped_column(Integer, nullable=False)
    raw_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    astronaut: Mapped['Astronaut'] = relationship(back_populates='injury_reports')
    __table_args__ = (UniqueConstraint('astronaut_id','source_row',name='uq_injury_source_row'),)


class NutritionReport(Base):
    """googledocs/reporting.csv: preserve source columns until actual CSV header is inspected."""
    __tablename__ = 'nutrition_reports'
    id: Mapped[int] = mapped_column(primary_key=True)
    astronaut_id: Mapped[int] = mapped_column(ForeignKey('astronauts.id'), nullable=False)
    source_row: Mapped[int] = mapped_column(Integer, nullable=False)
    raw_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    astronaut: Mapped['Astronaut'] = relationship(back_populates='nutrition_reports')
    __table_args__ = (UniqueConstraint('astronaut_id','source_row',name='uq_nutrition_source_row'),)
