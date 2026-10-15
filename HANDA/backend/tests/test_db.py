import unittest
from unittest.mock import MagicMock, call, patch

import psycopg
from fastapi import HTTPException

from app.db import CONNECT_ATTEMPTS, get_connection
from app.main import create_center, create_incident, evacuation_center_status, lifespan, resident_evacuation_status, update_current_profile, update_evacuee_status, write_evacuee
from app.schemas import CenterCreate, EvacueeCreate, EvacueeStatusUpdate, IncidentCreate, SelfProfileUpdate


class DatabaseDependencyTests(unittest.TestCase):
    @patch("app.db.time.sleep")
    @patch("app.db.psycopg.connect")
    def test_retries_transient_connection_failure(self, connect, sleep):
        connection = MagicMock()
        connect.side_effect = [psycopg.OperationalError("temporary timeout"), connection]

        dependency = get_connection()
        self.assertIs(next(dependency), connection)
        with self.assertRaises(StopIteration):
            next(dependency)

        self.assertEqual(connect.call_count, 2)
        self.assertEqual(connect.call_args.kwargs["connect_timeout"], 2)
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
        log_warning.assert_called_once()

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
        incident = IncidentCreate(
            id="incident-1",
            type="Flooding",
            description="Flood water is rising.",
            location="Poblacion",
        )

        result = create_incident(incident, connection, MagicMock(id="resident-1", role="resident"))

        self.assertEqual(result["status"], "accepted")
        self.assertEqual(connection.execute.call_args.args[1][3], "medium")
        self.assertEqual(connection.execute.call_args.args[1][-1], "resident-1")
        connection.commit.assert_called_once()

    def test_update_current_profile_persists_structured_name_fields(self):
        connection = MagicMock()
        connection.execute.return_value.fetchone.return_value = {
            "id": "user-1",
            "name": "Alex Marie Rivera",
            "first_name": "Alex",
            "middle_name": "Marie",
            "last_name": "Rivera",
            "email": "alex@example.org",
            "birthday": None,
            "sex": "",
            "mobile_number": "",
            "current_address": "",
            "role": "Responder",
        }

        result = update_current_profile(
            SelfProfileUpdate(firstName="Alex", middleName="Marie", lastName="Rivera"),
            MagicMock(id="user-1"),
            connection,
        )

        self.assertEqual(result["name"], "Alex Marie Rivera")
        self.assertEqual(connection.execute.call_args_list[0].args[1], ("Alex Marie Rivera", "Alex", "Marie", "Rivera", "user-1"))
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