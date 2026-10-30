import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app import main
from app.auth import CurrentUser
from app.schemas import ResidentAccountUpdate


class FakeResult:
    def __init__(self, row):
        self.row = row

    def fetchone(self):
        return self.row

    def fetchall(self):
        return []


class FakeConnection:
    def __init__(self, credential_row, profile_row):
        self.credential_row = credential_row
        self.profile_row = profile_row
        self.update_query = ""
        self.update_values = None
        self.committed = False
        self.rolled_back = False

    def execute(self, query, values=()):
        if query.startswith("SELECT password_hash"):
            return FakeResult(self.credential_row)
        if query.startswith("UPDATE users"):
            self.update_query = query
            self.update_values = values
            return FakeResult(None)
        return FakeResult(self.profile_row)

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True


class AccountCredentialTests(unittest.TestCase):
    def setUp(self):
        self.user = CurrentUser("resident-1", "old@example.com", "Resident User", "resident", 4)
        self.credential_row = {
            "password_hash": "current-hash",
            "email": "old@example.com",
            "mobile_number": "09171234567",
            "token_version": 4,
        }
        self.profile_row = {"id": "resident-1", "email": "new@example.com", "role": "Resident"}

    @patch("app.main.verify_password", return_value=False)
    def test_incorrect_current_password_does_not_return_session_expiry_status(self, _verify):
        connection = FakeConnection(self.credential_row, self.profile_row)

        with self.assertRaises(HTTPException) as error:
            main.update_resident_account(
                ResidentAccountUpdate(email="new@example.com", currentPassword="wrong-password"),
                self.user,
                connection,
            )

        self.assertEqual(error.exception.status_code, 400)
        self.assertFalse(connection.update_query)

    @patch("app.main.household_members_for_user", return_value=[])
    @patch("app.main.resident_profile_payload", side_effect=lambda row, _members: row)
    @patch("app.main.create_access_token", return_value=("fresh-access-token", 3600))
    @patch("app.main.hash_password", return_value="new-hash")
    @patch("app.main.validate_account_password")
    @patch("app.main.verify_password", side_effect=[True, False])
    def test_password_change_rotates_token_and_returns_fresh_session(self, _verify, _validate, _hash, _token, _profile, _members):
        connection = FakeConnection(self.credential_row, self.profile_row)

        result = main.update_resident_account(
            ResidentAccountUpdate(currentPassword="Current#123", newPassword="New#Password456"),
            self.user,
            connection,
        )

        self.assertIn("token_version = token_version + 1", connection.update_query)
        self.assertEqual(connection.update_values[0], "new-hash")
        _token.assert_called_once_with("resident-1", "resident", 5)
        self.assertEqual(result["accessToken"], "fresh-access-token")
        self.assertTrue(connection.committed)

    @patch("app.main.verify_password", return_value=True)
    def test_password_change_rejects_reusing_current_password(self, verify):
        connection = FakeConnection(self.credential_row, self.profile_row)

        with patch("app.main.validate_account_password"), self.assertRaises(HTTPException) as error:
            main.update_resident_account(
                ResidentAccountUpdate(currentPassword="Current#123", newPassword="Current#123"),
                self.user,
                connection,
            )

        self.assertEqual(error.exception.status_code, 400)
        self.assertFalse(connection.update_query)
        verify.assert_any_call("Current#123", "current-hash")
        verify.assert_any_call("Current#123", "current-hash")

    @patch("app.main.household_members_for_user", return_value=[])
    @patch("app.main.resident_profile_payload", side_effect=lambda row, _members: row)
    @patch("app.main.create_access_token", return_value=("fresh-access-token", 3600))
    @patch("app.main.verify_password", return_value=True)
    def test_email_change_normalizes_email_and_rotates_token(self, _verify, _token, _profile, _members):
        profile = {**self.profile_row, "email": "new@example.com"}
        connection = FakeConnection(self.credential_row, profile)

        result = main.update_resident_account(
            ResidentAccountUpdate(email="NEW@Example.com", currentPassword="Current#123"),
            self.user,
            connection,
        )

        self.assertIn("token_version = token_version + 1", connection.update_query)
        self.assertEqual(connection.update_values[0], "new@example.com")
        _token.assert_called_once_with("resident-1", "resident", 5)
        self.assertEqual(result["email"], "new@example.com")
        self.assertEqual(result["accessToken"], "fresh-access-token")


if __name__ == "__main__":
    unittest.main()