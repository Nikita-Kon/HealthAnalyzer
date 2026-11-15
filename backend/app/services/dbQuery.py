from sqlalchemy import select, func

from app.database import SessionLocal
from app.models import Astronaut, DailyMeasurement, WellnessReport

def getAstronauts():
    with SessionLocal() as db:
        astronauts = db.scalars(
            select(Astronaut).order_by(Astronaut.id)
        ).all()

    result = [
        {
            "id": astronaut.id,
            "participant_code": astronaut.participant_code,
            "display_name": astronaut.display_name
        }
        for astronaut in astronauts
    ]

    return result

def getAstronautById(id):
    with SessionLocal() as db:
        astronaut = db.scalars(
            select(Astronaut).where(Astronaut.id == id)
        ).first()

        if astronaut is None:
            return None

        result = {
            "id": astronaut.id,
            "participant_code": astronaut.participant_code,
            "display_name": astronaut.display_name
        }
        return result