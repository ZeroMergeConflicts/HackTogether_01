from __future__ import annotations

import hashlib
from pathlib import Path

SUPPORTED_EXTENSIONS = {
    ".txt",
    ".md",
    ".csv",
    ".json",
    ".html",
    ".htm",
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".bmp",
    ".webp",
    ".svg",
}


class FolderScanner:
    """Filesystem-only discovery component."""

    def __init__(self, folder_path: str) -> None:
        self.folder_path = Path(folder_path).expanduser()

    def validate_folder(self) -> Path:
        if not self.folder_path.exists():
            raise FileNotFoundError(f"Folder does not exist: {self.folder_path}")
        if not self.folder_path.is_dir():
            raise NotADirectoryError(f"Not a directory: {self.folder_path}")
        return self.folder_path

    def get_files(self) -> list[Path]:
        base = self.validate_folder()
        files: list[Path] = []
        for file_path in sorted(base.rglob("*")):
            if file_path.is_file() and file_path.suffix.lower() in SUPPORTED_EXTENSIONS:
                files.append(file_path)
        return files

    def get_file_hash(self, file_path: Path) -> str:
        digest = hashlib.sha256()
        with file_path.open("rb") as handle:
            while chunk := handle.read(8192):
                digest.update(chunk)
        return digest.hexdigest()

    def get_file_metadata(self, file_path: Path) -> dict[str, object]:
        stat = file_path.stat()
        return {
            "name": file_path.name,
            "path": str(file_path.resolve()),
            "extension": file_path.suffix.lower(),
            "size": stat.st_size,
            "modified_at": stat.st_mtime,
            "mime_type": "application/octet-stream",
        }
