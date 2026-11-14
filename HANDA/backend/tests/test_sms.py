import json
import unittest
from types import SimpleNamespace
from urllib.parse import parse_qs
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from app import main, sms


class SemaphoreSmsTests(unittest.TestCase):
    def setUp(self):
        self.configuration = SimpleNamespace(
            semaphore_api_key="test-semaphore-key",
            semaphore_sender_name="HANDA",
            twilio_account_sid="",
            twilio_auth_token="",
            twilio_from_number="",
            password_reset_expiry_minutes=10,
        )

    def response(self, status="Pending", code="123456"):
        result = MagicMock()
        result.__enter__.return_value.read.return_value = json.dumps([
            {"message_id": 1234, "status": status, "code": code},
        ]).encode()
        return result

    def test_otp_uses_semaphore_otp_endpoint_and_server_generated_code(self):
        with patch("app.sms.urlopen", return_value=self.response()) as urlopen:
            sms.send_sms_otp(
                "09171234567",
                "123456",
                "Your HANDA account verification code is {otp}.",
                self.configuration,
            )

        request = urlopen.call_args.args[0]
        self.assertEqual(request.full_url, sms.SEMAPHORE_OTP_URL)
        payload = parse_qs(request.data.decode())
        self.assertEqual(payload["apikey"], ["test-semaphore-key"])
        self.assertEqual(payload["number"], ["639171234567"])
        self.assertEqual(payload["message"], ["Your HANDA account verification code is {otp}."])
        self.assertEqual(payload["code"], ["123456"])
        self.assertEqual(payload["sendername"], ["HANDA"])

    def test_urgent_alert_uses_the_priority_endpoint(self):
        with patch("app.sms.urlopen", return_value=self.response()) as urlopen:
            sms.send_sms("09171234567", "Dispatch alert.", True, self.configuration)

        request = urlopen.call_args.args[0]
        self.assertEqual(request.full_url, sms.SEMAPHORE_PRIORITY_URL)
        self.assertEqual(parse_qs(request.data.decode())["message"], ["Dispatch alert."])

    def test_bulk_alert_sends_comma_separated_recipients(self):
        with patch("app.sms.urlopen", return_value=self.response()) as urlopen:
            sms.send_sms_to_many(
                ["09171234567", "+639181234567"],
                "Storm advisory.",
                configuration=self.configuration,
            )

        payload = parse_qs(urlopen.call_args.args[0].data.decode())
        self.assertEqual(payload["number"], ["639171234567,639181234567"])

    def test_bulk_alert_respects_semaphore_recipient_limit(self):
        numbers = [f"+63917{index:07d}" for index in range(1001)]
        with patch("app.sms.urlopen", side_effect=[self.response(), self.response()]) as urlopen:
            sms.send_sms_to_many(numbers, "Storm advisory.", configuration=self.configuration)

        self.assertEqual(urlopen.call_count, 2)
        first_batch = parse_qs(urlopen.call_args_list[0].args[0].data.decode())["number"][0]
        second_batch = parse_qs(urlopen.call_args_list[1].args[0].data.decode())["number"][0]
        self.assertEqual(len(first_batch.split(",")), 1000)
        self.assertEqual(len(second_batch.split(",")), 1)

    def test_provider_rejection_is_reported(self):
        with patch("app.sms.urlopen", return_value=self.response(status="Failed")):
            with self.assertRaises(sms.SmsDeliveryError):
                sms.send_sms("09171234567", "Test.", configuration=self.configuration)

    def test_email_change_requires_a_code_bound_to_current_phone(self):
        user = main.CurrentUser("resident-1", "old@example.com", "Resident", "resident", 1)

        class Connection:
            def execute(self, query, _params=()):
                if "SELECT password_hash, email, token_version" in query:
                    return FakeResult({
                        "password_hash": "stored-password",
                        "email": "old@example.com",
                        "token_version": 1,
                    })
                return FakeResult(None)

        with patch("app.main.verify_password", return_value=True), \
                patch("app.main.hash_password", return_value="new-password"), \
                patch("app.main.household_members_for_user", return_value=[]), \
                patch("app.main.resident_profile_payload", side_effect=lambda row, _members: row), \
                self.assertRaises(HTTPException) as error:
            main.update_resident_account(
                main.ResidentAccountUpdate(email="new@example.com", currentPassword="Current#123"),
                user,
                Connection(),
            )

        self.assertEqual(error.exception.status_code, 422)
        self.assertIn("SMS code", error.exception.detail)

    def test_email_change_code_is_sent_to_the_existing_mobile_number(self):
        user = main.CurrentUser("resident-1", "old@example.com", "Resident", "resident", 1)
        queries = []

        class Connection:
            def execute(self, query, _params=()):
                queries.append(query)
                if "SELECT password_hash, email, mobile_number FROM users" in query:
                    return FakeResult({
                        "password_hash": "stored-password",
                        "email": "old@example.com",
                        "mobile_number": "09171234567",
                    })
                return FakeResult(None)

            def commit(self):
                pass

        configuration = SimpleNamespace(
            auth_secret="test-secret",
            password_reset_expiry_minutes=10,
        )
        with patch.object(main, "settings", configuration), \
                patch.object(main, "verify_password", return_value=True), \
                patch.object(main, "assert_unique_contact"), \
                patch.object(main, "sms_delivery_configured", return_value=True), \
                patch.object(main, "deliver_password_reset_otp") as deliver:
            response = main.request_email_change_otp(
                main.EmailChangeOtpRequest(newEmail="new@example.com", currentPassword="Current#123"),
                user,
                Connection(),
            )

        self.assertNotIn("otp", response)
        self.assertEqual(response["destination"], "***4567")
        self.assertIn("email_change_requests", "\n".join(queries))
        deliver.assert_called_once()
        self.assertEqual(deliver.call_args.args[0:2], ("09171234567", "sms"))
        self.assertRegex(deliver.call_args.args[2], r"^\d{6}$")
        self.assertEqual(deliver.call_args.args[3], "email change")

    def test_new_incident_sms_is_batched_to_active_opted_in_responders(self):
        connection = MagicMock()
        connection.execute.return_value.fetchall.return_value = [
            {"mobile_number": "09171234567"},
            {"mobile_number": "09181234567"},
        ]
        incident = main.IncidentCreate(
            type="Flooding",
            description="Water is rising.",
            severity="critical",
            location="Biñan",
        )
        with patch.object(main, "sms_delivery_configured", return_value=True), \
                patch.object(main, "send_sms_to_many") as send_sms:
            main.notify_responders_of_new_incident_sms(
                connection,
                incident,
                "incident-1",
                "reporter-1",
            )

        sql = connection.execute.call_args.args[0]
        self.assertIn("role = 'Responder' AND status = 'Active'", sql)
        self.assertIn("sms_alerts_enabled", sql)
        send_sms.assert_called_once()
        self.assertEqual(send_sms.call_args.args[0], ["09171234567", "09181234567"])
        self.assertTrue(send_sms.call_args.args[2])


class FakeResult:
    def __init__(self, row):
        self.row = row

    def fetchone(self):
        return self.row


if __name__ == "__main__":
    unittest.main()
