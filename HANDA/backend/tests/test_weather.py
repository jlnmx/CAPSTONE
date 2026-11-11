import json
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlparse

from fastapi import HTTPException

from app import weather


class FakeResponse:
    def __init__(self, value):
        self.payload = json.dumps(value).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def read(self):
        return self.payload


def condition(kind, text):
    return {"type": kind, "description": {"text": text}}


def weather_responses():
    current = {
        "currentTime": "2026-11-11T09:00:00Z",
        "isDaytime": True,
        "weatherCondition": condition("PARTLY_CLOUDY", "Partly cloudy"),
        "temperature": {"degrees": 30},
        "feelsLikeTemperature": {"degrees": 34},
        "relativeHumidity": 76,
        "wind": {"speed": {"value": 12, "unit": "KILOMETERS_PER_HOUR"}},
    }
    hours = {
        "forecastHours": [{
            "displayDateTime": {"year": 2026, "month": 11, "day": 11, "hours": 17},
            "isDaytime": True,
            "weatherCondition": condition("THUNDERSTORM", "Thunderstorm"),
            "temperature": {"degrees": 31},
            "precipitation": {"probability": {"percent": 80}, "qpf": {"quantity": 3}},
            "thunderstormProbability": 80,
            "wind": {"speed": {"value": 20}, "gust": {"value": 30}},
        }],
    }
    days = {
        "forecastDays": [{
            "displayDate": {"year": 2026, "month": 11, "day": 11},
            "daytimeForecast": {
                "weatherCondition": condition("THUNDERSTORM", "Thunderstorms"),
                "precipitation": {"probability": {"percent": 80}, "qpf": {"quantity": 8}},
                "wind": {"speed": {"value": 20}},
            },
            "nighttimeForecast": {
                "weatherCondition": condition("RAIN", "Rain"),
                "precipitation": {"probability": {"percent": 40}, "qpf": {"quantity": 4}},
                "wind": {"speed": {"value": 15}},
            },
            "minTemperature": {"degrees": 25},
            "maxTemperature": {"degrees": 32},
        }],
    }
    air_quality = {"indexes": [{
        "code": "uaqi",
        "aqi": 65,
        "category": "Moderate air quality",
        "dominantPollutant": "pm25",
    }]}
    return current, hours, days, air_quality


class GoogleWeatherTests(unittest.TestCase):
    def setUp(self):
        weather._cached_snapshot = None
        weather._cache_expires_at = 0

    def tearDown(self):
        weather._cached_snapshot = None
        weather._cache_expires_at = 0

    @patch("app.weather.urlopen")
    def test_google_forecast_is_normalized_and_combined_risk_uses_air_quality_and_weather(self, urlopen):
        urlopen.side_effect = [FakeResponse(response) for response in weather_responses()]

        result = weather.get_google_weather_snapshot("weather-key")

        self.assertEqual(result["current"]["temperature"], 30)
        self.assertEqual(result["hourly"][0]["time"], "2026-11-11T17:00")
        self.assertEqual(result["daily"][0]["precipitationSum"], 12)
        self.assertEqual(result["environmentalRisk"]["airQualityFactor"], "Moderate")
        self.assertEqual(result["environmentalRisk"]["weatherFactor"], "High")
        self.assertEqual(result["environmentalRisk"]["label"], "High")
        self.assertEqual(urlopen.call_count, 4)

        requests = [call.args[0] for call in urlopen.call_args_list]
        self.assertEqual(requests[0].full_url.split("?")[0], weather.WEATHER_CURRENT_URL)
        self.assertEqual(requests[0].get_method(), "GET")
        self.assertEqual(requests[3].full_url.split("?")[0], weather.AIR_QUALITY_URL)
        self.assertEqual(requests[3].get_method(), "POST")
        self.assertTrue(json.loads(requests[3].data)["universalAqi"])
        self.assertEqual(requests[3].get_header("Content-type"), "application/json")
        self.assertEqual(parse_qs(urlparse(requests[1].full_url).query)["hours"], ["24"])
        self.assertEqual(parse_qs(urlparse(requests[2].full_url).query)["days"], ["7"])

    @patch("app.weather.urlopen")
    def test_air_quality_failure_keeps_weather_but_does_not_claim_a_combined_risk(self, urlopen):
        current, hours, days, _air_quality = weather_responses()
        urlopen.side_effect = [
            FakeResponse(current),
            FakeResponse(hours),
            FakeResponse(days),
            HTTPError(weather.AIR_QUALITY_URL, 403, "Forbidden", {}, None),
        ]

        result = weather.get_google_weather_snapshot("weather-key")

        self.assertEqual(len(result["hourly"]), 1)
        self.assertFalse(result["airQualityAvailable"])
        self.assertIsNone(result["environmentalRisk"])

    @patch("app.weather.urlopen", side_effect=HTTPError(weather.WEATHER_CURRENT_URL, 403, "Forbidden", {}, None))
    def test_weather_permission_error_is_actionable_without_exposing_api_key(self, _urlopen):
        with self.assertRaises(HTTPException) as error:
            weather.get_google_weather_snapshot("secret-weather-key")

        self.assertEqual(error.exception.status_code, 503)
        self.assertIn("not enabled or allowed", error.exception.detail)
        self.assertNotIn("secret-weather-key", error.exception.detail)

    @patch("app.weather.monotonic", side_effect=[100, 100, 101])
    @patch("app.weather._fetch_google_weather")
    def test_successful_snapshot_is_cached_for_one_hour(self, fetch_weather, _monotonic):
        snapshot = {"airQualityAvailable": True, "environmentalRisk": {"label": "Low"}}
        fetch_weather.return_value = snapshot

        first = weather.get_google_weather_snapshot("weather-key")
        second = weather.get_google_weather_snapshot("weather-key")

        self.assertEqual(first, second)
        fetch_weather.assert_called_once_with("weather-key")


if __name__ == "__main__":
    unittest.main()
