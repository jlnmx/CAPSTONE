import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import { getResponderData, ResponderDataSnapshot, updateIncidentStatus } from '@services/responderData';

const CENTER = [14.3036, 121.0781];
const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
const EMPTY_DATA: ResponderDataSnapshot = { incidents: [], evacuees: [], disasters: [], centers: [], unavailableSources: [] };

function nextIncidentAction(status: string) {
  if (status === 'reported') return { status: 'acknowledged' as const, label: 'Acknowledge' };
  if (status === 'acknowledged') return { status: 'in_progress' as const, label: 'Start response' };
  if (status === 'in_progress') return { status: 'resolved' as const, label: 'Resolve incident' };
  return null;
}

export default function ResponderLiveMap() {
  const webView = useRef<WebView>(null);
  const [data, setData] = useState<ResponderDataSnapshot>(EMPTY_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = async () => {
    try {
      const snapshot = await getResponderData();
      setData(snapshot);
      setLastUpdated(new Date());
      setLoadError(snapshot.unavailableSources.length > 0);
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    const refresh = setInterval(() => void loadData(), 15_000);
    return () => clearInterval(refresh);
  }, []);

  useEffect(() => {
    if (mapReady) {
      webView.current?.injectJavaScript(`window.updateResponderMapData(${JSON.stringify(data)}); true;`);
    }
  }, [data, mapReady]);

  const mapHtml = useMemo(() => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <style>
          html, body, #map { margin: 0; width: 100%; height: 100%; background: #e5efe8; font-family: sans-serif; }
          .leaflet-popup-content { min-width: 190px; }
          .map-action { margin-top: 9px; border: 0; border-radius: 4px; padding: 8px 10px; background: #0B3A63; color: #fff; font-weight: 700; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          const map = L.map('map').setView(${JSON.stringify(CENTER)}, 13);
          L.tileLayer(${JSON.stringify(mapboxToken ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}&tileSize=512` : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')}, {
            attribution: ${JSON.stringify(mapboxToken ? '&copy; Mapbox &copy; OpenStreetMap contributors' : '&copy; OpenStreetMap contributors')}, maxZoom: 19
          }).addTo(map);
          const centersLayer = L.layerGroup().addTo(map);
          const incidentsLayer = L.layerGroup().addTo(map);
          const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' })[character]);
          const nextAction = (status) => status === 'reported' ? ['acknowledged', 'Acknowledge'] : status === 'acknowledged' ? ['in_progress', 'Start response'] : status === 'in_progress' ? ['resolved', 'Resolve incident'] : null;
          window.postIncidentAction = (id, status, label) => window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'incident-action', id, status, label }));
          window.updateResponderMapData = (data) => {
            centersLayer.clearLayers();
            incidentsLayer.clearLayers();
            (data.centers || []).filter((center) => Number.isFinite(Number(center.latitude)) && Number.isFinite(Number(center.longitude))).forEach((center) => {
              const occupied = Math.max(0, Number(center.currentOccupancy) || 0);
              const capacity = Math.max(0, Number(center.capacity) || 0);
              const available = Math.max(capacity - occupied, 0);
              const marker = L.circleMarker([Number(center.latitude), Number(center.longitude)], {
                radius: 10, color: '#fff', fillColor: center.status === 'full' || available === 0 ? '#B42318' : '#218B25', fillOpacity: .96, weight: 3
              }).addTo(centersLayer);
              marker.bindPopup('<strong>' + escapeHtml(center.name) + '</strong><br>' + escapeHtml(center.location || 'Location not provided') + '<br>Status: ' + escapeHtml(String(center.status).replace('_', ' ')) + '<br>Occupancy: ' + occupied + ' / ' + capacity + '<br><strong>' + available + ' spaces available</strong>');
            });
            (data.incidents || []).filter((incident) => Number.isFinite(Number(incident.latitude)) && Number.isFinite(Number(incident.longitude))).forEach((incident) => {
              const status = String(incident.status || 'reported');
              const severity = String(incident.severity || 'medium').toLowerCase();
              const color = status === 'resolved' ? '#667085' : severity === 'critical' || severity === 'high' ? '#B42318' : severity === 'medium' ? '#D98C18' : '#2873A8';
              const marker = L.circleMarker([Number(incident.latitude), Number(incident.longitude)], {
                radius: status === 'resolved' ? 8 : 11, color: '#fff', fillColor: color, fillOpacity: .96, weight: 3
              }).addTo(incidentsLayer);
              const action = nextAction(status);
              const popup = document.createElement('div');
              const title = document.createElement('strong');
              title.textContent = String(incident.type || 'Incident');
              popup.appendChild(title);
              const statusLine = document.createElement('div');
              statusLine.textContent = severity.toUpperCase() + ' · ' + status.replace('_', ' ');
              statusLine.style.color = color;
              statusLine.style.fontWeight = '700';
              popup.appendChild(statusLine);
              for (const text of [String(incident.location || 'Location not provided'), String(incident.description || '')]) {
                const line = document.createElement('div');
                line.textContent = text;
                popup.appendChild(line);
              }
              if (incident.actionNotes) {
                const notes = document.createElement('div');
                notes.textContent = 'Response: ' + incident.actionNotes;
                popup.appendChild(notes);
              }
              if (action) {
                const actionButton = document.createElement('button');
                actionButton.type = 'button';
                actionButton.className = 'map-action';
                actionButton.textContent = action[1];
                actionButton.addEventListener('click', () => window.postIncidentAction(incident.id, action[0], action[1]));
                popup.appendChild(actionButton);
              }
              marker.bindPopup(popup);
            });
          };
          window.updateResponderMapData({ centers: [], incidents: [] });
          window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'map-ready' }));
        </script>
      </body>
    </html>
  `, []);

  const handleMessage = async (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type: string; id?: string; status?: 'acknowledged' | 'in_progress' | 'resolved'; label?: string };
      if (message.type === 'map-ready') {
        setMapReady(true);
        return;
      }
      if (message.type !== 'incident-action' || !message.id || !message.status) return;
      await updateIncidentStatus(message.id, message.status, `Updated from responder map: ${(message.label || 'status update').toLowerCase()}.`);
      await loadData();
    } catch {
      Alert.alert('Update failed', 'The incident status could not be saved. Check your connection and try again.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusBar}>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#218B25' }]} /><Text style={styles.legendText}>Centers</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#B42318' }]} /><Text style={styles.legendText}>High / critical</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#D98C18' }]} /><Text style={styles.legendText}>Medium</Text></View>
        <View style={styles.statusCopy}>{isLoading ? <ActivityIndicator size="small" color={Colors.secondary} /> : <Text style={[styles.syncStatus, loadError && styles.errorStatus]}>{loadError ? data.unavailableSources.length ? `Partial data · ${data.unavailableSources.join(', ')}` : 'Live data unavailable' : `Live · ${lastUpdated?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}</Text>}</View>
      </View>
      <WebView ref={webView} source={{ html: mapHtml }} style={styles.webView} javaScriptEnabled domStorageEnabled geolocationEnabled originWhitelist={['*']} onMessage={handleMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 320, backgroundColor: '#EAF2EF' },
  statusBar: { minHeight: 38, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 13, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: '#D7E2EA' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { color: Colors.textMuted, fontSize: 10, fontWeight: '600' },
  statusCopy: { flex: 1, alignItems: 'flex-end' },
  syncStatus: { color: '#167A5B', fontSize: 10, fontWeight: '700' },
  errorStatus: { color: Colors.emergency },
  webView: { flex: 1 },
});
