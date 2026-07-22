import unittest
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import WhatsappAlert
from app.repo import SqlRepo


class WhatsappPersistenceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(
            bind=self.engine,
            autoflush=False,
            expire_on_commit=False,
        )
        self.repo = SqlRepo()
        self.repo._Session = self.session_factory

        self.repo.record_whatsapp_alert(
            {
                "dossier_id": "dossier-1",
                "m2s_message_id": "message-1",
                "instance_id": "instance-1",
                "recipient": "212600000000",
                "status": "accepted",
                "accepted_at": datetime(2026, 7, 21, 10, 0),
            }
        )

    def tearDown(self):
        self.engine.dispose()

    def _alert(self):
        with self.session_factory() as db:
            return db.query(WhatsappAlert).filter_by(dossier_id="dossier-1").one()

    def test_records_and_updates_monotonic_status(self):
        sent_at = datetime(2026, 7, 21, 10, 1, tzinfo=timezone.utc)
        delivered_at = sent_at + timedelta(minutes=1)

        self.assertTrue(
            self.repo.update_whatsapp_alert_status(
                "message-1", "sent", "event-sent", sent_at
            )
        )
        self.assertTrue(
            self.repo.update_whatsapp_alert_status(
                "message-1", "delivered", "event-delivered", delivered_at
            )
        )

        alert = self._alert()
        self.assertEqual(alert.status, "delivered")
        self.assertEqual(alert.sent_at, datetime(2026, 7, 21, 10, 1))
        self.assertEqual(alert.delivered_at, datetime(2026, 7, 21, 10, 2))

        # Régression et échec tardif : l'état livré doit rester terminal.
        self.assertTrue(
            self.repo.update_whatsapp_alert_status(
                "message-1", "sent", "event-regression", delivered_at + timedelta(minutes=1)
            )
        )
        self.assertTrue(
            self.repo.update_whatsapp_alert_status(
                "message-1", "failed", "event-late-failure", delivered_at + timedelta(minutes=2)
            )
        )
        self.assertEqual(self._alert().status, "delivered")

    def test_retry_after_failure_clears_current_error(self):
        failed_at = datetime(2026, 7, 21, 10, 1)
        self.assertTrue(
            self.repo.update_whatsapp_alert_status(
                "message-1", "failed", "event-failed", failed_at, "passerelle indisponible"
            )
        )
        self.assertEqual(self._alert().failure_reason, "passerelle indisponible")

        self.assertTrue(
            self.repo.update_whatsapp_alert_status(
                "message-1", "sent", "event-retried", failed_at + timedelta(minutes=1)
            )
        )
        alert = self._alert()
        self.assertEqual(alert.status, "sent")
        self.assertIsNone(alert.failure_reason)
        self.assertIsNone(alert.failed_at)

    def test_record_is_idempotent_and_preserves_advanced_status(self):
        self.repo.update_whatsapp_alert_status(
            "message-1", "read", "event-read", datetime(2026, 7, 21, 10, 4)
        )
        self.repo.record_whatsapp_alert(
            {
                "dossier_id": "dossier-1",
                "m2s_message_id": "message-1",
                "instance_id": "instance-2",
                "recipient": "212611111111",
                "status": "accepted",
                "accepted_at": datetime(2026, 7, 21, 10, 5),
            }
        )

        alert = self._alert()
        self.assertEqual(alert.status, "read")
        self.assertEqual(alert.instance_id, "instance-2")
        self.assertEqual(alert.recipient, "212611111111")

    def test_unknown_message_or_status_is_not_tracked(self):
        self.assertFalse(self.repo.update_whatsapp_alert_status("missing", "sent"))
        self.assertFalse(self.repo.update_whatsapp_alert_status("message-1", "queued"))


if __name__ == "__main__":
    unittest.main()
