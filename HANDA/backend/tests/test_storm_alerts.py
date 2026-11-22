import unittest
from unittest.mock import MagicMock, patch

from app import storm_alerts


class FakeResult:
    def __init__(self, row=None, rows=None):
        self.row = row
        self.rows = rows or []

    def fetchone(self):
        return self.row

    def fetchall(self):
        return self.rows


class StormAdvisoryTests(unittest.TestCase):
    def setUp(self):
        self.storm = {
            "id": "gdacs-42",
            "international_name": "Kiko",
            "classification": "Typhoon",
            "par_status": "Inside PAR",
            "latitude": 15,
            "longitude": 125,
            "max_wind_kmh": 120,
        }

    def test_fingerprint_ignores_track_updates_but_changes_for_new_advisory(self):
        original = storm_alerts.storm_advisory_fingerprint(self.storm)
        moved = storm_alerts.storm_advisory_fingerprint({**self.storm, "latitude": 16, "longitude": 126})
        intensified = storm_alerts.storm_advisory_fingerprint({**self.storm, "classification": "Severe Tropical Storm"})

        self.assertEqual(original, moved)
        self.assertNotEqual(original, intensified)

    def test_new_inside_par_advisory_sends_push_and_sms(self):
        connection = MagicMock()

        def execute(sql, _params=None):
            if "INSERT INTO storm_advisory_sms_events" in sql:
                return FakeResult(row=("gdacs-42",))
            if "SELECT id FROM users" in sql:
                return FakeResult(rows=[{"id": "resident-1"}, {"id": "responder-1"}])
            if "SELECT mobile_number FROM users" in sql:
                return FakeResult(rows=[("+639171234567",), ("+639181234567",)])
            return FakeResult()

        connection.execute.side_effect = execute
        with patch.object(storm_alerts, "settings") as settings, \
                patch.object(storm_alerts, "sms_delivery_configured", return_value=True), \
                patch.object(storm_alerts, "send_sms_to_many") as send_sms, \
                patch.object(storm_alerts, "enqueue_weather_alert") as enqueue:
            sent = storm_alerts.notify_storm_advisory(connection, self.storm)

        self.assertTrue(sent)
        sql = next(
            call.args[0] for call in connection.execute.call_args_list
            if "SELECT mobile_number FROM users" in call.args[0]
        )
        self.assertIn("sms_alerts_enabled", sql)
        notification_calls = [
            call for call in connection.execute.call_args_list
            if "INSERT INTO notifications" in call.args[0]
        ]
        self.assertEqual(len(notification_calls), 2)
        self.assertIn("'weather'", notification_calls[0].args[0])
        self.assertEqual(enqueue.call_count, 2)
        enqueue.assert_any_call(
            connection,
            "resident-1",
            "Tropical storm advisory: Kiko",
            storm_alerts.storm_advisory_message(self.storm),
        )
        send_sms.assert_called_once_with(
            ["+639171234567", "+639181234567"],
            storm_alerts.storm_advisory_message(self.storm),
            configuration=settings,
        )

    def test_duplicate_and_outside_par_advisories_are_not_sent(self):
        connection = MagicMock()
        connection.execute.return_value = FakeResult(row=None)
        with patch.object(storm_alerts, "send_sms_to_many") as send_sms:
            self.assertFalse(storm_alerts.notify_storm_advisory(connection, self.storm))
            self.assertFalse(storm_alerts.notify_storm_advisory(
                connection,
                {**self.storm, "par_status": "Outside PAR"},
            ))

        self.assertEqual(connection.execute.call_count, 1)
        send_sms.assert_not_called()


if __name__ == "__main__":
    unittest.main()
