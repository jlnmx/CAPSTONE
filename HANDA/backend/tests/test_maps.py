import json
import unittest
from io import BytesIO
from unittest.mock import patch
from urllib.error import HTTPError

from fastapi import HTTPException

from app.maps import compute_routes, search_places
from app.schemas import MapPlaceSearch, MapRouteRequest


class FakeResponse:
    def __init__(self, value):
        self.payload = json.dumps(value).encode()

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def read(self):
        return self.payload


class GoogleMapsProxyTests(unittest.TestCase):
    @patch("app.maps.urlopen")
    def test_places_search_uses_new_api_field_mask_and_normalizes_results(self, urlopen):
        urlopen.return_value = FakeResponse({
            "places": [{
                "id": "place-1",
                "displayName": {"text": "Evacuation Center"},
                "formattedAddress": "Biñan, Laguna",
                "location": {"latitude": 14.3, "longitude": 121.08},
            }],
        })

        result = search_places(MapPlaceSearch(query="evacuation center"), "server-key")

        self.assertEqual(result["places"][0]["name"], "Evacuation Center")
        self.assertEqual(result["places"][0]["latitude"], 14.3)
        provider_request = urlopen.call_args.args[0]
        self.assertEqual(provider_request.full_url, "https://places.googleapis.com/v1/places:searchText")
        self.assertEqual(provider_request.get_header("X-goog-api-key"), "server-key")
        self.assertIn("places.location", provider_request.get_header("X-goog-fieldmask"))
        self.assertEqual(json.loads(provider_request.data)["regionCode"], "PH")

    @patch("app.maps.urlopen")
    def test_routes_request_returns_alternatives_and_turn_steps(self, urlopen):
        urlopen.return_value = FakeResponse({
            "routes": [{
                "distanceMeters": 1200,
                "duration": "300s",
                "polyline": {"encodedPolyline": "abc"},
                "legs": [{
                    "steps": [{
                        "navigationInstruction": {"instructions": "Turn right"},
                        "distanceMeters": 150,
                        "startLocation": {"latLng": {"latitude": 14.3, "longitude": 121.07}},
                        "endLocation": {"latLng": {"latitude": 14.31, "longitude": 121.08}},
                    }],
                }],
            }, {
                "distanceMeters": 1400,
                "duration": "360s",
                "polyline": {"encodedPolyline": "def"},
            }],
        })
        request = MapRouteRequest(
            origin={"latitude": 14.3, "longitude": 121.07},
            destination={"latitude": 14.31, "longitude": 121.08},
            travelMode="DRIVE",
        )

        result = compute_routes(request, "server-key")

        self.assertEqual(len(result["routes"]), 2)
        self.assertEqual(result["routes"][0]["durationSeconds"], 300)
        self.assertEqual(result["routes"][0]["steps"][0]["instruction"], "Turn right")
        provider_request = urlopen.call_args.args[0]
        self.assertEqual(provider_request.full_url, "https://routes.googleapis.com/directions/v2:computeRoutes")
        self.assertTrue(json.loads(provider_request.data)["computeAlternativeRoutes"])

    @patch("app.maps.urlopen", side_effect=HTTPError("https://places.googleapis.com", 403, "Forbidden", {}, BytesIO(b"")))
    def test_provider_permission_error_is_actionable_without_exposing_provider_response(self, _urlopen):
        with self.assertRaises(HTTPException) as error:
            search_places(MapPlaceSearch(query="evacuation center"), "server-key")

        self.assertEqual(error.exception.status_code, 503)
        self.assertIn("not enabled", error.exception.detail)


if __name__ == "__main__":
    unittest.main()
