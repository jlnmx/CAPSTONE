import unittest

from app.typhoons import is_inside_par, pagasa_reports_no_active_cyclone, parse_gdacs_typhoons


class TyphoonFeedTests(unittest.TestCase):
    def test_detects_pagasa_no_active_cyclone_bulletin(self):
        self.assertTrue(pagasa_reports_no_active_cyclone(
            "<h3>No Active Tropical Cyclone within the Philippine Area of Responsibility</h3>"
        ))
        self.assertFalse(pagasa_reports_no_active_cyclone("<h3>Tropical Cyclone Bulletin</h3>"))

    def test_identifies_par_boundary_membership(self):
        self.assertTrue(is_inside_par(125, 15))
        self.assertTrue(is_inside_par(115, 10))
        self.assertFalse(is_inside_par(140, 15))

    def test_parses_active_western_pacific_cyclones_and_source_fields(self):
        payload = {
            "features": [
                {
                    "geometry": {"type": "Point", "coordinates": [125.0, 15.0]},
                    "properties": {
                        "eventtype": "TC",
                        "eventid": 42,
                        "eventname": "KIKO-26",
                        "iscurrent": "true",
                        "source": "JTWC",
                        "datemodified": "2026-10-13T01:00:00",
                        "url": {"report": "https://example.org/storm/42"},
                        "severitydata": {"severity": 120.4, "severityunit": "km/h"},
                    },
                },
                {
                    "geometry": {"type": "Point", "coordinates": [145.0, 18.0]},
                    "properties": {
                        "eventtype": "TC",
                        "eventid": 43,
                        "eventname": "LUZON-26",
                        "iscurrent": True,
                        "severitydata": {"severity": 30, "severityunit": "m/s"},
                    },
                },
                {
                    "geometry": {"type": "Point", "coordinates": [-100.0, 20.0]},
                    "properties": {"eventtype": "TC", "eventid": 44, "iscurrent": "true"},
                },
            ]
        }

        storms = parse_gdacs_typhoons(payload)

        self.assertEqual([storm["international_name"] for storm in storms], ["Kiko", "Luzon"])
        self.assertEqual(storms[0]["par_status"], "Inside PAR")
        self.assertEqual(storms[0]["max_wind_kmh"], 120)
        self.assertEqual(storms[0]["classification"], "Typhoon")
        self.assertIsNone(storms[0]["gust_speed_kmh"])
        self.assertEqual(storms[1]["par_status"], "Outside PAR")
        self.assertEqual(storms[1]["max_wind_kmh"], 108)

    def test_ignores_stale_non_current_tracks(self):
        self.assertEqual(parse_gdacs_typhoons({"features": [
            {"geometry": {"type": "Point", "coordinates": [125, 15]}, "properties": {"eventtype": "TC", "iscurrent": "false"}},
        ]}), [])


if __name__ == "__main__":
    unittest.main()