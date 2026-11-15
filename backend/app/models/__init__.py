"""Register every model so SQLAlchemy can resolve relationships."""

from app.models.astronaut import Astronaut
from app.models.measurements import DailyMeasurement, HeartRateSample
from app.models.reports import (
    InjuryReport,
    NutritionReport,
    SleepScore,
    TrainingSession,
    WellnessReport,
)

__all__ = [
    'Astronaut', 'DailyMeasurement', 'HeartRateSample', 'InjuryReport',
    'NutritionReport', 'SleepScore', 'TrainingSession', 'WellnessReport',
]
