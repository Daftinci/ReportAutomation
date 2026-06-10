"""
db.py — asyncpg connection pool and CRUD helpers.
"""
import json
import os
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

import asyncpg

pool: Optional[asyncpg.Pool] = None

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/reportgen"
)


async def _init_conn(conn: asyncpg.Connection) -> None:
    """Register JSONB codec for every connection in the pool."""
    await conn.set_type_codec(
        "jsonb",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )


async def init_db() -> None:
    global pool
    pool = await asyncpg.create_pool(DATABASE_URL, init=_init_conn, min_size=1, max_size=10)
    await _create_tables()


async def close_db() -> None:
    global pool
    if pool:
        await pool.close()
        pool = None


async def _create_tables() -> None:
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id           TEXT PRIMARY KEY,
                username     TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role         TEXT NOT NULL DEFAULT 'standard',
                created_at   TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS jobs (
                id            TEXT PRIMARY KEY,
                upload_id     TEXT NOT NULL,
                status        TEXT NOT NULL DEFAULT 'queued',
                progress      INT  DEFAULT 0,
                error         TEXT,
                extraction_id TEXT,
                created_at    TIMESTAMPTZ DEFAULT NOW(),
                finished_at   TIMESTAMPTZ
            );

            CREATE TABLE IF NOT EXISTS extractions (
                id            TEXT PRIMARY KEY,
                job_id        TEXT,
                folder_name   TEXT NOT NULL,
                client_name   TEXT,
                database_name TEXT,
                instance_name TEXT,
                report_date   DATE,
                total_files   INT  DEFAULT 0,
                extracted_at  TIMESTAMPTZ DEFAULT NOW(),
                server_info   JSONB,
                database_info JSONB,
                sections      JSONB,
                cpu_utils     JSONB,
                flags         JSONB
            );

            CREATE INDEX IF NOT EXISTS idx_ext_client_date
                ON extractions (client_name, report_date DESC NULLS LAST);
            CREATE INDEX IF NOT EXISTS idx_ext_database
                ON extractions (database_name);
        """)
        # Migrate existing tables that predate the role column
        await conn.execute(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'standard'"
        )


# ─── USER ─────────────────────────────────────────────────────────────────────

async def create_user(username: str, password_hash: str, role: str = 'standard') -> str:
    uid = str(uuid4())
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)",
            uid, username, password_hash, role,
        )
    return uid


async def list_users() -> list[dict]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, username, role, created_at FROM users ORDER BY created_at"
        )
    return [dict(r) for r in rows]


async def update_user(user_id: str, **kwargs: Any) -> bool:
    allowed = {k: v for k, v in kwargs.items() if k in ('role', 'password_hash')}
    if not allowed:
        return False
    parts = []
    vals: list = []
    for i, (k, v) in enumerate(allowed.items(), start=1):
        parts.append(f"{k} = ${i}")
        vals.append(v)
    vals.append(user_id)
    async with pool.acquire() as conn:
        result = await conn.execute(
            f"UPDATE users SET {', '.join(parts)} WHERE id = ${len(vals)}",
            *vals,
        )
    return result == "UPDATE 1"


async def delete_user(user_id: str) -> bool:
    async with pool.acquire() as conn:
        result = await conn.execute("DELETE FROM users WHERE id = $1", user_id)
    return result == "DELETE 1"


async def get_user_by_username(username: str) -> Optional[dict]:
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM users WHERE username = $1", username)
    return dict(row) if row else None


async def count_users() -> int:
    async with pool.acquire() as conn:
        return await conn.fetchval("SELECT COUNT(*) FROM users")


# ─── JOB ──────────────────────────────────────────────────────────────────────

async def create_job(upload_id: str) -> str:
    jid = str(uuid4())
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO jobs (id, upload_id, status, progress) VALUES ($1, $2, 'queued', 0)",
            jid, upload_id,
        )
    return jid


async def update_job(job_id: str, **kwargs: Any) -> None:
    """Update arbitrary job fields. Supported keys: status, progress, error, extraction_id."""
    parts = []
    vals: list = []
    i = 1
    for k, v in kwargs.items():
        if k in ("status", "progress", "error", "extraction_id"):
            parts.append(f"{k} = ${i}")
            vals.append(v)
            i += 1
    if kwargs.get("status") in ("done", "failed"):
        parts.append(f"finished_at = ${i}")
        vals.append(datetime.now(timezone.utc))
        i += 1
    if not parts:
        return
    vals.append(job_id)
    async with pool.acquire() as conn:
        await conn.execute(
            f"UPDATE jobs SET {', '.join(parts)} WHERE id = ${i}",
            *vals,
        )


async def get_job(job_id: str) -> Optional[dict]:
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM jobs WHERE id = $1", job_id)
    return dict(row) if row else None


# ─── EXTRACTION ───────────────────────────────────────────────────────────────

async def save_extraction(job_id: str, data: dict, total_files: int = 0) -> str:
    eid = str(uuid4())
    db_info = data.get("databaseInfo") or {}
    server_info = data.get("serverInfo") or {}

    report_date = None
    raw_date = data.get("reportDate") or db_info.get("reportDate")
    if raw_date:
        try:
            from datetime import date
            report_date = date.fromisoformat(str(raw_date))
        except Exception:
            pass

    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO extractions
              (id, job_id, folder_name, client_name, database_name, instance_name,
               report_date, total_files, server_info, database_info,
               sections, cpu_utils, flags)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            """,
            eid,
            job_id,
            data.get("folderName", ""),
            data.get("clientName") or db_info.get("databaseName") or server_info.get("hostname"),
            db_info.get("databaseName"),
            db_info.get("instanceName"),
            report_date,
            total_files,
            server_info,
            db_info,
            data.get("sections") or {},
            data.get("cpuUtils") or {},
            data.get("flags") or [],
        )
    return eid


async def get_extraction(extraction_id: str) -> Optional[dict]:
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM extractions WHERE id = $1", extraction_id)
    return dict(row) if row else None


async def list_extractions(
    client_name: Optional[str] = None,
    database_name: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    conditions = []
    vals: list = []
    i = 1
    if client_name:
        conditions.append(f"client_name ILIKE ${i}")
        vals.append(f"%{client_name}%")
        i += 1
    if database_name:
        conditions.append(f"database_name ILIKE ${i}")
        vals.append(f"%{database_name}%")
        i += 1
    if from_date:
        conditions.append(f"extracted_at >= ${i}")
        vals.append(from_date)
        i += 1
    if to_date:
        conditions.append(f"extracted_at <= ${i}")
        vals.append(to_date)
        i += 1

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    vals += [limit, offset]

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT id, job_id, folder_name, client_name, database_name,
                   instance_name, report_date, total_files, extracted_at, flags
            FROM extractions
            {where}
            ORDER BY extracted_at DESC
            LIMIT ${i} OFFSET ${i+1}
            """,
            *vals,
        )
    return [dict(r) for r in rows]


async def delete_extraction(extraction_id: str) -> bool:
    async with pool.acquire() as conn:
        result = await conn.execute("DELETE FROM extractions WHERE id = $1", extraction_id)
    return result == "DELETE 1"
