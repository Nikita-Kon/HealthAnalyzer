from fastapi import APIRouter
from sqlalchemy import select, func

from app.database import SessionLocal
from app.models import Astronaut, DailyMeasurement, WellnessReport
from app.services import dbQuery

router = APIRouter(
    prefix="/astronauts",
    tags=["Astronauts"]
)


@router.get("/")
def get_astronauts():
    return dbQuery.getAstronauts()


@router.get("/{astronaut_id}")
def get_astronaut(astronaut_id: int):
    return dbQuery.getAstronautById(astronaut_id)