import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from app import main
from app.auth import CurrentUser
from app.schemas import NotificationPreferencesUpdate


class FakeResult:
    def __init__(self, row):
        self.row = row

    def fetchone(self):
        return self.row


class FakeConnection:
    def __init__(self, row):
        self.row = row
        self.query = ""
        self.params = None
        self.committed = False
        self.rolled_back = False

    def execute(self, query, params=()):
        self.query = query
        self.params = params
        return FakeResult(self.row)

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True


class NotificationPreferencesTests(unittest.TestCase):
    def setUp(self):
        self.user = CurrentUser("resident-1", "ana@example.com", "Ana Santos", "resident", 0)
        self.row = {
            "email": "ana@example.com",
            "mobile_number": "09171234567",
            "email_alerts_enabled": True,
            "sms_alerts_enabled": False,
            "dispatch_siren_enabled": True,
        }

    def test_partial_preference_update_saves_only_supplied_channel(self):
        connection = FakeConnection(self.row)
        preferences = main.update_notification_preferences(
            NotificationPreferencesUpdate(emailEnabled=True),
            self.user,
            connection,
        )

        self.assertEqual(connection.params, (True, None, None, "resident-1"))
        self.assertTrue(connection.committed)
        self.assertTrue(preferences["emailEnabled"])
        self.assertFalse(preferences["smsEnabled"])
        self.assertEqual(preferences["emailAddress"], "ana@example.com")

    def test_responder_can_toggle_dispatch_siren_preference(self):
        responder = CurrentUser("responder-1", "responder@example.com", "Responder", "responder", 0)
        row = {**self.row, "dispatch_siren_enabled": False}
        connection = FakeConnection(row)

        preferences = main.update_notification_preferences(
            NotificationPreferencesUpdate(dispatchSirenEnabled=False),
            responder,
            connection,
        )

        self.assertEqual(connection.params, (None, None, False, "responder-1"))
        self.assertFalse(preferences["dispatchSirenEnabled"])
        self.assertTrue(connection.committed)

    def test_resident_cannot_change_dispatch_siren_preference(self):
        connection = FakeConnection(self.row)
        with self.assertRaises(HTTPException) as error:
            main.update_notification_preferences(
                NotificationPreferencesUpdate(dispatchSirenEnabled=False),
                self.user,
                connection,
            )

        self.assertEqual(error.exception.status_code, 403)
        self.assertFalse(connection.committed)

    def test_empty_preference_update_is_rejected(self):
        connection = FakeConnection(self.row)
        with self.assertRaises(HTTPException) as error:
            main.update_notification_preferences(NotificationPreferencesUpdate(), self.user, connection)

        self.assertEqual(error.exception.status_code, 400)
        self.assertFalse(connection.committed)

    def test_incident_alert_uses_only_enabled_email_channel(self):
        smtp = MagicMock()
        smtp_context = MagicMock()
        smtp_context.__enter__.return_value = smtp
        configuration = SimpleNamespace(
            smtp_host="smtp.example.com",
            smtp_port=587,
            smtp_username="",
            smtp_password="",
            smtp_from="alerts@example.com",
            twilio_account_sid="AC123",
            twilio_auth_token="secret",
            twilio_from_number="+15550000000",
        )
        with patch.object(main, "settings", configuration), patch.object(main.smtplib, "SMTP", return_value=smtp_context) as smtp_factory, patch.object(main, "urlopen") as urlopen:
            main.deliver_incident_alert("ana@example.com", "09171234567", "Help is on the way", "Responders are coordinating.", True, False)

        smtp_factory.assert_called_once()
        smtp.send_message.assert_called_once()
        urlopen.assert_not_called()

    def test_incident_alert_uses_only_enabled_sms_channel(self):
        configuration = SimpleNamespace(
            smtp_host="smtp.example.com",
            smtp_port=587,
            smtp_username="",
            smtp_password="",
            smtp_from="alerts@example.com",
            twilio_account_sid="AC123",
            twilio_auth_token="secret",
            twilio_from_number="+15550000000",
        )
        with patch.object(main, "settings", configuration), patch.object(main, "send_sms") as send_sms, patch.object(main.smtplib, "SMTP") as smtp_factory:
            main.deliver_incident_alert("ana@example.com", "09171234567", "Help is on the way", "Responders are coordinating.", False, True)

        send_sms.assert_called_once_with(
            "09171234567",
            "Help is on the way: Responders are coordinating.",
            False,
            configuration,
        )
        smtp_factory.assert_not_called()

    def test_unread_incident_count_only_includes_active_incidents(self):
        connection = MagicMock()
        connection.execute.return_value.fetchone.return_value = {"count": 2}

        result = main.unread_active_incident_count(connection, self.user)

        self.assertEqual(result, {"count": 2})
        query = connection.execute.call_args.args[0]
        self.assertIn("COUNT(DISTINCT notifications.incident_id)", query)
        self.assertIn("notifications.read_at IS NULL", query)
        self.assertIn("incidents.status IN ('reported', 'acknowledged', 'in_progress')", query)
        self.assertEqual(connection.execute.call_args.args[1], ("resident-1",))

    def test_visiting_incidents_marks_active_incident_notifications_read(self):
        connection = MagicMock()
        connection.execute.return_value.fetchall.return_value = [
            {"incident_id": "incident-1"},
            {"incident_id": "incident-2"},
        ]

        result = main.mark_active_incident_notifications_read(connection, self.user)

        self.assertEqual(result, {"updated": 2})
        query = connection.execute.call_args.args[0]
        self.assertIn("UPDATE notifications", query)
        self.assertIn("read_at IS NULL", query)
        self.assertIn("status IN ('reported', 'acknowledged', 'in_progress')", query)
        self.assertEqual(connection.execute.call_args.args[1], ("resident-1",))
        connection.commit.assert_called_once()


if __name__ == "__main__":
    unittest.main()
