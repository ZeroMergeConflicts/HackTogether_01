from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "HackTogether_01" / "frontend"
OUTPUT = ROOT / "dist" / "pages"


def main() -> None:
    source = (FRONTEND / "index.html").read_text(encoding="utf-8")
    body_marker = '<body data-shell-mode="landing">'
    app_script = '    <script src="app.js"></script>'
    if body_marker not in source or app_script not in source:
        raise RuntimeError("Could not find the expected app shell markers.")
    source = source.replace(
        body_marker,
        '<body data-shell-mode="workspace">',
        1,
    )
    source = source.replace(
        app_script,
        '    <script src="pages.js"></script>',
        1,
    )

    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "index.html").write_text(source, encoding="utf-8")
    (OUTPUT / "style.css").write_bytes((FRONTEND / "style.css").read_bytes())
    (OUTPUT / "pages.js").write_bytes((FRONTEND / "pages.js").read_bytes())
    (OUTPUT / ".nojekyll").touch()


if __name__ == "__main__":
    main()
