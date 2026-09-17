export const BINAN_CENTER: [number, number] = [121.0781, 14.3036];

export const AGAP_BASE_VECTOR_STYLE = {
  version: 8,
  name: 'AGAP Emergency Vector',
  center: [121.0781, 14.3036],
  zoom: 12,
  sources: {
    protomaps: {
      type: 'vector',
      tiles: ['https://demotiles.maplibre.org/tiles/{z}/{x}/{y}.pbf'],
      minzoom: 0,
      maxzoom: 16,
      attribution: '© OpenMapTiles © Protomaps',
    },
  },
  layers: [
    {
      id: 'land-base',
      type: 'fill',
      source: 'protomaps',
      'source-layer': 'land',
      paint: {
        'fill-color': '#0f172a',
      },
    },
    {
      id: 'water-base',
      type: 'fill',
      source: 'protomaps',
      'source-layer': 'water',
      paint: {
        'fill-color': '#1d4ed8',
      },
    },
    {
      id: 'roads-base',
      type: 'line',
      source: 'protomaps',
      'source-layer': 'roads',
      paint: {
        'line-color': '#475569',
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 16, 3],
      },
    },
    {
      id: 'admin-boundaries',
      type: 'line',
      source: 'protomaps',
      'source-layer': 'boundaries',
      paint: {
        'line-color': '#94a3b8',
        'line-width': 1,
      },
    },
  ],
};

export const DEFAULT_EVACUATION_CENTERS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [121.071, 14.307] },
      properties: { id: 'ec-001', label: 'Biñan Multi-Purpose Hall', type: 'evacuation-center' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [121.082, 14.301] },
      properties: { id: 'ec-002', label: 'Barangay Gym', type: 'evacuation-center' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [121.089, 14.312] },
      properties: { id: 'ec-003', label: 'School Gymnasium', type: 'evacuation-center' },
    },
  ],
};

export const DEFAULT_SOS_LOCATIONS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [121.0781, 14.3036] },
      properties: { id: 'sos-001', label: 'Resident SOS', type: 'sos', severity: 'high' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [121.08, 14.31] },
      properties: { id: 'sos-002', label: 'Medical emergency', type: 'sos', severity: 'high' },
    },
  ],
};

export const DEFAULT_ROUTE = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [121.07, 14.29],
          [121.074, 14.296],
          [121.0781, 14.3036],
        ],
      },
      properties: { id: 'route-1', label: 'Evacuation route', type: 'route' },
    },
  ],
};
