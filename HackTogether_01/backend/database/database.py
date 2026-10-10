from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any


class DatabaseManager:
    """SQLite-backed source of truth for files, context, relationships, and actions."""

    def __init__(self, db_path: str | None = None) -> None:
        default_path = Path(__file__).resolve().parents[3] / "contextvault.db"
        configured_path = db_path or os.getenv("DATABASE_URL", str(default_path))
        self.db_path: str | Path
        self._connection: sqlite3.Connection | None = None
        if configured_path == ":memory:":
            self.db_path = ":memory:"
        else:
            self.db_path = Path(configured_path)
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.initialize()

    def _connect(self) -> sqlite3.Connection:
        if self.db_path == ":memory:":
            if self._connection is None:
                self._connection = sqlite3.connect(":memory:")
                self._connection.row_factory = sqlite3.Row
            return self._connection

        connection = sqlite3.connect(str(self.db_path))
        connection.row_factory = sqlite3.Row
        return connection

    def close(self) -> None:
        """Explicitly close any open database handles if the manager owns one."""
        if self._connection is not None:
            self._connection.close()
            self._connection = None

    def initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS files (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    path TEXT NOT NULL UNIQUE,
                    hash TEXT,
                    extension TEXT,
                    mime_type TEXT,
                    size INTEGER,
                    modified_at REAL,
                    status TEXT NOT NULL DEFAULT 'new',
                    analyzed_at TEXT,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS contexts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_id INTEGER NOT NULL,
                    summary TEXT NOT NULL,
                    data TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(file_id) REFERENCES files(id)
                );

                CREATE TABLE IF NOT EXISTS entities (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    type TEXT NOT NULL DEFAULT 'context',
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS file_entities (
                    file_id INTEGER NOT NULL,
                    entity_id INTEGER NOT NULL,
                    PRIMARY KEY(file_id, entity_id),
                    FOREIGN KEY(file_id) REFERENCES files(id),
                    FOREIGN KEY(entity_id) REFERENCES entities(id)
                );

                CREATE TABLE IF NOT EXISTS relationships (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_id INTEGER NOT NULL,
                    target_id INTEGER NOT NULL,
                    relationship_type TEXT NOT NULL,
                    confidence REAL NOT NULL DEFAULT 0.0,
                    reason TEXT,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(source_id) REFERENCES files(id),
                    FOREIGN KEY(target_id) REFERENCES files(id)
                );

                CREATE TABLE IF NOT EXISTS actions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_id INTEGER NOT NULL,
                    description TEXT NOT NULL,
                    deadline TEXT,
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(file_id) REFERENCES files(id)
                );

                CREATE TABLE IF NOT EXISTS processing_errors (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_id INTEGER,
                    message TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                """
            )
            file_columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(files)").fetchall()
            }
            if "ignored" not in file_columns:
                connection.execute(
                    "ALTER TABLE files ADD COLUMN ignored INTEGER NOT NULL DEFAULT 0"
                )

    def upsert_file(
        self,
        *,
        name: str,
        path: str,
        file_hash: str,
        extension: str,
        mime_type: str,
        size: int,
        modified_at: float,
        status: str,
    ) -> int:
        with self._connect() as connection:
            existing = connection.execute(
                "SELECT id FROM files WHERE path = ?",
                (path,),
            ).fetchone()

            if existing:
                connection.execute(
                    """
                    UPDATE files
                    SET name = ?, hash = ?, extension = ?, mime_type = ?, size = ?,
                        modified_at = ?, status = ?, analyzed_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (
                        name,
                        file_hash,
                        extension,
                        mime_type,
                        size,
                        modified_at,
                        status,
                        existing["id"],
                    ),
                )
                return int(existing["id"])

            cursor = connection.execute(
                """
                INSERT INTO files (
                    name,
                    path,
                    hash,
                    extension,
                    mime_type,
                    size,
                    modified_at,
                    status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    name,
                    path,
                    file_hash,
                    extension,
                    mime_type,
                    size,
                    modified_at,
                    status,
                ),
            )
            return int(cursor.lastrowid)  # type: ignore

    def get_file_by_path(self, path: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM files WHERE path = ?",
                (path,),
            ).fetchone()
        return dict(row) if row else None

    def get_files(self) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute("SELECT * FROM files ORDER BY id ASC").fetchall()
        return [dict(row) for row in rows]

    def get_file(self, file_id: int) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM files WHERE id = ?",
                (file_id,),
            ).fetchone()
        return dict(row) if row else None

    def set_file_ignored(self, file_id: int, ignored: bool) -> bool:
        with self._connect() as connection:
            cursor = connection.execute(
                "UPDATE files SET ignored = ? WHERE id = ?",
                (int(ignored), file_id),
            )
        return cursor.rowcount > 0

    def update_file_status(self, file_id: int, status: str) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE files
                SET status = ?, analyzed_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (status, file_id),
            )

    def insert_context(
        self,
        *,
        file_id: int,
        summary: str,
        data: dict[str, Any],
    ) -> int:
        with self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO contexts (file_id, summary, data, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (file_id, summary, json.dumps(data, ensure_ascii=False)),
            )
            return int(cursor.lastrowid)  # type: ignore

    def get_context(self) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    c.id,
                    c.file_id,
                    f.name AS filename,
                    c.summary,
                    c.data,
                    c.created_at,
                    c.updated_at
                FROM contexts c
                LEFT JOIN files f ON f.id = c.file_id
                WHERE f.ignored = 0
                ORDER BY c.id ASC
                """
            ).fetchall()

        items: list[dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            item["data"] = json.loads(item["data"])
            items.append(item)
        return items

    def get_context_for_file(self, file_id: int) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    c.id,
                    c.file_id,
                    f.name AS filename,
                    c.summary,
                    c.data,
                    c.created_at,
                    c.updated_at
                FROM contexts c
                LEFT JOIN files f ON f.id = c.file_id
                WHERE c.file_id = ?
                ORDER BY c.id ASC
                """,
                (file_id,),
            ).fetchall()

        items: list[dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            item["data"] = json.loads(item["data"])
            items.append(item)
        return items

    def upsert_entity(self, name: str, entity_type: str = "context") -> int:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT id FROM entities WHERE name = ?",
                (name,),
            ).fetchone()
            if row:
                return int(row["id"])

            cursor = connection.execute(
                "INSERT INTO entities (name, type) VALUES (?, ?)",
                (name, entity_type),
            )
            return int(cursor.lastrowid)  # type: ignore

    def attach_file_entity(self, file_id: int, entity_name: str) -> None:
        entity_id = self.upsert_entity(entity_name)
        with self._connect() as connection:
            connection.execute(
                """
                INSERT OR IGNORE INTO file_entities (file_id, entity_id)
                VALUES (?, ?)
                """,
                (file_id, entity_id),
            )

    def insert_relationship(
        self,
        *,
        source_id: int,
        target_id: int,
        relationship_type: str,
        confidence: float,
        reason: str,
    ) -> int:
        with self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO relationships (
                    source_id,
                    target_id,
                    relationship_type,
                    confidence,
                    reason
                ) VALUES (?, ?, ?, ?, ?)
                """,
                (source_id, target_id, relationship_type, confidence, reason),
            )
            return int(cursor.lastrowid)  # type: ignore

    def get_relationships(self) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    r.id,
                    r.source_id,
                    r.target_id,
                    r.relationship_type,
                    r.confidence,
                    r.reason,
                    sf.name AS source_name,
                    tf.name AS target_name
                FROM relationships r
                JOIN files sf ON sf.id = r.source_id
                JOIN files tf ON tf.id = r.target_id
                WHERE sf.ignored = 0 AND tf.ignored = 0
                ORDER BY r.id ASC
                """
            ).fetchall()
        return [dict(row) for row in rows]

    def insert_error(self, *, file_id: int | None, message: str) -> int:
        with self._connect() as connection:
            cursor = connection.execute(
                "INSERT INTO processing_errors (file_id, message) VALUES (?, ?)",
                (file_id, message),
            )
            return int(cursor.lastrowid)  # type: ignore

    def get_errors(self) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM processing_errors ORDER BY created_at DESC"
            ).fetchall()
        return [dict(row) for row in rows]
