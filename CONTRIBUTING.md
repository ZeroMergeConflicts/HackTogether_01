# Contributing to ContextVault

Thank you for your interest in contributing to ContextVault. Contributions are welcome through bug reports, documentation improvements, tests, and code changes.

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) before participating. For security vulnerabilities, follow the private reporting process in [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Before You Start

1. Check existing issues and pull requests to avoid duplicating work.
2. For significant changes, open an issue first so the proposed approach can be discussed.
3. Keep changes focused. Avoid mixing unrelated refactors or formatting changes into a feature or bug fix.

## Development Setup

ContextVault requires Python 3.10 or newer. From the repository root, create a virtual environment and install the dependencies:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

The optional `GEMINI_API_KEY` environment variable enables Gemini-powered analysis. The application can also run with its local fallback behavior, so a key is not required for most development and tests.

Start the application locally with:

```powershell
python main.py
```

Then open <http://127.0.0.1:8000>. See [README.md](README.md) for configuration details and API usage.

## Making Changes

- Backend code belongs under `HackTogether_01/backend/`.
- Frontend code belongs under `HackTogether_01/frontend/`.
- Add or update tests under `tests/` for behavior changes.
- Do not commit credentials, generated databases, uploaded files, virtual environments, or other local artifacts.
- Preserve source citations and privacy protections when changing ingestion or query behavior.
- Update relevant documentation when commands, configuration, APIs, or user-facing behavior change.

## Testing and Linting

Run the test suite before submitting a pull request:

```powershell
python -m unittest discover -s tests -v
```

Run the focused query-accuracy tests when changing retrieval or answer-generation behavior:

```powershell
python -m unittest tests.test_query_service_accuracy -v
```

Run Ruff and the type checker when available:

```powershell
python -m ruff check HackTogether_01 tests
python -m ty check
```

If a check cannot be run locally, mention that clearly in the pull request description.

## Pull Requests

Before opening a pull request:

1. Review the complete diff and remove unrelated changes.
2. Confirm that tests and applicable lint/type checks pass.
3. Explain the problem, the solution, and any user-visible behavior changes.
4. Include testing evidence and note any known limitations.
5. Ensure the pull request checklist is complete and request review from a maintainer.

Pull requests should target `main` unless a maintainer says otherwise. Reviewers may request changes to improve correctness, test coverage, maintainability, accessibility, or security.

## Reporting Bugs and Requesting Features

Use the repository issue forms for bug reports. Include reproducible steps, expected behavior, actual behavior, environment details, and relevant logs without exposing sensitive document contents or API keys.

Feature requests should describe the use case, the proposed behavior, and any alternatives considered. Small, well-scoped proposals are easier to evaluate and implement.
