import unittest
from unittest.mock import MagicMock

from fastapi import HTTPException
from pydantic import ValidationError

from app import main
from app.auth import CurrentUser
from app.schemas import IncidentStatusUpdate, UserRegistration

RESPONDER = {
    "firstName": "Ana",
    "lastName": "Santos",
    "birthday": "2000-01-01",
    "sex": "Female",
    "mobileNumber": "09171234567",
    "email": "ana@example.com",
    "password": "StrongPass1!",
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
        self.responder = CurrentUser("responder-1", "r@example.com", "Juan Dela Cruz", "responder", 0)

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
                        self.responder,
                    )

                self.assertEqual(error.exception.status_code, 409)
                self.assertIn("acknowledged", error.exception.detail)
                self.assertEqual(connection.execute.call_count, 1)
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


class ResidentNotificationTests(unittest.TestCase):
    def test_critical_incident_notifies_active_responders(self):
        connection = MagicMock()
        connection.execute.return_value.fetchall.return_value = [{"id": "responder-1"}]
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
