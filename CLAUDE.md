# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Oracle DBA health-check report automation tool. Users upload Oracle diagnostic snapshot folders through a React frontend; the FastAPI backend extracts structured data via BeautifulSoup, stores it in PostgreSQL, and generates Word (.docx) reports on demand.

| Part | Location | Stack |
|------|----------|-------|
| Backend | `Backend/` | Python 3.13 · FastAPI · asyncpg · python-docx · BeautifulSoup |
| Frontend | `Frontend/Report_Automation/` | React 19 · TypeScript · Tailwind CSS v4 · Vite |
| Sample data | `Database Data/` | KAI, exakai, TSR snapshot folders for local testing |

Each subdirectory has its own `CLAUDE.md` with deeper detail. This file covers cross-cutting concerns.

## Running Locally

**Prerequisites:** Docker Desktop, Anaconda (`Automation` conda env, Python 3.13), Node 20+.

**1 — PostgreSQL (Docker):**
```powershell
# First time
docker run -d --name reportgen-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=reportgen -p 5432:5432 postgres:16

# Subsequent starts
docker start reportgen-pg
```

**2 — Backend** (run from `Backend/`):
```powershell
conda activate Automation
pip install -r requirements.txt   # first time or after dependency changes
uvicorn server:app --reload        # http://127.0.0.1:8000
```

Tables are created automatically on first startup. `Headers Template.docx` must be present in `Backend/`; it is the base template for generated reports (preserves company header/logo). If missing, a blank document is used as fallback.

**3 — Frontend** (run from `Frontend/Report_Automation/`):
```bash
npm install
npm run dev      # Vite dev server → http://localhost:5173
npm run build    # tsc check + Vite build → dist/
npm run lint     # ESLint
npm run preview  # serve dist/ locally
```

Vite proxies `/auth`, `/upload`, `/jobs`, `/reports`, `/generate`, `/health` to `http://localhost:8000` in dev.

**First login:** Register via the UI on first startup (no users exist), or set `ADMIN_USERNAME` + `ADMIN_PASSWORD` env vars before starting the server.

## Data Flow

```
POST /upload (multipart files)
  → temp/{uuid}/ on disk + job row in PostgreSQL
  → BackgroundTask: asyncio.to_thread(_extract_folder_sync)
      BeautifulSoup parses dba_snapshot_*.html → SECTION_PROCESSORS
      _extract_txt_sections() handles companion .txt files (merged after HTML, HTML wins)
      _analyze() → flags (tablespace/mountpoint >85% warn / >95% critical,
                           RMAN non-COMPLETED → critical, sessions >90% warn / >95% critical)
  → save_extraction() → INSERT INTO extractions (JSONB columns)
  → temp/{uuid}/ deleted, job.status = "done"
Frontend polls GET /jobs/{job_id} every 2 s
  → user clicks Generate → POST /generate → docx_builder.build_report() → .docx download
```

**`/generate` modes:** `single` (one DB, one doc) · `combined` (multiple DBs, one doc) · `separate` (multiple DBs, one doc each). When `extraction_id` is supplied, the server auto-populates missing fields from the stored extraction.

## Critical Gotchas

**`docx_builder.py` field routing:** `meta.clientName`/`companyName`/`reportTitle` come from `meta`, but `authorName`, `docDate`, `docVersion`, and `dataCollectionDate` are read from `report_data`, not from `meta`.

**CPU utilization column:** `cpu_utils` is stored in its own JSONB column, never in the `sections` dict. `SECTION_PROCESSORS` has no `"cpu"` key. The `/generate` handler must explicitly inject a CPU section entry into `rd["sections"]` from `row["cpu_utils"]`, and set `payload["cpuData"]` for single mode. Combined mode injects `cpuData` per DB inside `dbsData[i].sections`.

**Combined generate — per-DB sections:** `CombinedGenerateModal` calls `getSavedSections(upload)` for each selected DB and sends the array as `dbs_sections` in the POST body. The backend merges frontend sections by ID into `dbsData` (frontend wins per section ID, falls back to DB-extracted data for missing sections).

## PostgreSQL Schema

All tables are auto-created by `db._create_tables()`:

- **`users`** — `id`, `username` (unique), `password_hash`, `created_at`
- **`jobs`** — `id`, `upload_id`, `status` (queued/processing/done/failed), `progress` (0–100), `error`, `extraction_id`, timestamps
- **`extractions`** — `id`, `job_id`, `folder_name`, `client_name`, `database_name`, `instance_name`, `report_date`, `total_files`, `extracted_at`; JSONB columns: `server_info`, `database_info`, `sections`, `cpu_utils`, `flags`

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/reportgen` | asyncpg DSN |
| `SECRET_KEY` | `change-this-secret-in-production` | JWT signing key |
| `TOKEN_EXPIRE_HOURS` | `24` | JWT lifetime |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | — | Auto-create admin on first startup |
| `TEMP_DIR` | `./temp_uploads` | Upload staging dir (auto-cleaned) |

## Input Folder Structure

```
exakai04db01/               ← parent folder (uploaded as a whole)
└── MBSHIP1/                ← one subfolder per database
    ├── dba_snapshot_*.html ← preferred (full snapshot)
    ├── lite_snapshot_*.html← fallback
    ├── mountpoint.txt / total_mountpoint.txt
    ├── hostnamectl.txt, etc-host.txt
    ├── cpu-count-linux.txt / cpu_count.txt
    ├── memtotal-linux.txt / memtotal-linux-mb.txt
    ├── size_tablespace.txt, 2_rman.txt, session_count.txt
    ├── redolog_switch.txt, cpu_utils.txt, 1_status.txt
    └── asm_usage.txt
```

HTML sections take priority over `.txt` fallbacks. `dba_snapshot` preferred over `lite_snapshot`.

## Pending Features

| ID | Feature |
|----|---------|
| M3 | Logo upload UI in GenerateModal |
| M4 | Wire topbar search |
| L1 | Persist soft-delete to backend (TrashPage currently frontend-only) |
