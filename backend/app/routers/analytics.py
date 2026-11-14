from datetime import date
from fastapi import APIRouter, Query

from app.database import get_connection
from app.services.analytics import analyze_health

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"]
)


@router.get("/astronauts/{participant_id}/analytics")
def get_analytics(participant_id: str, as_of: date = Query(...)):
    with get_connection() as conn:
        astronaut = conn.execute("SELECT id FROM astronauts WHERE participant_code=?", (participant_id.lower(),)).fetchone()
        if astronaut is None:
            from fastapi import HTTPException
            raise HTTPException(404, "Participant not found")
        rows = conn.execute("SELECT metric,value,unit,measured_at FROM measurements WHERE astronaut_id=? AND measured_at<=? ORDER BY measured_at", (astronaut["id"], as_of.isoformat())).fetchall()
    return {"participant_id": participant_id.lower(), **analyze_health([dict(row) for row in rows], as_of)}
