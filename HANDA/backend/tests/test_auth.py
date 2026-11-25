import unittest
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError

from app.auth import CurrentUser, create_access_token, get_current_user, require_admin_category, require_roles, require_roles_or_admin_categories, require_superadmin
from app.main import app, create_user, delete_user, list_users, login_user, logout_user, mobile_login_candidates, refresh_user_session, update_user
from app.schemas import AdminUserCreate, AdminUserUpdate, LogoutRequest, RefreshTokenInput, UserLogin


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
        self.query = None
        self.queries = []

    def execute(self, *_args):
        self.executed = True
        self.query = _args[0] if _args else None
        self.parameters = _args[1] if len(_args) > 1 else None
        self.queries.append((_args[0] if _args else None, _args[1] if len(_args) > 1 else None))
        return FakeResult(self.row)

    def commit(self):
        pass


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

        result = login_user(UserLogin(email="+63 (917) 123-4567", password="password", keepLoggedIn=True), connection)

        self.assertEqual(connection.queries[0][1], (["639171234567", "09171234567"],))
        self.assertEqual(result["accessToken"], "access-token")
        self.assertTrue(result["refreshToken"])
        self.assertEqual(result["user"]["role"], "resident")
        _token.assert_called_once_with("resident-1", "resident", 0, True)

    def test_remembered_access_token_has_thirty_day_lifetime(self):
        configuration = type("TestSettings", (), {
            "auth_secret": "test-secret",
            "access_token_minutes": 480,
            "remembered_access_token_minutes": 30 * 24 * 60,
        })()
        with patch("app.auth.settings", configuration), patch("app.auth.time.time", return_value=1_000):
            _, normal_lifetime = create_access_token("user-1", "resident", 0)
            _, remembered_lifetime = create_access_token("user-1", "resident", 0, True)

        self.assertEqual(normal_lifetime, 8 * 60 * 60)
        self.assertEqual(remembered_lifetime, 30 * 24 * 60 * 60)

    @patch("app.main.household_members_for_user", return_value=[])
    @patch("app.main.resident_profile_payload", return_value={"id": "resident-1"})
    @patch("app.main.create_access_token", return_value=("new-access-token", 3600))
    def test_persistent_refresh_credential_issues_a_fresh_access_token(self, _token, _profile, _members):
        connection = FakeConnection({
            "id": "resident-1",
            "name": "Resident",
            "email": "resident@example.com",
            "role": "Resident",
            "status": "Active",
            "token_version": 2,
            "is_superadmin": False,
        })

        result = refresh_user_session(RefreshTokenInput(refreshToken="persistent-refresh-token-value-123456"), connection)

        self.assertEqual(result["accessToken"], "new-access-token")
        self.assertEqual(result["user"]["role"], "resident")
        self.assertIn("refresh_tokens", connection.query)

    def test_logout_preserves_only_the_requested_biometric_refresh_credential(self):
        connection = FakeConnection({"valid": True})
        user = CurrentUser("resident-1", "resident@example.com", "Resident", "resident", 0)

        result = logout_user(
            LogoutRequest(preserveRefreshToken="persistent-refresh-token-value-123456"),
            user,
            connection,
        )

        self.assertEqual(result, {"status": "signed_out"})
        self.assertTrue(any("token_hash <>" in query for query, _ in connection.queries))
        self.assertTrue(any("token_version = token_version + 1" in query for query, _ in connection.queries))

    def test_admin_resident_listing_can_include_saved_household_members(self):
        members = [{
            "name": "Ana Santos",
            "relationship": "Child",
            "age": 10,
            "sex": "Female",
            "contactNumber": "09171234567",
        }]
        connection = FakeConnection({"id": "resident-1", "household_members": members})

        result = list_users(True, connection, CurrentUser("admin-1", "admin@example.com", "Admin", "admin", 0))

        self.assertEqual(result[0]["household_members"], members)
        self.assertIn("resident_household_members", connection.query)
        self.assertIn("jsonb_agg", connection.query)

    def test_admin_user_update_rejects_password_fields(self):
        with self.assertRaises(ValidationError):
            AdminUserUpdate.model_validate({"password": "NewStrongPass1!"})

    def test_admin_user_update_requires_owner_verified_email_change(self):
        connection = FakeConnection({
            "email": "resident@example.com",
            "role": "Resident",
            "status": "Active",
            "is_superadmin": False,
            "admin_category": None,
        })

        with self.assertRaises(HTTPException) as error:
            update_user(
                "resident-1",
                AdminUserUpdate(email="changed@example.com"),
                CurrentUser("admin-1", "admin@example.com", "Admin", "admin", 0, True),
                connection,
            )

        self.assertEqual(error.exception.status_code, 422)
        self.assertIn("verified by the account owner", error.exception.detail)
        self.assertFalse(any(query.startswith("UPDATE users") for query, _ in connection.queries))

    def test_admin_cannot_change_own_status(self):
        connection = FakeConnection({
            "email": "admin@example.com",
            "role": "Administrator",
            "status": "Active",
            "is_superadmin": True,
            "admin_category": None,
        })

        with self.assertRaises(HTTPException) as error:
            update_user(
                "admin-1",
                AdminUserUpdate(status="Inactive"),
                CurrentUser("admin-1", "admin@example.com", "Admin", "admin", 0, True),
                connection,
            )

        self.assertEqual(error.exception.status_code, 400)
        self.assertFalse(any(query.startswith("UPDATE users") for query, _ in connection.queries))

    def test_deactivation_revokes_sessions_and_audits_access_change(self):
        connection = FakeConnection({
            "email": "resident@example.com",
            "role": "Resident",
            "status": "Active",
            "is_superadmin": False,
            "admin_category": None,
        })

        update_user(
            "resident-1",
            AdminUserUpdate(status="Inactive"),
            CurrentUser("admin-1", "admin@example.com", "Admin", "admin", 0, True),
            connection,
        )

        self.assertTrue(any("token_version = token_version + 1" in query for query, _ in connection.queries))
        self.assertTrue(any("UPDATE refresh_tokens SET revoked_at" in query for query, _ in connection.queries))
        audit = next(params for query, params in connection.queries if "INSERT INTO application_logs" in query)
        self.assertIn("status Active → Inactive", audit[5])

    def test_permanent_user_deletion_is_disabled(self):
        connection = FakeConnection(None)

        with self.assertRaises(HTTPException) as error:
            delete_user(CurrentUser("admin-1", "admin@example.com", "Admin", "admin", 0, True))

        self.assertEqual(error.exception.status_code, 405)
        self.assertFalse(connection.executed)

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

    def test_only_superadmin_can_manage_user_accounts(self):
        admin = CurrentUser("admin-1", "admin@example.com", "Admin", "admin", 0)
        superadmin = CurrentUser("superadmin-1", "root@example.com", "Root", "admin", 0, True)

        self.assertIs(require_superadmin(superadmin), superadmin)
        with self.assertRaises(HTTPException) as error:
            require_superadmin(admin)
        self.assertEqual(error.exception.status_code, 403)

    def test_admin_category_guards_allow_only_assigned_department_and_superadmin(self):
        bc_admin = CurrentUser("bc-1", "bc@example.com", "BC Admin", "admin", 0, False, "BCDRRMO")
        cswd_admin = CurrentUser("cswd-1", "cswd@example.com", "CSWD Admin", "admin", 0, False, "CSWD")
        unassigned_admin = CurrentUser("none-1", "none@example.com", "Unassigned", "admin", 0)
        superadmin = CurrentUser("root-1", "root@example.com", "Root", "admin", 0, True)
        dispatch_guard = require_admin_category("BCDRRMO")
        center_guard = require_admin_category("CSWD")

        self.assertIs(dispatch_guard(bc_admin), bc_admin)
        self.assertIs(dispatch_guard(superadmin), superadmin)
        self.assertIs(center_guard(cswd_admin), cswd_admin)
        for guard, denied in ((dispatch_guard, cswd_admin), (dispatch_guard, unassigned_admin), (center_guard, bc_admin), (center_guard, unassigned_admin)):
            with self.subTest(denied=denied, guard=guard), self.assertRaises(HTTPException) as error:
                guard(denied)
            self.assertEqual(error.exception.status_code, 403)

    def test_responder_routes_preserve_responder_access_but_scope_admins(self):
        responder = CurrentUser("responder-1", "responder@example.com", "Responder", "responder", 0)
        bc_admin = CurrentUser("bc-1", "bc@example.com", "BC Admin", "admin", 0, False, "BCDRRMO")
        cswd_admin = CurrentUser("cswd-1", "cswd@example.com", "CSWD Admin", "admin", 0, False, "CSWD")
        evacuation_guard = require_roles_or_admin_categories(("CSWD",), "responder")

        self.assertIs(evacuation_guard(responder), responder)
        self.assertIs(evacuation_guard(cswd_admin), cswd_admin)
        with self.assertRaises(HTTPException) as error:
            evacuation_guard(bc_admin)
        self.assertEqual(error.exception.status_code, 403)

    def test_subadmin_creation_requires_a_valid_category(self):
        common = {
            "name": "Department Admin",
            "email": "department@example.com",
            "birthday": "1990-01-01",
            "mobileNumber": "09171234567",
            "currentAddress": "Biñan",
            "password": "StrongPass1!",
            "role": "Administrator",
            "status": "Active",
        }
        with self.assertRaises(ValueError):
            AdminUserCreate(**common)
        with self.assertRaises(ValueError):
            AdminUserCreate(**common, adminCategory="Unknown")
        account = AdminUserCreate(**common, adminCategory="CSWD")
        self.assertEqual(account.adminCategory, "CSWD")

    @patch("app.main.assert_unique_contact")
    @patch("app.main.validate_account_password")
    @patch("app.main.hash_password", return_value="password-hash")
    def test_superadmin_can_create_categorized_subadmin(self, _hash, _validate, _unique):
        account = AdminUserCreate(
            name="BCDRRMO Admin",
            email="bc@example.com",
            birthday="1990-01-01",
            mobileNumber="09171234567",
            currentAddress="Biñan",
            password="StrongPass1!",
            role="Administrator",
            status="Active",
            adminCategory="BCDRRMO",
        )
        connection = FakeConnection({"id": "admin-2", "admin_category": "BCDRRMO"})

        result = create_user(
            account,
            connection,
            CurrentUser("root-1", "root@example.com", "Root", "admin", 0, True),
        )

        self.assertEqual(result["admin_category"], "BCDRRMO")
        self.assertIn("admin_category", connection.queries[0][0])
        self.assertEqual(connection.queries[0][1][-1], "BCDRRMO")

    @patch("app.main.assert_unique_contact")
    @patch("app.main.validate_account_password")
    @patch("app.main.hash_password", return_value="password-hash")
    def test_superadmin_can_create_another_active_superadmin(self, _hash, _validate, _unique):
        account = AdminUserCreate(
            name="Second Superadmin",
            email="second@example.com",
            birthday="1990-01-01",
            mobileNumber="09171234567",
            currentAddress="Biñan",
            password="StrongPass1!",
            role="Administrator",
            status="Active",
            isSuperAdmin=True,
        )
        connection = FakeConnection({"id": "admin-2", "is_superadmin": True})

        result = create_user(
            account,
            connection,
            CurrentUser("admin-1", "root@example.com", "Root", "admin", 0, True),
        )

        self.assertTrue(result["is_superadmin"])
        self.assertIn("is_superadmin", connection.queries[0][0])
        self.assertTrue(connection.queries[0][1][-2])
        self.assertIsNone(connection.queries[0][1][-1])

    def test_superadmin_cannot_be_created_with_non_admin_role(self):
        account = AdminUserCreate(
            name="Invalid Superadmin",
            email="invalid@example.com",
            birthday="1990-01-01",
            mobileNumber="09171234567",
            currentAddress="Biñan",
            password="StrongPass1!",
            role="Responder",
            status="Active",
            isSuperAdmin=True,
        )

        with self.assertRaises(HTTPException) as error:
            create_user(
                account,
                FakeConnection(None),
                CurrentUser("admin-1", "root@example.com", "Root", "admin", 0, True),
            )

        self.assertEqual(error.exception.status_code, 422)

    def test_authenticated_user_loads_superadmin_flag_from_database(self):
        token, _ = create_access_token("root-1", "admin", 0)
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        connection = FakeConnection({
            "id": "root-1",
            "email": "root@example.com",
            "name": "Root",
            "role": "Administrator",
            "status": "Active",
            "token_version": 0,
            "is_superadmin": True,
            "admin_category": None,
        })

        user = get_current_user(credentials, connection)

        self.assertTrue(user.is_superadmin)

    def test_only_login_and_registration_are_public_api_routes(self):
        public_routes = {
            ("POST", "/api/v1/auth/login"),
            ("POST", "/api/v1/auth/refresh"),
            ("POST", "/api/v1/auth/password-reset/request"),
            ("POST", "/api/v1/auth/password-reset/verify"),
            ("POST", "/api/v1/auth/password-reset/complete"),
            ("POST", "/api/v1/auth/registration-otp/request"),
            ("POST", "/api/v1/auth/registration-otp/verify"),
            ("POST", "/api/v1/users/register"),
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

    def test_user_management_routes_require_superadmin(self):
        protected_routes = {
            ("GET", "/api/v1/users"),
            ("GET", "/api/v1/users/{user_id}/verification-document"),
            ("PATCH", "/api/v1/users/{user_id}/responder-application"),
            ("POST", "/api/v1/users"),
            ("PATCH", "/api/v1/users/{user_id}"),
            ("DELETE", "/api/v1/users/{user_id}"),
        }
        found_routes = set()

        for route in app.routes:
            if not getattr(route, "path", "").startswith("/api/v1/users"):
                continue
            calls = tuple(dependency_calls(route.dependant))
            for method in route.methods:
                endpoint = (method, route.path)
                if endpoint in protected_routes:
                    found_routes.add(endpoint)
                    self.assertIn(require_superadmin, calls, endpoint)

        self.assertEqual(found_routes, protected_routes)


if __name__ == "__main__":
    unittest.main()