from __future__ import annotations

import shutil
from pathlib import Path, PurePosixPath
from typing import Annotated, Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from ..ai.analyzer import AIAnalyzer
from ..ai.client import TEXT_EXTENSIONS, AIClient
from ..database.database import DatabaseManager
from ..ingestion.scanner import SUPPORTED_EXTENSIONS
from ..services.ingestion_service import IngestionService
from ..services.query_service import QueryService


class FolderSelectionRequest(BaseModel):
    folder_path: str = Field(..., min_length=1)


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1)


def create_app(db_path: str | None = None) -> FastAPI:
    app = FastAPI(title="ContextVault", version="0.2.0")
    db = DatabaseManager(db_path)
    ai_client = AIClient()
    analyzer = AIAnalyzer(ai_client)
    ingestion_service = IngestionService(db, analyzer)
    query_service = QueryService(db, analyzer, ai_client)

    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    app.mount("/static", StaticFiles(directory=str(frontend_dir)), name="static")
    app.state.db = db
    app.state.selected_folder = None
    app.state.scan_status = {
        "status": "idle",
        "total": 0,
        "processed": 0,
        "failed": 0,
    }
    app.state.upload_folder = Path(__file__).resolve().parents[3] / ".uploads"

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    async def home() -> FileResponse:
        return FileResponse(frontend_dir / "index.html")

    @app.get("/style.css")
    async def styles() -> FileResponse:
        return FileResponse(frontend_dir / "style.css", media_type="text/css")

    @app.get("/app.js")
    async def scripts() -> FileResponse:
        return FileResponse(
            frontend_dir / "app.js",
            media_type="application/javascript",
        )

    @app.get("/api/health")
    async def health() -> dict[str, object]:
        return {
            "status": "ok",
            "ai_configured": ai_client.is_configured(),
            "model": ai_client.model,
            "selected_folder": app.state.selected_folder,
        }

    @app.post("/api/folder/select")
    async def select_folder(request: FolderSelectionRequest) -> dict[str, str]:
        candidate = Path(request.folder_path).expanduser()
        if not candidate.exists():
            raise HTTPException(status_code=400, detail="Folder does not exist.")
        if not candidate.is_dir():
            raise HTTPException(
                status_code=400,
                detail="Selected path is not a directory.",
            )

        app.state.selected_folder = str(candidate.resolve())
        return {"folder_path": app.state.selected_folder, "status": "selected"}

    @app.post("/api/scan")
    async def scan_folder(request: FolderSelectionRequest) -> dict[str, Any]:
        candidate = Path(request.folder_path).expanduser()
        if not candidate.exists():
            raise HTTPException(status_code=400, detail="Folder does not exist.")
        if not candidate.is_dir():
            raise HTTPException(
                status_code=400,
                detail="Selected path is not a directory.",
            )

        app.state.selected_folder = str(candidate.resolve())
        app.state.scan_status = {
            "status": "processing",
            "total": 0,
            "processed": 0,
            "failed": 0,
        }

        result = ingestion_service.scan_folder(str(candidate.resolve()))
        app.state.scan_status = {
            "status": (
                "completed"
                if result.get("failed", 0) == 0
                else "completed_with_failures"
            ),
            "total": result.get("total", 0),
            "processed": result.get("processed", 0),
            "failed": result.get("failed", 0),
        }
        return result

    @app.post("/api/upload")
    async def upload_files(
        files: Annotated[list[UploadFile], File()],
    ) -> dict[str, Any]:
        if not files:
            raise HTTPException(status_code=400, detail="Select at least one file.")

        upload_folder: Path = app.state.upload_folder
        validated_files: list[tuple[UploadFile, str, str]] = []
        for upload in files:
            filename = PurePosixPath(
                (upload.filename or "").replace("\\", "/")
            ).name
            if not filename or filename in {".", ".."}:
                raise HTTPException(status_code=400, detail="Invalid filename.")

            extension = Path(filename).suffix.lower()
            if extension not in SUPPORTED_EXTENSIONS:
                supported = ", ".join(sorted(SUPPORTED_EXTENSIONS))
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Unsupported file type: {filename}. "
                        f"Supported types: {supported}."
                    ),
                )
            validated_files.append((upload, filename, extension))

        upload_folder.mkdir(parents=True, exist_ok=True)
        saved_files: list[str] = []

        for upload, filename, extension in validated_files:
            destination = upload_folder / filename
            suffix = 1
            while destination.exists():
                destination = upload_folder / (
                    f"{Path(filename).stem}_{suffix}{extension}"
                )
                suffix += 1

            try:
                with destination.open("wb") as output:
                    shutil.copyfileobj(upload.file, output)
            except OSError as exc:
                destination.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=500,
                    detail=f"Could not store {filename}: {exc}",
                ) from exc
            saved_files.append(destination.name)

        app.state.selected_folder = str(upload_folder.resolve())
        app.state.scan_status = {
            "status": "processing",
            "total": 0,
            "processed": 0,
            "failed": 0,
        }
        result = ingestion_service.scan_folder(str(upload_folder.resolve()))
        app.state.scan_status = {
            "status": (
                "completed"
                if result.get("failed", 0) == 0
                else "completed_with_failures"
            ),
            "total": result.get("total", 0),
            "processed": result.get("processed", 0),
            "failed": result.get("failed", 0),
        }
        return {
            "uploaded": saved_files,
            "folder_path": app.state.selected_folder,
            "scan": result,
        }

    @app.get("/api/scan/status")
    async def get_scan_status() -> dict[str, int | str | Any]:
        return app.state.scan_status

    @app.get("/api/files")
    async def get_files() -> dict[str, list[dict[str, object]]]:
        return {"files": db.get_files()}

    @app.get("/api/files/{file_id}")
    async def get_file(file_id: int) -> dict[str, object]:
        record = db.get_file(file_id)
        if record is None:
            raise HTTPException(status_code=404, detail="File not found.")
        return {
            "file": record,
            "context": db.get_context_for_file(file_id),
        }

    @app.get("/api/files/{file_id}/preview")
    async def preview_file(file_id: int) -> dict[str, object]:
        record = db.get_file(file_id)
        if record is None:
            raise HTTPException(status_code=404, detail="File not found.")

        file_path = Path(str(record.get("path") or ""))
        ext = str(record.get("extension") or file_path.suffix).lower()
        exists_on_disk = file_path.exists() and file_path.is_file()

        preview_type = "binary"
        text_content: str | None = None

        if ext in TEXT_EXTENSIONS:
            preview_type = "text"
            if exists_on_disk:
                try:
                    text_content = file_path.read_text(
                        encoding="utf-8",
                        errors="replace",
                    )[:15000]
                except Exception as exc:
                    text_content = f"Unable to read file content: {exc}"
        elif ext in {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".svg"}:
            preview_type = "image"
        elif ext == ".pdf":
            preview_type = "pdf"

        contexts = db.get_context_for_file(file_id)
        relationships = [
            rel
            for rel in db.get_relationships()
            if rel.get("source_id") == file_id or rel.get("target_id") == file_id
        ]

        return {
            "file": record,
            "exists_on_disk": exists_on_disk,
            "preview_type": preview_type,
            "text_content": text_content,
            "raw_url": f"/api/files/{file_id}/raw" if exists_on_disk else None,
            "context": contexts,
            "relationships": relationships,
        }

    @app.get("/api/files/{file_id}/raw")
    async def raw_file(file_id: int) -> FileResponse:
        record = db.get_file(file_id)
        if record is None:
            raise HTTPException(status_code=404, detail="File not found.")

        file_path = Path(str(record.get("path") or ""))
        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(
                status_code=404,
                detail="Physical file is no longer at its original path.",
            )

        media_type = str(record.get("mime_type") or "application/octet-stream")
        return FileResponse(
            path=file_path,
            media_type=media_type,
            filename=str(record.get("name") or file_path.name),
        )

    @app.get("/api/context")
    async def get_context() -> dict[str, list[dict[str, object]]]:
        return {"context": db.get_context()}

    @app.get("/api/relationships")
    async def get_relationships() -> dict[str, list[dict[str, object]]]:
        return {"relationships": db.get_relationships()}

    @app.get("/api/errors")
    async def get_errors() -> dict[str, list[dict[str, object]]]:
        return {"errors": db.get_errors()}

    @app.post("/api/query")
    async def answer_query(request: QueryRequest) -> dict[str, object]:
        if not request.query.strip():
            raise HTTPException(status_code=400, detail="Query cannot be empty.")
        return query_service.answer_query(request.query)  # type: ignore

    return app


app = create_app()
