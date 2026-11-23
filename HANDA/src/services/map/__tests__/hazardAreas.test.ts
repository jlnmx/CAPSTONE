import { BINAN_HAZARD_AREAS } from '../hazardAreas';

describe('Biñan hazard map boundaries', () => {
  it('includes exactly the requested barangays in their hazard layers', () => {
    const layers = BINAN_HAZARD_AREAS.reduce<Record<string, string[]>>((result, feature) => {
      result[feature.properties.hazardType].push(feature.properties.name);
      return result;
    }, { flood: [], earthquake: [] });

    expect(layers.flood.sort()).toEqual(['Casile', 'De La Paz', 'Malaban', 'San Jose', 'Santo Niño']);
    expect(layers.earthquake.sort()).toEqual(['Biñan', 'Malamig', 'San Francisco (Halang)']);
  });

  it('contains closed, geographically valid polygon rings for each barangay', () => {
    expect(BINAN_HAZARD_AREAS).toHaveLength(8);
    for (const feature of BINAN_HAZARD_AREAS) {
      expect(feature.geometry.type).toBe('Polygon');
      expect(feature.geometry.coordinates.length).toBeGreaterThan(0);
      for (const ring of feature.geometry.coordinates) {
        expect(ring.length).toBeGreaterThanOrEqual(4);
        expect(ring[0]).toEqual(ring[ring.length - 1]);
        for (const [longitude, latitude] of ring) {
          expect(longitude).toBeGreaterThan(121);
          expect(longitude).toBeLessThan(121.2);
          expect(latitude).toBeGreaterThan(14.2);
          expect(latitude).toBeLessThan(14.5);
        }
      }
    }
  });
});
