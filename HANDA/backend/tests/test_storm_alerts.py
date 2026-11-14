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

    def test_only_new_inside_par_advisory_sends_to_sms_opted_in_recipients(self):
        connection = MagicMock()
        connection.execute.side_effect = [
            FakeResult(row=("gdacs-42",)),
            FakeResult(rows=[("+639171234567",), ("+639181234567",)]),
        ]
        with patch.object(storm_alerts, "settings") as settings, \
                patch.object(storm_alerts, "send_sms_to_many") as send_sms:
            sent = storm_alerts.notify_storm_advisory(connection, self.storm)

        self.assertTrue(sent)
        sql = connection.execute.call_args_list[1].args[0]
        self.assertIn("sms_alerts_enabled", sql)
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
