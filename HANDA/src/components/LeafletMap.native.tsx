import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { MapEvacuationCenter } from '@types/index';

const BINAN_CENTER = [14.3036, 121.0781];
const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
const tileUrl = mapboxToken
  ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}&tileSize=512`
  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const attribution = mapboxToken
  ? '&copy; Mapbox &copy; OpenStreetMap contributors'
  : '&copy; OpenStreetMap contributors';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

interface LeafletMapProps {
  centers?: MapEvacuationCenter[];
  onSelectCenter?: (centerId: string) => void;
}

export default function LeafletMap({ centers = [], onSelectCenter }: LeafletMapProps) {
  const [ready, setReady] = useState(false);
  const mappedCenters = useMemo(() => centers.flatMap((item) => (
    item.latitude == null || item.longitude == null
      ? []
      : [{ ...item, position: [Number(item.latitude), Number(item.longitude)] }]
  )), [centers]);
  const html = useMemo(() => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <style>
          html, body, #map { margin: 0; width: 100%; height: 100%; }
          .leaflet-container { background: #e5efe8; }
          .location-panel { position: absolute; top: 14px; left: 14px; right: 14px; z-index: 1000; width: auto; max-width: 390px; box-sizing: border-box; padding: 14px 16px; border-radius: 8px; background: #ffffff; box-shadow: 0 3px 14px rgba(23, 33, 43, 0.22); color: #17212B; font: 13px/1.5 Arial, sans-serif; overflow-wrap: anywhere; }
          .location-panel strong { display: block; margin-bottom: 6px; font-size: 16px; }
          .location-panel .center-name { display: block; font-size: 14px; font-weight: 700; }
          .location-panel .muted { display: block; margin-top: 2px; color: #667085; font-size: 12px; }
          .location-panel button { margin-top: 10px; border: 0; border-radius: 5px; padding: 9px 12px; background: #218B25; color: #ffffff; font-weight: 700; }
          .location-panel .secondary { margin-right: 7px; background: #E8F2E8; color: #175B19; }
          .evacuation-center-icon { background: transparent; border: 0; }
          .evacuation-center-icon div { width: 32px; height: 32px; border: 3px solid #ffffff; border-radius: 8px; background: #218B25; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 23px; font-weight: 800; line-height: 1; box-shadow: 0 2px 6px rgba(23,33,43,.35); }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <div id="location-panel" class="location-panel"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          const center = ${JSON.stringify(BINAN_CENTER)};
          const map = L.map('map', { zoomControl: true }).setView(center, 13);
          const infoPanel = document.getElementById('location-panel');
          let routeLine = null;
          function clearRoute() {
            if (routeLine) {
              map.removeLayer(routeLine);
              routeLine = null;
            }
          }
          function distanceInKm(first, second) {
            const latitudeDelta = (second[0] - first[0]) * Math.PI / 180;
            const longitudeDelta = (second[1] - first[1]) * Math.PI / 180;
            const latitude = first[0] * Math.PI / 180;
            const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitude) * Math.cos(second[0] * Math.PI / 180) * Math.sin(longitudeDelta / 2) ** 2;
            return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
          }
          function findNearestCenter(position) {
            if (!centers.length) return null;
            return centers.reduce((nearest, item) => {
              const distance = distanceInKm(position, item.position);
              return distance < nearest.distance ? { item, distance } : nearest;
            }, { item: centers[0], distance: Number.POSITIVE_INFINITY });
          }
          async function drawRoute(start, destination) {
            if (routeLine) map.removeLayer(routeLine);
            let route = [start, destination];
            ${mapboxToken ? `try {
              const response = await fetch('https://api.mapbox.com/directions/v5/mapbox/driving/' + start[1] + ',' + start[0] + ';' + destination[1] + ',' + destination[0] + '?geometries=geojson&overview=full&access_token=${mapboxToken}');
              const data = await response.json();
              const coordinates = data.routes?.[0]?.geometry?.coordinates;
              if (coordinates?.length) route = coordinates.map(([longitude, latitude]) => [latitude, longitude]);
            } catch (error) {}` : ''}
            routeLine = L.polyline(route, { color: '#D98C18', weight: 5, opacity: 0.85 }).addTo(map);
            map.fitBounds(routeLine.getBounds(), { padding: [42, 42] });
          }
          function showInfo(title, position, detail) {
            infoPanel.innerHTML = '<strong>' + title + '</strong>' + detail + '<br>Latitude: ' + position[0].toFixed(6) + '<br>Longitude: ' + position[1].toFixed(6);
          }
          function escapeHtml(value) {
            return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
          }
          function showCenter(item, start, distance) {
            const capacity = Math.max(0, Number(item.capacity) || 0);
            const occupancy = Math.max(0, Number(item.current_occupancy) || 0);
            const spaces = Math.max(0, capacity - occupancy);
            const accepting = item.status !== 'closed' && item.status !== 'full' && spaces > 0;
            infoPanel.innerHTML = '<strong>' + escapeHtml(item.name) + '</strong><span class="center-name">' + escapeHtml(item.location || 'Location not provided') + '</span><span class="muted">Capacity: ' + occupancy + ' of ' + capacity + ' · ' + spaces + ' spaces' + (distance == null ? '' : ' · ' + distance.toFixed(1) + ' km away') + '</span><span class="muted" style="color:' + (accepting ? '#218B25' : '#B42318') + ';font-weight:700">' + (accepting ? 'Accepting registrations' : 'Not accepting registrations') + '</span><button id="navigate-button" class="secondary">Navigate</button><button id="select-center-button" ' + (accepting ? '' : 'disabled') + '>' + (accepting ? 'Select center' : 'Unavailable') + '</button>';
            infoPanel.querySelector('#navigate-button').onclick = async () => {
              await drawRoute(start, item.position);
              infoPanel.insertAdjacentHTML('beforeend', '<span class="muted" style="color:#218B25;font-weight:700">In-app navigation active.</span>');
            };
            infoPanel.querySelector('#select-center-button').onclick = () => {
              if (accepting) window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'select-center', centerId: item.id }));
            };
            clearRoute();
          }
          async function showNearest(position) {
            const nearest = findNearestCenter(position);
            if (!nearest) {
              infoPanel.innerHTML = '<strong>No evacuation centers are available.</strong>';
              return;
            }
            showCenter(nearest.item, position, nearest.distance);
          }
          L.tileLayer(${JSON.stringify(tileUrl)}, { attribution: ${JSON.stringify(attribution)}, maxZoom: 19 }).addTo(map);
          const centers = ${JSON.stringify(mappedCenters).replace(/</g, '\\u003c')};
          const evacuationIcon = L.divIcon({ className: 'evacuation-center-icon', html: '<div>⌂</div>', iconSize: [32, 32], iconAnchor: [16, 16] });
          centers.forEach((item) => L.marker(item.position, { icon: evacuationIcon }).addTo(map).on('click', () => {
            const start = mainMarker.getLatLng();
            showCenter(item, [start.lat, start.lng], null);
          }));
          async function loadReportedIncidents() {
            try {
              const response = await fetch(${JSON.stringify(API_BASE_URL)} + '/api/v1/incidents');
              if (!response.ok) return;
              const incidents = await response.json();
              incidents.filter((incident) => {
                const status = String(incident.verificationStatus || incident.verification_status || 'confirmed').toLowerCase();
                return incident.latitude != null && incident.longitude != null && ['confirmed', 'acknowledged', 'resolved', 'accepted'].includes(status);
              }).forEach((incident) => {
                const severity = String(incident.severity || 'medium').toLowerCase();
                const color = severity === 'critical' || severity === 'high' ? '#B42318' : severity === 'medium' ? '#D98C18' : '#2873A8';
                const position = [Number(incident.latitude), Number(incident.longitude)];
                L.circleMarker(position, { radius: 10, color, fillColor: color, fillOpacity: 0.9, weight: 3 }).addTo(map).on('click', () => {
                  clearRoute();
                  showInfo('Reported incident', position, String(incident.type || 'Incident') + '<br><span style="color:' + color + '">' + String(incident.severity || 'Medium') + ' severity</span><br>' + String(incident.description || 'Confirmed by incident reporting.'));
                });
              });
            } catch (error) {}
          }
          void loadReportedIncidents();
          const mainMarker = L.marker(center).addTo(map);
          showNearest(center);
          map.on('click', (event) => {
            clearRoute();
            mainMarker.setLatLng(event.latlng);
            void showNearest([event.latlng.lat, event.latlng.lng]);
          });
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
              const current = [position.coords.latitude, position.coords.longitude];
              L.circleMarker(current, { radius: 8, color: '#2563eb', fillColor: '#60a5fa', fillOpacity: 0.95, weight: 3 }).addTo(map).on('click', () => showNearest(current));
              mainMarker.setLatLng(current);
              void showNearest(current);
            });
          }
        </script>
      </body>
    </html>
  `, [mappedCenters]);

  return (
    <View style={styles.container}>
      {!ready && <ActivityIndicator size="large" color="#218B25" style={styles.loader} />}
      <WebView
        source={{ html }}
        style={styles.webView}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled
        onLoad={() => setReady(true)}
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data) as { type?: string; centerId?: string };
            if (message.type === 'select-center' && message.centerId) onSelectCenter?.(message.centerId);
          } catch {
            // Ignore non-JSON map messages.
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e5efe8',
  },
  webView: {
    flex: 1,
  },
  loader: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    zIndex: 1,
  },
});
