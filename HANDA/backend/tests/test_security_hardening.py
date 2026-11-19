import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from app import main
from app.auth import CurrentUser, get_current_user
from app.schemas import EvacueeCreate, IncidentCreate, IncidentResponsePhotoCreate, PasswordResetRequest


def dependency_calls(dependant):
    for dependency in dependant.dependencies:
        yield dependency.call
        yield from dependency_calls(dependency)


class SecurityHardeningTests(unittest.TestCase):
    @staticmethod
    def role_guards(calls):
        guards = []
        for call in calls:
            if not callable(call) or getattr(call, "__name__", None) != "dependency" or not call.__closure__:
                continue
            closure = dict(zip(call.__code__.co_freevars, call.__closure__))
            if "allowed_roles" in closure:
                guards.append(closure["allowed_roles"].cell_contents)
        return guards

    def test_incident_list_returns_public_fields_and_report_status_to_residents(self):
        connection = MagicMock()
        connection.execute.return_value.fetchall.return_value = [{
            "id": "incident-1",
            "type": "Fire",
            "location": "Poblacion",
            "status": "in_progress",
            "is_own_report": True,
            "created_at": "2026-11-17T00:00:00Z",
        }]

        result = main.list_incidents(connection, CurrentUser("resident-1", "", "", "resident", 0))

        self.assertEqual(set(result[0]), {"id", "type", "location", "status", "is_own_report", "created_at"})
        self.assertEqual(result[0]["status"], "in_progress")
        self.assertTrue(result[0]["is_own_report"])
        self.assertNotIn("reporter_user_id", result[0])
        query = connection.execute.call_args.args[0]
        self.assertIn("WHERE status <> 'resolved'", query)
        self.assertNotIn("OR reporter_user_id", query)
        self.assertIn("COALESCE(reporter_user_id = %s, FALSE) AS is_own_report", query)
        self.assertEqual(connection.execute.call_args.args[1], ("resident-1",))
        self.assertNotIn("description", query)
        self.assertNotIn("photo_uris", query)
        self.assertNotIn("latitude", query)

    def test_responder_and_admin_incident_lists_keep_operational_details(self):
        for role in ("responder", "admin"):
            with self.subTest(role=role):
                connection = MagicMock()
                connection.execute.return_value.fetchall.return_value = []
                main.list_incidents(connection, CurrentUser(f"{role}-1", "", "", role, 0))
                query = connection.execute.call_args.args[0]
                self.assertIn("incidents.description", query)
                self.assertIn("incidents.photo_uris", query)
                self.assertIn("latitude", query)

    def test_incident_feed_requires_authentication_and_resident_directory_access_is_removed(self):
        routes = {
            (method, route.path): tuple(dependency_calls(route.dependant))
            for route in main.app.routes
            if getattr(route, "path", "").startswith("/api/v1/")
            for method in route.methods
        }

        self.assertIn(get_current_user, routes[("GET", "/api/v1/incidents")])
        self.assertIn(get_current_user, routes[("GET", "/api/v1/evacuees")])
        self.assertEqual(self.role_guards(routes[("GET", "/api/v1/evacuees")]), [{"responder", "admin"}])
        self.assertEqual(self.role_guards(routes[("GET", "/api/v1/resident/evacuation-status")]), [{"resident"}])

    def test_create_conflicts_do_not_overwrite_existing_records(self):
        incident_connection = MagicMock()
        main.write_incident(
            incident_connection,
            IncidentCreate(id="incident-1", type="Fire", description="New report", location="Poblacion"),
            "resident-1",
        )
        incident_sql = incident_connection.execute.call_args.args[0]
        self.assertIn("ON CONFLICT (id) DO NOTHING", incident_sql)
        self.assertNotIn("DO UPDATE", incident_sql)

        evacuee_connection = MagicMock()
        main.write_evacuee(
            evacuee_connection,
            EvacueeCreate(id="evacuee-1", firstName="Ana", lastName="Santos", age=20, sex="Female"),
        )
        evacuee_sql = evacuee_connection.execute.call_args.args[0]
        self.assertIn("ON CONFLICT (id) DO NOTHING", evacuee_sql)
        self.assertNotIn("DO UPDATE", evacuee_sql)

    def test_incident_photos_and_description_are_bounded(self):
        photo = "data:image/jpeg;base64,Y2FwdHVyZWQtcGhvdG8="
        with self.assertRaises(ValueError):
            IncidentCreate(
                type="Fire", description="Report", location="Poblacion",
                photoUris=[photo] * 5,
            )
        with self.assertRaises(ValueError):
            IncidentCreate(
                type="Fire", description="Report", location="Poblacion",
                photoUris=["data:image/jpeg;base64," + ("A" * 1_500_001)],
            )
        with self.assertRaises(ValueError):
            IncidentCreate(type="Fire", description="x" * 2001, location="Poblacion")
        with self.assertRaises(ValueError):
            IncidentResponsePhotoCreate(photoUri="data:image/jpeg;base64," + ("A" * 1_500_001))

    def test_presence_route_is_responder_only_and_read_is_admin_only(self):
        routes = {
            (method, route.path): tuple(dependency_calls(route.dependant))
            for route in main.app.routes
            if getattr(route, "path", "").startswith("/api/v1/")
            for method in route.methods
        }
        write_dependencies = routes[("POST", "/api/v1/responders/me/presence")]
        read_dependencies = routes[("GET", "/api/v1/responders/live")]
        self.assertIn(get_current_user, write_dependencies)
        self.assertIn(get_current_user, read_dependencies)
        self.assertEqual(self.role_guards(write_dependencies), [{"responder"}])
        self.assertEqual(self.role_guards(read_dependencies), [{"admin"}])

    def test_supabase_privacy_migration_revokes_public_table_access(self):
        migration = (
            Path(__file__).resolve().parents[2]
            / "database"
            / "migrations"
            / "20261117_api_privacy_and_presence.sql"
        ).read_text(encoding="utf-8").lower()
        self.assertIn("revoke all privileges on all tables in schema public from anon, authenticated", migration)
        self.assertIn("revoke all privileges on all sequences in schema public from anon, authenticated", migration)
        self.assertIn("alter default privileges", migration)

    def test_password_reset_requests_are_throttled_per_account(self):
        connection = MagicMock()
        user = {"id": "resident-1", "email": "resident@example.com", "mobile_number": "09171234567"}
        connection.execute.return_value.fetchone.side_effect = [user, {"1": 1}]
        request = PasswordResetRequest(identifier="resident@example.com", channel="email")
        with patch.object(main, "otp_channel_configured", return_value=True), \
                patch.object(main, "deliver_password_reset_otp") as deliver:
            response = main.request_password_reset(request, connection)

        self.assertEqual(response, {"message": "If the account exists, a one-time code has been sent to the selected contact."})
        self.assertEqual(connection.execute.call_count, 2)
        deliver.assert_not_called()


if __name__ == "__main__":
    unittest.main()
