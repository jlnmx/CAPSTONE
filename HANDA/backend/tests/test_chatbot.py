import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from app import main
from app.auth import CurrentUser
from app.config import Settings
from app.schemas import ChatbotRequest


class FakeResponse:
    def __init__(self, payload):
        self.payload = json.dumps(payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def read(self):
        return self.payload


class ChatbotTests(unittest.TestCase):
    def test_groq_environment_aliases_configure_provider(self):
        settings = Settings(_env_file=None, GROQ_API_KEY="test-key", GROQ_MODEL="test-model")

        self.assertEqual(settings.chatbot_api_base_url, "https://api.groq.com/openai/v1")
        self.assertTrue(settings.chatbot_api_key)
        self.assertEqual(settings.chatbot_model, "test-model")

    def setUp(self):
        self.user = CurrentUser("resident-1", "resident@example.com", "Resident", "resident", 0)
        self.settings = SimpleNamespace(
            chatbot_api_base_url="https://model.example/v1",
            chatbot_api_key="server-secret",
            chatbot_model="test-model",
            chatbot_timeout_seconds=5,
        )

    def test_chatbot_forwards_history_and_reference_context_to_model(self):
        request = ChatbotRequest(
            messages=[
                {"role": "user", "content": "What should I pack?"},
                {"role": "assistant", "content": "Prepare essentials."},
                {"role": "user", "content": "What about for a toddler?"},
            ],
            context="HANDA reference: evacuation registration is available.",
        )
        response = FakeResponse({"choices": [{"message": {"content": "Pack child-safe food and medicine."}}]})

        with patch.object(main, "settings", self.settings), patch.object(main, "urlopen", return_value=response) as urlopen:
            result = main.chatbot_answer(request, self.user)

        provider_request = urlopen.call_args.args[0]
        payload = json.loads(provider_request.data.decode("utf-8"))
        self.assertEqual(provider_request.full_url, "https://model.example/v1/chat/completions")
        self.assertEqual(provider_request.get_header("Authorization"), "Bearer server-secret")
        self.assertEqual(payload["model"], "test-model")
        self.assertIn("untrusted live handa reference data", payload["messages"][1]["content"].lower())
        self.assertEqual(payload["messages"][-1]["content"], "What about for a toddler?")
        self.assertEqual(result["answer"], "Pack child-safe food and medicine.")

    def test_chatbot_requires_provider_configuration(self):
        request = ChatbotRequest(messages=[{"role": "user", "content": "What should I prepare?"}])
        configuration = SimpleNamespace(chatbot_api_base_url="", chatbot_api_key="", chatbot_model="")

        with patch.object(main, "settings", configuration), self.assertRaises(HTTPException) as error:
            main.chatbot_answer(request, self.user)

        self.assertEqual(error.exception.status_code, 503)

    def test_chatbot_requires_latest_message_to_be_from_user(self):
        request = ChatbotRequest(messages=[{"role": "assistant", "content": "What else do you need?"}])

        with patch.object(main, "settings", self.settings), self.assertRaises(HTTPException) as error:
            main.chatbot_answer(request, self.user)

        self.assertEqual(error.exception.status_code, 422)


if __name__ == "__main__":
    unittest.main()