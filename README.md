# Report Automation

Oracle DBA health-check report automation tool. Upload Oracle diagnostic snapshot folders through the web UI; the backend extracts structured data and generates Word (`.docx`) reports on demand.

## Features

- Upload Oracle snapshot folders (`dba_snapshot_*.html` or `.txt` companions)
- Automatic extraction: server info, tablespace, RMAN, sessions, mountpoints, CPU utilization
- Severity flags — critical/warning badges for thresholds (tablespace >85%/95%, RMAN failures, sessions >90%/95%)
- Edit Mapping wizard — review and edit extracted data, add screenshots, customize CPU charts
- Generate reports: single DB, combined multi-DB, or separate docs per DB
- Groups — organize DBs into named groups for combined generation
- Soft delete with trash/restore

## Stack

| Part | Tech |
|------|------|
| Backend | Python 3.13 · FastAPI · asyncpg · python-docx · BeautifulSoup |
| Frontend | React 19 · TypeScript · Tailwind CSS v4 · Vite |
| Database | PostgreSQL 16 (Docker) |

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Anaconda](https://www.anaconda.com/) with a `Python 3.13` conda env named `Automation`
- Node.js 20+

## Getting Started

**1 — PostgreSQL**

```powershell
# First time
docker run -d --name reportgen-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=reportgen -p 5432:5432 postgres:16

# Subsequent starts
docker start reportgen-pg
```

**2 — Backend**

```powershell
conda activate Automation
cd Backend
pip install -r requirements.txt
uvicorn server:app --reload
# → http://localhost:8000
```

> `Headers Template.docx` must be present in `Backend/` — it is the base template that preserves the company header/logo in generated reports.

**3 — Frontend**

```powershell
cd Frontend/Report_Automation
npm install
npm run dev
# → http://localhost:5173
```

**4 — First login**

On first startup with an empty database, a **Register** form appears. Create your account — after that, registration is disabled and only login is shown.

## Environment Variables (Backend)

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/reportgen` | asyncpg DSN |
| `SECRET_KEY` | `change-this-secret-in-production` | JWT signing key |
| `TOKEN_EXPIRE_HOURS` | `24` | JWT lifetime |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | — | Auto-create admin on first startup |
| `TEMP_DIR` | `./temp_uploads` | Upload staging directory |

## Input Folder Structure

```
exakai04db01/               ← parent folder (upload this whole folder)
└── MBSHIP1/                ← one subfolder per database instance
    ├── dba_snapshot_*.html ← full snapshot (preferred)
    ├── lite_snapshot_*.html← fallback
    ├── cpu_utils.txt
    ├── size_tablespace.txt
    ├── 2_rman.txt
    ├── session_count.txt
    ├── mountpoint.txt / total_mountpoint.txt
    └── hostnamectl.txt, etc-host.txt, ...
```

A sample snapshot is included under `Database Data/KAI/exakai04db01/MBSHIP1/`.

## Generating Reports

1. Upload a snapshot folder from the **Upload** page
2. Wait for extraction to complete (progress bar)
3. Click a record → **Edit Mapping** to review/edit data and CPU charts
4. Click **Generate Report** → fill in metadata → download `.docx`

> Open the generated file in **Microsoft Word** and press `Ctrl+A → F9` to populate the Table of Contents.

## Project Structure

```
├── Backend/
│   ├── server.py           # FastAPI app — all endpoints
│   ├── db.py               # asyncpg pool + CRUD
│   ├── auth.py             # JWT + bcrypt
│   ├── extract_snapshot.py # BeautifulSoup parser
│   ├── docx_builder.py     # Word report builder
│   └── requirements.txt
├── Frontend/Report_Automation/
│   └── src/
│       ├── App.tsx
│       ├── api/client.ts
│       └── components/     # Upload, EditMapping, Sidebar, ...
├── Database Data/
│   └── KAI/exakai04db01/MBSHIP1/   # sample snapshot
└── HOW-TO-RUN.md
```
