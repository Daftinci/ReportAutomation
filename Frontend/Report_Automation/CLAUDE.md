# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start Vite dev server (HMR)
npm run build     # TypeScript check + Vite production build
npm run lint      # ESLint across all TS/TSX files
npm run preview   # serve the production build locally
```

No test suite is configured yet.

## Architecture

**Vite + React 19 + TypeScript + Tailwind v4** frontend — a DBA workspace dashboard for uploading Oracle snapshot folders, tracking extraction status, previewing findings, editing section data, and generating Word reports.

### Page routing

State-driven in `App.tsx` via `page: 'reports' | 'upload' | 'trash'`. No React Router. `Sidebar` drives navigation by calling `setPage` and `setFilter`.

### Core data flow

- **`Upload`** (from `Upload.tsx`) is the central domain object: `status`, `progress`, `tree`, `findings`, `sections`, `clientGuess`, `dbGuess`.
- **`dynamicClients`** in `App.tsx` is computed via `useMemo` from `uploads` — no static client list.
- **`Filter`** (from `Sidebar.tsx`): `{ kind: 'all' | 'shared' | 'client' | 'db' | 'group', clientId?, dbId?, groupId? }`.
- **`Group`** (from `Sidebar.tsx`): `{ id, name, clientName, extractionIds[] }` — stored in `localStorage('ra_groups')`, state in `App.tsx`.
- All state in `App`, flows down as props. No global store.

### Key components

| Component | Role |
|---|---|
| `Sidebar` | Client/DB/group tree + page links. Groups nested inside their client; expandable to show member DBs. |
| `ExtractedDataList` | Center panel — list/grid/split view; `GroupMenu` per card; `CombinedGenerateModal`. |
| `ExtractedDataPreview` | Right-panel detail — findings, file tree, `GenerateModal` (6 metadata fields). |
| `EditMappingModal` | 960 px slide-in, 4-step wizard: source ID → field mapping → data review → alert thresholds. |
| `TrashPage` | Restore or permanently delete discarded uploads. |

### EditMapping — Data Review step

- Sections with extracted data show `SectionDataTable` (editable cells; rows collapse past 10 with expand button).
- Sections with no data show `CreateTablePanel` (comma-separated column input → empty table).
- All sections have `ScreenshotsPanel` (FileReader base64 upload, thumbnail grid with hover-delete).
- CPU section shows `SectionDataTable` for raw `cpuData` rows + `CpuChart` below.
- `CpuChart` is a `forwardRef` recharts component exposing `capture(): Promise<string|null>` via `useImperativeHandle`. Controls: Line/Bar toggle, Y min/max inputs, series visibility pills.
- `handleSave` is async — awaits `cpuChartRef.current.capture()` to get a PNG and stores it as `chartImageData` in `localStorage('sections_{id}')`.
- `contentType` is auto-derived on save: `'table'` | `'image'` | `'table+image'`; CPU is always `'image'`.

### SectionData type

```typescript
interface SectionData {
  tableColumns: string[];
  tableRows: string[][];
  screenshots?: string[];
  contentType?: 'table' | 'image' | 'table+image';
  recommendation?: string;
  cpuData?: { columns: string[]; rows: string[][] };
  chartImageData?: string;   // base64 PNG from frontend recharts chart
}
```

### Generate flow

**Single:** `GenerateModal` reads `upload.sections` or `localStorage('sections_{id}')`, calls `api.generateReport({ extraction_id, ...metadata, sections })`. Server auto-populates missing fields; frontend sections win via `setdefault` logic.

**Combined:** `CombinedGenerateModal` calls `getSavedSections(upload)` per selected DB (reads App state or localStorage), sends as `dbs_sections[]` parallel to `extraction_ids`. Backend merges by section ID into `dbsData` — frontend sections win, backend data fills gaps. Both single and combined are triggered from `ExtractedDataList` (visible when `filter.kind === 'client'` or `'group'` with 2+ extractions).

### Flag severity

`Upload.findings` is `{ message: string; severity: 'critical' | 'warning' }[]` — not a plain `string[]`. `mapReport()` in `App.tsx` maps `api.Flag[]` to this shape, preserving severity. Findings render with red dots/badges for critical and amber for warning in both `ExtractedDataPreview` (right panel) and `ExtractedDataList` (card grid — shows severity count badges below the preview rows).

### Groups

- `Group { id, name, clientName, extractionIds[] }` persisted to `localStorage('ra_groups')`.
- Appear in `Sidebar` under their client — each group is expandable (chevron) showing member DB rows.
- Ungrouped DBs appear in the flat DB list; DBs in any group are removed from the flat list.
- `GroupMenu` on each card in `ExtractedDataList` — dropdown filtered to same-client groups, checkbox per group to add/remove.
- "Generate Combined" appears for `filter.kind === 'group'` with 2+ items.

### Styling conventions

- **Tailwind v4** (`@import "tailwindcss"` in `index.css`). No config file.
- Accent `#5538ee`, top-bar `#0b1130` — constants in `App.tsx`, passed as `accent` prop.
- Inline `style` props for accent-colored elements (Tailwind can't generate runtime hex).
- Font: **Plus Jakarta Sans**.

### `References/` folder

Standalone HTML prototype and plain JSX sketches — design references only, not imported, do not affect the build.
