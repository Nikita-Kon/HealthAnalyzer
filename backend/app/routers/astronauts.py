from fastapi import APIRouter

router = APIRouter(
    prefix="/astronauts",
    tags=["Astronauts"]
)


@router.get("/")
def get_astronauts():
    return [
        {"id": 1, "name": "Demo Astronaut 01"},
        {"id": 2, "name": "Demo Astronaut 02"}
    ]


@router.get("/{astronaut_id}")
def get_astronaut(astronaut_id: int):
    return {
        "id": astronaut_id,
        "name": f"Demo Astronaut {astronaut_id}"
    }