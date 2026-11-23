import unittest
from unittest.mock import MagicMock, patch
from urllib.error import URLError

from pydantic import ValidationError

from app import main, push
from app.auth import CurrentUser
from app.schemas import EvacuationRegistrationStatusUpdate, IncidentCreate, IncidentStatusUpdate, PushDeviceInput


class PushDeviceTests(unittest.TestCase):
    def test_device_token_validation(self):
        self.assertEqual(PushDeviceInput(token="ExponentPushToken[abc-123_def]").token, "ExponentPushToken[abc-123_def]")
        with self.assertRaises(ValidationError):
            PushDeviceInput(token="not-a-push-token")

    def test_registration_uses_authenticated_user_and_clears_previous_owner_queue(self):
        connection = MagicMock()
        user = CurrentUser("resident-1", "r@example.com", "Resident", "resident", 0)
        main.register_push_device(PushDeviceInput(token="ExpoPushToken[abc123]"), connection, user)
        calls = connection.execute.call_args_list
        self.assertEqual(calls[0].args[1], ("ExpoPushToken[abc123]", "resident-1"))
        self.assertEqual(calls[1].args[1], ("ExpoPushToken[abc123]", "resident-1"))
        connection.commit.assert_called_once()

    def test_removal_is_scoped_to_user(self):
        connection = MagicMock()
        user = CurrentUser("resident-1", "r@example.com", "Resident", "resident", 0)
        main.remove_push_device(PushDeviceInput(token="ExpoPushToken[abc123]"), connection, user)
        self.assertIn("user_id = %s", connection.execute.call_args.args[0])
        self.assertEqual(connection.execute.call_args.args[1], ("ExpoPushToken[abc123]", "resident-1"))

    def test_noncritical_new_incident_queues_responder_push(self):
        connection = MagicMock()
        incident = IncidentCreate(type="Fire", description="Smoke", location="Biñan", severity="high")
        main.notify_responders_of_new_incident(connection, incident, "incident-1", "resident-1")
        self.assertEqual(connection.execute.call_count, 2)
        self.assertIn("INSERT INTO notifications", connection.execute.call_args_list[0].args[0])
        self.assertIn("INSERT INTO push_deliveries", connection.execute.call_args_list[1].args[0])
        self.assertEqual(connection.execute.call_args_list[1].args[1][1], "Fire: HIGH severity. Location: Biñan.")
        self.assertEqual(connection.execute.call_args_list[1].args[1][-2:], ("incident-1", "resident-1"))

    def test_new_incident_notifies_all_active_residents_and_queues_push(self):
        connection = MagicMock()
        incident = IncidentCreate(type="Fire", description="Smoke", location="Biñan", severity="high")

        main.notify_residents_of_new_incident(connection, incident, "incident-1")

        notification_call, push_call = connection.execute.call_args_list
        self.assertIn("INSERT INTO notifications", notification_call.args[0])
        self.assertIn("role = 'Resident' AND status = 'Active'", notification_call.args[0])
        self.assertEqual(notification_call.args[1], (
            "incident-1",
            "New community incident: Fire",
            "A HIGH severity Fire incident was reported at Biñan. Open HANDA to view details.",
        ))
        self.assertIn("INSERT INTO push_deliveries", push_call.args[0])
        self.assertIn("role = 'Resident' AND users.status = 'Active'", push_call.args[0])
        self.assertEqual(push_call.args[1], (
            "New community incident",
            "Fire: HIGH severity. Location: Biñan.",
            "incident-1",
        ))

    def test_existing_incident_does_not_send_new_alert(self):
        connection = MagicMock()
        connection.execute.return_value.fetchone.return_value = {"id": "incident-1"}
        incident = IncidentCreate(id="incident-1", type="Fire", description="Smoke", location="Biñan")
        main.create_incident(incident, connection, MagicMock(role="resident", id="resident-1"))
        self.assertFalse(any("INSERT INTO push_deliveries" in c.args[0] for c in connection.execute.call_args_list))

    def test_status_change_queues_reporter_update(self):
        connection = MagicMock()
        def execute(sql, params=None):
            cursor = MagicMock()
            if "SELECT status, verified_by" in sql:
                cursor.fetchone.return_value = {"status": "reported", "verified_by": None}
            elif "UPDATE incidents" in sql:
                cursor.fetchone.return_value = {
                    "response_people": "", "response_organizations": "", "response_eta_minutes": None, "response_notes": "",
                }
            elif "SELECT users.id, users.email" in sql:
                cursor.fetchone.return_value = {
                    "id": "resident-1", "email": "r@example.com", "mobile_number": "",
                    "email_alerts_enabled": False, "sms_alerts_enabled": False, "incident_type": "Fire",
                }
            elif "SELECT type, location_text" in sql:
                cursor.fetchone.return_value = {"type": "Fire", "location_text": "Biñan"}
            elif "SELECT users.id, users.mobile_number" in sql:
                cursor.fetchall.return_value = [{"id": "responder-1", "mobile_number": ""}]
            return cursor
        connection.execute.side_effect = execute
        user = CurrentUser("admin-1", "admin@example.com", "Admin", "admin", 0)
        with patch("app.main.deliver_incident_alert"), patch("app.main.resolve_response_details", side_effect=lambda _c, _u, update: update):
            main.update_incident_status("incident-1", IncidentStatusUpdate(status="acknowledged"), connection, user)
        call = next(c for c in connection.execute.call_args_list if "INSERT INTO push_deliveries" in c.args[0])
        self.assertEqual(call.args[1][-1], "resident-1")
        self.assertEqual(call.args[1][1], "Fire report: ACKNOWLEDGED. Updated by Administrator Admin.")
        responder_push = next(
            c for c in connection.execute.call_args_list
            if "INSERT INTO push_deliveries" in c.args[0]
            and c.args[1][-1] == "responder-1"
        )
        self.assertEqual(responder_push.args[1], (
            "Incident update: Fire",
            "Fire is now ACKNOWLEDGED. Open HANDA for details.",
            "incident-1",
            "responder-1",
        ))
        connection.commit.assert_called_once()

    def test_evacuation_status_changes_notify_registration_owner(self):
        for current in ("registered", "checked_in", "evacuated"):
            with self.subTest(current_status=current):
                connection = MagicMock()
                def execute(sql, params=None):
                    cursor = MagicMock()
                    if "SELECT id, center_id, status" in sql:
                        cursor.fetchone.return_value = {
                            "id": "registration-1", "center_id": "center-1", "status": current,
                            "household_size": 2, "resident_user_id": "resident-1",
                        }
                    elif "SELECT id, name, location_text, capacity, current_occupancy, status" in sql:
                        cursor.fetchone.return_value = {
                            "id": "center-1", "name": "Center", "location_text": "",
                            "capacity": 10, "current_occupancy": 2, "status": "limited",
                        }
                    elif "SELECT id, name, capacity, current_occupancy, status" in sql:
                        cursor.fetchone.return_value = {
                            "id": "center-1", "name": "Center",
                            "capacity": 10, "current_occupancy": 0, "status": "available",
                        }
                    return cursor
                connection.execute.side_effect = execute
                user = CurrentUser("responder-1", "r@example.com", "Ana Santos", "responder", 0)
                result = main.update_evacuation_registration_status(
                    "registration-1", EvacuationRegistrationStatusUpdate(status="released"), user, connection,
                )
                self.assertEqual(result["status"], "released")
                calls = connection.execute.call_args_list
                push_call = next(call for call in calls if "INSERT INTO push_deliveries" in call.args[0])
                self.assertEqual(push_call.args[1], (
                    "Evacuation status update",
                    "Your evacuation registration is RELEASED. Updated by Responder Ana Santos.",
                    "registration-1", "resident-1",
                ))
                connection.commit.assert_called_once()

    def test_registration_status_schema_rejects_check_in_transitions(self):
        from pydantic import ValidationError

        with self.assertRaises(ValidationError):
            EvacuationRegistrationStatusUpdate(status="checked_in")

    def test_releasing_legacy_registered_walk_in_does_not_decrement_capacity(self):
        connection = MagicMock()
        connection.execute.side_effect = [
            MagicMock(fetchone=MagicMock(return_value={
                "id": "registration-1", "center_id": "center-1", "status": "registered",
                "household_size": 1, "resident_user_id": None,
            })),
            MagicMock(),
            MagicMock(),
        ]
        user = CurrentUser("admin-1", "a@example.com", "Admin", "admin", 0)

        result = main.update_evacuation_registration_status(
            "registration-1", EvacuationRegistrationStatusUpdate(status="released"), user, connection,
        )

        self.assertEqual(result["status"], "released")
        self.assertFalse(any("UPDATE evacuation_centers" in call.args[0] for call in connection.execute.call_args_list))
        self.assertFalse(any("INSERT INTO push_deliveries" in call.args[0] for call in connection.execute.call_args_list))
        connection.commit.assert_called_once()

    def test_evacuation_center_status_change_queues_push_for_registered_residents(self):
        connection = MagicMock()
        connection.execute.return_value.fetchall.return_value = [{
            "id": "resident-1",
            "email": "r@example.com",
            "mobile_number": "",
            "email_alerts_enabled": False,
            "sms_alerts_enabled": False,
        }]
        center = {
            "id": "center-1",
            "name": "Biñan Central School",
            "status": "closed",
            "current_occupancy": 10,
            "capacity": 10,
        }

        with patch("app.main.enqueue_evacuation_status") as enqueue, patch("app.main.deliver_incident_alert") as deliver:
            main.notify_center_status_change(connection, "available", center)

        enqueue.assert_called_once_with(
            connection,
            "resident-1",
            "center-1",
            "The evacuation center Biñan Central School is now closed. Current occupancy: 10 of 10.",
        )
        deliver.assert_called_once_with(
            "r@example.com",
            "",
            "Biñan Central School status changed to CLOSED",
            "The evacuation center Biñan Central School is now closed. Current occupancy: 10 of 10.",
            False,
            False,
        )

    def test_unchanged_evacuation_center_status_sends_no_push(self):
        connection = MagicMock()
        with patch("app.main.enqueue_evacuation_status") as enqueue:
            main.notify_center_status_change(connection, "available", {"status": "available"})
        connection.execute.assert_not_called()
        enqueue.assert_not_called()


class PushDeliveryTests(unittest.TestCase):
    def setUp(self):
        self.delivery = {
            "id": 1, "token": "ExpoPushToken[abc123]", "user_id": "resident-1",
            "title": "Update", "body": "Open HANDA", "incident_id": "incident-1",
            "receipt_id": None, "attempts": 0, "notification_type": "incident",
        }
        self.connection = MagicMock()
        self.connection.execute.return_value.fetchone.return_value = self.delivery
        self.pool = MagicMock()
        self.pool.connection.return_value.__enter__.return_value = self.connection
        self.connect = patch("app.push.open_connection_pool", return_value=self.pool)
        self.connect.start()
        self.addCleanup(self.connect.stop)

    def test_successful_send_saves_receipt_and_private_payload(self):
        with patch("app.push._request", return_value={"data": {"status": "ok", "id": "receipt-1"}}) as request:
            self.assertTrue(push.process_one())
        payload = request.call_args.args[1]
        self.assertEqual(payload["channelId"], "incidents")
        self.assertEqual(payload["data"], {"type": "incident", "incidentId": "incident-1"})
        self.assertIn("receipt_id = %s", self.connection.execute.call_args.args[0])
        self.assertEqual(self.connection.execute.call_args.args[1], ("receipt-1", 1))

    def test_evacuation_payload_contains_registration_type(self):
        self.delivery["notification_type"] = "evacuation"
        self.delivery["incident_id"] = "registration-1"
        with patch("app.push._request", return_value={"data": {"status": "ok", "id": "receipt-1"}}) as request:
            self.assertTrue(push.process_one())
        self.assertEqual(request.call_args.args[1]["data"], {"type": "evacuation", "registrationId": "registration-1"})

    def test_weather_payload_uses_weather_channel_without_incident_id(self):
        self.delivery["notification_type"] = "weather"
        self.delivery["incident_id"] = None
        with patch("app.push._request", return_value={"data": {"status": "ok", "id": "receipt-1"}}) as request:
            self.assertTrue(push.process_one())
        payload = request.call_args.args[1]
        self.assertEqual(payload["channelId"], "weather")
        self.assertEqual(payload["data"], {"type": "weather"})

    def test_dispatch_payload_uses_siren_and_dispatch_channel(self):
        self.delivery["notification_type"] = "dispatch"
        with patch("app.push._request", return_value={"data": {"status": "ok", "id": "receipt-1"}}) as request:
            self.assertTrue(push.process_one())
        payload = request.call_args.args[1]
        self.assertEqual(payload["sound"], "dispatch_siren.wav")
        self.assertEqual(payload["channelId"], "dispatch")
        self.assertEqual(payload["data"], {"type": "dispatch", "incidentId": "incident-1"})

    def test_successful_receipt_removes_delivery(self):
        self.delivery["receipt_id"] = "receipt-1"
        with patch("app.push._request", return_value={"data": {"receipt-1": {"status": "ok"}}}):
            push.process_one()
        self.assertIn("DELETE FROM push_deliveries", self.connection.execute.call_args.args[0])

    def test_unregistered_device_is_removed(self):
        with patch("app.push._request", return_value={"data": {"status": "error", "details": {"error": "DeviceNotRegistered"}}}):
            push.process_one()
        self.assertIn("DELETE FROM push_devices", self.connection.execute.call_args.args[0])

    def test_network_failure_schedules_retry(self):
        with patch("app.push._request", side_effect=URLError("offline")):
            push.process_one()
        self.assertIn("attempts = attempts + 1", self.connection.execute.call_args.args[0])

    def test_missing_receipt_schedules_retry(self):
        self.delivery["receipt_id"] = "receipt-1"
        with patch("app.push._request", return_value={"data": {}}):
            push.process_one()
        self.assertIn("attempts = attempts + 1", self.connection.execute.call_args.args[0])


if __name__ == "__main__":
    unittest.main()
