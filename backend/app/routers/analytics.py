from datetime import date

from fastapi import APIRouter

from app.routers.astronauts import findAstronautOr404
from app.services import analytics_service

router = APIRouter(tags=["Analytics"])


@router.get("/astronauts/{astronaut_id}/analytics")
def get_analytics(astronaut_id: str, as_of: date):
    astronaut = findAstronautOr404(astronaut_id)
    return {
        "participant_id": astronaut["participant_code"],
        **analytics_service.getAnalytics(astronaut["id"], as_of),
    }
