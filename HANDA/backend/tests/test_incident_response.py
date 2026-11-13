import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from pydantic import ValidationError

from app import main
from app.auth import CurrentUser
from app.schemas import IncidentDispatch, IncidentResponsePhotoCreate, IncidentStatusUpdate, UserRegistration

RESPONDER = {
    "firstName": "Ana",
    "lastName": "Santos",
    "birthday": "2000-01-01",
    "sex": "Female",
    "mobileNumber": "09171234567",
    "email": "ana@example.com",
    "password": "StrongPass1!",
    "registrationToken": "r" * 32,
    "role": "Responder",
    "responderType": "Official",
}


class ResponderOrganizationTests(unittest.TestCase):
    def test_responder_must_choose_an_organization(self):
        with self.assertRaises(ValidationError):
            UserRegistration.model_validate(RESPONDER)

    def test_barangay_responder_requires_a_barangay(self):
        with self.assertRaises(ValidationError):
            UserRegistration.model_validate({**RESPONDER, "responderOrganization": "Barangay Responder"})
        with self.assertRaises(ValidationError):
            UserRegistration.model_validate({**RESPONDER, "responderOrganization": "Barangay Responder", "responderBarangay": "Nowhere"})

    def test_barangay_responder_keeps_valid_barangay(self):
        registration = UserRegistration.model_validate({**RESPONDER, "responderOrganization": "Barangay Responder", "responderBarangay": "Santo Tomas"})

        self.assertEqual(registration.responderBarangay, "Santo Tomas")

    def test_other_organizations_discard_a_barangay(self):
        registration = UserRegistration.model_validate({**RESPONDER, "responderOrganization": "BFP", "responderBarangay": "Loma"})

        self.assertIsNone(registration.responderBarangay)

    def test_unknown_organization_is_rejected(self):
        with self.assertRaises(ValidationError):
            UserRegistration.model_validate({**RESPONDER, "responderOrganization": "Red Cross"})

    def test_residents_do_not_need_an_organization(self):
        registration = UserRegistration.model_validate({**RESPONDER, "role": "Resident", "responderType": None})

        self.assertIsNone(registration.responderOrganization)


class AcknowledgementDefaultsTests(unittest.TestCase):
    def setUp(self):
        self.responder = CurrentUser("responder-1", "r@example.com", "Juan Dela Cruz", "responder", 0)
        self.connection = MagicMock()
        self.connection.execute.return_value.fetchone.return_value = {
            "name": "Juan Dela Cruz",
            "responder_organization": "Barangay Responder",
            "responder_barangay": "Santo Domingo",
        }

    def test_acknowledging_fills_people_and_organization_when_omitted(self):
        update = main.resolve_response_details(self.connection, self.responder, IncidentStatusUpdate(status="acknowledged"))

        self.assertEqual(update.responsePeople, "Juan Dela Cruz")
        self.assertEqual(update.responseOrganizations, "Barangay Responder (Brgy. Santo Domingo)")

    def test_explicit_empty_or_edited_values_are_kept(self):
        update = main.resolve_response_details(
            self.connection,
            self.responder,
            IncidentStatusUpdate(status="acknowledged", responsePeople="", responseOrganizations="PNP, BFP"),
        )

        self.assertEqual(update.responsePeople, "")
        self.assertEqual(update.responseOrganizations, "PNP, BFP")
        self.connection.execute.assert_not_called()

    def test_other_statuses_keep_stored_values_by_leaving_fields_unset(self):
        update = main.resolve_response_details(self.connection, self.responder, IncidentStatusUpdate(status="in_progress"))

        self.assertIsNone(update.responsePeople)
        self.assertIsNone(update.responseOrganizations)

    def test_administrators_are_not_listed_as_responders(self):
        admin = CurrentUser("admin-1", "a@example.com", "Admin", "admin", 0)

        update = main.resolve_response_details(self.connection, admin, IncidentStatusUpdate(status="acknowledged"))

        self.assertIsNone(update.responsePeople)

    def test_non_barangay_organization_label_has_no_barangay(self):
        self.assertEqual(main.responder_organization_label("PNP", "Loma"), "PNP")
        self.assertEqual(main.responder_organization_label(None, None), "")


class IncidentStatusTransitionTests(unittest.TestCase):
    def setUp(self):
        self.admin = CurrentUser("admin-1", "a@example.com", "Admin", "admin", 0)

    def test_reported_incident_cannot_skip_acknowledgement(self):
        for next_status in ("in_progress", "resolved"):
            with self.subTest(next_status=next_status):
                connection = MagicMock()
                connection.execute.return_value.fetchone.return_value = {"status": "reported"}

                with self.assertRaises(HTTPException) as error:
                    main.update_incident_status(
                        "incident-1",
                        IncidentStatusUpdate(status=next_status),
                        connection,
                        self.admin,
                    )

                self.assertEqual(error.exception.status_code, 409)
                self.assertIn("acknowledged", error.exception.detail)
                self.assertEqual(connection.execute.call_count, 1)
                connection.commit.assert_not_called()

    def test_status_endpoint_allows_admin_and_responder_roles_only(self):
        route = next(route for route in main.app.routes if getattr(route, "path", "") == "/api/v1/incidents/{incident_id}/status")
        guard = next(dependency.call for dependency in route.dependant.dependencies if dependency.call.__name__ == "dependency")

        for role in ("admin", "responder"):
            user = CurrentUser(f"{role}-1", f"{role}@example.com", role, role, 0)
            self.assertIs(guard(user), user)

        with self.assertRaises(HTTPException) as error:
            guard(CurrentUser("resident-1", "resident@example.com", "Resident", "resident", 0))
        self.assertEqual(error.exception.status_code, 403)


class ResidentSosStatusAccessTests(unittest.TestCase):
    def test_active_sos_endpoint_is_resident_only(self):
        route = next(route for route in main.app.routes if getattr(route, "path", "") == "/api/v1/resident/sos")
        guard = next(dependency.call for dependency in route.dependant.dependencies if dependency.call.__name__ == "dependency")
        resident = CurrentUser("resident-1", "resident@example.com", "Resident", "resident", 0)

        self.assertIs(guard(resident), resident)
        for role in ("responder", "admin"):
            with self.subTest(role=role), self.assertRaises(HTTPException) as error:
                guard(CurrentUser(f"{role}-1", f"{role}@example.com", role, role, 0))
            self.assertEqual(error.exception.status_code, 403)


class IncidentDispatchTests(unittest.TestCase):
    @patch("app.main.seed_binan_evacuation_centers")
    @patch("app.main.psycopg.connect")
    def test_startup_adds_incident_id_to_legacy_notifications_table(self, connect, _seed_centers):
        connection = MagicMock()
        connect.return_value.__enter__.return_value = connection

        main.ensure_operational_schema()

        statements = [call.args[0] for call in connection.execute.call_args_list]
        self.assertIn(
            "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS incident_id TEXT REFERENCES incidents(id) ON DELETE CASCADE",
            statements,
        )

    def test_dispatch_requires_unique_responder_ids(self):
        with self.assertRaises(ValidationError):
            IncidentDispatch(responderIds=["responder-1", "responder-1"])

    def test_active_responder_roster_is_admin_only(self):
        route = next(route for route in main.app.routes if getattr(route, "path", "") == "/api/v1/responders/active")
        guard = next(dependency.call for dependency in route.dependant.dependencies if dependency.call.__name__ == "dependency")
        responder = CurrentUser("responder-1", "r@example.com", "Responder", "responder", 0)

        with self.assertRaises(HTTPException) as error:
            guard(responder)

        self.assertEqual(error.exception.status_code, 403)

    def test_dispatch_endpoint_is_admin_only(self):
        route = next(route for route in main.app.routes if getattr(route, "path", "") == "/api/v1/incidents/{incident_id}/dispatch")
        guard = next(dependency.call for dependency in route.dependant.dependencies if dependency.call.__name__ == "dependency")
        responder = CurrentUser("responder-1", "r@example.com", "Responder", "responder", 0)

        with self.assertRaises(HTTPException) as error:
            guard(responder)

        self.assertEqual(error.exception.status_code, 403)

    def test_resolved_incidents_cannot_be_dispatched(self):
        connection = MagicMock()
        connection.execute.return_value.fetchone.return_value = {
            "id": "incident-1",
            "type": "Fire",
            "location_text": "Biñan",
            "status": "resolved",
            "reporter_user_id": None,
        }
        admin = CurrentUser("admin-1", "a@example.com", "Admin", "admin", 0)

        with self.assertRaises(HTTPException) as error:
            main.dispatch_incident_responders("incident-1", IncidentDispatch(responderIds=["responder-1"]), connection, admin)

        self.assertEqual(error.exception.status_code, 409)
        connection.execute.assert_called_once()
        connection.commit.assert_not_called()

    def test_dispatch_saves_assignment_and_notifies_selected_responder(self):
        connection = MagicMock()

        def execute(sql, params=None):
            cursor = MagicMock()
            if "SELECT id, type, location_text, status, reporter_user_id" in sql:
                cursor.fetchone.return_value = {
                    "id": "incident-1",
                    "type": "Fire",
                    "location_text": "Biñan",
                    "status": "reported",
                    "reporter_user_id": None,
                }
            elif "SELECT id, name, responder_organization, responder_barangay" in sql:
                cursor.fetchall.return_value = [{
                    "id": "responder-1",
                    "name": "Ana Santos",
                    "responder_organization": "BFP",
                    "responder_barangay": None,
                }]
            elif "SELECT responder_id FROM incident_responder_assignments" in sql:
                cursor.fetchall.return_value = []
            elif "SELECT users.name, users.responder_organization" in sql:
                cursor.fetchall.return_value = [{
                    "name": "Ana Santos",
                    "responder_organization": "BFP",
                    "responder_barangay": None,
                }]
            return cursor

        connection.execute.side_effect = execute
        admin = CurrentUser("admin-1", "a@example.com", "Admin", "admin", 0)

        result = main.dispatch_incident_responders(
            "incident-1",
            IncidentDispatch(responderIds=["responder-1"]),
            connection,
            admin,
        )

        self.assertEqual(result["status"], "acknowledged")
        self.assertEqual(result["responders"], [{"id": "responder-1", "name": "Ana Santos"}])
        cursor = connection.cursor.return_value.__enter__.return_value
        cursor.executemany.assert_called_once()
        self.assertEqual(cursor.executemany.call_args.args[1], [("incident-1", "responder-1", "admin-1")])
        incident_update = next(call for call in connection.execute.call_args_list if "UPDATE incidents" in call.args[0])
        self.assertIn("THEN 'acknowledged'", incident_update.args[0])
        self.assertTrue(any("'acknowledged'" in call.args[0] for call in connection.execute.call_args_list if "incident_status_events" in call.args[0]))
        notifications = [call for call in connection.execute.call_args_list if "INSERT INTO notifications" in call.args[0]]
        pushes = [call for call in connection.execute.call_args_list if "INSERT INTO push_deliveries" in call.args[0]]
        self.assertEqual(len(notifications), 1)
        self.assertIn("You have been dispatched", notifications[0].args[1][3])
        self.assertEqual(len(pushes), 1)
        connection.commit.assert_called_once()


class ScenePhotoAssignmentTests(unittest.TestCase):
    def test_only_dispatched_responders_can_submit_scene_photos(self):
        connection = MagicMock()
        incident_cursor = MagicMock()
        incident_cursor.fetchone.return_value = {"type": "Fire", "location_text": "Biñan", "status": "in_progress"}
        assignment_cursor = MagicMock()
        assignment_cursor.fetchone.return_value = None
        connection.execute.side_effect = [incident_cursor, assignment_cursor]
        responder = CurrentUser("responder-1", "r@example.com", "Responder", "responder", 0)
        photo = IncidentResponsePhotoCreate(photoUri="data:image/jpeg;base64," + "a" * 40)

        with self.assertRaises(HTTPException) as error:
            main.add_incident_response_photo("incident-1", photo, connection, responder)

        self.assertEqual(error.exception.status_code, 403)
        self.assertEqual(connection.execute.call_count, 2)
        connection.commit.assert_not_called()

    @patch("app.main.notify_responders")
    @patch("app.main.write_log")
    def test_scene_photo_records_arrival_and_advances_acknowledged_incident(self, _write_log, _notify):
        connection = MagicMock()
        created_at = "2026-11-10T12:00:00Z"

        def execute(sql, params=None):
            cursor = MagicMock()
            if "SELECT type, location_text, status, reporter_user_id" in sql:
                cursor.fetchone.return_value = {
                    "type": "Fire",
                    "location_text": "Biñan",
                    "status": "acknowledged",
                    "reporter_user_id": None,
                    "latitude": 14.3,
                    "longitude": 121.1,
                }
            elif "SELECT 1 FROM incident_responder_assignments" in sql:
                cursor.fetchone.return_value = {"exists": 1}
            elif "SELECT COUNT(*) AS total" in sql:
                cursor.fetchone.return_value = {"total": 0}
            elif "INSERT INTO incident_response_photos" in sql:
                cursor.fetchone.return_value = {"id": "photo-1", "created_at": created_at}
            return cursor

        connection.execute.side_effect = execute
        responder = CurrentUser("responder-1", "r@example.com", "Ana", "responder", 0)
        photo = IncidentResponsePhotoCreate(
            photoUri="data:image/jpeg;base64," + "a" * 40,
            latitude=14.31,
            longitude=121.12,
        )

        result = main.add_incident_response_photo("incident-1", photo, connection, responder)

        self.assertEqual(result["createdAt"], created_at)
        incident_update = next(call for call in connection.execute.call_args_list if "UPDATE incidents" in call.args[0])
        self.assertIn("THEN 'in_progress'", incident_update.args[0])
        self.assertEqual(incident_update.args[1][:3], (created_at, 14.31, 121.12))
        self.assertTrue(any("'in_progress'" in call.args[0] for call in connection.execute.call_args_list if "incident_status_events" in call.args[0]))
        connection.commit.assert_called_once()

    def test_responder_cannot_manually_acknowledge_or_start_response(self):
        connection = MagicMock()
        connection.execute.return_value.fetchone.return_value = {"status": "acknowledged"}
        responder = CurrentUser("responder-1", "r@example.com", "Ana", "responder", 0)

        with self.assertRaises(HTTPException) as error:
            main.update_incident_status("incident-1", IncidentStatusUpdate(status="in_progress"), connection, responder)

        self.assertEqual(error.exception.status_code, 403)
        connection.execute.assert_called_once()
        connection.commit.assert_not_called()

    def test_only_dispatched_responder_can_resolve_incident(self):
        connection = MagicMock()
        connection.execute.side_effect = [
            MagicMock(fetchone=MagicMock(return_value={"status": "in_progress"})),
            MagicMock(fetchone=MagicMock(return_value=None)),
        ]
        responder = CurrentUser("responder-1", "r@example.com", "Ana", "responder", 0)

        with self.assertRaises(HTTPException) as error:
            main.update_incident_status("incident-1", IncidentStatusUpdate(status="resolved"), connection, responder)

        self.assertEqual(error.exception.status_code, 403)
        connection.commit.assert_not_called()


class ReporterContactTests(unittest.TestCase):
    def test_only_responders_and_admins_can_read_reporter_contacts(self):
        route = next(route for route in main.app.routes if getattr(route, "path", "") == "/api/v1/incidents/reporters")
        guard = next(dependency.call for dependency in route.dependant.dependencies if dependency.call.__name__ == "dependency")

        for role in ("responder", "admin"):
            user = CurrentUser(f"{role}-1", f"{role}@example.com", role, role, 0)
            self.assertIs(guard(user), user, role)
        resident = CurrentUser("resident-1", "resident@example.com", "resident", "resident", 0)
        with self.assertRaises(HTTPException) as error:
            guard(resident)
        self.assertEqual(error.exception.status_code, 403)

    def test_reporter_contacts_exclude_resolved_incidents(self):
        connection = MagicMock()
        connection.execute.return_value.fetchall.return_value = [{"incident_id": "i-1", "name": "Ana", "mobile_number": "09171234567"}]

        result = main.list_incident_reporters(connection, MagicMock())

        self.assertEqual(result[0]["mobile_number"], "09171234567")
        self.assertIn("<> 'resolved'", connection.execute.call_args.args[0])


class ResponderRosterTests(unittest.TestCase):
    def test_residents_cannot_read_responder_names(self):
        route = next(route for route in main.app.routes if getattr(route, "path", "") == "/api/v1/incidents/responders")
        guard = next(dependency.call for dependency in route.dependant.dependencies if dependency.call.__name__ == "dependency")
        resident = CurrentUser("resident-1", "resident@example.com", "resident", "resident", 0)
        with self.assertRaises(HTTPException) as error:
            guard(resident)
        self.assertEqual(error.exception.status_code, 403)

    def test_roster_lists_dispatched_responders_of_active_incidents_only(self):
        connection = MagicMock()
        connection.execute.return_value.fetchall.return_value = [{"incident_id": "i-1", "name": "Ben", "status": "acknowledged"}]

        result = main.list_incident_responders(connection, MagicMock())

        self.assertEqual(result[0]["name"], "Ben")
        sql = connection.execute.call_args.args[0]
        self.assertIn("<> 'resolved'", sql)
        self.assertIn("incident_responder_assignments", sql)
        self.assertIn("assignments.status = 'dispatched'", sql)


class ResidentNotificationTests(unittest.TestCase):
    def test_critical_incident_notifies_active_responders(self):
        connection = MagicMock()
        connection.execute.return_value.fetchone.return_value = None
        incident = main.IncidentCreate(
            id="sos-1",
            type="SOS - Medical",
            description="Resident activated SOS.",
            severity="critical",
            location="Biñan City · 14.3, 121.1",
        )

        result = main.create_incident(incident, connection, MagicMock(id="resident-1", role="resident"))

        self.assertEqual(result["status"], "accepted")
        notification_call = next(
            call for call in connection.execute.call_args_list
            if "INSERT INTO notifications" in call.args[0]
        )
        self.assertEqual(notification_call.args[1], ("sos-1", "EMERGENCY SOS: SOS - Medical", "Resident activated SOS. Location: Biñan City · 14.3, 121.1", "resident-1"))
        self.assertIn("role = 'Responder'", notification_call.args[0])
        connection.commit.assert_called_once()

    def test_acknowledged_message_mentions_type_status_and_reassurance(self):
        update = IncidentStatusUpdate(status="acknowledged", responsePeople="Juan", responseOrganizations="PNP", responseEtaMinutes=7)

        title, message = main.incident_notification_message("acknowledged", update, "Fire")

        self.assertEqual(title, "Help is on the way")
        self.assertIn("Fire report", message)
        self.assertIn("on the way", message)
        self.assertIn("stay safe", message.lower())
        self.assertIn("Status: ACKNOWLEDGED", message)
        self.assertIn("ETA: 7 minutes", message)
        self.assertIn("Organizations: PNP", message)

    def test_message_without_details_still_includes_status(self):
        title, message = main.incident_notification_message("resolved", IncidentStatusUpdate(status="resolved"), "Flooding")

        self.assertEqual(title, "Incident response completed")
        self.assertIn("Status: RESOLVED", message)


if __name__ == "__main__":
    unittest.main()
