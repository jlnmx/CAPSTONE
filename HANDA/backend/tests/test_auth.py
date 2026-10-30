import unittest
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import CurrentUser, create_access_token, get_current_user, require_roles
from app.main import app, login_user, mobile_login_candidates
from app.schemas import UserLogin


class FakeResult:
    def __init__(self, row):
        self.row = row

    def fetchone(self):
        return self.row

    def fetchall(self):
        if isinstance(self.row, list):
            return self.row
        return [self.row] if self.row is not None else []


class FakeConnection:
    def __init__(self, row):
        self.row = row
        self.executed = False
        self.parameters = None

    def execute(self, *_args):
        self.executed = True
        self.parameters = _args[1] if len(_args) > 1 else None
        return FakeResult(self.row)


def dependency_calls(dependant):
    for dependency in dependant.dependencies:
        yield dependency.call
        yield from dependency_calls(dependency)


class AuthTests(unittest.TestCase):
    def test_mobile_login_candidates_support_local_and_international_formats(self):
        expected = ["09171234567", "639171234567"]

        for identifier in ("09171234567", "+639171234567", "639171234567", "+63 (917) 123-4567"):
            with self.subTest(identifier=identifier):
                self.assertCountEqual(mobile_login_candidates(identifier), expected)

    def test_mobile_login_candidates_reject_invalid_numbers(self):
        for identifier in ("0917123456", "08171234567", "name@example.com", ""):
            with self.subTest(identifier=identifier):
                self.assertEqual(mobile_login_candidates(identifier), [])

    @patch("app.main.household_members_for_user", return_value=[])
    @patch("app.main.resident_profile_payload", return_value={"id": "resident-1", "email": "resident@example.com"})
    @patch("app.main.create_access_token", return_value=("access-token", 3600))
    @patch("app.main.verify_password", return_value=True)
    def test_login_accepts_mobile_number_and_queries_both_storage_formats(self, _verify, _token, _profile, _members):
        row = {
            "id": "resident-1",
            "failed_login_attempts": 0,
            "locked_until": None,
            "password_hash": "password-hash",
            "status": "Active",
            "role": "Resident",
            "token_version": 0,
        }
        connection = FakeConnection(row)

        result = login_user(UserLogin(email="+63 (917) 123-4567", password="password"), connection)

        self.assertEqual(connection.parameters, (["639171234567", "09171234567"],))
        self.assertEqual(result["accessToken"], "access-token")
        self.assertEqual(result["user"]["role"], "resident")

    def test_login_rejects_mobile_number_shared_by_multiple_accounts(self):
        connection = FakeConnection([{"id": "resident-1"}, {"id": "resident-2"}])

        with self.assertRaises(HTTPException) as error:
            login_user(UserLogin(email="09171234567", password="password"), connection)

        self.assertEqual(error.exception.status_code, 401)

    def test_missing_credentials_are_rejected_before_database_access(self):
        connection = FakeConnection(None)

        with self.assertRaises(HTTPException) as error:
            get_current_user(None, connection)

        self.assertEqual(error.exception.status_code, 401)
        self.assertFalse(connection.executed)

    def test_invalid_token_is_rejected(self):
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid")

        with self.assertRaises(HTTPException) as error:
            get_current_user(credentials, FakeConnection(None))

        self.assertEqual(error.exception.status_code, 401)

    def test_active_user_with_matching_token_version_is_authenticated(self):
        token, _ = create_access_token("user-1", "admin", 3)
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        connection = FakeConnection({
            "id": "user-1",
            "email": "admin@example.com",
            "name": "Admin User",
            "role": "Administrator",
            "status": "Active",
            "token_version": 3,
        })

        user = get_current_user(credentials, connection)

        self.assertEqual(user.role, "admin")
        self.assertEqual(user.id, "user-1")

    def test_inactive_or_stale_user_session_is_rejected(self):
        token, _ = create_access_token("user-1", "resident", 3)
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        rows = [
            {"id": "user-1", "email": "resident@example.com", "name": "Resident", "role": "Resident", "status": "Inactive", "token_version": 3},
            {"id": "user-1", "email": "resident@example.com", "name": "Resident", "role": "Resident", "status": "Active", "token_version": 4},
        ]

        for row in rows:
            with self.subTest(row=row), self.assertRaises(HTTPException) as error:
                get_current_user(credentials, FakeConnection(row))
            self.assertEqual(error.exception.status_code, 401)

    def test_role_guard_allows_admin_and_rejects_resident(self):
        admin = CurrentUser("admin-1", "admin@example.com", "Admin", "admin", 0)
        resident = CurrentUser("resident-1", "resident@example.com", "Resident", "resident", 0)
        admin_guard = require_roles("admin")

        self.assertIs(admin_guard(admin), admin)
        with self.assertRaises(HTTPException) as error:
            admin_guard(resident)
        self.assertEqual(error.exception.status_code, 403)

    def test_only_login_and_registration_are_public_api_routes(self):
        public_routes = {
            ("POST", "/api/v1/auth/login"),
            ("POST", "/api/v1/auth/password-reset/request"),
            ("POST", "/api/v1/auth/password-reset/verify"),
            ("POST", "/api/v1/auth/password-reset/complete"),
            ("POST", "/api/v1/users/register"),
            ("GET", "/api/v1/incidents"),
        }
        found_public_routes = set()

        for route in app.routes:
            if not getattr(route, "path", "").startswith("/api/v1/"):
                continue

            calls = tuple(dependency_calls(route.dependant))
            for method in route.methods:
                endpoint = (method, route.path)
                if endpoint in public_routes:
                    found_public_routes.add(endpoint)
                    self.assertNotIn(get_current_user, calls, endpoint)
                else:
                    self.assertIn(get_current_user, calls, endpoint)

        self.assertEqual(found_public_routes, public_routes)


if __name__ == "__main__":
    unittest.main()