# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Oracle DBA health-check report automation tool. Users upload Oracle diagnostic snapshot folders through a React frontend; the FastAPI backend extracts structured data via BeautifulSoup, stores it in PostgreSQL, and generates Word (.docx) reports on demand.

| Part | Location | Stack |
|------|----------|-------|
| Backend | `Backend/` | Python 3.13 · FastAPI · asyncpg · python-docx · BeautifulSoup |
| Frontend | `Frontend/Report_Automation/` | React 19 · TypeScript · Tailwind CSS v4 · Vite |
| Sample data | `Database Data/` | KAI, exakai, TSR snapshot folders for local testing |

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
uvicorn server:app --reload   # http://127.0.0.1:8000
```
Tables are created automatically on first startup. `Headers Template.docx` must be present in `Backend/`; it is the base template for generated reports (preserves company header/logo).

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

## Backend Architecture

| File | Purpose |
|------|---------|
| `server.py` | FastAPI app — all endpoints, upload pipeline, background extraction |
| `db.py` | asyncpg pool, table creation (`users`, `jobs`, `extractions`), CRUD helpers |
| `auth.py` | JWT + bcrypt; `get_current_user` FastAPI dependency |
| `extract_snapshot.py` | BeautifulSoup parser; `SECTION_PROCESSORS` dict maps Oracle section anchors → parser functions |
| `docx_builder.py` | python-docx report builder, called by `POST /generate` |

**Data flow:**
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

**`docx_builder.py` field routing gotcha:** `meta.clientName`/`companyName`/`reportTitle` come from `meta`, but `authorName`, `docDate`, `docVersion`, and `dataCollectionDate` are read from `report_data`, not from `meta`.

**CPU utilization gotcha:** `cpu_utils` is stored in its own JSONB column, never in the `sections` dict. `SECTION_PROCESSORS` has no `"cpu"` key. The `/generate` handler must explicitly inject a CPU section entry into `rd["sections"]` from `row["cpu_utils"]`, and set `payload["cpuData"]` for single mode. Combined mode injects `cpuData` per DB inside `dbsData[i].sections`.

**Environment variables:**

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/reportgen` | asyncpg DSN |
| `SECRET_KEY` | `change-this-secret-in-production` | JWT signing key |
| `TOKEN_EXPIRE_HOURS` | `24` | JWT lifetime |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | — | Auto-create admin on first startup |
| `TEMP_DIR` | `./temp_uploads` | Upload staging dir (auto-cleaned) |

## Frontend Architecture

**Routing:** State-driven in `App.tsx` via `page: 'reports' | 'upload' | 'trash'`. No React Router.

**Auth:** JWT stored in `localStorage` under key `ra_token`. `api/client.ts` attaches it as Bearer to every request; a 401 dispatches `ra:logout` CustomEvent which `App.tsx` catches to show the login screen.

**Key components:**

| Component | Role |
|-----------|------|
| `api/client.ts` | Typed API client — all fetch calls, Bearer token, 401 → logout |
| `App.tsx` | Root — login gate, `loadReports()`, page routing, groups state, all top-level state |
| `Upload.tsx` | Drag-drop + `webkitdirectory` folder picker, upload → polls job → progress bar |
| `ExtractedDataList.tsx` | Sortable/filterable list of stored extractions; `CombinedGenerateModal`; `GroupMenu` per card |
| `ExtractedDataPreview.tsx` | Right-panel detail + `GenerateModal` |
| `EditMapping.tsx` | 4-step wizard: source ID → field mapping → data review (table/image edit + CPU chart) → alert thresholds |
| `Sidebar.tsx` | Client/DB/group tree navigation; exports `Filter` and `Group` types |
| `TrashPage.tsx` | Soft-deleted extractions (restore/delete) |

**Groups (frontend-only):** `Group { id, name, clientName, extractionIds[] }` stored in `localStorage` under `ra_groups`. State lives in `App.tsx`. Groups appear nested inside their client in the sidebar — ungrouped DBs show in the flat list; grouped DBs appear under their group's expandable row. The "Generate Combined" button in `ExtractedDataList` appears for both `filter.kind === 'client'` and `'group'`.

**CPU chart in EditMapping:** `CpuChart` is a `forwardRef` component (recharts `LineChart`/`BarChart`) that exposes `capture(): Promise<string | null>` via `useImperativeHandle`. `handleSave` awaits `capture()` to get a PNG data URL and stores it as `chartImageData` in the section's localStorage entry. `docx_builder.py` prefers `chartImageData` over matplotlib when present.

**Combined generate with per-DB sections:** `CombinedGenerateModal` calls `getSavedSections(upload)` for each selected DB (reads `upload.sections` or `localStorage`), sends the array as `dbs_sections` in the POST body. The backend merges frontend sections by ID into `dbsData`, falling back to DB-extracted data for missing sections. This ensures `chartImageData` and all Edit Mapping edits reach the combined `.docx`.

**`SectionData` type** (in `Upload.tsx`):
```typescript
interface SectionData {
  tableColumns: string[];
  tableRows: string[][];
  screenshots?: string[];
  contentType?: 'table' | 'image' | 'table+image';
  recommendation?: string;
  cpuData?: { columns: string[]; rows: string[][] };
  chartImageData?: string;   // base64 PNG captured from frontend recharts chart
}
```

**Styling:** Tailwind v4 (`@import "tailwindcss"` in `index.css`, no config file). Accent `#5538ee` / top-bar `#0b1130` are constants in `App.tsx` passed as `accent` prop. Use inline `style` props for accent-colored elements. Font: Plus Jakarta Sans.

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

## Frontend–Backend Wiring Progress

| Feature | Status |
|---------|--------|
| H2 — Client assignment during upload + dynamic sidebar | ✅ Done (2026-05-13) |
| H1 — Generate field routing (authorName/docDate in reportData not meta) | ✅ Done (2026-05-13) |
| H3 — Data Review in EditMapping (getReport never called) | ✅ Done (2026-05-13) |
| Data Review — Create table + add images per section | ✅ Done (2026-05-13) |
| Multi-DB upload + combined generate | ✅ Done (2026-05-13) |
| M1 — Wire EditMapping sections to generate payload | ✅ Done (2026-05-14) |
| CPU chart — recharts in EditMapping + PNG export to docx | ✅ Done (2026-05-14) |
| Combined generate — per-DB frontend sections (chartImageData) | ✅ Done (2026-05-15) |
| Groups — persistent named groups for combined generate | ✅ Done (2026-05-15) |
| M2 — Flag severity UI (critical/warning badges) | ✅ Done (2026-05-15) |
| M3 — Logo upload UI in GenerateModal | ⬜ |
| M4 — Wire topbar search | ⬜ |
| L1 — Persist soft-delete to backend | ⬜ |

**CPU chart + PNG export (2026-05-14/15):**
- `Frontend/src/components/Upload.tsx`: Added `cpuData?` and `chartImageData?` to `SectionData`
- `Frontend/src/components/EditMapping.tsx`: Added `CpuChart` (recharts, `forwardRef` with `capture()` via `useImperativeHandle`); `svgToPng()` helper serializes SVG → 2× canvas PNG; `handleSave` is async — awaits `capture()` and stores `chartImageData` in localStorage; CPU section in Data Review shows `SectionDataTable` for raw data + `CpuChart` below; chart controls: Line/Bar toggle, Y min/max, series visibility pills; `SectionDataTable` collapses rows past `PREVIEW_ROWS = 10` threshold
- `Frontend/src/api/client.ts`: Added `chartImageData?` to `GenerateSection`
- `Frontend/src/components/ExtractedDataPreview.tsx`: `buildSectionsForGenerate` passes `chartImageData` through
- `Backend/server.py`: Injects CPU section into `rd["sections"]` from `cpu_utils` (single + combined mode); sets `payload["cpuData"]` in single mode; in combined mode adds `cpuData` per DB into `dbsData[i].sections`
- `Backend/docx_builder.py`: `_push_sec_content` prefers `chartImageData` over matplotlib; in combined mode adds `caption_db` title paragraph before image/chart when `inline_title=True`

**Combined generate per-DB sections (2026-05-15):**
- `Frontend/src/api/client.ts`: Added `dbsSections?: (GenerateSection[] | null)[]` to `GenerateOptions`; `generateCombined` sends `dbs_sections` in POST body
- `Frontend/src/components/ExtractedDataList.tsx`: `CombinedGenerateModal` calls `getSavedSections(upload)` per selected DB and passes `dbsSections` to `api.generateCombined`
- `Backend/server.py`: `GenerateRequest` gains `dbs_sections`; combined handler merges frontend sections by ID into `dbsData` (frontend wins per section ID, falls back to backend data for missing sections)

**Flag severity UI (2026-05-15):**
- `Frontend/src/components/Upload.tsx`: `Upload.findings` changed from `string[]` to `{ message: string; severity: 'critical' | 'warning' }[]`; upload progress panel renders severity-colored dots
- `Frontend/src/App.tsx`: `mapReport()` now preserves severity — `findings: (r.flags || []).map((f) => ({ message: f.message, severity: f.severity }))`
- `Frontend/src/components/ExtractedDataPreview.tsx`: right-panel findings show a red/amber dot + inline `critical`/`warning` badge before each message
- `Frontend/src/components/ExtractedDataList.tsx`: card preview dots are severity-colored; count badges ("N critical", "N warnings") appear below the findings rows

**Groups (2026-05-15):**
- `Frontend/src/components/Sidebar.tsx`: Exports `Group { id, name, clientName, extractionIds[] }`; groups appear nested inside their client's expanded section; each group is expandable (chevron) showing member DBs; ungrouped DBs shown in flat list; grouped DBs removed from flat list; inline create/rename/delete; "New group" button at bottom of each client's expanded section
- `Frontend/src/App.tsx`: `groups` state persisted to `localStorage('ra_groups')`; handlers: `createGroup(name, clientName)`, `deleteGroup`, `renameGroup`, `addToGroup`, `removeFromGroup`
- `Frontend/src/components/ExtractedDataList.tsx`: `GroupMenu` per card (folder icon + dropdown, filters to same-client groups only); "Generate Combined" visible for both `filter.kind === 'client'` and `'group'`

## PostgreSQL Schema

All tables are auto-created by `db._create_tables()`:

- **`users`** — `id`, `username` (unique), `password_hash`, `created_at`
- **`jobs`** — `id`, `upload_id`, `status` (queued/processing/done/failed), `progress` (0–100), `error`, `extraction_id`, timestamps
- **`extractions`** — `id`, `job_id`, `folder_name`, `client_name`, `database_name`, `instance_name`, `report_date`, `total_files`, `extracted_at`; JSONB columns: `server_info`, `database_info`, `sections`, `cpu_utils`, `flags`
