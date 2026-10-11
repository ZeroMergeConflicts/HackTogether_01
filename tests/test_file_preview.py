from __future__ import annotations

from fastapi.testclient import TestClient
from HackTogether_01.backend.api.routes import create_app


def test_text_file_preview_returns_complete_file_contents(tmp_path) -> None:
    file_path = tmp_path / "long-notes.txt"
    file_contents = "Start of file.\n" + "preview " * 5000 + "\nEnd of file."
    file_path.write_text(file_contents, encoding="utf-8")

    app = create_app(db_path=str(tmp_path / "preview-test.db"))
    file_id = app.state.db.upsert_file(
        name=file_path.name,
        path=str(file_path),
        file_hash="preview-test-hash",
        extension=".txt",
        mime_type="text/plain",
        size=file_path.stat().st_size,
        modified_at=file_path.stat().st_mtime,
        status="analyzed",
    )

    with TestClient(app) as client:
        response = client.get(f"/api/files/{file_id}/preview")

    assert response.status_code == 200
    payload = response.json()
    assert payload["preview_type"] == "text"
    assert payload["exists_on_disk"] is True
    assert payload["text_content"] == file_contents
