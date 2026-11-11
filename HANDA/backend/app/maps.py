import json
import logging
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import HTTPException

from .schemas import MapPlaceSearch, MapRouteRequest

logger = logging.getLogger(__name__)

PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
ROUTES_COMPUTE_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"


def _google_post(url: str, api_key: str, body: dict, field_mask: str) -> dict:
    request = Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": field_mask,
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        logger.warning("Google Maps provider returned HTTP %s for %s.", error.code, url)
        if error.code == 403:
            raise HTTPException(
                status_code=503,
                detail="Google Maps search or routing is not enabled for the server API key.",
            ) from error
        raise HTTPException(
            status_code=502,
            detail="Google Maps could not complete this request. Try again shortly.",
        ) from error
    except (URLError, TimeoutError, json.JSONDecodeError) as error:
        logger.warning("Google Maps provider request failed for %s (%s).", url, type(error).__name__)
        raise HTTPException(
            status_code=502,
            detail="Google Maps could not complete this request. Check your connection and try again.",
        ) from error


def search_places(search: MapPlaceSearch, api_key: str) -> dict:
    result = _google_post(
        PLACES_TEXT_SEARCH_URL,
        api_key,
        {
            "textQuery": search.query.strip(),
            "languageCode": "en",
            "regionCode": "PH",
            "maxResultCount": 5,
            "locationBias": {
                "circle": {
                    "center": {"latitude": 14.3036, "longitude": 121.0781},
                    "radius": 25000,
                }
            },
        },
        "places.id,places.displayName,places.formattedAddress,places.location",
    )
    places = []
    for place in result.get("places", []):
        location = place.get("location")
        if not location or not isinstance(location.get("latitude"), (int, float)) or not isinstance(location.get("longitude"), (int, float)):
            continue
        places.append({
            "id": place.get("id", ""),
            "name": place.get("displayName", {}).get("text", "Map location"),
            "address": place.get("formattedAddress", ""),
            "latitude": location["latitude"],
            "longitude": location["longitude"],
        })
    return {"places": places}


def compute_routes(route_request: MapRouteRequest, api_key: str) -> dict:
    body = {
        "origin": {"location": {"latLng": route_request.origin.model_dump()}},
        "destination": {"location": {"latLng": route_request.destination.model_dump()}},
        "travelMode": route_request.travelMode,
        "computeAlternativeRoutes": True,
        "languageCode": "en",
        "units": "METRIC",
    }
    if route_request.travelMode == "DRIVE":
        body["routingPreference"] = "TRAFFIC_AWARE"
    result = _google_post(
        ROUTES_COMPUTE_URL,
        api_key,
        body,
        "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction.instructions,routes.legs.steps.distanceMeters,routes.legs.steps.startLocation,routes.legs.steps.endLocation",
    )
    routes = []
    for index, route in enumerate(result.get("routes", [])):
        polyline = route.get("polyline", {}).get("encodedPolyline")
        if not polyline:
            continue
        duration = route.get("duration", "0s")
        try:
            duration_seconds = int(float(duration.removesuffix("s")))
        except (TypeError, ValueError):
            duration_seconds = 0
        steps = [
            {
                "instruction": step.get("navigationInstruction", {}).get("instructions", ""),
                "distanceMeters": step.get("distanceMeters", 0),
                "startLocation": step.get("startLocation", {}).get("latLng"),
                "endLocation": step.get("endLocation", {}).get("latLng"),
            }
            for leg in route.get("legs", [])
            for step in leg.get("steps", [])
            if step.get("navigationInstruction", {}).get("instructions")
        ]
        routes.append({
            "id": index,
            "distanceMeters": route.get("distanceMeters", 0),
            "durationSeconds": duration_seconds,
            "encodedPolyline": polyline,
            "steps": steps,
        })
    return {"routes": routes}
