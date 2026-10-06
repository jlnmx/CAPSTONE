import React, { useEffect, useRef } from 'react';
import * as Leaflet from '../vendor/leaflet/LeafletWithGlobals.js';
import '../vendor/leaflet/leaflet.css';
import { MapEvacuationCenter } from '@types/index';

const BINAN_CENTER: [number, number] = [14.3036, 121.0781];
const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
const LeafletApi = (Leaflet as any).default ?? Leaflet;
const markerIconAsset = require('../vendor/leaflet/images/marker-icon.png');
const markerShadowAsset = require('../vendor/leaflet/images/marker-shadow.png');
const markerIconUrl = markerIconAsset?.default?.uri ?? markerIconAsset?.default ?? markerIconAsset?.uri ?? markerIconAsset;
const markerShadowUrl = markerShadowAsset?.default?.uri ?? markerShadowAsset?.default ?? markerShadowAsset?.uri ?? markerShadowAsset;
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

interface LeafletMapProps {
  centers?: MapEvacuationCenter[];
  onSelectCenter?: (centerId: string) => void;
}

export default function LeafletMap({ centers = [], onSelectCenter }: LeafletMapProps) {
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

    const infoPanel = document.createElement('div');
    Object.assign(infoPanel.style, {
      position: 'absolute',
      top: '14px',
      right: '14px',
      left: '14px',
      zIndex: '1000',
      width: 'auto',
      maxWidth: '390px',
      boxSizing: 'border-box',
      padding: '14px 16px',
      borderRadius: '8px',
      background: '#ffffff',
      boxShadow: '0 3px 14px rgba(23, 33, 43, 0.22)',
      fontFamily: 'Arial, sans-serif',
      color: '#17212B',
      overflowWrap: 'anywhere',
      pointerEvents: 'auto',
    });
    mapElement.current.appendChild(infoPanel);
    LeafletApi.DomEvent.disableClickPropagation(infoPanel);

    const escapeHtml = (value: string) =>
      value.replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character]);

    const mappedCenters = centers.flatMap((center) => (
      center.latitude == null || center.longitude == null
        ? []
        : [{ center, position: [Number(center.latitude), Number(center.longitude)] as [number, number] }]
    ));
    const destinationMarkers = mappedCenters.map(({ position }) => new LeafletApi.Marker(position, {
      icon: new LeafletApi.DivIcon({
        className: 'evacuation-center-icon',
        html: '<div style="width:32px;height:32px;border:3px solid #ffffff;border-radius:8px;background:#218B25;color:#ffffff;display:flex;align-items:center;justify-content:center;font-size:23px;font-weight:800;line-height:1;box-shadow:0 2px 6px rgba(23,33,43,.35)">⌂</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      }),
    }).addTo(map));
    let reportedMarkers: any[] = [];
    let routeLine: any = null;

    const clearRoute = () => {
      if (routeLine) {
        routeLine.remove();
        routeLine = null;
      }
    };

    const distanceInKm = (first: [number, number], second: [number, number]) => {
      const latitudeDelta = (second[0] - first[0]) * Math.PI / 180;
      const longitudeDelta = (second[1] - first[1]) * Math.PI / 180;
      const latitude = first[0] * Math.PI / 180;
      const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitude) * Math.cos(second[0] * Math.PI / 180) * Math.sin(longitudeDelta / 2) ** 2;
      return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    };

    const findNearestCenter = (position: [number, number]) => mappedCenters.reduce<{ item: typeof mappedCenters[number] | null; distance: number }>((nearest, item) => {
      const distance = distanceInKm(position, item.position);
      return distance < nearest.distance ? { item, distance } : nearest;
    }, { item: null, distance: Number.POSITIVE_INFINITY });

    const drawRoute = async (start: [number, number], destination: [number, number]) => {
      if (routeLine) routeLine.remove();
      let route: [number, number][] = [start, destination];
      if (mapboxToken) {
        try {
          const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${start[1]},${start[0]};${destination[1]},${destination[0]}?geometries=geojson&overview=full&access_token=${mapboxToken}`);
          const data = await response.json();
          const coordinates = data.routes?.[0]?.geometry?.coordinates;
          if (coordinates?.length) route = coordinates.map(([longitude, latitude]: [number, number]) => [latitude, longitude]);
        } catch {
          // Keep the direct guidance line when routing is unavailable.
        }
      }
      routeLine = new LeafletApi.Polyline(route, { color: '#D98C18', weight: 5, opacity: 0.85 }).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [42, 42] });
    };

    const showCenter = (center: MapEvacuationCenter, destination: [number, number], userPosition: [number, number], distance?: number) => {
      const capacity = Math.max(0, Number(center.capacity) || 0);
      const occupancy = Math.max(0, Number(center.current_occupancy) || 0);
      const spaces = Math.max(0, capacity - occupancy);
      const acceptingRegistrations = center.status !== 'closed' && center.status !== 'full' && spaces > 0;
      infoPanel.innerHTML = `<strong style="display:block;font-size:16px;margin-bottom:5px">${escapeHtml(center.name)}</strong><span style="display:block;font-size:12px;color:#667085">${escapeHtml(center.location || 'Location not provided')}${distance == null ? '' : ` · ${distance.toFixed(1)} km away`}</span><span style="display:block;font-size:12px;margin-top:6px">Capacity: ${occupancy} of ${capacity} · ${spaces} spaces available</span><span style="display:block;font-size:12px;color:${acceptingRegistrations ? '#218B25' : '#B42318'};font-weight:700;margin-top:2px">${acceptingRegistrations ? 'Accepting registrations' : 'Not accepting registrations'}</span><button id="navigate-button" style="margin-top:10px;margin-right:7px;border:0;border-radius:5px;padding:9px 12px;background:#E8F2E8;color:#175B19;font-weight:700;cursor:pointer">Navigate</button><button id="select-center-button" ${acceptingRegistrations ? '' : 'disabled'} style="margin-top:10px;border:0;border-radius:5px;padding:9px 12px;background:${acceptingRegistrations ? '#218B25' : '#98A29A'};color:#fff;font-weight:700;cursor:${acceptingRegistrations ? 'pointer' : 'not-allowed'}">Select center</button>`;
      infoPanel.querySelector('#navigate-button')?.addEventListener('click', async () => {
        await drawRoute(userPosition, destination);
        infoPanel.insertAdjacentHTML('beforeend', '<span style="display:block;margin-top:8px;color:#218B25;font-size:12px;font-weight:700">In-app navigation active. Follow the highlighted route.</span>');
      });
      infoPanel.querySelector('#select-center-button')?.addEventListener('click', () => onSelectCenter?.(center.id));
    };

    const updateInfoPanel = async (position: any) => {
      const userPosition: [number, number] = [position.lat, position.lng];
      const nearest = findNearestCenter(userPosition);
      if (!nearest.item) {
        infoPanel.innerHTML = '<strong>No evacuation centers available on the map.</strong>';
        clearRoute();
        return;
      }
      showCenter(nearest.item.center, nearest.item.position, userPosition, nearest.distance);
      clearRoute();
    };

    const loadReportedIncidents = async () => {
      try {
        reportedMarkers.forEach((reportedMarker) => reportedMarker.remove());
        reportedMarkers = [];
        const response = await fetch(`${API_BASE_URL}/api/v1/incidents`);
        if (!response.ok) return;
        const incidents = await response.json() as Array<Record<string, unknown>>;
        reportedMarkers = incidents
          .filter((incident) => {
            const status = String(incident.status ?? incident.verificationStatus ?? incident.verification_status ?? 'reported').toLowerCase();
            return incident.latitude != null && incident.longitude != null && ['reported', 'acknowledged', 'in_progress', 'resolved', 'confirmed', 'accepted'].includes(status);
          })
          .map((incident) => {
            const severity = String(incident.severity ?? 'medium').toLowerCase();
            const color = severity === 'critical' || severity === 'high' ? '#B42318' : severity === 'medium' ? '#D98C18' : '#2873A8';
            const position: [number, number] = [Number(incident.latitude), Number(incident.longitude)];
            const marker = new LeafletApi.CircleMarker(position, { radius: 10, color, fillColor: color, fillOpacity: 0.9, weight: 3 }).addTo(map);
            marker.on('click', () => {
              clearRoute();
              const status = String(incident.status ?? incident.verificationStatus ?? 'reported').toLowerCase();
              const actionNotes = String(incident.actionNotes ?? incident.action_notes ?? '');
              infoPanel.innerHTML = `<strong style="display:block;font-size:16px;margin-bottom:5px;color:${color}">Incident report</strong><span style="display:block;font-size:14px;font-weight:700">${escapeHtml(String(incident.type ?? 'Incident'))}</span><span style="display:block;font-size:12px;color:${color};margin-top:3px">${escapeHtml(String(incident.severity ?? 'Medium'))} severity · ${escapeHtml(status.replace('_', ' '))}</span><span style="display:block;font-size:12px;line-height:1.5;margin-top:6px">${escapeHtml(String(incident.description ?? 'No description provided.'))}</span>${actionNotes ? `<span style="display:block;font-size:12px;line-height:1.5;margin-top:6px;color:#218B25">Action: ${escapeHtml(actionNotes)}</span>` : ''}`;
            });
            return marker;
          });
      } catch {
        // Map remains usable when the incident service is unavailable.
      }
    };

    void loadReportedIncidents();
    const incidentRefresh = window.setInterval(() => void loadReportedIncidents(), 15000);

    destinationMarkers.forEach((destinationMarker, index) => {
      destinationMarker.on('click', () => {
        clearRoute();
        const selected = mappedCenters[index];
        const userPosition = marker.getLatLng();
        showCenter(selected.center, selected.position, [userPosition.lat, userPosition.lng], distanceInKm([userPosition.lat, userPosition.lng], selected.position));
      });
    });

    marker.on('dragend', () => {
      void updateInfoPanel(marker.getLatLng());
    });

    map.on('click', (event: any) => {
      clearRoute();
      marker.setLatLng(event.latlng);
      void updateInfoPanel(event.latlng);
    });

    void updateInfoPanel(marker.getLatLng());

    return () => {
      window.clearInterval(incidentRefresh);
      infoPanel.remove();
      destinationMarkers.forEach((destinationMarker) => destinationMarker.remove());
      reportedMarkers.forEach((reportedMarker) => reportedMarker.remove());
      map.remove();
    };
  }, [centers, onSelectCenter]);

  return <div ref={mapElement} style={styles.map} />;
}

const styles = {
  map: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e5efe8',
  },
};
