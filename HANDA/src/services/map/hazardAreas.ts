import hazardAreaData from '../../data/binanHazardAreas.json';

export type HazardType = 'flood' | 'earthquake';
export type HazardPosition = [number, number];

export type HazardFeature = {
  type: 'Feature';
  properties: {
    code: string;
    name: string;
    hazardType: HazardType;
  };
  geometry: {
    type: 'Polygon';
    coordinates: HazardPosition[][];
  };
};

export const BINAN_HAZARD_AREAS = hazardAreaData.features as HazardFeature[];
