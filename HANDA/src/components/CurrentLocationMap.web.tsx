import React, { useEffect, useRef } from 'react';
import * as Leaflet from '../vendor/leaflet/LeafletWithGlobals.js';
import '../vendor/leaflet/leaflet.css';
import { CurrentLocationMapProps } from './CurrentLocationMap';

const BINAN_CENTER: [number, number] = [14.3036, 121.0781];
const LeafletApi = (Leaflet as any).default ?? Leaflet;
const markerIconAsset = require('../vendor/leaflet/images/marker-icon.png');
const markerShadowAsset = require('../vendor/leaflet/images/marker-shadow.png');
const markerIconUrl = markerIconAsset?.default?.uri ?? markerIconAsset?.default ?? markerIconAsset?.uri ?? markerIconAsset;
const markerShadowUrl = markerShadowAsset?.default?.uri ?? markerShadowAsset?.default ?? markerShadowAsset?.uri ?? markerShadowAsset;

export default function CurrentLocationMap({ coordinate }: CurrentLocationMapProps) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!mapElement.current) {
      return undefined;
    }

    const map = new LeafletApi.Map(mapElement.current).setView(BINAN_CENTER, 13);
    new LeafletApi.TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !coordinate) {
      return;
    }

    const position: [number, number] = [coordinate.latitude, coordinate.longitude];
    if (!markerRef.current) {
      markerRef.current = new LeafletApi.Marker(position, {
        icon: new LeafletApi.Icon({
          iconUrl: markerIconUrl,
          shadowUrl: markerShadowUrl,
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          shadowSize: [41, 41],
          shadowAnchor: [12, 41],
        }),
      }).addTo(mapRef.current);
    } else {
      markerRef.current.setLatLng(position);
    }

    mapRef.current.setView(position, 16);
    markerRef.current.bindPopup(`<strong>Your current location</strong><br />Latitude: ${coordinate.latitude.toFixed(6)}<br />Longitude: ${coordinate.longitude.toFixed(6)}`).openPopup();
  }, [coordinate]);

  return <div ref={mapElement} style={styles.map} />;
}

const styles = {
  map: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e5efe8',
  },
};