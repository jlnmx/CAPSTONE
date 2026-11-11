import { decodeRoutePolyline, distanceMeters, distanceToRouteMeters } from '../googleMaps';

describe('Google Maps route geometry', () => {
  it('decodes an encoded polyline into coordinates', () => {
    expect(decodeRoutePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ]);
  });

  it('measures a point on a route as on-route and a distant point as off-route', () => {
    const route = [
      { latitude: 14.3, longitude: 121.07 },
      { latitude: 14.31, longitude: 121.08 },
    ];
    const midpoint = { latitude: 14.305, longitude: 121.075 };
    const farAway = { latitude: 14.32, longitude: 121.1 };

    expect(distanceToRouteMeters(midpoint, route)).toBeLessThan(2);
    expect(distanceToRouteMeters(farAway, route)).toBeGreaterThan(1000);
    expect(distanceMeters(route[0], route[1])).toBeGreaterThan(1000);
  });
});
