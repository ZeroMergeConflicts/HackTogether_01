from __future__ import annotations

from fastapi.testclient import TestClient
from HackTogether_01.backend.ai.analyzer import AIAnalyzer
from HackTogether_01.backend.api.routes import create_app


def test_upload_stores_sanitized_files_and_indexes_them(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        AIAnalyzer,
        "analyze_file",
        lambda self, file_path: {"summary": file_path.name},
    )
    monkeypatch.setattr(
        AIAnalyzer,
        "find_relationships",
        lambda self, analysis, contexts: [],
    )
    app = create_app(db_path=str(tmp_path / "upload-test.db"))
    app.state.upload_folder = tmp_path / "uploaded"

    with TestClient(app) as client:
        response = client.post(
            "/api/upload",
            files=[
                ("files", ("../notes.txt", b"first note", "text/plain")),
                ("files", ("notes.txt", b"second note", "text/plain")),
            ],
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["uploaded"] == ["notes.txt", "notes_1.txt"]
    assert (app.state.upload_folder / "notes.txt").read_bytes() == b"first note"
    assert (app.state.upload_folder / "notes_1.txt").read_bytes() == b"second note"
    assert payload["folder_path"] == str(app.state.upload_folder.resolve())
    assert payload["scan"]["total"] == 2
    assert payload["scan"]["failed"] == 0


def test_upload_rejects_unsupported_files_before_saving_any(tmp_path) -> None:
    app = create_app(db_path=str(tmp_path / "upload-test.db"))
    app.state.upload_folder = tmp_path / "uploaded"

    with TestClient(app) as client:
        response = client.post(
            "/api/upload",
            files=[
                ("files", ("notes.txt", b"valid", "text/plain")),
                (
                    "files",
                    ("program.exe", b"unsupported", "application/octet-stream"),
                ),
            ],
        )

    assert response.status_code == 400
    assert not app.state.upload_folder.exists()
