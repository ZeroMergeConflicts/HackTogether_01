from HackTogether_01.backend.ai.client import AIClient
from HackTogether_01.backend.ai.analyzer import AIAnalyzer
from HackTogether_01.backend.database.database import DatabaseManager
from HackTogether_01.backend.services.query_service import QueryService


def test_math_and_general_queries_never_dump_personal_context(self):
    db = DatabaseManager(":memory:")
    try:
        file_id = db.upsert_file(
            name="symposium_notice.txt",
            path="/tmp/symposium_notice.txt",
            file_hash="abc123",
            extension=".txt",
            mime_type="text/plain",
            size=512,
            modified_at=123456,
            status="analyzed",
        )
        db.insert_context(
            file_id=file_id,
            summary="Tech Symposium Notice",
            data={
                "actions": ["Submit project abstract before registration deadline"],
                "deadlines": ["Registration closes on 30 September"],
                "amounts": ["₹500"],
            },
        )

        client = AIClient(api_key="")
        client.client = None
        service = QueryService(db, AIAnalyzer(client), client)

        math_res = service.answer_query("whats 5*6")
        self.assertEqual(math_res["answer"], "30.")
        self.assertEqual(math_res["sources"], [])
        self.assertNotIn("abstract", math_res["answer"].lower())

        gen_res = service.answer_query("What's the capital of Japan?")
        self.assertEqual(gen_res["answer"], "Tokyo.")
        self.assertEqual(gen_res["sources"], [])
    finally:
        db.close()
