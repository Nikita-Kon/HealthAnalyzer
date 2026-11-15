"""Add, show, and delete sample records in existing tables.

Run from backend: python -m app.test_database
"""

from datetime import date
from uuid import uuid4

from sqlalchemy import delete, select

from app.database import Base, SessionLocal, engine
from app.models import Astronaut, DailyMeasurement


def main():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        astronauts = []
        for index, name in enumerate(['Alice', 'Bob', 'Charlie']):
            astronaut = Astronaut(
                participant_code=uuid4().hex[:10],
                display_name=f'Test {name}',
                dataset_source='test',
            )
            astronaut.daily_measurements = [
                DailyMeasurement(
                    day=date.today(), metric='steps', value=5000 + index * 1000,
                    unit='steps', source_file='test_database.py',
                ),
                DailyMeasurement(
                    day=date.today(), metric='resting_heart_rate', value=60 + index * 5,
                    unit='bpm', source_file='test_database.py',
                ),
            ]
            astronauts.append(astronaut)

        db.add_all(astronauts)
        db.flush()
        astronaut_ids = [astronaut.id for astronaut in astronauts]
        db.commit()

        try:
            print('Created astronauts and measurements:')
            for astronaut in db.scalars(
                select(Astronaut).where(Astronaut.id.in_(astronaut_ids)).order_by(Astronaut.id)
            ):
                print(f'{astronaut.id}: {astronaut.display_name} ({astronaut.participant_code})')
                for measurement in astronaut.daily_measurements:
                    print(f'  {measurement.day}: {measurement.metric} = {measurement.value} {measurement.unit}')
        finally:
            db.rollback()
            # Delete children first because these relationships have no delete cascade.
            db.execute(delete(DailyMeasurement).where(DailyMeasurement.astronaut_id.in_(astronaut_ids)))
            db.execute(delete(Astronaut).where(Astronaut.id.in_(astronaut_ids)))
            db.commit()

        remaining_astronaut = db.scalar(select(Astronaut.id).where(Astronaut.id.in_(astronaut_ids)))
        remaining_measurement = db.scalar(
            select(DailyMeasurement.id).where(DailyMeasurement.astronaut_id.in_(astronaut_ids))
        )
        if remaining_astronaut is not None or remaining_measurement is not None:
            raise RuntimeError('Sample records were not fully deleted')
        print('Deleted all sample astronauts and measurements.')


if __name__ == '__main__':
    main()
