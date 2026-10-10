from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "HackTogether_01" / "frontend"
OUTPUT = ROOT / "dist" / "pages"
WORKSPACE_MARKER = (
    "    <!-- =====================================================================\n"
    "         SHELL 2: 7-VIEW WORKSPACE APPLICATION"
)


def main() -> None:
    source = (FRONTEND / "index.html").read_text(encoding="utf-8")
    if WORKSPACE_MARKER not in source:
        raise RuntimeError(
            "Could not find the workspace boundary in frontend/index.html."
        )

    landing = source.split(WORKSPACE_MARKER, maxsplit=1)[0]
    landing = landing.replace(
        '<body data-shell-mode="landing">',
        '<body id="top" data-shell-mode="landing">',
        1,
    )
    landing = landing.replace('href="#/welcome"', 'href="#top"')
    landing += '  <script src="pages.js"></script>\n  </body>\n</html>\n'

    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "index.html").write_text(landing, encoding="utf-8")
    (OUTPUT / "style.css").write_bytes((FRONTEND / "style.css").read_bytes())
    (OUTPUT / "pages.js").write_bytes((FRONTEND / "pages.js").read_bytes())
    (OUTPUT / ".nojekyll").touch()


if __name__ == "__main__":
    main()
