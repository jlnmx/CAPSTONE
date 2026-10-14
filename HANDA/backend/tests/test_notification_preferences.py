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
        }

    def test_partial_preference_update_saves_only_supplied_channel(self):
        connection = FakeConnection(self.row)
        preferences = main.update_notification_preferences(
            NotificationPreferencesUpdate(emailEnabled=True),
            self.user,
            connection,
        )

        self.assertEqual(connection.params, (True, None, "resident-1"))
        self.assertTrue(connection.committed)
        self.assertTrue(preferences["emailEnabled"])
        self.assertFalse(preferences["smsEnabled"])
        self.assertEqual(preferences["emailAddress"], "ana@example.com")

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
        with patch.object(main, "settings", configuration), patch.object(main.smtplib, "SMTP", return_value=smtp_context) as smtp_factory, patch("urllib.request.urlopen") as urlopen:
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
        with patch.object(main, "settings", configuration), patch("urllib.request.urlopen") as urlopen, patch.object(main.smtplib, "SMTP") as smtp_factory:
            main.deliver_incident_alert("ana@example.com", "09171234567", "Help is on the way", "Responders are coordinating.", False, True)

        urlopen.assert_called_once()
        smtp_factory.assert_not_called()


if __name__ == "__main__":
    unittest.main()
