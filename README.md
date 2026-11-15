# HealthAnalyzer — Local Setup

Backend: FastAPI + SQLAlchemy (SQLite) in `backend/`. Dashboard: React + Vite in `frontend/`.

> **Run every backend command from the `backend` folder** (the one containing `requirements.txt`).

## 1. Python 3.10+

The code uses `X | None` type syntax, so Python **3.10 or newer** is required (3.9 will not start).

**Windows (CMD):**
```cmd
py -3.10 --version
```

**Linux / macOS:**
```bash
python3.10 --version
```

## 2. Virtual environment and dependencies

```bash
cd backend
```

**Windows (CMD):**
```cmd
py -3.10 -m venv .venv
.venv\Scripts\activate.bat
```

**Linux / macOS:**
```bash
python3.10 -m venv .venv
source .venv/bin/activate
```

Your terminal should now show `(.venv)`. Then:

```bash
python -m pip install -r requirements.txt
```

Next time, just `cd backend` and activate `.venv` again. `deactivate` leaves it.

## 3. Create the database

The database is a SQLite file at `backend/app/data/health.db`. It is **not** in git (`*.db` and `data` are ignored), so every developer builds it locally from the PMData dataset.

### 3.1 Download PMData

Download the PMData dataset (https://datasets.simula.no/pmdata/) and unpack it so the participant folders sit directly in `backend/app/data/pmdata`:

```
backend/app/data/pmdata/
├── p01/
│   ├── fitbit/      (steps.json, resting_heart_rate.json, heart_rate.json, sleep_score.csv, ...)
│   ├── pmsys/       (wellness.csv, srpe.csv, injury.csv)
│   └── googledocs/  (reporting.csv)
├── p02/
└── ...
```

### 3.2 Run the importer

From `backend` with `.venv` active:

```bash
# Check that files are found and parsed, without writing anything
python -m app.importers.pmdata --dry-run

# Import everything into backend/app/data/health.db
python -m app.importers.pmdata
```

Useful variants:

```bash
# Dataset stored somewhere else
python -m app.importers.pmdata /path/to/pmdata

# Only one participant's high-frequency heart rate
python -m app.importers.pmdata app/data/pmdata/p01/fitbit/heart_rate.json
```

- The importer creates missing tables, and running it again is safe: rows that already exist are skipped.
- The full import, which includes minute-level steps and `heart_rate.json` for every participant, takes a while and needs several GB of disk space.
- To start over, delete `backend/app/data/health.db` and run the import again.
- To use a different database, set `DATABASE_URL`, e.g. `DATABASE_URL=sqlite:////abs/path/other.db`.

Details on what gets imported, units and data quality flags: [`backend/app/importers/README.md`](backend/app/importers/README.md).

### 3.3 Check the data

```bash
python -m app.tests.test_read_db
```

It prints the astronauts and the number of imported measurements.

## 4. Run the API

```bash
uvicorn app.main:app --reload --port 8000
```

- Health check: http://localhost:8000/api/v1/health
- Interactive docs: http://localhost:8000/docs

If the database is empty the API still starts: `/api/v1/astronauts` returns an empty list until you run the import.

## 5. Dashboard

```bash
cd frontend
npm install
npm run dev        # http://localhost:5000, proxies /api to FastAPI on :8000
npm run build      # production build in frontend/dist
```

- `npm run dev` uses the real API by default, so start `uvicorn` (step 4) first.
- **macOS:** port 5000 is taken by AirPlay Receiver ("Port 5000 is already in use"). Either run `npm run dev -- --port 5173`, or turn off System Settings → General → AirDrop & Handoff → AirPlay Receiver.
- To work on the UI without a backend, create `frontend/.env` with `VITE_API_URL=mock`. See `frontend/.env.example`.
- Once `frontend/dist` exists, FastAPI also serves the dashboard at http://localhost:8000/ and it uses the API on the same domain.
- Live simulation (`/api/v1/simulation`) needs at least four days of imported data, including `heart_rate.json` samples.

More frontend details: [`frontend/README.md`](frontend/README.md).

## 6. Tests

```bash
cd backend
python -m pip install -r requirements-dev.txt
python -m pytest
```
