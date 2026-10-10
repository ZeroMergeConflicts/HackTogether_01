# ContextVault

ContextVault is a local-first personal context engine. It scans a folder of documents, extracts structured facts, connects related files, and answers questions with links back to the source material.

The app includes a browser-based dashboard, AI question answering, an action and deadline board, a knowledge graph, searchable file/context views, and file previews.

## Features

- Recursively scans supported files and uses SHA-256 hashes to skip unchanged files.
- Extracts summaries, people, events, dates, deadlines, actions, amounts, and other facts.
- Links related documents and exposes the evidence behind answers.
- Supports Gemini-powered multimodal analysis when an API key is configured.
- Runs with a local fallback when Gemini is not configured; fallback analysis and answers are more limited.
- Accepts multiple files from the Upload Files page via file picker or drag and drop, then stores and indexes them in the server's `.uploads/` folder without a per-file size limit.
- Stores file metadata and extracted context in SQLite.

## Requirements

- Python 3.10 or newer is recommended.
- Gemini API key for Gemini-powered file analysis and general-knowledge answers. It is optional for local fallback behavior.
- Internet access to install Python packages. The frontend also loads fonts and Lucide icons from external CDNs.

## Install and Run

From PowerShell, at the repository root:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Configure Gemini in the current PowerShell session if you want Gemini-powered analysis:

```powershell
$env:GEMINI_API_KEY = "your-gemini-api-key"
$env:GEMINI_MODEL = "gemini-2.5-flash"
```

`GEMINI_API_KEY` is optional. The application reads configuration from process environment variables. It does not load a `.env` file automatically, so placing a key in `.env` alone will not configure the app unless your shell or development tool loads that file.

Start the application:

```powershell
python main.py
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). Interactive API documentation is available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

You can also start the development server directly:

```powershell
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | Unset | Enables Gemini file analysis and general-knowledge answers. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model name used by the adapter. |
| `DATABASE_URL` | `contextvault.db` in the repository root | SQLite database path. Despite its name, this currently accepts a filesystem path, not a remote database URL. Use `:memory:` for an in-memory database in development/tests. |

The database is created automatically on startup. The generated `contextvault.db`, `.env`, `.venv`, `.test/`, and `.uploads/` are ignored by Git.

## Use the App

1. Start the server and open the dashboard.
2. Upload documents on the **Upload Files** page by browsing or dragging files into the drop zone. Uploads are stored in `.uploads/` on the backend machine and indexed automatically.
3. Alternatively, enter a folder path accessible to the backend. The default path is `.test` relative to the server's working directory.
4. Select **Scan Folder**. Scans are recursive; new and modified files are analyzed, while unchanged files are skipped by hash.
5. Use the dashboard or workspace navigation to review extracted context, tasks, deadlines, links, and files.
6. Ask a question in Instant Synthesis or AI Studio. Personal answers include source files when supporting evidence is available.

The scanner supports `.txt`, `.md`, `.csv`, `.json`, `.html`, `.htm`, `.pdf`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`, `.webp`, and `.svg` files. PDF and image understanding requires Gemini configuration. Without Gemini, text files use a limited local extractor; binary files cannot be meaningfully analyzed by that fallback.

Scanning does not automatically remove database records for files that have since been deleted from disk. Existing file metadata and extracted context remain in SQLite.

## API Overview

All routes use the local FastAPI server. Request and response schemas are also browsable at `/docs`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Reports service status, selected model, Gemini configuration, and selected folder. |
| `POST` | `/api/folder/select` | Validates and records a folder path. Body: `{"folder_path": "..."}`. |
| `POST` | `/api/scan` | Scans and processes a folder. Body: `{"folder_path": "..."}`. |
| `POST` | `/api/upload` | Accepts multiple `files` multipart form fields, stores files in `.uploads/`, and indexes that folder. |
| `GET` | `/api/scan/status` | Returns the most recently recorded scan status. |
| `GET` | `/api/files` | Lists indexed files. |
| `GET` | `/api/files/{file_id}` | Returns a file and its extracted context. |
| `GET` | `/api/files/{file_id}/preview` | Returns preview metadata, context, and related files. |
| `GET` | `/api/files/{file_id}/raw` | Serves the original file if it still exists at its recorded path. |
| `GET` | `/api/context` | Lists extracted context records. |
| `GET` | `/api/relationships` | Lists cross-file relationships. |
| `GET` | `/api/errors` | Lists ingestion errors. |
| `POST` | `/api/query` | Answers a question. Body: `{"query": "What is my next deadline?"}`. |

Example PowerShell requests:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health"

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/query" `
  -Method Post `
  -ContentType "application/json" `
  -Body (@{ query = "What is my next deadline?" } | ConvertTo-Json)
```

Query responses include `answer`, `confidence`, `has_sufficient_context`, and `sources`. When personal information is not supported by retrieved records, the service reports that it could not find the information instead of asking Gemini to guess. Sources identify the files used to support the response; verify critical details against the original documents.

## Architecture

```text
Browser UI
	| HTTP / JSON
FastAPI routes
	|-- IngestionService --> FolderScanner --> SHA-256 --> AIAnalyzer --> AIClient/Gemini
	|                                      \--------------------> local fallback
	|-- QueryService --> SQLite context retrieval --> grounded answer + sources
	`-- DatabaseManager --> SQLite
```

The frontend is plain HTML, CSS, and JavaScript served by FastAPI. The backend separates API routing, ingestion, AI provider access, query reasoning, and SQLite persistence.

```text
HackTogether_01/
|-- main.py
|-- requirements.txt
|-- pyproject.toml
|-- HackTogether_01/
|   |-- backend/
|   |   |-- ai/          # Gemini adapter and file analysis
|   |   |-- api/         # FastAPI routes
|   |   |-- database/    # SQLite persistence
|   |   |-- ingestion/   # Recursive scanning and hashes
|   |   `-- services/    # Ingestion and query orchestration
|   `-- frontend/        # index.html, app.js, style.css
`-- tests/
```

## Tests and Linting

Run the focused query-accuracy regression tests:

```powershell
python -m unittest tests.test_query_service_accuracy -v
```

If Ruff is installed, lint the backend and tests with:

```powershell
python -m ruff check HackTogether_01 tests
```

## Privacy and Security

- Treat scanned documents as sensitive. When Gemini is configured, supported files are sent to Google's Gemini API for analysis.
- Keep `GEMINI_API_KEY` out of source control and do not commit credentials.
- The development server binds to `127.0.0.1` by default. The API currently has no authentication and enables permissive CORS; do not expose it to an untrusted network without adding access controls and reviewing the deployment configuration.
- Only scan folders you are authorized to access. Review source citations before relying on an answer for important decisions.
- See [SECURITY.md](SECURITY.md) for vulnerability reporting guidance.
