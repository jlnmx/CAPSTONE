import React, { useEffect, useRef } from 'react';
import * as Leaflet from '../vendor/leaflet/LeafletWithGlobals.js';
import '../vendor/leaflet/leaflet.css';

const BINAN_CENTER: [number, number] = [14.3036, 121.0781];
const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
const LeafletApi = (Leaflet as any).default ?? Leaflet;
const markerIconAsset = require('../vendor/leaflet/images/marker-icon.png');
const markerShadowAsset = require('../vendor/leaflet/images/marker-shadow.png');
const markerIconUrl = markerIconAsset?.default?.uri ?? markerIconAsset?.default ?? markerIconAsset?.uri ?? markerIconAsset;
const markerShadowUrl = markerShadowAsset?.default?.uri ?? markerShadowAsset?.default ?? markerShadowAsset?.uri ?? markerShadowAsset;

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

    const marker = new LeafletApi.Marker(BINAN_CENTER, {
      draggable: true,
      icon: new LeafletApi.Icon({
        iconUrl: markerIconUrl,
        shadowUrl: markerShadowUrl,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        shadowSize: [41, 41],
        shadowAnchor: [12, 41],
      }),
    }).addTo(map);

    const escapeHtml = (value: string) =>
      value.replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character]);

    const updatePopup = async (position: any) => {
      const latitude = position.lat.toFixed(6);
      const longitude = position.lng.toFixed(6);
      let placeName = 'Pinned location';
      const showPopup = () => marker
        .bindPopup(`<strong>${escapeHtml(placeName)}</strong><br />Latitude: ${latitude}<br />Longitude: ${longitude}`)
        .openPopup();

      showPopup();

      if (mapboxToken) {
        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${position.lng},${position.lat}.json?access_token=${mapboxToken}&limit=1`,
          );
          const data = await response.json();
          placeName = data.features?.[0]?.place_name ?? placeName;
        } catch {
          // Keep the exact coordinates visible when reverse geocoding is unavailable.
        }
      }

      showPopup();
    };

    marker.on('dragend', () => {
      void updatePopup(marker.getLatLng());
    });

    map.on('click', (event: any) => {
      marker.setLatLng(event.latlng);
      void updatePopup(event.latlng);
    });

    void updatePopup(marker.getLatLng());

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
