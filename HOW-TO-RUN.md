# How to Run — Report Automation App

The app has three parts that all need to be running:

| Part | What it is | URL |
|------|-----------|-----|
| **PostgreSQL** | Database (Docker) | `localhost:5432` |
| **Backend** (`server.py`) | FastAPI server — API + report generation | `http://localhost:8000` |
| **Frontend** (Vite) | React UI | `http://localhost:5173` |

---

## Prerequisites

- Docker Desktop (running)
- Anaconda with the `Automation` conda env
- Node.js 20+

---

## Step 1 — Start PostgreSQL

First time only (creates the container):
```powershell
docker run -d --name reportgen-pg `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=reportgen `
  -p 5432:5432 postgres:16
```

On subsequent runs (container already exists):
```powershell
docker start reportgen-pg
```

---

## Step 2 — Start the Backend

Open a terminal, go to the `Backend` folder, activate the conda env, then start the server:

```powershell
conda activate Automation
cd "D:\From Old Laptop\Project\Report Generator v2\Backend"
uvicorn server:app --reload
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

> Keep this terminal open. The database tables are created automatically on first startup.

> **Important:** Make sure `Headers Template.docx` is present in the `Backend` folder before starting. It is used as the base template for generated reports.

---

## Step 3 — Start the Frontend

Open a **second terminal** and run the Vite dev server:

```powershell
cd "D:\From Old Laptop\Project\Report Generator v2\Frontend\Report_Automation"
npm run dev
```

You should see:
```
VITE ready in ...ms
➜  Local:   http://localhost:5173/
```

Open **http://localhost:5173** in your browser.

---

## Step 4 — First Login

On first startup with no users in the database, you will see a **Register** form. Create a username and password (minimum 8 characters). After that, registration is disabled and only login is available.

---

## Step 5 — Using the App

### Upload
Drag and drop your Oracle snapshot folder onto the upload zone, or use the folder picker. The folder should contain a `dba_snapshot_*.html` or `lite_snapshot_*.html` file. The server extracts data in the background and shows a progress bar.

### Review
Once extraction is done, click on a record in the list to see the extracted data — server info, database info, tablespace, RMAN, sessions, mountpoints, CPU utilization.

### Generate Report
Click **Generate Report**, fill in the report metadata (client name, period, author), and download the `.docx` file. Open it in **Microsoft Word** (not LibreOffice or Google Docs).

> After downloading, press **Ctrl+A then F9** in Word to populate the Table of Contents.

---

## Folder Structure Expected by the Server

```
exakai04db01/               ← parent folder (uploaded as a whole)
└── MBSHIP1/                ← database subfolder
    ├── dba_snapshot_*.html ← required; preferred over lite_snapshot
    ├── lite_snapshot_*.html← fallback if no dba_snapshot
    ├── total_mountpoint.txt / mountpoint.txt
    ├── hostnamectl.txt
    ├── cpu-count-linux.txt / cpu_count.txt
    ├── memtotal-linux-mb.txt / memtotal-linux.txt
    ├── etc-host.txt
    ├── cpu_utils.txt
    └── 1_status.txt
```

---

## Quick Reference

```powershell
# Terminal 1 — PostgreSQL (if container already exists)
docker start reportgen-pg

# Terminal 2 — Backend
conda activate Automation
cd "D:\From Old Laptop\Project\Report Generator v2\Backend"
uvicorn server:app --reload

# Terminal 3 — Frontend
cd "D:\From Old Laptop\Project\Report Generator v2\Frontend\Report_Automation"
npm run dev
```

Then open: **http://localhost:5173**

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Cannot connect to the Docker daemon" | Open Docker Desktop and wait for it to start |
| Backend fails to start | Check PostgreSQL is running: `docker ps` |
| Login page never loads | Make sure Vite dev server is running on port 5173 |
| Upload stuck / job fails | Check the backend terminal for error output |
| Report generates but header is blank | Ensure `Headers Template.docx` is in the `Backend` folder |
| DOCX formatting looks wrong | Open in Microsoft Word, not LibreOffice or Google Docs |
| TOC is empty | Press Ctrl+A then F9 in Word to update all fields |

---

## Building for Production (optional)

To serve the frontend directly from FastAPI (no Vite needed):

```powershell
cd "D:\From Old Laptop\Project\Report Generator v2\Frontend\Report_Automation"
npm run build
```

After building, the `dist/` folder is served automatically by the backend at `http://localhost:8000`. Only the backend needs to run.
