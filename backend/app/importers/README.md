# PMData importer

Run from `backend`:

```powershell
.\.venv\Scripts\python.exe -m app.importers.pmdata
.\.venv\Scripts\python.exe -m app.importers.pmdata --dry-run
# Import just the requested participant heart-rate file:
.\.venv\Scripts\python.exe -m app.importers.pmdata app/data/pmdata/p01/fitbit/heart_rate.json
.\.venv\Scripts\python.exe -m app.importers.pmdata "C:\datasets\pmdata"
```

The default source is `backend/app/data/pmdata`. The destination is configured
by `app.database`: `../data/health.db` unless `DATABASE_URL` overrides it.
Missing tables are created; existing tables are not dropped. `create_all` does
not migrate an old DATE column to DATETIME. The database schema must match the
current models. For the existing heart_rate_samples table, the importer adds a
missing nullable confidence column without dropping rows. Existing samples have
null confidence. A dry run rolls back records, but may create tables/add this column.

Participant folder names become Astronaut participant codes and initial display
names. CSVs are read using pandas. Report mappings:

| Source | Model |
| --- | --- |
| `fitbit/sleep_score.csv` | SleepScore |
| `fitbit/heart_rate.json` | HeartRateSample: dateTime, value.bpm, value.confidence |
| `pmsys/wellness.csv` | WellnessReport |
| `pmsys/srpe.csv` | TrainingSession |
| `pmsys/injury.csv` | InjuryReport (original columns as JSON) |
| `googledocs/reporting.csv` | NutritionReport (original columns as JSON) |

Fitbit measurement filenames in `DAILY_METRICS` support both JSON and CSV.
Despite the legacy name, `DailyMeasurement.day` stores the **full observation
datetime**. Minute-level steps, distance, and calorie readings are imported
individually. Daily activity minutes and resting heart rate retain their source
timestamps. No daily summation or midnight normalization is performed.

CSV measurements require a `dateTime`, `timestamp`, `date`, or `day` column,
and a `value` column (or a column named after the metric). Resting heart rate
accepts scalar CSV values and nested JSON `value.value` values. If both CSV and
JSON provide the same participant/metric/timestamp, the first imported row wins.

The configured units are steps, cm for distance, kcal, min, and bpm. Values are
not rescaled. Confirm source units before adding a different export format.
Timezone offsets are removed while retaining source wall-clock time, matching
the current timezone-naive DateTime models. Missing values in raw report JSON
become null; other missing/invalid required values fail the participant import.

Exact duplicate source timestamps retain the last value and have
`quality_flag=duplicate_source`. Zero resting-heart-rate readings are retained
with `quality_flag=invalid_value`. Separate times on the same date remain separate
records. Existing rows are skipped by their unique key, including full datetime
for measurements. Reports using `source_row` require stable CSV row order.
Changes to already imported values are not applied automatically. Old daily
aggregates are not automatically removed; do not mix them with raw readings.

Inserts use batches of 5,000 rows and one transaction per participant. A failure
rolls back the current participant; earlier participants stay committed. Minute
measurements are much larger than daily aggregates and take more disk space.

Heart-rate samples preserve seconds and are stored separately from resting heart
rate in `heart_rate_samples`, with uniqueness on astronaut_id + recorded_at.
BPM must be a positive integer; confidence accepts 0, 1, 2, 3, or null when
absent. Repeated source timestamps retain the last reading; reruns skip existing
timestamps. The single-file command imports only that participant's heart-rate
samples. The default full-directory command now includes heart-rate files for
all participants, which can require substantial disk space. Files are loaded
one at a time with pandas and inserted in batches of 5,000 samples.

Images, the overview workbook, `exercise.json`, `sleep.json`, and
`time_in_heart_rate_zones.json` are skipped.
