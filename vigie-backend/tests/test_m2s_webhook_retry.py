import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.config import config
from app.main import app


class M2SWhatsappWebhookTests(unittest.TestCase):
    def setUp(self):
        self.previous_api_key = config.vigie_api_key
        config.vigie_api_key = "vigie-test-key"
        self.repo = SimpleNamespace(update_whatsapp_alert_status=lambda **_values: True)
        self.repo_patch = patch(
            "app.routers.m2s_whatsapp_webhook.get_repo",
            return_value=self.repo,
        )
        self.repo_patch.start()
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.repo_patch.stop()
        config.vigie_api_key = self.previous_api_key

    def test_m2s_bearer_webhook_is_accepted(self):
        response = self.client.post(
            "/api/webhooks/m2s-whatsapp",
            headers={"Authorization": "Bearer vigie-test-key"},
            json={
                "id": "event-1",
                "type": "message.delivered",
                "occurred_at": "2026-07-21T11:00:00+01:00",
                "instance_id": "instance-1",
                "data": {"message_id": "message-1"},
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["tracked"])

    def test_missing_bearer_is_rejected(self):
        response = self.client.post(
            "/api/webhooks/m2s-whatsapp",
            json={"id": "event-2", "type": "message.sent", "data": {}},
        )
        self.assertEqual(response.status_code, 401)


if __name__ == "__main__":
    unittest.main()
