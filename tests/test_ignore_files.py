from __future__ import annotations

from fastapi.testclient import TestClient
from HackTogether_01.backend.ai.analyzer import AIAnalyzer
from HackTogether_01.backend.api.routes import create_app


def add_file(db, path: str, name: str) -> int:
    return db.upsert_file(
        name=name,
        path=path,
        file_hash=f"hash-{name}",
        extension=".txt",
        mime_type="text/plain",
        size=24,
        modified_at=123456,
        status="analyzed",
    )


def test_ignoring_file_preserves_it_but_hides_context_and_links(tmp_path) -> None:
    app = create_app(db_path=str(tmp_path / "ignore-test.db"))
    db = app.state.db
    ignored_id = add_file(db, str(tmp_path / "private.txt"), "private.txt")
    active_id = add_file(db, str(tmp_path / "active.txt"), "active.txt")
    for file_id, name in ((ignored_id, "private.txt"), (active_id, "active.txt")):
        db.insert_context(
            file_id=file_id,
            summary=f"Context from {name}",
            data={"deadlines": [f"Deadline in {name}"]},
        )
    db.insert_relationship(
        source_id=ignored_id,
        target_id=active_id,
        relationship_type="same_topic",
        confidence=0.9,
        reason="Shared entity",
    )

    with TestClient(app) as client:
        response = client.patch(
            f"/api/files/{ignored_id}/ignore",
            json={"ignored": True},
        )
        assert response.status_code == 200
        assert response.json()["file"]["ignored"] == 1

        files = client.get("/api/files").json()["files"]
        contexts = client.get("/api/context").json()["context"]
        relationships = client.get("/api/relationships").json()["relationships"]
        query = client.post(
            "/api/query",
            json={"query": "What is the deadline in private.txt?"},
        ).json()

        assert len(files) == 2
        assert next(file for file in files if file["id"] == ignored_id)["path"] == str(
            tmp_path / "private.txt"
        )
        assert [context["filename"] for context in contexts] == ["active.txt"]
        assert relationships == []
        assert all(source["file_id"] != ignored_id for source in query["sources"])
        assert "private.txt" not in query["answer"]

        restored = client.patch(
            f"/api/files/{ignored_id}/ignore",
            json={"ignored": False},
        )
        assert restored.status_code == 200
        assert len(client.get("/api/context").json()["context"]) == 2


def test_scan_skips_previously_ignored_file(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        AIAnalyzer,
        "analyze_file",
        lambda self, file_path: (_ for _ in ()).throw(
            AssertionError("Ignored files must not be analyzed.")
        ),
    )
    app = create_app(db_path=str(tmp_path / "ignore-scan-test.db"))
    folder = tmp_path / "documents"
    folder.mkdir()
    path = folder / "private.txt"
    path.write_text("Private notes", encoding="utf-8")
    file_id = add_file(app.state.db, str(path.resolve()), path.name)
    app.state.db.set_file_ignored(file_id, True)

    with TestClient(app) as client:
        response = client.post("/api/scan", json={"folder_path": str(folder)})

    assert response.status_code == 200
    assert response.json()["ignored"] == 1
    assert response.json()["processed"] == 0
    assert app.state.db.get_file(file_id)["ignored"] == 1
