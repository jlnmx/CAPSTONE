import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as Leaflet from '../vendor/leaflet/LeafletWithGlobals.js';
import '../vendor/leaflet/leaflet.css';
import { getResponderData, ResponderDataSnapshot, ResponderIncident, updateIncidentStatus } from '@services/responderData';
import { Colors } from '@constants/colors';

const CENTER: [number, number] = [14.3036, 121.0781];
const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
const LeafletApi = (Leaflet as any).default ?? Leaflet;
const EMPTY_DATA: ResponderDataSnapshot = { incidents: [], evacuees: [], registeredEvacuees: 0, disasters: [], centers: [], unavailableSources: [] };

function nextIncidentAction(status: ResponderIncident['status']) {
  if (status === 'reported') return { status: 'acknowledged' as const, label: 'Acknowledge' };
  if (status === 'acknowledged') return { status: 'in_progress' as const, label: 'Start response' };
  if (status === 'in_progress') return { status: 'resolved' as const, label: 'Resolve incident' };
  return null;
}

function severityColor(severity: string, status: string) {
  if (status === 'resolved') return '#667085';
  if (severity === 'critical' || severity === 'high') return '#B42318';
  if (severity === 'medium') return '#D98C18';
  return '#2873A8';
}

export default function ResponderLiveMap() {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const centerLayer = useRef<any>(null);
  const incidentLayer = useRef<any>(null);
  const [data, setData] = useState<ResponderDataSnapshot>(EMPTY_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        const snapshot = await getResponderData();
        if (!mounted) return;
        setData(snapshot);
        setLastUpdated(new Date());
        setLoadError(snapshot.unavailableSources.length > 0);
      } catch {
        if (mounted) setLoadError(true);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    void loadData();
    const refresh = setInterval(() => void loadData(), 15_000);
    return () => {
      mounted = false;
      clearInterval(refresh);
    };
  }, []);

  useEffect(() => {
    if (!mapElement.current) return undefined;

    const map = new LeafletApi.Map(mapElement.current);
    map.setView(CENTER, 13);
    new LeafletApi.TileLayer(
      mapboxToken
        ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}&tileSize=512`
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution: mapboxToken ? '&copy; Mapbox &copy; OpenStreetMap contributors' : '&copy; OpenStreetMap contributors', maxZoom: 19 },
    ).addTo(map);

    centerLayer.current = new LeafletApi.LayerGroup().addTo(map);
    incidentLayer.current = new LeafletApi.LayerGroup().addTo(map);

    return () => {
      centerLayer.current = null;
      incidentLayer.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (!centerLayer.current || !incidentLayer.current) return;

    const makeText = (tag: string, text: string, style?: Partial<CSSStyleDeclaration>) => {
      const element = document.createElement(tag);
      element.textContent = text;
      if (style) Object.assign(element.style, style);
      return element;
    };

    const renderMarkers = () => {
      centerLayer.current.clearLayers();
      incidentLayer.current.clearLayers();
      data.centers.filter((center) => Number.isFinite(center.latitude) && Number.isFinite(center.longitude)).forEach((center) => {
        const occupied = Math.max(0, center.currentOccupancy);
        const capacity = Math.max(0, center.capacity);
        const available = Math.max(0, capacity - occupied);
        const marker = new LeafletApi.CircleMarker([center.latitude, center.longitude], {
          radius: 10,
          color: '#FFFFFF',
          fillColor: center.status === 'full' || available === 0 ? '#B42318' : '#218B25',
          fillOpacity: 0.96,
          weight: 3,
        }).addTo(centerLayer.current);
        const popup = document.createElement('div');
        popup.appendChild(makeText('strong', center.name, { display: 'block', marginBottom: '4px' }));
        popup.appendChild(makeText('div', center.location || 'Location not provided'));
        popup.appendChild(makeText('div', `Status: ${center.status.replace('_', ' ')}`));
        popup.appendChild(makeText('div', `Occupancy: ${occupied} / ${capacity}`));
        popup.appendChild(makeText('div', `${available} spaces available`, { color: available === 0 ? '#B42318' : '#167A5B', fontWeight: '700' }));
        marker.bindPopup(popup);
      });

      data.incidents.filter((incident) => Number.isFinite(incident.latitude) && Number.isFinite(incident.longitude)).forEach((incident) => {
        const color = severityColor(incident.severity, incident.status);
        const marker = new LeafletApi.CircleMarker([incident.latitude, incident.longitude], {
          radius: incident.status === 'resolved' ? 8 : 11,
          color: '#FFFFFF',
          fillColor: color,
          fillOpacity: 0.95,
          weight: 3,
        }).addTo(incidentLayer.current);
        const popup = document.createElement('div');
        popup.appendChild(makeText('strong', incident.type, { display: 'block', marginBottom: '4px' }));
        popup.appendChild(makeText('div', `${incident.severity.toUpperCase()} · ${incident.status.replace('_', ' ')}`, { color, fontWeight: '800' }));
        popup.appendChild(makeText('div', incident.location || 'Location not provided', { marginTop: '4px' }));
        popup.appendChild(makeText('div', incident.description, { marginTop: '4px', maxWidth: '260px', whiteSpace: 'normal' }));
        if (incident.actionNotes) popup.appendChild(makeText('div', `Response: ${incident.actionNotes}`, { marginTop: '5px', color: '#167A5B' }));
        const action = nextIncidentAction(incident.status);
        if (action) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = action.label;
          Object.assign(button.style, { marginTop: '9px', border: '0', borderRadius: '4px', padding: '8px 10px', background: '#0B3A63', color: '#FFFFFF', fontWeight: '700', cursor: 'pointer' });
          button.addEventListener('click', async () => {
            button.disabled = true;
            button.textContent = 'Saving...';
            try {
              await updateIncidentStatus(incident.id, action.status, `Updated from responder map: ${action.label.toLowerCase()}.`);
              const freshData = await getResponderData();
              setData(freshData);
              setLastUpdated(new Date());
            } catch {
              button.disabled = false;
              button.textContent = 'Update failed · retry';
            }
          });
          popup.appendChild(button);
        }
        marker.bindPopup(popup);
      });
    };

    renderMarkers();
  }, [data]);

  return (
    <View style={styles.container}>
      <View style={styles.statusBar}>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#218B25' }]} /><Text style={styles.legendText}>Centers</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#B42318' }]} /><Text style={styles.legendText}>High / critical</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#D98C18' }]} /><Text style={styles.legendText}>Medium</Text></View>
        <View style={styles.statusCopy}>{isLoading ? <ActivityIndicator size="small" color={Colors.secondary} /> : <Text style={[styles.syncStatus, loadError && styles.errorStatus]}>{loadError ? data.unavailableSources.length ? `Partial data · ${data.unavailableSources.join(', ')}` : 'Live data unavailable' : `Live · ${lastUpdated?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}</Text>}</View>
      </View>
      <div ref={mapElement} style={{ width: '100%', height: '100%', minHeight: 280 }} />
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
  map: { flex: 1, minHeight: 280 },
});
