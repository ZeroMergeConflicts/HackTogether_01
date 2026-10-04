from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from google import genai
from google.genai import types

TEXT_EXTENSIONS = {".txt", ".md", ".csv", ".json", ".html", ".htm", ".svg"}


class AIClient:
    """Thin Gemini adapter. This module knows how to speak to the provider."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
    ) -> None:
        raw_key = api_key or os.getenv("GEMINI_API_KEY")
        self.api_key = raw_key.strip() if raw_key else None
        self.model = (model or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")).strip()
        self.client = genai.Client(api_key=self.api_key) if self.api_key else None

    def is_configured(self) -> bool:
        return self.client is not None

    def _require_client(self) -> Any:
        if self.client is None:
            raise ValueError("GEMINI_API_KEY is not configured.")
        return self.client

    def upload_file(self, file_path: Path) -> Any:
        """Upload a local file to Gemini and return the uploaded resource."""
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        if not file_path.is_file():
            raise ValueError(f"Not a file: {file_path}")

        client = self._require_client()
        return client.files.upload(file=file_path)

    def generate_json(
        self,
        prompt: str,
        files: list[Any] | None = None,
        response_schema: dict[str, Any] | None = None,
        system_instruction: str | None = None,
    ) -> dict[str, Any]:
        """Call Gemini and parse a JSON response object."""
        client = self._require_client()
        contents: list[Any] = []

        if files:
            contents.extend(files)

        contents.append(prompt)

        config_kwargs: dict[str, Any] = {"response_mime_type": "application/json"}
        if response_schema:
            config_kwargs["response_schema"] = response_schema
        if system_instruction:
            config_kwargs["system_instruction"] = system_instruction

        response = client.models.generate_content(
            model=self.model,
            contents=contents,
            config=types.GenerateContentConfig(**config_kwargs),
        )

        if not getattr(response, "text", None):
            raise ValueError("Gemini returned an empty response.")

        try:
            result = json.loads(response.text)
        except json.JSONDecodeError as exc:
            raise ValueError("Gemini returned invalid JSON.") from exc

        if not isinstance(result, dict):
            raise ValueError("Gemini response must be a JSON object.")

        return result

    def analyze_file(
        self,
        file_path: Path,
        prompt: str,
        response_schema: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if file_path.suffix.lower() in TEXT_EXTENSIONS:
            text_content = file_path.read_text(encoding="utf-8", errors="ignore")
            combined_prompt = (
                f"{prompt}\n\n"
                f"--- BEGIN FILE ({file_path.name}) ---\n"
                f"{text_content}\n"
                f"--- END FILE ---"
            )
            return self.generate_json(
                prompt=combined_prompt,
                response_schema=response_schema,
            )

        uploaded_file = self.upload_file(file_path)
        return self.generate_json(
            prompt=prompt,
            files=[uploaded_file],
            response_schema=response_schema,
        )

    def analyze_files(
        self,
        file_paths: list[Path],
        prompt: str,
        response_schema: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        uploaded_files = [self.upload_file(file_path) for file_path in file_paths]
        return self.generate_json(
            prompt=prompt,
            files=uploaded_files,
            response_schema=response_schema,
        )
