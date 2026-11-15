from fastapi import APIRouter, HTTPException

from app.services import dbQuery

router = APIRouter(
    prefix="/astronauts",
    tags=["Astronauts"]
)


def _item(astronaut):
    return {
        "id": astronaut["participant_code"],
        "name": astronaut["display_name"],
        "source": astronaut["dataset_source"],
    }


def findAstronautOr404(key):
    astronaut = dbQuery.findAstronaut(key)
    if astronaut is None:
        raise HTTPException(404, f"Participant {key} not found")
    return astronaut


@router.get("")
def get_astronauts():
    return {"data": [_item(astronaut) for astronaut in dbQuery.getAstronauts()]}


@router.get("/{astronaut_id}")
def get_astronaut(astronaut_id: str):
    astronaut = findAstronautOr404(astronaut_id)
    period = dbQuery.getRecordDateRange(astronaut["id"]) or {}
    return {
        **_item(astronaut),
        "first_record_date": period.get("start"),
        "last_record_date": period.get("end"),
    }
