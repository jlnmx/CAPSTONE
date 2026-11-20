import unittest
from unittest.mock import MagicMock

from app import weather_alerts


class WeatherAlertTests(unittest.TestCase):
    def test_thunderstorm_probability_escalates_from_watch_to_severe(self):
        alerts = weather_alerts.significant_weather_alerts({
            "hourly": [
                {
                    "time": "2026-11-20T10:00:00",
                    "conditionType": "THUNDERSTORM",
                    "thunderstormProbability": 55,
                },
                {
                    "time": "2026-11-20T17:00:00",
                    "conditionType": "THUNDERSTORM",
                    "thunderstormProbability": 70,
                },
            ],
        })

        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["severity"], 2)
        self.assertIn("Conditions have intensified.", alerts[0]["message"])

    def test_thunderstorm_condition_without_escalation_is_not_marked_intensified(self):
        alerts = weather_alerts.significant_weather_alerts({
            "hourly": [{
                "time": "2026-11-20T10:00:00",
                "conditionType": "THUNDERSTORM",
                "thunderstormProbability": 50,
            }],
        })

        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["severity"], 1)
        self.assertNotIn("Conditions have intensified.", alerts[0]["message"])

    def test_detects_significant_hazards_and_escalates_within_forecast_day(self):
        snapshot = {
            "current": {"time": "2026-11-20T08:00:00", "conditionType": "CLEAR", "temperature": 30},
            "hourly": [
                {
                    "time": "2026-11-20T10:00:00",
                    "conditionType": "RAIN",
                    "temperature": 35,
                    "precipitation": 8,
                    "windSpeed": 40,
                    "windGust": 50,
                    "thunderstormProbability": 55,
                },
                {
                    "time": "2026-11-20T17:00:00",
                    "conditionType": "THUNDERSTORM",
                    "temperature": 40,
                    "precipitation": 16,
                    "windSpeed": 55,
                    "windGust": 70,
                    "thunderstormProbability": 80,
                },
            ],
        }

        alerts = weather_alerts.significant_weather_alerts(snapshot)

        self.assertEqual(
            {alert["kind"]: alert["severity"] for alert in alerts},
            {
                "dangerous-heat": 2,
                "heavy-rain": 2,
                "strong-winds": 2,
                "thunderstorms": 2,
            },
        )
        self.assertTrue(all(alert["date"] == "2026-11-20" for alert in alerts))
        self.assertTrue(all("Conditions have intensified." in alert["message"] for alert in alerts))

    def test_ignores_routine_conditions_and_malformed_values(self):
        alerts = weather_alerts.significant_weather_alerts({
            "current": {"time": "2026-11-20T08:00:00", "conditionType": "CLEAR", "temperature": 30},
            "hourly": [{
                "time": "invalid",
                "conditionType": "RAIN",
                "temperature": True,
                "precipitation": float("nan"),
                "windSpeed": "40",
                "windGust": None,
                "thunderstormProbability": 20,
            }],
        })

        self.assertEqual(alerts, [])

    def test_deduplicates_repeated_alert_and_only_notifies_on_escalation(self):
        connection = MagicMock()
        connection.execute.side_effect = [
            MagicMock(**{"fetchone.return_value": {"alert_key": "heavy-rain:2026-11-20"}}),
            MagicMock(**{"fetchall.return_value": [{"id": "resident-1"}]}),
            MagicMock(),
            MagicMock(),
        ]
        alert = {
            "key": "heavy-rain:2026-11-20",
            "date": "2026-11-20",
            "severity": 1,
            "title": "Heavy rain alert",
            "message": "Heavy rainfall is forecast.",
        }

        self.assertTrue(weather_alerts.notify_weather_alert(connection, alert))
        state_query = connection.execute.call_args_list[0].args[0]
        self.assertIn("WHERE weather_alert_state.severity < EXCLUDED.severity", state_query)
        self.assertIn("INSERT INTO notifications", connection.execute.call_args_list[2].args[0])
        self.assertIn("'weather'", connection.execute.call_args_list[2].args[0])
        self.assertIn("INSERT INTO push_deliveries", connection.execute.call_args_list[3].args[0])

        duplicate_connection = MagicMock()
        duplicate_connection.execute.return_value.fetchone.return_value = None
        self.assertFalse(weather_alerts.notify_weather_alert(duplicate_connection, alert))
        self.assertEqual(duplicate_connection.execute.call_count, 1)


if __name__ == "__main__":
    unittest.main()
