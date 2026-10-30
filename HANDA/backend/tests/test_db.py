import json
import unittest
from datetime import date
from unittest.mock import MagicMock, call, patch

import psycopg
from fastapi import HTTPException

from app.db import CONNECT_ATTEMPTS, get_connection
from app.main import BINAN_CENTERS_FILE, cancel_resident_evacuation_registration, create_center, create_incident, database_readiness, evacuation_center_status, health, lifespan, register_resident_at_center, resident_evacuation_status, seed_binan_evacuation_centers, update_current_profile, update_evacuee_status, update_resident_evacuation_registration, write_evacuee
from app.schemas import CenterCreate, EvacuationRegistrationCenterUpdate, EvacuationRegistrationCreate, EvacueeCreate, EvacueeStatusUpdate, IncidentCreate, SelfProfileUpdate


class DatabaseDependencyTests(unittest.TestCase):
    def test_released_registration_is_not_returned_as_resident_status(self):
        connection = MagicMock()
        registration_query = MagicMock()
        member_count_query = MagicMock()
        registration_query.fetchone.return_value = None
        member_count_query.fetchone.return_value = {"member_count": 2}
        connection.execute.side_effect = [registration_query, member_count_query]

        result = resident_evacuation_status(connection, MagicMock(id="resident-1", name="Resident"))

        self.assertIsNone(result["registrationId"])
        self.assertEqual(result["status"], "not_registered")
        self.assertIn("status <> 'released'", connection.execute.call_args_list[0].args[0])

    def test_resident_can_change_center_for_pending_registration(self):
        connection = MagicMock()
        connection.execute.return_value.fetchone.side_effect = [
            {"id": "registration-1", "status": "registered"},
            {"id": "center-2", "capacity": 100, "current_occupancy": 20, "status": "available"},
        ]

        result = update_resident_evacuation_registration(
            "registration-1",
            EvacuationRegistrationCenterUpdate(centerId="center-2"),
            MagicMock(id="resident-1"),
            connection,
        )

        self.assertEqual(result, {"id": "registration-1", "status": "registered", "centerId": "center-2"})
        self.assertEqual(connection.execute.call_args_list[2].args[1], ("center-2", "registration-1"))
        connection.commit.assert_called_once()

    def test_resident_cannot_change_center_after_check_in(self):
        connection = MagicMock()
        connection.execute.return_value.fetchone.return_value = {"id": "registration-1", "status": "checked_in"}

        with self.assertRaises(HTTPException) as error:
            update_resident_evacuation_registration(
                "registration-1",
                EvacuationRegistrationCenterUpdate(centerId="center-2"),
                MagicMock(id="resident-1"),
                connection,
            )

        self.assertEqual(error.exception.status_code, 409)
        connection.commit.assert_not_called()

    def test_resident_cannot_create_duplicate_active_registration(self):
        connection = MagicMock()
        center_query = MagicMock()
        registration_query = MagicMock()
        center_query.fetchone.return_value = {"id": "center-1", "capacity": 100, "current_occupancy": 20, "status": "available"}
        registration_query.fetchone.return_value = {"id": "registration-1"}
        connection.execute.side_effect = [center_query, registration_query]
        registration = EvacuationRegistrationCreate(
            centerId="center-1",
            firstName="Alex",
            lastName="Rivera",
            age=30,
            sex="Female",
            contactNumber="09171234567",
            address="Poblacion",
            householdSize=1,
        )

        with self.assertRaises(HTTPException) as error:
            register_resident_at_center(registration, MagicMock(id="resident-1"), connection)

        self.assertEqual(error.exception.status_code, 409)
        connection.commit.assert_not_called()

    def test_resident_can_cancel_pending_registration(self):
        connection = MagicMock()
        connection.execute.return_value.fetchone.return_value = {"id": "registration-1", "status": "registered"}

        result = cancel_resident_evacuation_registration("registration-1", MagicMock(id="resident-1"), connection)

        self.assertEqual(result, {"id": "registration-1", "status": "cancelled"})
        self.assertEqual(connection.execute.call_args_list[1].args[0], "DELETE FROM evacuation_registrations WHERE id = %s")
        connection.commit.assert_called_once()

    def test_resident_cannot_cancel_checked_in_registration(self):
        connection = MagicMock()
        connection.execute.return_value.fetchone.return_value = {"id": "registration-1", "status": "checked_in"}

        with self.assertRaises(HTTPException) as error:
            cancel_resident_evacuation_registration("registration-1", MagicMock(id="resident-1"), connection)

        self.assertEqual(error.exception.status_code, 409)
        connection.commit.assert_not_called()

    @patch("app.db.time.sleep")
    @patch("app.db.random.uniform", return_value=0.5)
    @patch("app.db.psycopg.connect")
    def test_retries_transient_connection_failure(self, connect, jitter, sleep):
        connection = MagicMock()
        connect.side_effect = [psycopg.OperationalError("temporary timeout"), connection]

        dependency = get_connection()
        self.assertIs(next(dependency), connection)
        with self.assertRaises(StopIteration):
            next(dependency)

        self.assertEqual(connect.call_count, 2)
        self.assertEqual(connect.call_args.kwargs["connect_timeout"], 4)
        self.assertEqual(sleep.call_args_list, [call(0.5)])
        connection.__exit__.assert_called_once_with(None, None, None)

    @patch("app.db.time.sleep")
    @patch("app.db.logger.warning")
    @patch("app.db.psycopg.connect", side_effect=psycopg.OperationalError("pooler timeout"))
    def test_returns_service_unavailable_after_retries(self, connect, log_warning, sleep):
        with self.assertRaises(HTTPException) as error:
            next(get_connection())

        self.assertEqual(error.exception.status_code, 503)
        self.assertEqual(connect.call_count, CONNECT_ATTEMPTS)
        self.assertEqual(sleep.call_count, CONNECT_ATTEMPTS - 1)
        self.assertEqual(log_warning.call_count, 2)
        self.assertIn("Retrying database connection", log_warning.call_args_list[0].args[0])
        self.assertIn("Database connection failed", log_warning.call_args_list[1].args[0])

    @patch("app.db.time.sleep")
    @patch("app.db.psycopg.connect")
    def test_does_not_retry_permanent_authentication_failure(self, connect, sleep):
        class AuthenticationError(psycopg.OperationalError):
            @property
            def sqlstate(self):
                return "28P01"

        connect.side_effect = AuthenticationError("authentication failed")

        with self.assertRaises(HTTPException) as error:
            next(get_connection())

        self.assertEqual(error.exception.status_code, 503)
        connect.assert_called_once()
        sleep.assert_not_called()

    def test_liveness_does_not_require_database(self):
        self.assertEqual(health(), {"status": "ok"})

    def test_readiness_executes_lightweight_database_query(self):
        connection = MagicMock()

        self.assertEqual(database_readiness(connection), {"status": "ready", "database": "ok"})
        connection.execute.assert_called_once_with("SELECT 1")

    def test_binan_center_seed_data_is_complete_and_unique(self):
        centers = json.loads(BINAN_CENTERS_FILE.read_text(encoding="utf-8"))

        self.assertEqual(len(centers), 26)
        self.assertEqual(len({center["id"] for center in centers}), 26)
        self.assertTrue(all(center["name"] and center["location"] and center["contactNumber"] for center in centers))
        self.assertFalse(any("?" in center["location"] for center in centers))

    def test_seeding_upserts_centers_without_overwriting_admin_edits(self):
        connection = MagicMock()
        cursor = connection.cursor.return_value.__enter__.return_value

        seed_binan_evacuation_centers(connection)

        sql = cursor.executemany.call_args.args[0]
        self.assertEqual(len(cursor.executemany.call_args.args[1]), 26)
        self.assertIn("ON CONFLICT (id) DO UPDATE", sql)
        self.assertNotIn("capacity = EXCLUDED", sql)
        self.assertIn("NOT EXISTS", connection.execute.call_args.args[0])

    def test_write_evacuee_passes_sql_parameters_as_a_tuple(self):
        connection = MagicMock()
        evacuee = EvacueeCreate(
            id="evacuee-1",
            firstName="Alex",
            lastName="Rivera",
            age=30,
            sex="Other",
            address="Biñan",
        )

        result = write_evacuee(connection, evacuee)

        self.assertEqual(result["id"], "evacuee-1")
        self.assertEqual(len(connection.execute.call_args.args), 2)
        self.assertEqual(connection.execute.call_args.args[1][0], "evacuee-1")

    def test_update_evacuee_status_passes_sql_parameters_as_a_tuple(self):
        connection = MagicMock()
        connection.execute.return_value.fetchone.return_value = {"id": "evacuee-1"}

        update_evacuee_status("evacuee-1", EvacueeStatusUpdate(evacuationStatus="checked_in"), connection)

        self.assertEqual(len(connection.execute.call_args.args), 2)
        self.assertEqual(connection.execute.call_args.args[1], ("checked_in", "evacuee-1"))

    def test_create_center_passes_sql_parameters_as_a_tuple(self):
        connection = MagicMock()
        center = CenterCreate(name="Community Hall", location="Poblacion", capacity=100)

        create_center(center, connection, MagicMock())

        self.assertEqual(len(connection.execute.call_args.args), 2)
        self.assertEqual(connection.execute.call_args.args[1][1:5], ("Community Hall", "Poblacion", 100, 0))

    def test_center_status_is_derived_from_occupancy_and_capacity(self):
        self.assertEqual(evacuation_center_status(10, 0, "available"), "available")
        self.assertEqual(evacuation_center_status(10, 2, "available"), "limited")
        self.assertEqual(evacuation_center_status(10, 10, "limited"), "full")
        self.assertEqual(evacuation_center_status(10, 2, "closed"), "closed")

    def test_unregistered_resident_count_includes_user_and_saved_household(self):
        connection = MagicMock()
        connection.execute.return_value.fetchone.side_effect = [None, {"member_count": 2}]

        result = resident_evacuation_status(connection, MagicMock(id="resident-1", name="Resident"))

        self.assertEqual(result["householdCount"], 3)

    def test_registered_household_count_includes_resident(self):
        connection = MagicMock()
        connection.execute.return_value.fetchone.return_value = {
            "id": "registration-1",
            "status": "registered",
            "registered_at": None,
            "checked_in_at": None,
            "first_name": "Alex",
            "middle_name": None,
            "last_name": "Rivera",
            "age": 30,
            "sex": "Other",
            "contact_number": "09171234567",
            "address": "Biñan",
            "household_size": 1,
            "checked_in_by": None,
            "center_id": "center-1",
            "center_name": "Community Hall",
            "center_location": "Poblacion",
        }
        connection.execute.return_value.fetchall.return_value = [
            {"id": "member-1"},
            {"id": "member-2"},
        ]

        result = resident_evacuation_status(connection, MagicMock(id="resident-1", name="Resident"))

        self.assertEqual(result["householdCount"], 3)

    def test_create_incident_persists_resident_report_and_commits(self):
        connection = MagicMock()
        photo_uris = ["data:image/jpeg;base64,Y2FwdHVyZWQtcGhvdG8="]
        incident = IncidentCreate(
            id="incident-1",
            type="Flooding",
            description="Flood water is rising.",
            location="Poblacion",
            photoUris=photo_uris,
        )

        result = create_incident(incident, connection, MagicMock(id="resident-1", role="resident"))

        self.assertEqual(result["status"], "accepted")
        self.assertEqual(connection.execute.call_args.args[1][3], "medium")
        self.assertEqual(json.loads(connection.execute.call_args.args[1][7]), photo_uris)
        self.assertEqual(connection.execute.call_args.args[1][-1], "resident-1")
        connection.commit.assert_called_once()

    def test_update_current_profile_persists_structured_profile_fields(self):
        connection = MagicMock()
        connection.execute.return_value.fetchone.return_value = {
            "id": "user-1",
            "name": "Alex Marie Rivera",
            "first_name": "Alex",
            "middle_name": "Marie",
            "last_name": "Rivera",
            "email": "alex@example.org",
            "birthday": date(1990, 1, 2),
            "sex": "Female",
            "mobile_number": "",
            "current_address": "123 Main Street",
            "role": "Responder",
        }

        result = update_current_profile(
            SelfProfileUpdate(
                firstName="Alex",
                middleName="Marie",
                lastName="Rivera",
                birthday=date(1990, 1, 2),
                sex="Female",
                currentAddress="123 Main Street",
            ),
            MagicMock(id="user-1"),
            connection,
        )

        self.assertEqual(result["name"], "Alex Marie Rivera")
        self.assertEqual(connection.execute.call_args_list[0].args[1], ("Alex Marie Rivera", "Alex", "Marie", "Rivera", date(1990, 1, 2), "Female", "123 Main Street", "user-1"))
        connection.commit.assert_called_once()


class DatabaseStartupTests(unittest.IsolatedAsyncioTestCase):
    @patch("app.main.logger.warning")
    @patch("app.main.ensure_default_users")
    @patch("app.main.ensure_operational_schema", side_effect=psycopg.OperationalError("database unavailable"))
    async def test_startup_continues_when_database_is_unavailable(self, ensure_schema, ensure_users, log_warning):
        async with lifespan(None):
            self.assertTrue(True)

        ensure_schema.assert_called_once()
        ensure_users.assert_not_called()
        log_warning.assert_called_once()


if __name__ == "__main__":
    unittest.main()