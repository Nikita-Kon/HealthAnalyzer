from sqlalchemy import select, func

from app.database import SessionLocal
from app.models import Astronaut, DailyMeasurement, WellnessReport


def main():
    with SessionLocal() as db:

        # 1. List all astronauts
        astronauts = db.scalars(
            select(Astronaut).order_by(Astronaut.id)
        ).all()

        print("\n=== ASTRONAUTS ===")

        for astronaut in astronauts:
            print(astronaut.id, astronaut.participant_code)

        # 2. Count imported measurements
        total = db.scalar(
            select(func.count()).select_from(DailyMeasurement)
        )

        print("\nTotal daily measurements:", total)

        # 3. Get actual heart rate data for p01
        astronaut = db.scalar(
            select(Astronaut).where(
                Astronaut.participant_code == "p01"
            )
        )

        if astronaut is None:
            print("Participant p01 not found")
            return

        measurements = db.scalars(
            select(DailyMeasurement)
            .where(
                DailyMeasurement.astronaut_id == astronaut.id,
                DailyMeasurement.metric == "resting_heart_rate"
            )
            .order_by(DailyMeasurement.day)
            .limit(100)
        ).all()

        print("\n=== P01 RESTING HEART RATE ===")

        for m in measurements:
            print(
                m.day,
                m.value,
                m.unit,
                m.quality_flag
            )

        # 4. Read wellness reports
        reports = db.scalars(
            select(WellnessReport)
            .where(
                WellnessReport.astronaut_id == astronaut.id
            )
            .order_by(WellnessReport.effective_time_frame)
            .limit(10)
        ).all()

        print("\n=== P01 WELLNESS REPORTS ===")

        for r in reports:
            print(
                r.effective_time_frame,
                "Fatigue:", r.fatigue,
                "Mood:", r.mood,
                "Stress:", r.stress,
                "Sleep:", r.sleep_duration_h
            )


if __name__ == "__main__":
    main()