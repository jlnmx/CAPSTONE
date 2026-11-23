import React from 'react';
import { Polygon } from 'react-native-maps';
import { BINAN_HAZARD_AREAS } from '@services/map/hazardAreas';
import type { HazardFeature } from '@services/map/hazardAreas';

type Props = {
  showFlood: boolean;
  showEarthquake: boolean;
};

export default function HazardAreaOverlay({ showFlood, showEarthquake }: Props) {
  return (
    <>
      {BINAN_HAZARD_AREAS.filter((feature) => (
        feature.properties.hazardType === 'flood' ? showFlood : showEarthquake
      )).map((feature: HazardFeature) => (
        <Polygon
          key={feature.properties.code}
          coordinates={feature.geometry.coordinates[0].map(([longitude, latitude]) => ({ latitude, longitude }))}
          holes={feature.geometry.coordinates.slice(1).map((ring) => ring.map(([longitude, latitude]) => ({ latitude, longitude })))}
          fillColor={feature.properties.hazardType === 'flood' ? '#C628283B' : '#EF6C003B'}
          strokeColor={feature.properties.hazardType === 'flood' ? '#B71C1CCC' : '#E65100CC'}
          strokeWidth={1.5}
        />
      ))}
    </>
  );
}
