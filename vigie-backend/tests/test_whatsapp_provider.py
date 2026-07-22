import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.config import config
from app.providers.whatsapp import notify_handoff


class _M2SResponse:
    def raise_for_status(self):
        return None

    def json(self):
        return {"data": {"message_id": "01M2SMESSAGE", "status": "accepted"}}


class _Repo:
    def __init__(self):
        self.alert = None

    def get_settings(self):
        return SimpleNamespace(selected_whatsapp_id="contact-1")

    def record_whatsapp_alert(self, values):
        self.alert = values


class WhatsappProviderContractTests(unittest.TestCase):
    def setUp(self):
        self.previous_url = config.m2s_whatsapp_api_url
        config.m2s_whatsapp_api_url = "https://m2s.example/api/v1"
        self.repo = _Repo()

    def tearDown(self):
        config.m2s_whatsapp_api_url = self.previous_url

    def test_sends_m2s_api_contract_and_persists_message_id(self):
        with (
            patch(
                "app.providers.whatsapp._resolve_target",
                return_value=("+212 600-000-000", "m2s-token", "instance-1"),
            ),
            patch("app.providers.whatsapp.httpx.post", return_value=_M2SResponse()) as post,
            patch("app.repo.get_repo", return_value=self.repo),
        ):
            sent = notify_handoff(
                dossier_id="dossier-1",
                ref_m2s="M2S-001",
                constateur_nom="Constateur Test",
                telephone="+212611111111",
                remaining_label="45 min",
                reason="seuil_1h",
            )

        self.assertTrue(sent)
        self.assertEqual(post.call_args.args[0], "https://m2s.example/api/v1/messages/text")
        self.assertEqual(post.call_args.kwargs["headers"]["Authorization"], "Bearer m2s-token")
        self.assertEqual(post.call_args.kwargs["json"]["recipient"], "212600000000")
        self.assertEqual(self.repo.alert["m2s_message_id"], "01M2SMESSAGE")
        self.assertEqual(self.repo.alert["status"], "accepted")


if __name__ == "__main__":
    unittest.main()
