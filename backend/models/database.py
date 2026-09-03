"""
ReconcileX — Database Connection and Repository
Asynchronous SQLite database interface.
"""
from __future__ import annotations

import json
import logging
import sqlite3
from pathlib import Path
from typing import Any, Optional

import aiosqlite

from config import DB_DIR

logger = logging.getLogger(__name__)

DB_PATH = DB_DIR / "reconcilex.db"
SCHEMA_PATH = DB_DIR / "schema.sql"


async def init_db():
    """Initialize database tables from schema.sql."""
    DB_DIR.mkdir(parents=True, exist_ok=True)
    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")

    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(schema_sql)
        await db.commit()
    logger.info(f"Initialized database at {DB_PATH}")


def get_sync_db() -> sqlite3.Connection:
    """Get a synchronous connection with dict row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


async def get_db():
    """Async generator yielding an aiosqlite connection."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        yield db


# ── Database Operations ────────────────────────────────────────────────

async def insert_batch(batch: dict[str, Any]):
    """Insert a new reconciliation batch record."""
    async with aiosqlite.connect(DB_PATH) as db:
        cols = ", ".join(batch.keys())
        placeholders = ", ".join([f":{k}" for k in batch.keys()])
        query = f"INSERT INTO batches ({cols}) VALUES ({placeholders})"
        await db.execute(query, batch)
        await db.commit()


async def update_batch(batch_id: str, updates: dict[str, Any]):
    """Update fields on a reconciliation batch."""
    async with aiosqlite.connect(DB_PATH) as db:
        set_clause = ", ".join([f"{k} = :{k}" for k in updates.keys()])
        query = f"UPDATE batches SET {set_clause} WHERE id = :batch_id"
        updates["batch_id"] = batch_id
        await db.execute(query, updates)
        await db.commit()


async def get_batch_by_id(batch_id: str) -> Optional[dict[str, Any]]:
    """Retrieve a single batch by ID."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM batches WHERE id = ?", (batch_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def list_all_batches() -> list[dict[str, Any]]:
    """Retrieve all batches ordered by creation time descending."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM batches ORDER BY created_at DESC")
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


async def insert_recon_records(records: list[dict[str, Any]]):
    """Bulk insert reconciliation result records."""
    if not records:
        return

    async with aiosqlite.connect(DB_PATH) as db:
        keys = list(records[0].keys())
        cols = ", ".join(keys)
        placeholders = ", ".join([f":{k}" for k in keys])
        query = f"INSERT INTO recon_records ({cols}) VALUES ({placeholders})"

        # Convert dicts/lists to JSON strings for SQLite storage
        processed = []
        for r in records:
            item = dict(r)
            for k, v in item.items():
                if isinstance(v, (dict, list)):
                    item[k] = json.dumps(v)
            processed.append(item)

        await db.executemany(query, processed)
        await db.commit()


async def get_recon_records(
    batch_id: str,
    recon_level: Optional[str] = None,
    final_status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    """Retrieve paginated reconciliation records for a batch."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        where_clauses = ["batch_id = ?"]
        params: list[Any] = [batch_id]

        if recon_level:
            where_clauses.append("recon_level = ?")
            params.append(recon_level)
        if final_status:
            where_clauses.append("final_status = ?")
            params.append(final_status)

        where_str = " AND ".join(where_clauses)

        # Count total
        count_query = f"SELECT COUNT(*) FROM recon_records WHERE {where_str}"
        cursor = await db.execute(count_query, params)
        total = (await cursor.fetchone())[0]

        # Fetch page
        query = f"""
            SELECT * FROM recon_records
            WHERE {where_str}
            ORDER BY
                CASE final_status
                    WHEN 'EXCEPTION' THEN 1
                    WHEN 'NEEDS_REVIEW' THEN 2
                    ELSE 3
                END,
                created_at ASC
            LIMIT ? OFFSET ?
        """
        cursor = await db.execute(query, params + [limit, offset])
        rows = await cursor.fetchall()
        return [dict(r) for r in rows], total


async def get_record_detail(record_id: str) -> Optional[dict[str, Any]]:
    """Retrieve full record detail with audit logs."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM recon_records WHERE id = ?", (record_id,))
        row = await cursor.fetchone()
        if not row:
            return None

        record_dict = dict(row)

        # Parse JSON fields
        for field_name in ["ml_feature_vector", "ai_evidence"]:
            if record_dict.get(field_name):
                try:
                    record_dict[field_name] = json.loads(record_dict[field_name])
                except Exception:
                    pass

        # Fetch audit log
        audit_cursor = await db.execute(
            "SELECT * FROM audit_log WHERE recon_record_id = ? ORDER BY created_at ASC",
            (record_id,),
        )
        audit_rows = await audit_cursor.fetchall()
        record_dict["audit_trail"] = [dict(a) for a in audit_rows]

        return record_dict


async def insert_audit_entries(entries: list[dict[str, Any]]):
    """Insert audit trail log items."""
    if not entries:
        return

    async with aiosqlite.connect(DB_PATH) as db:
        keys = list(entries[0].keys())
        cols = ", ".join(keys)
        placeholders = ", ".join([f":{k}" for k in keys])
        query = f"INSERT INTO audit_log ({cols}) VALUES ({placeholders})"

        processed = []
        for e in entries:
            item = dict(e)
            if isinstance(item.get("details"), (dict, list)):
                item["details"] = json.dumps(item["details"])
            processed.append(item)

        await db.executemany(query, processed)
        await db.commit()
