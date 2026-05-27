# How to Run — Report Automation App

## Overview

The app has two parts that must both be running:

| Part                                    | What it is                                                             | Required?                      |
| --------------------------------------- | ---------------------------------------------------------------------- | ------------------------------ |
| **Backend** (`server.py`)               | FastAPI server that reads Oracle snapshot HTML files and extracts data | Yes (for backend path loading) |
| **Frontend** (`Report-Automation.html`) | React app opened directly in browser                                   | Always                         |

---

## Prerequisites

- Python environment with required packages
- A modern browser (Chrome or Edge 86+)

---

## Step 1 — Install Python Dependencies

Open a terminal and run:

```bash
cd "D:\Project\Report Generator v2"
C:\Users\DaafiqRaSis\AppData\Local\miniconda3\envs\.myenv\python.exe -m pip install -r requirements.txt
```

This installs: `fastapi`, `uvicorn`, `beautifulsoup4`

---

## Step 2 — Start the Backend Server

In the same terminal:

```bash
cd "D:\Project\Report Generator v2"
C:\Users\DaafiqRaSis\AppData\Local\miniconda3\envs\.myenv\python.exe -m uvicorn server:app --reload
```

You should see:

```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process ...
```

> Keep this terminal open while using the app. Press `Ctrl+C` to stop.

---

## Step 3 — Open the Frontend

Open `Report-Automation.html` directly in Chrome or Edge:

- Double-click the file in File Explorer, **or**
- Drag it into an open browser window, **or**
- In the browser address bar, type: `file:///D:/Project/Report Generator v2/Report-Automation.html`

The status indicator in the top-right of Step 1 will show **"Backend online"** (green dot) when the server is running.

---

## Step 4 — Using the App

The app is a 4-step wizard:

### Step 1 — Load Data

**Option A: Backend API (recommended for Oracle snapshot HTML)**

1. Paste the folder path into the input field
   - Single DB folder: `D:\Database Data\exakai04db01\MBSHIP1`
   - Parent folder (multiple DBs): `D:\Database Data\exakai04db01`
2. Click **Validate** — checks for required files and HTML anchors
3. For a single folder: click **Extract & Load**
4. For a parent folder with multiple DB subfolders: check/uncheck which DBs to load, then click **Extract Selected**

**Option B: Folder Picker (legacy .txt files only, no HTML parse)**

Click **Select Folder** to open a native folder picker. Works with the old `.txt`-based diagnostic files but does not extract server/database info from snapshot HTML.

**Option C: Snapshot JSON**

If you previously ran `extract_snapshot.py` to produce `_data.json` files, click **Load Snapshot JSON** and select one or more `.json` files.

**Logos (optional)**

- **Company Logo** — appears on the cover page and in the document header
- **Client Logo** — appears on the cover page below the client name

**Saved Templates**

If you have previously saved a template, select it from the dropdown and click **Load** to pre-fill the report metadata (client name, period, reviewers, etc.).

---

### Step 2 — Review

Browse extracted data per database across tabs:

- **Summary** — flags and issues detected automatically
- **System Info** — server and database details (hostname, OS, Oracle version, etc.)
- **Tablespace**, **Mountpoints**, **RMAN**, **Sessions**, **CPU** — extracted table data

---

### Step 3 — Edit

Fill in and adjust all report content:

- **Report Information** — client name, period, author, version, date, etc.
- **Save Template** — save current metadata as a named template for reuse
- **Executive Summary Issues** — add/edit/remove findings for the Executive Summary table
- **Section Cards** — for each report section:
  - **ON/OFF** toggle to include or exclude the section from the DOCX
  - **Content type**: `Table` / `Image` / `Table+Image` / `None`
  - **Reorder** with ▲ ▼ buttons
  - **Rename** by double-clicking the section name
  - **Upload screenshots** (for Image or Table+Image sections)
  - **Edit recommendation** text
- **Add Section** — type a name and press Enter or click `+ Add Section` to create a custom section
- Custom sections can be deleted with the **×** button

---

### Step 4 — Generate

1. Choose report mode:
   - **Separate Reports** — one `.docx` file per database
   - **Combined Report** — all databases in a single `.docx`
2. Click **Download Report** — the file(s) will be saved to your Downloads folder

---

## Folder Structure Expected by Backend

```
exakai04db01/               ← parent folder (multi-DB mode)
├── MBSHIP1/                ← single DB folder
│   ├── dba_snapshot_*.html ← required (full snapshot with all sections)
│   ├── lite_snapshot_*.html← alternative (SGA info only)
│   ├── mountpoint.txt      ← optional (mount point data)
│   ├── hostnamectl.txt     ← optional (OS / hostname info)
│   ├── cpu-count-linux.txt ← optional (CPU info)
│   ├── memtotal-linux.txt  ← optional (total memory)
│   └── etc-host.txt        ← optional (IP lookup)
└── rtskci1/
    └── ...
```

---

## Troubleshooting

| Problem                           | Fix                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| "Backend offline" red dot         | Start `uvicorn server:app --reload` in terminal                                             |
| "Cannot reach backend" error      | Confirm server is running on port 8000; check firewall                                      |
| Validate shows ✗ for HTML file    | Make sure the folder contains a file named `dba_snapshot*.html` or `lite_snapshot*.html`    |
| Extraction is slow                | Normal — large snapshot HTML files (~33 MB) take 10–30 seconds to parse                     |
| DOCX opens with formatting issues | Ensure you open with Microsoft Word (not LibreOffice/Google Docs)                           |
| Tables overflow page in Word      | This is fixed — tables with many columns now use compact font (9pt) and auto-width          |
| No system info in Step 2          | Use the backend API path input instead of the folder picker; the picker does not parse HTML |
| Template not loading              | Templates are saved in browser `localStorage` — use the same browser you saved them in      |

---

## Quick Reference

```
# Start backend (run once per session)
cd "D:\Project\Report Generator v2"
C:\Users\DaafiqRaSis\AppData\Local\miniconda3\envs\.myenv\python.exe -m uvicorn server:app --reload

# Then open in browser:
Report-Automation.html
```

API endpoints (for debugging):

- `GET  http://localhost:8000/health` — server status
- `POST http://localhost:8000/validate` — check folder readiness
- `POST http://localhost:8000/extract` — extract data from folder
