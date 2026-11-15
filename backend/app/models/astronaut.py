from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Astronaut(Base):
    __tablename__ = 'astronauts'

    id: Mapped[int] = mapped_column(primary_key=True)
    participant_code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    dataset_source: Mapped[str] = mapped_column(String(50), nullable=False, default='pmdata')

    daily_measurements: Mapped[list['DailyMeasurement']] = relationship(back_populates='astronaut')
    wellness_reports: Mapped[list['WellnessReport']] = relationship(back_populates='astronaut')
    sleep_scores: Mapped[list['SleepScore']] = relationship(back_populates='astronaut')
    training_sessions: Mapped[list['TrainingSession']] = relationship(back_populates='astronaut')
    injury_reports: Mapped[list['InjuryReport']] = relationship(back_populates='astronaut')
    nutrition_reports: Mapped[list['NutritionReport']] = relationship(back_populates='astronaut')
    heart_rate_samples: Mapped[list['HeartRateSample']] = relationship(back_populates='astronaut')
