import React, { useEffect, useRef } from 'react';
import * as Leaflet from '../vendor/leaflet/LeafletWithGlobals.js';
import '../vendor/leaflet/leaflet.css';

const BINAN_CENTER: [number, number] = [14.3036, 121.0781];
const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
const LeafletApi = (Leaflet as any).default ?? Leaflet;

export default function LeafletMap() {
  const mapElement = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapElement.current) {
      return undefined;
    }

    const map = new LeafletApi.Map(mapElement.current);
    map.fitBounds([
      [14.2500, 121.0200],
      [14.3600, 121.1400],
    ]);

    new LeafletApi.TileLayer(
      `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}&tileSize=512`,
      {
        attribution: '&copy; Mapbox &copy; OpenStreetMap contributors',
        maxZoom: 19,
      },
    ).addTo(map);

    new LeafletApi.Marker(BINAN_CENTER)
      .addTo(map)
      .bindPopup('Biñan City, Laguna');

    return () => {
      map.remove();
    };
  }, []);

  return <div ref={mapElement} style={styles.map} />;
}

const styles = {
  map: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e5efe8',
  },
};
