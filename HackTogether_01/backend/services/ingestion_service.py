from __future__ import annotations

from typing import Any

from ..ai.analyzer import AIAnalyzer
from ..database.database import DatabaseManager
from ..ingestion.scanner import FolderScanner


class IngestionService:
    """Coordinate file discovery, hashing, analysis, and database persistence."""

    def __init__(self, db: DatabaseManager, analyzer: AIAnalyzer) -> None:
        self.db = db
        self.analyzer = analyzer

    def scan_folder(self, folder_path: str) -> dict[str, Any]:
        scanner = FolderScanner(folder_path)
        files = scanner.get_files()
        status = {
            "status": "processing",
            "total": len(files),
            "processed": 0,
            "failed": 0,
            "ignored": 0,
        }

        for file_path in files:
            metadata: Any = scanner.get_file_metadata(file_path)
            existing = self.db.get_file_by_path(str(file_path.resolve()))

            if existing and existing.get("ignored"):
                status["ignored"] += 1
                continue

            file_hash = scanner.get_file_hash(file_path)
            if existing:
                if existing["hash"] == file_hash:
                    self.db.update_file_status(existing["id"], "analyzed")
                    status["processed"] += 1
                    continue
                self.db.update_file_status(existing["id"], "changed")

            file_id = self.db.upsert_file(
                name=metadata["name"],
                path=str(file_path.resolve()),
                file_hash=file_hash,
                extension=metadata["extension"],
                mime_type=(
                    metadata.get("mime_type")
                    or self._mime_for_extension(metadata["extension"])
                ),
                size=metadata["size"],
                modified_at=metadata["modified_at"],
                status="processing",
            )

            try:
                analysis = self.analyzer.analyze_file(file_path)
                if not isinstance(analysis, dict):
                    raise ValueError("AI returned an invalid payload.")

                self.db.insert_context(
                    file_id=file_id,
                    summary=str(analysis.get("summary") or metadata["name"]),
                    data=analysis,
                )

                entity_names: list[str] = []
                for key in (
                    "entities",
                    "people",
                    "organizations",
                    "events",
                    "dates",
                    "deadlines",
                    "actions",
                    "amounts",
                    "important_facts",
                ):
                    for value in analysis.get(key, []) or []:
                        if isinstance(value, str) and value.strip():
                            entity_names.append(value.strip())

                for entity_name in sorted(set(entity_names)):
                    self.db.upsert_entity(entity_name, "context")
                    self.db.attach_file_entity(file_id, entity_name)

                self.db.update_file_status(file_id, "analyzed")
                status["processed"] += 1

                existing_context = [
                    context
                    for context in self.db.get_context()
                    if context["file_id"] != file_id
                ]
                if existing_context:
                    relationships = self.analyzer.find_relationships(
                        analysis,
                        existing_context,
                    )
                    for relationship in relationships:
                        self.db.insert_relationship(
                            source_id=file_id,
                            target_id=relationship.get(
                                "target_file_id",
                                existing_context[0]["file_id"],
                            ),
                            relationship_type=relationship.get(
                                "relationship_type",
                                "related",
                            ),
                            confidence=float(relationship.get("confidence", 0.5)),
                            reason=str(relationship.get("reason", "Shared context")),
                        )
            except Exception as exc:  # pragma: no cover - runtime/API smoke tests
                self.db.update_file_status(file_id, "failed")
                status["failed"] += 1
                status["processed"] += 1
                self.db.insert_error(file_id=file_id, message=str(exc))

        return {
            "status": "completed",
            "total": status["total"],
            "processed": status["processed"],
            "failed": status["failed"],
            "ignored": status["ignored"],
            "files": self.db.get_files(),
            "context": self.db.get_context(),
            "relationships": self.db.get_relationships(),
        }

    @staticmethod
    def _mime_for_extension(extension: str) -> str:
        mapping = {
            ".pdf": "application/pdf",
            ".txt": "text/plain",
            ".md": "text/markdown",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".bmp": "image/bmp",
            ".webp": "image/webp",
            ".json": "application/json",
            ".csv": "text/csv",
            ".html": "text/html",
            ".htm": "text/html",
            ".svg": "image/svg+xml",
        }
        return mapping.get(extension.lower(), "application/octet-stream")
