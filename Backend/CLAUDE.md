# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Oracle DBA health-check report automation tool. Users upload Oracle diagnostic snapshot files from their browser; the server extracts structured data, stores it in PostgreSQL, and generates Word (.docx) reports on demand.

**Two-part system:**
| Part | Location | Stack |
|------|----------|-------|
| Backend | `Backend/` | FastAPI + asyncpg (PostgreSQL) + python-jose (JWT) |
| Frontend | `Frontend/Report_Automation/` | React 19 + TypeScript + Tailwind CSS 4 + Vite |

Legacy single-file frontend (`Report-Automation.html`) still exists but is superseded by the Vite frontend.

## Running Locally

**Prerequisites:**
- Anaconda with a conda env named `Automation` (Python 3.13)
- Node 20+
- Docker (for PostgreSQL)

**1. Start PostgreSQL:**
```powershell
docker run -d --name reportgen-pg `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=reportgen `
  -p 5432:5432 postgres:16

# On subsequent startups (container already exists):
docker start reportgen-pg
```

**2. Activate the conda env and start the backend:**
```powershell
conda activate Automation
uvicorn server:app --reload
# Runs on http://127.0.0.1:8000
# Tables are created automatically on first startup
```
```powershell
# Install/update dependencies
pip install -r requirements.txt
```

**3. Start the frontend dev server:**
```bash
cd Frontend/Report_Automation
npm install
npm run dev    # Vite dev server on http://localhost:5173
npm run build  # tsc + vite build → dist/ (served by FastAPI in production)
npm run lint   # eslint
```

**First login:** On first startup with no users, register via the UI (`/auth/register`) or set env vars `ADMIN_USERNAME` + `ADMIN_PASSWORD` before starting the server.

**`Headers Template.docx`** must be present in the working directory when the server starts. `docx_builder.py` opens it as the base document (preserving the Sisindokom header and logo). If missing, a blank `Document()` is used as fallback and the header will be empty.

## Backend Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/reportgen` | asyncpg DSN |
| `SECRET_KEY` | `change-this-secret-in-production` | JWT signing key |
| `TOKEN_EXPIRE_HOURS` | `24` | JWT lifetime |
| `ADMIN_USERNAME` | — | Auto-creates admin user on first startup if set |
| `ADMIN_PASSWORD` | — | Required with `ADMIN_USERNAME` |
| `TEMP_DIR` | `./temp_uploads` | Temporary upload directory (auto-cleaned after extraction) |

## Backend Module Structure

| File | Purpose |
|------|---------|
| `server.py` | FastAPI app — all endpoints, upload pipeline, background extraction |
| `db.py` | asyncpg pool, table creation, CRUD helpers |
| `auth.py` | JWT creation/verification, bcrypt hashing, `get_current_user` FastAPI dependency |
| `extract_snapshot.py` | BeautifulSoup extraction library; `SECTION_PROCESSORS` dict reused by server |
| `docx_builder.py` | python-docx report builder, called by `POST /generate` |

## API Endpoints

All endpoints except `/health` and `/auth/*` require `Authorization: Bearer <token>`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Server + DB status |
| POST | `/auth/login` | `{ username, password }` → `{ access_token }` (JWT) |
| POST | `/auth/register` | First-time setup only (rejected if any user exists) |
| POST | `/upload` | Multipart `files[]` → saves to `temp/{uuid}/` → starts background extraction → `{ upload_id, job_id }` |
| GET | `/jobs/{job_id}` | Poll: `{ status, progress, extraction_id }` |
| GET | `/reports` | List extractions. Query: `client`, `database`, `from_date`, `to_date`, `limit`, `offset` |
| GET | `/reports/{id}` | Full extraction record including `sections`, `server_info`, `database_info`, `cpu_utils`, `flags` |
| DELETE | `/reports/{id}` | Delete a stored extraction |
| POST | `/generate` | See `GenerateRequest` below → returns `.docx` binary |

## Data Flow

```
Browser drag-drops Oracle snapshot folder
    ↓ POST /upload (multipart)
temp/{uuid}/ (disk) + job row created in PostgreSQL
    ↓ BackgroundTask: asyncio.to_thread(_extract_folder_sync)
SECTION_PROCESSORS (BeautifulSoup parses dba_snapshot_*.html)
+ _extract_txt_sections (companion .txt files)
    ↓ _analyze() → flags list (thresholds: tablespace/mountpoint >85% warn/>95% critical,
                                 RMAN non-COMPLETED → critical, sessions >90% warn/>95% critical)
save_extraction() → INSERT INTO extractions (JSONB columns)
temp/{uuid}/ deleted
    ↓ job status = "done", extraction_id set
Frontend polls GET /jobs/{job_id} every 2s → updates progress bar
    ↓ user clicks "Generate report"
POST /generate { extraction_id, mode, meta, reportData, ... }
    → load from DB → merge with payload defaults → docx_builder.build_report() → .docx download
```

## Report Generation (`/generate`)

The `GenerateRequest` model supports three modes:

| `mode` | Behaviour |
|--------|-----------|
| `single` (default) | One DB per document, uses `db` + `serverInfo` + `databaseInfo` |
| `separate` | Same as single but intended for batch multi-DB generation from the frontend |
| `combined` | Multiple DBs in one document; uses `dbs` list + `dbsData` list |

When `extraction_id` is provided, the server auto-populates `serverInfo`, `databaseInfo`, `reportData`, `meta`, and `db` from the stored extraction if those keys are absent in the request payload.

**Key field routing in `docx_builder.py`:** The builder reads `meta.clientName`/`meta.companyName`/`meta.reportTitle` from `meta`, but reads `authorName`, `docDate`, `docVersion`, and `dataCollectionDate` from `report_data` (not from `meta`). When the frontend calls `/generate` directly (without relying on server defaults), it should populate those fields in `reportData`, not only in `meta`.

## PostgreSQL Schema

Tables are created automatically in `db._create_tables()`:

- **`users`** — `id`, `username` (unique), `password_hash`, `created_at`
- **`jobs`** — `id`, `upload_id`, `status` (queued/processing/done/failed), `progress` (0–100), `error`, `extraction_id`, timestamps
- **`extractions`** — `id`, `job_id`, `folder_name`, `client_name`, `database_name`, `instance_name`, `report_date`, `total_files`, `extracted_at`, plus JSONB columns: `server_info`, `database_info`, `sections`, `cpu_utils`, `flags`

## Frontend Architecture

`Frontend/Report_Automation/src/`:

| File/Dir | Purpose |
|----------|---------|
| `api/client.ts` | Typed API client — all fetch calls, Bearer token management, 401 → `ra:logout` event |
| `App.tsx` | Root — login gate, `loadReports()`, page routing, trash state |
| `components/Upload.tsx` | Drag-drop zone, `webkitdirectory` folder picker, upload → poll → progress bar |
| `components/ExtractedDataList.tsx` | Sortable/filterable list of stored extractions |
| `components/ExtractedDataPreview.tsx` | Right-panel detail view + `GenerateModal` (calls `api.generateReport`) |
| `components/EditMapping.tsx` | Section mapping editor modal |
| `components/Sidebar.tsx` | Client/filter nav |
| `components/TrashPage.tsx` | Soft-deleted extractions |

**Auth flow:** JWT stored in `localStorage` under key `ra_token`. `apiFetch()` in `client.ts` attaches it to every request; a 401 dispatches `ra:logout` CustomEvent which `App.tsx` listens to and clears the token, showing the login page.

**Upload flow:** `POST /upload` multipart → job ID returned → `setInterval(2000ms)` polls `GET /jobs/{job_id}` → on `status === 'done'`, calls `onExtractionComplete()` to reload the reports list.

**Generate flow:** `GenerateModal` collects `clientName`, `period`, `authorName` → `api.generateReport({ extraction_id, ... })` → `POST /generate` → response blob → `URL.createObjectURL` + anchor click → browser downloads `.docx`.

**Vite proxy (dev only):** All `/auth`, `/upload`, `/jobs`, `/reports`, `/generate`, `/health` requests are proxied to `http://localhost:8000`.

## extract_snapshot.py

Standalone CLI and import library. `server.py` imports `SECTION_PROCESSORS` and `find_section_table` directly.

```bash
python extract_snapshot.py path/to/dba_snapshot_*.html   # single file
python extract_snapshot.py path/to/folder/               # whole folder
```

`SECTION_PROCESSORS` maps section id → parser function. Each calls `find_section_table(soup, anchor_name)` → `{ tableColumns, tableRows }`.

`_extract_txt_sections()` in `server.py` handles the companion `.txt` files (mountpoint, dataguard role from `1_status.txt`, cpu_utils). Its results are merged into `sections` after HTML extraction, with HTML data taking priority. The `_cpuUtils` key is popped out separately and stored in the `cpu_utils` JSONB column.

## Input Folder Structure

```
exakai04db01/               ← parent folder (uploaded as a whole)
└── MBSHIP1/                ← single DB subfolder
    ├── dba_snapshot_*.html ← required (full snapshot); preferred over lite_snapshot
    ├── lite_snapshot_*.html
    ├── mountpoint.txt / total_mountpoint.txt
    ├── hostnamectl.txt
    ├── cpu-count-linux.txt / cpu_count.txt
    ├── memtotal-linux.txt / memtotal-linux-mb.txt
    ├── etc-host.txt
    ├── size_tablespace.txt, 2_rman.txt, session_count.txt
    ├── redolog_switch.txt, cpu_utils.txt, 1_status.txt
    └── asm_usage.txt
```

HTML sections take priority over `.txt` fallbacks. `dba_snapshot` preferred over `lite_snapshot`.
