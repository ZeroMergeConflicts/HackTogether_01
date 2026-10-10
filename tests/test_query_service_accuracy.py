from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any, cast, override

from HackTogether_01.backend.ai.analyzer import AIAnalyzer
from HackTogether_01.backend.ai.client import AIClient
from HackTogether_01.backend.database.database import DatabaseManager
from HackTogether_01.backend.services.query_service import QueryService


class FakeDatabase:
    def __init__(self, contexts: list[dict[str, Any]]) -> None:
        self.contexts = contexts

    def get_context(self) -> list[dict[str, Any]]:
        return self.contexts


class FakeAIClient:
    def __init__(self, response: dict[str, Any]) -> None:
        self.response = response
        self.calls = 0
        self.last_prompt = ""
        self.last_options: dict[str, Any] = {}

    def is_configured(self) -> bool:
        return True

    def generate_json(self, **kwargs: Any) -> dict[str, Any]:
        self.calls += 1
        self.last_prompt = str(kwargs.get("prompt", ""))
        self.last_options = kwargs
        return self.response


class QueryServiceAccuracyTests(unittest.TestCase):
    @override
    def setUp(self) -> None:
        self.context = {
            "file_id": 1,
            "filename": "project_deadline.txt",
            "summary": "Project deadline",
            "data": {
                "deadlines": ["Project submission deadline is 30 September 2026"],
            },
        }

    @staticmethod
    def make_service(database: FakeDatabase, client: FakeAIClient) -> QueryService:
        return QueryService(
            cast(DatabaseManager, database),
            cast(AIAnalyzer, object()),
            cast(AIClient, client),
        )

    def test_personal_question_without_evidence_never_reaches_model(self) -> None:
        client = FakeAIClient(
            {
                "answer": "Your passport number is X1234567.",
                "confidence": 0.99,
                "has_sufficient_context": True,
                "relevant_file_ids": [123],
            }
        )
        service = self.make_service(FakeDatabase([]), client)

        result = service.answer_query("What is my passport number?")

        self.assertEqual(client.calls, 0)
        self.assertFalse(result["has_sufficient_context"])
        self.assertEqual(result["sources"], [])
        self.assertNotIn("X1234567", result["answer"])

    def test_answer_with_unretrieved_source_id_uses_grounded_fallback(self) -> None:
        client = FakeAIClient(
            {
                "answer": "The project is due next year.",
                "confidence": 0.99,
                "has_sufficient_context": True,
                "relevant_file_ids": [999],
            }
        )
        service = self.make_service(FakeDatabase([self.context]), client)

        result = service.answer_query("When is my project deadline?")

        self.assertNotIn("next year", result["answer"])
        self.assertIn("30 September 2026", result["answer"])
        self.assertEqual(
            result["sources"],
            [{"file_id": 1, "filename": "project_deadline.txt"}],
        )

    def test_valid_citation_is_kept_and_confidence_is_clamped(self) -> None:
        client = FakeAIClient(
            {
                "answer": "The deadline is 30 September 2026.",
                "confidence": 1.7,
                "has_sufficient_context": True,
                "relevant_file_ids": [1],
            }
        )
        service = self.make_service(FakeDatabase([self.context]), client)

        result = service.answer_query("When is my project deadline?")

        self.assertEqual(result["confidence"], 1.0)
        self.assertTrue(result["has_sufficient_context"])
        self.assertEqual(result["sources"][0]["file_id"], 1)

    def test_invalid_confidence_uses_conservative_default(self) -> None:
        self.assertEqual(
            QueryService._normalize_confidence(float("nan"), default=0.5),
            0.5,
        )

    def test_arrival_time_query_reports_when_time_is_not_specified(self) -> None:
        context = {
            "file_id": 4,
            "filename": "coordinator_message.txt",
            "summary": "Tech Symposium coordination message",
            "data": {
                "events": ["Annual Tech Symposium"],
                "deadlines": ["Participant registration closes on 30 September 2026"],
                "important_facts": [
                    "The coordination team will share the final arrival time "
                    "with registered participants."
                ],
            },
        }
        client = FakeAIClient(
            {
                "answer": "Registration closes on 30 September 2026.",
                "confidence": 0.88,
                "has_sufficient_context": True,
                "relevant_file_ids": [4],
            }
        )
        service = self.make_service(FakeDatabase([context]), client)

        result = service.answer_query("What time should I arrive?")

        self.assertEqual(
            result["answer"],
            "The documents don't specify an arrival time. The symposium "
            "coordination team will share it with registered participants.",
        )
        self.assertFalse(result["has_sufficient_context"])
        self.assertEqual(
            result["sources"],
            [{"file_id": 4, "filename": "coordinator_message.txt"}],
        )
        self.assertEqual(client.calls, 0)

    def test_arrival_time_query_uses_explicit_arrival_time_only(self) -> None:
        context = {
            "file_id": 5,
            "filename": "arrival_details.txt",
            "summary": "Arrival details",
            "data": {
                "deadlines": ["Registration closes on 30 September 2026"],
                "important_facts": ["Please arrive at 9:30 AM for the symposium."],
            },
        }
        service = self.make_service(
            FakeDatabase([context]),
            FakeAIClient({}),
        )

        result = service.answer_query("What time should I arrive?")

        self.assertEqual(result["answer"], "The documents say to arrive at 9:30 AM.")
        self.assertTrue(result["has_sufficient_context"])
        self.assertEqual(
            result["sources"],
            [{"file_id": 5, "filename": "arrival_details.txt"}],
        )

    def test_event_date_query_does_not_return_registration_deadline(self) -> None:
        event_context = {
            "file_id": 2,
            "filename": "symposium.txt",
            "summary": "Tech Symposium 2026",
            "data": {
                "events": ["Annual Tech Symposium"],
                "event_dates": ["18 October 2026"],
                "dates": ["18 October 2026", "30 September 2026"],
                "deadlines": ["Registration deadline: 30 September 2026"],
            },
        }
        client = FakeAIClient(
            {
                "answer": "Registration deadline: 30 September 2026.",
                "confidence": 0.94,
                "has_sufficient_context": True,
                "relevant_file_ids": [2],
            }
        )
        service = self.make_service(FakeDatabase([event_context]), client)

        result = service.answer_query("When is the annual Tech Symposium?")

        self.assertEqual(
            result["answer"],
            "The Annual Tech Symposium is scheduled for 18 October 2026.",
        )
        self.assertNotIn("30 September", result["answer"])
        self.assertEqual(
            result["sources"],
            [{"file_id": 2, "filename": "symposium.txt"}],
        )
        self.assertEqual(client.calls, 0)

    def test_event_date_lookup_uses_legacy_dates_without_deadline_date(self) -> None:
        legacy_context = {
            "file_id": 3,
            "filename": "symposium.txt",
            "summary": "Annual Tech Symposium",
            "data": {
                "events": ["Annual Tech Symposium"],
                "dates": ["18 October 2026", "30 September 2026"],
                "deadlines": ["Registration deadline: 30 September 2026"],
            },
        }
        service = self.make_service(
            FakeDatabase([legacy_context]),
            FakeAIClient({}),
        )

        result = service.answer_query("When is the annual Tech Symposium?")

        self.assertIn("18 October 2026", result["answer"])
        self.assertNotIn("30 September", result["answer"])

    def test_registration_deadline_query_is_not_treated_as_event_date(self) -> None:
        event_context = {
            "file_id": 2,
            "filename": "symposium.txt",
            "summary": "Tech Symposium 2026",
            "data": {
                "events": ["Annual Tech Symposium"],
                "event_dates": ["18 October 2026"],
                "dates": ["18 October 2026", "30 September 2026"],
                "deadlines": ["Registration deadline: 30 September 2026"],
            },
        }
        client = FakeAIClient(
            {
                "answer": "Registration closes on 30 September 2026.",
                "confidence": 0.94,
                "has_sufficient_context": True,
                "relevant_file_ids": [2],
            }
        )
        service = self.make_service(FakeDatabase([event_context]), client)

        result = service.answer_query(
            "When is the registration deadline for the Tech Symposium?"
        )

        self.assertIn("30 September 2026", result["answer"])
        self.assertEqual(client.calls, 1)
        self.assertIn("Event Dates", client.last_prompt)
        self.assertIn("Deadlines", client.last_prompt)

    def test_fallback_extraction_separates_event_date_from_deadline(self) -> None:
        with TemporaryDirectory() as directory:
            source = Path(directory) / "symposium.txt"
            source.write_text(
                "TECH SYMPOSIUM 2026\n"
                "The Department is organizing the annual Tech Symposium "
                "on 18 October 2026.\n"
                "Registration deadline: 30 September 2026.\n"
                "The coordination team will share the final arrival time "
                "with registered participants.\n",
                encoding="utf-8",
            )
            analyzer = AIAnalyzer(cast(AIClient, object()))

            result = analyzer._fallback_analysis(source)

        self.assertEqual(result["event_dates"], ["18 October 2026"])
        self.assertEqual(
            result["deadlines"],
            ["Registration deadline: 30 September 2026"],
        )
        self.assertIn(
            "The coordination team will share the final arrival time "
            "with registered participants",
            result["important_facts"],
        )


if __name__ == "__main__":
    unittest.main()
