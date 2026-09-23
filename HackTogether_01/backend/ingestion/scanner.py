import hashlib
from pathlib import Path


class FolderScanner:
    def __init__(self, folder_path: str):
        self.folder_path = Path(folder_path)

    def get_files(self) -> list[Path]:

        if not self.folder_path.exists():
            raise FileNotFoundError(f"Folder does not exist: {self.folder_path}")

        if not self.folder_path.is_dir():
            raise NotADirectoryError(f"Not a directory: {self.folder_path}")

        return [file for file in self.folder_path.rglob("*") if file.is_file()]

    def get_file_hash(self, file_path: Path) -> str:

        sha256 = hashlib.sha256()

        with file_path.open("rb") as file:
            while chunk := file.read(8192):
                sha256.update(chunk)

        return sha256.hexdigest()

