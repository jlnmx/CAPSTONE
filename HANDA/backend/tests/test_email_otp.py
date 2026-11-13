import base64
import json
import unittest
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from urllib.parse import parse_qs
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from app import main
from app.schemas import RegistrationOtpRequest, RegistrationOtpVerification, UserRegistration


class FakeResult:
    def __init__(self, row=None, rows=None):
        self.row = row
        self.rows = rows or []

    def fetchone(self):
        return self.row

    def fetchall(self):
        return self.rows


class FakeConnection:
    def __init__(self, rows=None):
        self.rows = list(rows or [])
        self.executions = []
        self.committed = False

    def execute(self, query, params=()):
        self.executions.append((query, params))
        row = self.rows.pop(0) if self.rows else None
        return FakeResult(rows=row) if isinstance(row, list) else FakeResult(row=row)

    def commit(self):
        self.committed = True


class EmailOtpTests(unittest.TestCase):
    def test_email_otp_uses_configured_starttls_smtp(self):
        configuration = SimpleNamespace(
            smtp_host="smtp.gmail.com",
            smtp_port=587,
            smtp_username="sender@gmail.com",
            smtp_password="app-password",
            smtp_from="sender@gmail.com",
            password_reset_expiry_minutes=10,
        )
        smtp = MagicMock()
        smtp_context = MagicMock()
        smtp_context.__enter__.return_value = smtp

        with patch.object(main, "settings", configuration), \
                patch.object(main.smtplib, "SMTP", return_value=smtp_context) as smtp_factory:
            main.deliver_password_reset_otp("ana@example.com", "email", "123456", "account verification", True)

        smtp_factory.assert_called_once_with("smtp.gmail.com", 587, timeout=10)
        smtp.starttls.assert_called_once()
        smtp.login.assert_called_once_with("sender@gmail.com", "app-password")
        message = smtp.send_message.call_args.args[0]
        self.assertEqual(message["From"], "sender@gmail.com")
        self.assertEqual(message["To"], "ana@example.com")
        self.assertIn("account verification", message["Subject"])
        self.assertIn("123456", message.get_content())

    def test_email_otp_uses_gmail_api_over_https_when_configured(self):
        configuration = SimpleNamespace(
            gmail_api_client_id="oauth-client-id",
            gmail_api_client_secret="oauth-client-secret",
            gmail_api_refresh_token="refresh-token",
            smtp_host="",
            smtp_from="sender@gmail.com",
            password_reset_expiry_minutes=10,
        )
        token_response = MagicMock()
        token_response.__enter__.return_value.read.return_value = b'{"access_token":"short-lived-token"}'
        send_response = MagicMock()

        with patch.object(main, "settings", configuration), \
                patch.object(main, "urlopen", side_effect=[token_response, send_response]) as urlopen, \
                patch.object(main.smtplib, "SMTP") as smtp_factory:
            self.assertTrue(main.otp_channel_configured("email"))
            main.deliver_password_reset_otp("ana@example.com", "email", "123456", "password change", True)

        self.assertEqual(urlopen.call_count, 2)
        token_request, send_request = [call.args[0] for call in urlopen.call_args_list]
        self.assertEqual(token_request.full_url, "https://oauth2.googleapis.com/token")
        self.assertEqual(parse_qs(token_request.data.decode())["refresh_token"], ["refresh-token"])
        self.assertEqual(send_request.full_url, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send")
        payload = json.loads(send_request.data)
        encoded_message = payload["raw"]
        decoded_message = base64.urlsafe_b64decode(encoded_message + "=" * (-len(encoded_message) % 4))
        self.assertIn(b"123456", decoded_message)
        self.assertIn(b"ana@example.com", decoded_message)
        smtp_factory.assert_not_called()

    def test_philippine_mobile_numbers_are_normalized_for_sms(self):
        self.assertEqual(main.normalize_sms_number("09171234567"), "+639171234567")
        self.assertEqual(main.normalize_sms_number("639171234567"), "+639171234567")

    def test_registration_request_sends_six_digit_code_without_returning_it(self):
        connection = FakeConnection([None])
        request = RegistrationOtpRequest(
            email="ana@example.com",
            mobileNumber="09171234567",
            channel="email",
        )
        configuration = SimpleNamespace(
            auth_secret="test-secret",
            password_reset_expiry_minutes=10,
        )
        with patch.object(main, "settings", configuration), \
                patch.object(main, "assert_unique_contact"), \
                patch.object(main, "otp_channel_configured", return_value=True), \
                patch.object(main, "deliver_password_reset_otp") as deliver:
            response = main.request_registration_otp(request, connection)

        self.assertRegex(response["registrationToken"], r"^[A-Za-z0-9_-]{20,}$")
        self.assertNotIn("otp", response)
        self.assertEqual(response["destination"], "a***@example.com")
        sent_otp = deliver.call_args.args[2]
        self.assertRegex(sent_otp, r"^\d{6}$")
        self.assertTrue(connection.committed)

    def test_registration_request_rejects_unconfigured_delivery(self):
        request = RegistrationOtpRequest(
            email="ana@example.com",
            mobileNumber="09171234567",
            channel="sms",
        )
        with patch.object(main, "assert_unique_contact"), patch.object(main, "otp_channel_configured", return_value=False):
            with self.assertRaises(HTTPException) as error:
                main.request_registration_otp(request, FakeConnection())

        self.assertEqual(error.exception.status_code, 503)

    def test_registration_cannot_create_account_with_unverified_contact(self):
        registration = UserRegistration.model_validate({
            "firstName": "Ana",
            "lastName": "Santos",
            "birthday": "2000-01-01",
            "sex": "Female",
            "mobileNumber": "09171234567",
            "email": "ana@example.com",
            "password": "StrongPass1!",
            "registrationToken": "r" * 32,
        })
        with self.assertRaises(HTTPException) as error:
            main.register_user(registration, FakeConnection([None]))

        self.assertEqual(error.exception.status_code, 400)
        self.assertIn("verification", error.exception.detail.lower())

    def test_registration_verification_marks_code_as_verified(self):
        otp = "123456"
        with patch.object(main, "settings", SimpleNamespace(auth_secret="test-secret", password_reset_max_attempts=3)):
            row = {
                "otp_hash": main.hash_reset_otp(otp),
                "expires_at": datetime.now(UTC) + timedelta(minutes=5),
                "attempts": 0,
            }
            connection = FakeConnection([row])
            result = main.verify_registration_otp(
                RegistrationOtpVerification(registrationToken="a" * 32, otp=otp),
                connection,
            )

        self.assertIn("verified", result["message"].lower())
        self.assertTrue(connection.committed)
        self.assertIn("verified_at = NOW()", connection.executions[-1][0])

    def test_registration_verification_rejects_wrong_code_and_counts_attempt(self):
        with patch.object(main, "settings", SimpleNamespace(auth_secret="test-secret", password_reset_max_attempts=3)):
            row = {
                "otp_hash": main.hash_reset_otp("123456"),
                "expires_at": datetime.now(UTC) + timedelta(minutes=5),
                "attempts": 0,
            }
            connection = FakeConnection([row])
            with self.assertRaises(HTTPException) as error:
                main.verify_registration_otp(
                    RegistrationOtpVerification(registrationToken="a" * 32, otp="654321"),
                    connection,
                )

        self.assertEqual(error.exception.status_code, 400)
        self.assertTrue(connection.committed)
        self.assertIn("attempts = attempts + 1", connection.executions[-1][0])

    def test_center_status_update_alerts_opted_in_residents_at_that_center(self):
        residents = [{
            "email": "ana@example.com",
            "mobile_number": "09171234567",
            "email_alerts_enabled": True,
            "sms_alerts_enabled": False,
        }]
        connection = FakeConnection([residents])
        center = {
            "id": "center-1",
            "name": "Central School",
            "capacity": 100,
            "current_occupancy": 40,
            "status": "limited",
        }
        with patch.object(main, "deliver_incident_alert") as deliver:
            main.notify_center_status_change(connection, "available", center)

        self.assertIn("registrations.status IN ('registered', 'checked_in', 'evacuated')", connection.executions[0][0])
        self.assertEqual(connection.executions[0][1], ("center-1",))
        deliver.assert_called_once_with(
            "ana@example.com",
            "09171234567",
            "Central School status changed to LIMITED",
            "The evacuation center Central School is now limited. Current occupancy: 40 of 100.",
            True,
            False,
        )

    def test_center_status_alert_is_not_sent_when_status_is_unchanged(self):
        with patch.object(main, "deliver_incident_alert") as deliver:
            main.notify_center_status_change(FakeConnection(), "available", {"status": "available"})

        deliver.assert_not_called()


if __name__ == "__main__":
    unittest.main()
