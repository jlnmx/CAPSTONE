import { useEffect } from 'react';
import { BINAN_HAZARD_AREAS } from '@services/map/hazardAreas';
import type { HazardFeature } from '@services/map/hazardAreas';

type Props = {
  map: google.maps.Map | null;
  showFlood: boolean;
  showEarthquake: boolean;
};

export default function HazardAreaOverlay({ map, showFlood, showEarthquake }: Props) {
  useEffect(() => {
    if (!map) return undefined;
    const polygons = BINAN_HAZARD_AREAS.filter((feature) => (
      feature.properties.hazardType === 'flood' ? showFlood : showEarthquake
    )).map((feature: HazardFeature) => new google.maps.Polygon({
      map,
      paths: feature.geometry.coordinates.map((ring) => ring.map(([lng, lat]) => ({ lat, lng }))),
      strokeColor: feature.properties.hazardType === 'flood' ? '#B71C1C' : '#E65100',
      strokeOpacity: 0.82,
      strokeWeight: 1.5,
      fillColor: feature.properties.hazardType === 'flood' ? '#C62828' : '#EF6C00',
      fillOpacity: 0.24,
      clickable: false,
      zIndex: 1,
    }));
    return () => polygons.forEach((polygon) => polygon.setMap(null));
  }, [map, showEarthquake, showFlood]);

  return null;
}
