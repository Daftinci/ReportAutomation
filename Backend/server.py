#!/usr/bin/env python3
"""
server.py — FastAPI backend for Report Automation.

Endpoints:
    GET  /health
    POST /auth/login        — { username, password } → JWT
    POST /auth/register     — first-time setup only
    POST /upload            — multipart file upload → { upload_id, job_id }
    GET  /jobs/{job_id}     — poll extraction status
    GET  /reports           — list stored extractions
    GET  /reports/{id}      — full extraction record
    DELETE /reports/{id}    — delete extraction
    POST /generate          — build and stream .docx
"""
import asyncio
import os
import re
import shutil
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import (
    BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Query,
    UploadFile, status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

try:
    from bs4 import BeautifulSoup
except ImportError:
    sys.exit("Missing: pip install beautifulsoup4")

import auth
import db
from extract_snapshot import SECTION_PROCESSORS, find_section_table, extract_table
from docx_builder import build_report

TEMP_DIR = Path(os.environ.get("TEMP_DIR", "./temp_uploads"))
TEMP_DIR.mkdir(exist_ok=True)

# ─── APP SETUP ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.init_db()
    await _ensure_admin_user()
    yield
    await db.close_db()
    # Clean up stale temp dirs older than 1 hour on shutdown
    _cleanup_stale_temp()


app = FastAPI(title="Report Automation API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _ensure_admin_user() -> None:
    """Create or promote the configured admin user on every startup."""
    admin_user = os.environ.get("ADMIN_USERNAME", "admin")
    admin_pass = os.environ.get("ADMIN_PASSWORD", "")
    if not admin_pass:
        return
    existing = await db.get_user_by_username(admin_user)
    if existing:
        if existing.get("role") != "admin":
            await db.update_user(existing["id"], role="admin")
            print(f"[startup] Promoted {admin_user} to admin role")
    else:
        if await db.count_users() == 0:
            hashed = auth.hash_password(admin_pass)
            await db.create_user(admin_user, hashed, role='admin')
            print(f"[startup] Created admin user: {admin_user}")


def _cleanup_stale_temp() -> None:
    import time
    cutoff = time.time() - 3600
    for d in TEMP_DIR.iterdir():
        if d.is_dir() and d.stat().st_mtime < cutoff:
            shutil.rmtree(d, ignore_errors=True)


# ─── REQUEST MODELS ──────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str


class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str = 'standard'


class UpdateUserRequest(BaseModel):
    role: Optional[str] = None
    password: Optional[str] = None


class GenerateRequest(BaseModel):
    extraction_id: Optional[str] = None
    extraction_ids: Optional[List[str]] = None  # for combined mode (2+ DBs)
    dbs_sections: Optional[List[Optional[List[Dict[str, Any]]]]] = None  # per-DB frontend sections
    meta: Optional[Dict[str, Any]] = None
    mode: str = "single"
    db: Optional[Dict[str, Any]] = None
    dbs: Optional[List[Dict[str, Any]]] = None
    serverInfo: Optional[Dict[str, Any]] = None
    databaseInfo: Optional[Dict[str, Any]] = None
    reportData: Optional[Dict[str, Any]] = None
    dbsData: Optional[List[Dict[str, Any]]] = None
    logoData: Optional[str] = None
    clientLogoData: Optional[str] = None
    cpu_chart_images: Optional[List[str]] = None
    cpu_chart_images_per_db: Optional[List[Optional[List[str]]]] = None


# ─── AUTH ENDPOINTS ───────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/login")
async def login(req: LoginRequest):
    user = await db.get_user_by_username(req.username)
    if not user or not auth.verify_password(req.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    token = auth.create_access_token(req.username, user.get("role", "standard"), user.get("id", ""))
    return {"access_token": token, "token_type": "bearer", "role": user.get("role", "standard")}


@app.post("/auth/register", status_code=201)
async def register(req: RegisterRequest):
    """Only works when no users exist (first-time setup)."""
    if await db.count_users() > 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registration is disabled — contact your administrator",
        )
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    hashed = auth.hash_password(req.password)
    uid = await db.create_user(req.username, hashed, role='admin')
    token = auth.create_access_token(req.username, 'admin', uid)
    return {"access_token": token, "token_type": "bearer", "role": "admin"}


# ─── USER MANAGEMENT (admin only) ────────────────────────────────────────────

@app.get("/users")
async def list_users(_admin: dict = Depends(auth.require_admin)):
    users = await db.list_users()
    for u in users:
        if u.get("created_at") is not None:
            u["created_at"] = str(u["created_at"])
    return users


@app.post("/users", status_code=201)
async def create_user_endpoint(req: CreateUserRequest, _admin: dict = Depends(auth.require_admin)):
    if req.role not in ("admin", "standard"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'standard'")
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if await db.get_user_by_username(req.username):
        raise HTTPException(status_code=409, detail="Username already taken")
    hashed = auth.hash_password(req.password)
    uid = await db.create_user(req.username, hashed, role=req.role)
    return {"id": uid, "username": req.username, "role": req.role}


@app.patch("/users/{user_id}")
async def update_user_endpoint(
    user_id: str,
    req: UpdateUserRequest,
    _admin: dict = Depends(auth.require_admin),
):
    updates: dict = {}
    if req.role is not None:
        if req.role not in ("admin", "standard"):
            raise HTTPException(status_code=400, detail="Role must be 'admin' or 'standard'")
        updates["role"] = req.role
    if req.password is not None:
        if len(req.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        updates["password_hash"] = auth.hash_password(req.password)
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")
    ok = await db.update_user(user_id, **updates)
    if not ok:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}


@app.delete("/users/{user_id}", status_code=204)
async def delete_user_endpoint(
    user_id: str,
    admin: dict = Depends(auth.require_admin),
):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    ok = await db.delete_user(user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="User not found")


# ─── UPLOAD ENDPOINT ──────────────────────────────────────────────────────────

@app.post("/upload")
async def upload(
    files: List[UploadFile] = File(...),
    client_name: Optional[str] = Form(None),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    _user: dict = Depends(auth.get_current_user),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    upload_id = str(uuid4())
    temp_dir = TEMP_DIR / upload_id
    temp_dir.mkdir(parents=True)

    saved_names: list[str] = []
    for f in files:
        # Preserve relative path structure sent by the browser (webkitRelativePath)
        safe_name = (f.filename or "file").replace('\\', '/').lstrip('/')
        dest = temp_dir / safe_name
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            content = await f.read()
            dest.write_bytes(content)
            saved_names.append(safe_name)
        finally:
            await f.close()

    job_id = await db.create_job(upload_id)
    background_tasks.add_task(_run_extraction, upload_id, job_id, temp_dir, len(saved_names), client_name or '')

    return {"upload_id": upload_id, "job_id": job_id, "files": saved_names}


async def _run_extraction(
    upload_id: str, job_id: str, temp_dir: Path, total_files: int,
    client_name: str = '',
) -> None:
    await db.update_job(job_id, status="processing", progress=5)
    try:
        # BeautifulSoup parse is CPU-bound — run in thread pool
        data = await asyncio.to_thread(_extract_folder_sync, temp_dir, job_id)
        if client_name:
            data['clientName'] = client_name  # db.py reads this first in its fallback chain
        await db.update_job(job_id, progress=90)
        extraction_id = await db.save_extraction(job_id, data, total_files=total_files)
        await db.update_job(job_id, status="done", progress=100, extraction_id=extraction_id)
    except Exception as exc:
        await db.update_job(job_id, status="failed", error=str(exc))
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


# ─── JOB POLLING ──────────────────────────────────────────────────────────────

@app.get("/jobs/{job_id}")
async def get_job(
    job_id: str,
    _user: dict = Depends(auth.get_current_user),
):
    job = await db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": job["id"],
        "status": job["status"],
        "progress": job["progress"],
        "error": job["error"],
        "extraction_id": job["extraction_id"],
    }


# ─── REPORTS CRUD ─────────────────────────────────────────────────────────────

@app.get("/reports")
async def list_reports(
    client: Optional[str] = Query(None),
    database: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    _user: dict = Depends(auth.get_current_user),
):
    rows = await db.list_extractions(
        client_name=client,
        database_name=database,
        from_date=from_date,
        to_date=to_date,
        limit=limit,
        offset=offset,
    )
    # Serialize datetime objects for JSON
    for r in rows:
        for k in ("extracted_at", "report_date"):
            if r.get(k) is not None:
                r[k] = str(r[k])
    return rows


@app.get("/reports/{extraction_id}")
async def get_report(
    extraction_id: str,
    _user: dict = Depends(auth.get_current_user),
):
    row = await db.get_extraction(extraction_id)
    if not row:
        raise HTTPException(status_code=404, detail="Extraction not found")
    for k in ("extracted_at", "report_date"):
        if row.get(k) is not None:
            row[k] = str(row[k])
    return row


@app.delete("/reports/{extraction_id}", status_code=204)
async def delete_report(
    extraction_id: str,
    _user: dict = Depends(auth.get_current_user),
):
    deleted = await db.delete_extraction(extraction_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Extraction not found")


# ─── GENERATE ENDPOINT ────────────────────────────────────────────────────────

@app.post("/generate")
async def generate(
    req: GenerateRequest,
    _user: dict = Depends(auth.get_current_user),
):
    payload = req.model_dump()

    # If extraction_id provided, load data from DB and merge
    if req.extraction_id:
        row = await db.get_extraction(req.extraction_id)
        if not row:
            raise HTTPException(status_code=404, detail="Extraction not found")
        # Fill in defaults from stored extraction if not provided
        if not payload.get("serverInfo"):
            payload["serverInfo"] = row.get("server_info") or {}
        if not payload.get("databaseInfo"):
            payload["databaseInfo"] = row.get("database_info") or {}
        rd = payload.get("reportData") or {}
        rd.setdefault("period", str(row.get("report_date") or ""))
        rd.setdefault("authorName", _user.get("username", ""))
        rd.setdefault("docVersion", "1.0")
        rd.setdefault("docDate", str(row.get("report_date") or ""))
        rd.setdefault("dataCollectionDate", str(row.get("report_date") or ""))
        rd.setdefault("sections", _sections_to_report_data(row.get("sections") or {}))
        # cpu section lives in cpu_utils column, not in sections — inject it if missing
        if not any(s.get("id") == "cpu" for s in rd["sections"]):
            cpu_u = row.get("cpu_utils") or {}
            if cpu_u.get("rows"):
                rd["sections"].insert(0, {
                    "id": "cpu",
                    "name": "CPU Utilization",
                    "tableColumns": [],
                    "tableRows": [],
                    "recommendation": "",
                    "screenshots": [],
                    "cpuData": cpu_u,
                })
        rd.setdefault("executiveSummaryIssues", _flags_to_issues(row.get("flags") or []))
        # Inject frontend recharts chart images into the cpu section (overrides matplotlib)
        if req.cpu_chart_images:
            for sec in rd.get("sections", []):
                if sec.get("id") == "cpu":
                    sec["chartImageDataList"] = req.cpu_chart_images
                    break
        payload["reportData"] = rd

        m = payload.get("meta") or {}
        m.setdefault("clientName", row.get("client_name") or "")
        m.setdefault("companyName", "PT. Sisindokom Lintasbuana")
        m.setdefault("reportTitle", "Preventive Maintenance")
        m.setdefault("period", str(row.get("report_date") or ""))
        m.setdefault("overallCondition", "good condition")
        m.setdefault("summaryText", "")
        m.setdefault("reviewers", [{"name": "", "position": "", "company": ""}])
        m.setdefault("sectionsConfig", [])
        payload["meta"] = m
        if not payload.get("db"):
            payload["db"] = {
                "databaseName": row.get("database_name") or "",
                "instanceName": row.get("instance_name") or "",
            }
        if not payload.get("cpuData"):
            payload["cpuData"] = row.get("cpu_utils") or {}

    # Combined mode: multiple extraction IDs → one document with all DBs
    elif req.extraction_ids and len(req.extraction_ids) >= 2:
        rows = [await db.get_extraction(eid) for eid in req.extraction_ids]
        rows = [r for r in rows if r]
        if not rows:
            raise HTTPException(status_code=404, detail="No extractions found")

        payload["mode"] = "combined"

        canonical_order = list(_SECTION_NAMES.keys())
        seen_ids: set = set()
        for r in rows:
            for sid in (r.get("sections") or {}):
                seen_ids.add(sid)
            # cpu lives in cpu_utils, not in sections
            if (r.get("cpu_utils") or {}).get("rows"):
                seen_ids.add("cpu")
        ordered_ids = [sid for sid in canonical_order if sid in seen_ids]

        # Use explicit falsy checks — model_dump() puts None for unset fields,
        # and setdefault() won't override an existing None key.
        if not payload.get("dbs"):
            payload["dbs"] = [
                {"databaseName": r.get("database_name") or "", "instanceName": r.get("instance_name") or ""}
                for r in rows
            ]
        if not payload.get("dbsData"):
            fe_dbs = payload.get("dbs_sections") or []
            payload["dbsData"] = []
            for i, r in enumerate(rows):
                fe_secs = fe_dbs[i] if i < len(fe_dbs) else None
                fe_lookup = {s["id"]: s for s in fe_secs} if fe_secs else {}
                sections_list = []
                for sid in ordered_ids:
                    if sid in fe_lookup:
                        sections_list.append(fe_lookup[sid])
                    else:
                        be_sec = {
                            **(r.get("sections") or {}).get(sid, {}),
                            "id": sid,
                            "name": _SECTION_NAMES.get(sid, sid.replace("_", " ").title()),
                        }
                        if sid == "cpu" and r.get("cpu_utils"):
                            be_sec["cpuData"] = r.get("cpu_utils")
                        sections_list.append(be_sec)
                payload["dbsData"].append({
                    "databaseName": r.get("database_name") or "",
                    "sections": sections_list,
                })
        if not payload.get("serverInfo"):
            payload["serverInfo"] = rows[0].get("server_info") or {}
        if not payload.get("databaseInfo"):
            payload["databaseInfo"] = rows[0].get("database_info") or {}

        rd = payload.get("reportData") or {}
        rd.setdefault("period", str(rows[0].get("report_date") or ""))
        rd.setdefault("authorName", _user.get("username", ""))
        rd.setdefault("docVersion", "1.0")
        rd.setdefault("docDate", str(rows[0].get("report_date") or ""))
        rd.setdefault("dataCollectionDate", str(rows[0].get("report_date") or ""))
        rd.setdefault("sections", [
            {"id": sid, "name": _SECTION_NAMES.get(sid, sid.replace("_", " ").title()),
             "tableColumns": [], "tableRows": [], "recommendation": "", "screenshots": []}
            for sid in ordered_ids
        ])
        rd.setdefault("executiveSummaryIssues",
            [iss for r in rows for iss in _flags_to_issues(r.get("flags") or [])])
        # Inject frontend recharts chart images per DB (overrides matplotlib)
        if req.cpu_chart_images_per_db:
            for db_idx, imgs in enumerate(req.cpu_chart_images_per_db):
                if not imgs:
                    continue
                dbs_data = payload.get("dbsData") or []
                if db_idx < len(dbs_data):
                    for sec in dbs_data[db_idx].get("sections", []):
                        if sec.get("id") == "cpu":
                            sec["chartImageDataList"] = imgs
                            break
        payload["reportData"] = rd

        m = payload.get("meta") or {}
        m.setdefault("clientName", rows[0].get("client_name") or "")
        m.setdefault("companyName", "PT. Sisindokom Lintasbuana")
        m.setdefault("reportTitle", "Preventive Maintenance")
        m.setdefault("period", str(rows[0].get("report_date") or ""))
        m.setdefault("overallCondition", "good condition")
        m.setdefault("summaryText", "")
        m.setdefault("reviewers", [{"name": "", "position": "", "company": ""}])
        m.setdefault("sectionsConfig", [])
        payload["meta"] = m

    if not payload.get("reportData"):
        payload["reportData"] = {}
    if not payload.get("meta"):
        payload["meta"] = {}

    try:
        docx_bytes = build_report(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    meta = payload.get("meta") or {}
    report_data = payload.get("reportData") or {}
    client = (meta.get("clientName") or "client").replace(" ", "_")
    period = (report_data.get("period") or "report").replace(" ", "_")
    if req.mode == "separate" and payload.get("db"):
        db_name = (payload["db"].get("databaseName") or "db").replace(" ", "_")
        filename = f"Report_{client}_{db_name}_{period}.docx"
    else:
        filename = f"Report_{client}_{period}.docx"

    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


_SECTION_NAMES = {
    "cpu":              "CPU Utilization",
    "mountpoint":       "Mountpoint Usage",
    "tablespace":       "Tablespace Usage",
    "rman":             "RMAN Backup Status",
    "sessions":         "Session Count",
    'sessions_matrix':  "User Session Matrix",
    "sga":              "SGA Information",
    "fileio":           "File I/O Statistics",
    "invalid":          "Invalid Objects",
    "initparams":       "Init Parameters",
    "datafiles":        "Data Files",
    "dbgrowth":         "Database Growth",
    "redo":             "Redo Log Switches",
    "dataguard":        "DataGuard Status",
    'parameter_review': "Parameter Review",
    'online_redo':        "Online Redo Logs",
    'performance_review': "Performance Review",
}

def _sections_to_report_data(sections: dict) -> list:
    """Convert extracted sections dict to the reportData.sections format."""
    out = []
    for sec_id, sec_data in sections.items():
        out.append({
            "id": sec_id,
            "name": _SECTION_NAMES.get(sec_id, sec_id.replace("_", " ").title()),
            "tableColumns": sec_data.get("tableColumns", []),
            "tableRows": sec_data.get("tableRows", []),
            "recommendation": sec_data.get("recommendation", ""),
            "screenshots": sec_data.get("screenshots", []),
        })
    return out


def _flags_to_issues(flags: list) -> list:
    out = []
    for f in flags:
        out.append({
            "finding": f.get("message", ""),
            "severity": f.get("severity", "warning"),
            "section": f.get("section", ""),
        })
    return out


# ─── EXTRACTION LOGIC (sync, run in thread) ───────────────────────────────────

def _find_html(folder: Path) -> Optional[Path]:
    lite = sorted(folder.rglob("lite_snapshot*.html"))
    if lite:
        return lite[0]
    dba = sorted(folder.rglob("dba_snapshot*.html"))
    if dba:
        return dba[0]
    return None


def _parse_keyvalue(text: str) -> dict:
    result = {}
    for line in text.splitlines():
        if ":" in line:
            k, _, v = line.partition(":")
            k = k.strip()
            if k:
                result[k] = v.strip()
    return result


def _parse_memtotal(text: str) -> Optional[str]:
    for line in text.splitlines():
        if line.strip().startswith("Mem:"):
            parts = line.split()
            if len(parts) >= 2:
                try:
                    total = int(parts[1])
                    gb = round(total / 1_073_741_824, 1) if total >= 1_000_000_000 else round(total / 1_048_576, 1)
                    return f"{gb} GB"
                except ValueError:
                    pass
    return None


def _lookup_ip(hosts_text: str, hostname: str) -> Optional[str]:
    if not hostname:
        return None
    hn = hostname.lower()
    for line in hosts_text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) >= 2:
            aliases = [p.lower() for p in parts[1:]]
            if any(a == hn or a.startswith(hn + ".") for a in aliases):
                return parts[0]
    return None


def _load_txt(folder: Path, *fnames: str) -> str:
    for fname in fnames:
        p = folder / fname
        if p.exists():
            try:
                return p.read_text(encoding="utf-8", errors="replace")
            except Exception:
                pass
    return ""


def _extract_server_db_info(soup, folder: Path) -> tuple:
    server_info: dict = {
        k: None for k in ("hostname", "domainName", "virtualization", "ip",
                          "os", "kernel", "systemModel", "vendorProcessor",
                          "cpus", "totalMemory", "storageTotalSize")
    }
    db_info: dict = {
        k: None for k in ("instanceName", "instanceStatus", "instanceStartupTime",
                          "instanceVersion", "sqlPlusVersion", "databaseName",
                          "dbUniqueName", "databaseCreated", "openMode",
                          "archiveMode", "spfile", "compatibility", "characterSet")
    }

    _, inst_rows = find_section_table(soup, "instance_overview")
    if inst_rows and inst_rows[0]:
        row = inst_rows[0]
        if len(row) > 0:
            db_info["instanceName"] = row[0].strip() or None
        if len(row) > 3:
            server_info["hostname"] = row[3].strip() or None
        if len(row) > 4:
            db_info["instanceVersion"] = row[4].strip() or None
        date_re = re.compile(r"\d{2}-[A-Z]{3}-\d{2,4}", re.IGNORECASE)
        for idx in range(1, min(len(row), 8)):
            if date_re.search(row[idx]):
                db_info["instanceStartupTime"] = row[idx].strip()
                break
        for idx in range(1, min(len(row), 8)):
            if row[idx].strip().upper() in {"OPEN", "MOUNTED", "STARTED", "READ WRITE", "READ ONLY"}:
                db_info["instanceStatus"] = row[idx].strip()
                break

    _, db_rows = find_section_table(soup, "database_overview")
    if db_rows and db_rows[0]:
        row = db_rows[0]
        if len(row) > 0:
            db_info["databaseName"] = row[0].strip() or None
        if len(row) > 6:
            db_info["archiveMode"] = row[6].strip() or None
        if len(row) > 7:
            db_info["openMode"] = row[7].strip() or None
        date_re = re.compile(r"\d{2}-[A-Z]{3}-\d{2,4}", re.IGNORECASE)
        for idx in range(1, min(len(row), 7)):
            if date_re.search(row[idx]):
                db_info["databaseCreated"] = row[idx].strip()
                break

    anchor = soup.find("a", attrs={"name": "initialization_parameters"})
    if anchor:
        for tbl in anchor.find_all_next("table", limit=5):
            ths = tbl.find_all("th", {"scope": "col"})
            if len(ths) >= 2:
                _, param_rows = extract_table(tbl)
                if param_rows:
                    def _pval(name):
                        for r in param_rows:
                            if len(r) >= 3 and r[0].strip().lower() == name:
                                return r[2].strip() or None
                        return None
                    db_info["spfile"] = _pval("spfile") or _pval("spfile_name")
                    db_info["compatibility"] = _pval("compatible")
                    db_info["characterSet"] = _pval("nls_characterset")
                    dom = _pval("db_domain")
                    if dom:
                        server_info["domainName"] = dom
                break

    hctl = _load_txt(folder, "hostnamectl.txt")
    if hctl:
        kv = _parse_keyvalue(hctl)
        server_info["os"] = kv.get("Operating System")
        server_info["kernel"] = kv.get("Kernel")
        server_info["virtualization"] = kv.get("Virtualization")
        if not server_info["hostname"]:
            server_info["hostname"] = kv.get("Static hostname")

    cpu_txt = _load_txt(folder, "cpu-count-linux.txt", "cpu_count.txt")
    if cpu_txt:
        kv = _parse_keyvalue(cpu_txt)
        server_info["cpus"] = kv.get("CPU(s)")
        server_info["systemModel"] = kv.get("Model name")
        vendor = kv.get("Vendor ID")
        if vendor:
            if "Intel" in vendor or "Genuine" in vendor:
                server_info["vendorProcessor"] = "Intel"
            elif "AMD" in vendor or "Authentic" in vendor:
                server_info["vendorProcessor"] = "AMD"
            else:
                server_info["vendorProcessor"] = vendor

    mem_txt = _load_txt(folder, "memtotal-linux-mb.txt", "memtotal-linux.txt", "memory_total.txt")
    if mem_txt:
        server_info["totalMemory"] = _parse_memtotal(mem_txt)

    hosts_txt = _load_txt(folder, "etc-host.txt")
    if hosts_txt and server_info["hostname"]:
        server_info["ip"] = _lookup_ip(hosts_txt, server_info["hostname"])

    return server_info, db_info


def _parse_mountpoint(text: str) -> dict:
    pattern = re.compile(r"^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\d+)%\s+(.+)$")
    rows = []
    for line in text.splitlines():
        m = pattern.match(line.strip())
        if m:
            rows.append([m.group(1), m.group(2), m.group(3), m.group(4),
                         f"{m.group(5)}%", m.group(6).strip()])
    return {"tableColumns": ["Filesystem", "Size", "Used", "Available", "Use%", "Mounted On"],
            "tableRows": rows} if rows else {}


def _parse_sql_fixed(text: str) -> Optional[dict]:
    if not text:
        return None
    lines = text.split("\n")

    # Find every separator line (SQL*Plus repeats header+separator every ~1000 rows)
    sep_indices = [
        i for i, l in enumerate(lines)
        if re.match(r"^[\-\s]+$", l) and "---" in l
    ]
    if not sep_indices:
        return None

    # Derive column ranges and headers from the first separator
    first_sep = sep_indices[0]
    sep_line = lines[first_sep]
    ranges: list[tuple[int, int]] = []
    i = 0
    while i < len(sep_line):
        if sep_line[i] == "-":
            s = i
            while i < len(sep_line) and sep_line[i] == "-":
                i += 1
            ranges.append((s, i))
        else:
            i += 1
    if not ranges:
        return None
    headers = [lines[first_sep - 1][s:e].strip() if first_sep > 0 else "" for s, e in ranges]

    # Skip every separator line and the repeated header line before it
    skip: set[int] = set()
    for si in sep_indices:
        skip.add(si)
        if si > 0:
            skip.add(si - 1)

    # Collect data rows from all blocks in a single pass
    rows = []
    for idx, line in enumerate(lines):
        if idx in skip or not line.strip():
            continue
        if re.search(r"\d+\s+rows?\s+selected", line, re.IGNORECASE):
            continue
        row = [(line[s:e].strip() if s < len(line) else "") for s, e in ranges]
        if any(row):
            rows.append(row)

    return {"headers": headers, "rows": rows}


def _parse_status_txt(text: str) -> dict:
    if not text:
        return {}
    m = re.search(r"PHYSICAL STANDBY|LOGICAL STANDBY", text, re.IGNORECASE)
    db_role = m.group(0).upper() if m else ("PRIMARY" if re.search(r"\bPRIMARY\b", text) else "UNKNOWN")
    m2 = re.search(r"READ ONLY WITH APPLY|READ WRITE|MOUNTED|READ ONLY", text, re.IGNORECASE)
    open_mode = m2.group(0).upper() if m2 else "UNKNOWN"
    m3 = re.search(r"MAXIMUM PERFORMANCE|MAXIMUM AVAILABILITY|MAXIMUM PROTECTION", text, re.IGNORECASE)
    protection_mode = m3.group(0).upper() if m3 else "UNKNOWN"
    mrp = None
    for line in text.split("\n"):
        if "MRP0" in line:
            m5 = re.search(r"APPLYING_LOG|WAIT_FOR_LOG|RECEIVING", line, re.IGNORECASE)
            if m5:
                mrp = m5.group(0).upper()
            break
    return {"dbRole": db_role, "openMode": open_mode, "protectionMode": protection_mode, "mrpStatus": mrp}


def _extract_txt_sections(folder: Path) -> dict:
    sections: dict = {}

    mp_txt = _load_txt(folder, "total_mountpoint.txt", "mountpoint.txt")
    if mp_txt:
        mp = _parse_mountpoint(mp_txt)
        if mp.get("tableRows"):
            sections["mountpoint"] = mp

    status_text = _load_txt(folder, "1_status.txt")
    if status_text:
        st = _parse_status_txt(status_text)
        if st.get("dbRole"):
            sections["dataguard"] = {
                "tableColumns": ["Property", "Value"],
                "tableRows": [
                    ["Database Role", st.get("dbRole", "")],
                    ["Open Mode", st.get("openMode", "")],
                    ["Protection Mode", st.get("protectionMode", "")],
                    ["MRP0 Status", st.get("mrpStatus") or "N/A (Primary)"],
                ],
            }

    cpu_txt = _load_txt(folder, "cpu_utils.txt")
    if cpu_txt:
        p = _parse_sql_fixed(cpu_txt)
        if p and p["rows"]:
            sections["_cpuUtils"] = {"columns": p["headers"], "rows": p["rows"]}

    return sections


def _analyze(sections: dict) -> list:
    flags = []
    for row in sections.get("tablespace", {}).get("tableRows", []):
        if len(row) >= 5:
            try:
                pct = float(str(row[4]).replace("%", "").strip())
                if pct > 85:
                    flags.append({
                        "section": "Tablespace Status",
                        "severity": "critical" if pct > 95 else "warning",
                        "item": row[1],
                        "metric": "Used %",
                        "value": pct,
                        "threshold": 85,
                        "message": f"{row[1]} is {pct:.1f}% used",
                    })
            except ValueError:
                pass
    for row in sections.get("rman", {}).get("tableRows", []):
        if len(row) >= 2:
            s = str(row[1]).strip().upper()
            if s not in ("COMPLETED", "COMPLETED WITH WARNINGS", ""):
                flags.append({
                    "section": "RMAN Backup Status",
                    "severity": "critical",
                    "item": f"{row[0]} @ {row[2] if len(row) > 2 else ''}",
                    "metric": "STATUS",
                    "value": row[1],
                    "threshold": "No FAILED",
                    "message": f"Backup {row[1]}: {row[0]} started {row[2] if len(row) > 2 else ''}",
                })
    for row in sections.get("sessions", {}).get("tableRows", []):
        if len(row) >= 4:
            try:
                pct = float(str(row[3]).replace("%", "").strip())
                if pct > 90:
                    flags.append({
                        "section": "Current Sessions",
                        "severity": "critical" if pct > 95 else "warning",
                        "item": row[0],
                        "metric": "Session Utilization",
                        "value": f"{pct:.1f}%",
                        "threshold": "90%",
                        "message": f"{row[0]}: {row[1]} / {row[2]} sessions ({pct:.1f}%)",
                    })
            except ValueError:
                pass
    for row in sections.get("sessions_matrix", {}).get("tableRows", []):
        if len(row) >= 4:
            try:
                pct = float(str(row[3]).replace("%", "").strip())
                if pct > 90:
                    flags.append({
                        "section": "User Session Matrix",
                        "severity": "critical" if pct > 95 else "warning",
                        "item": row[0],
                        "metric": "Session Utilization",
                        "value": f"{pct:.1f}%",
                        "threshold": "90%",
                        "message": f"{row[0]}: {row[1]} / {row[2]} sessions ({pct:.1f}%)",
                    })
            except ValueError:
                pass

    for row in sections.get("parameter_review", {}).get("tableRows", []):
        if len(row) >= 4:
            try:
                pct = float(str(row[3]).replace("%", "").strip())
                if pct > 90:
                    flags.append({
                        "section": "Parameter Review",
                        "severity": "critical" if pct > 95 else "warning",
                        "item": row[0],
                        "metric": "Session Utilization",
                        "value": f"{pct:.1f}%",
                        "threshold": "90%",
                        "message": f"{row[0]}: {row[1]} / {row[2]} sessions ({pct:.1f}%)",
                    })
            except ValueError:
                pass

    for row in sections.get("mountpoint", {}).get("tableRows", []):
        if len(row) >= 5:
            try:
                pct = float(str(row[4]).replace("%", "").strip())
                if pct > 85:
                    mount = row[5] if len(row) > 5 else row[0]
                    flags.append({
                        "section": "Mount Point Usage",
                        "severity": "critical" if pct > 95 else "warning",
                        "item": mount,
                        "metric": "Use%",
                        "value": pct,
                        "threshold": 85,
                        "message": f"{mount} is {pct:.0f}% full",
                    })
            except ValueError:
                pass
    return flags




def _extract_folder_sync(folder: Path, job_id: str) -> dict:
    """Synchronous extraction — runs in thread pool via asyncio.to_thread."""
    html_path = _find_html(folder)
    if not html_path:
        raise ValueError("No dba_snapshot / lite_snapshot HTML file found in upload")

    # Companion .txt files live alongside the HTML (e.g. temp/{uuid}/MBSHIP1/)
    working_dir = html_path.parent

    content = html_path.read_text(encoding="utf-8", errors="replace")
    try:
        soup = BeautifulSoup(content, "lxml")
    except Exception:
        soup = BeautifulSoup(content, "html.parser")

    server_info, db_info = _extract_server_db_info(soup, working_dir)

    sections: dict = {}
    for sec_id, processor in SECTION_PROCESSORS.items():
        try:
            result = processor(soup)
            if result:
                sections[sec_id] = result
        except Exception:
            pass

    txt_data = _extract_txt_sections(working_dir)
    cpu_utils = txt_data.pop("_cpuUtils", {"columns": [], "rows": []})
    for key, val in txt_data.items():
        if key not in sections or not sections[key].get("tableRows"):
            sections[key] = val

    # database_growth: prefer lite_snapshot values (already in Megabytes).
    # When the main file was a dba_snapshot, re-extract from lite_snapshot if present.
    if html_path.name.startswith("dba_snapshot"):
        lite_files = sorted(html_path.parent.glob("lite_snapshot*.html"))
        if lite_files:
            try:
                lite_content = lite_files[0].read_text(encoding="utf-8", errors="replace")
                try:
                    lite_soup = BeautifulSoup(lite_content, "lxml")
                except Exception:
                    lite_soup = BeautifulSoup(lite_content, "html.parser")
                lite_growth = SECTION_PROCESSORS["database_growth"](lite_soup)
                if lite_growth:
                    sections["database_growth"] = lite_growth
            except Exception:
                pass

    # Fallback for db name from 1_status.txt (lite_snapshot only)
    if not db_info.get("databaseName"):
        st = _parse_status_txt(_load_txt(working_dir, "1_status.txt"))
        if st.get("dbName"):
            db_info["databaseName"] = st["dbName"]
        if st.get("openMode") and not db_info.get("openMode"):
            db_info["openMode"] = st["openMode"]

    # Extract report date from HTML filename
    report_date = None
    m = re.search(r"(\d{8})", html_path.stem)
    if m:
        d = m.group(1)
        report_date = f"{d[:4]}-{d[4:6]}-{d[6:8]}"

    return {
        "folderName": working_dir.name,  # DB subfolder name, e.g. "MBSHIP1"
        "serverInfo": server_info,
        "databaseInfo": db_info,
        "sections": sections,
        "cpuUtils": cpu_utils,
        "flags": _analyze(sections),
        "reportDate": report_date,
    }


# ─── PRODUCTION STATIC FILES ─────────────────────────────────────────────────
# Serve built React app in production. Mount last so API routes take priority.
_dist = Path(__file__).parent.parent / "Frontend" / "Report_Automation" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=str(_dist), html=True), name="static")
