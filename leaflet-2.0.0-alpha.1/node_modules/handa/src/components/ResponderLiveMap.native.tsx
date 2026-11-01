import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import * as Location from 'expo-location';
import { ThemedText as Text } from '@components/ThemedText';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import { INCIDENT_STATUS_COLORS, INCIDENT_STATUS_LABELS } from '@constants/incidentStatus';
import { estimateResponseEta } from '@services/responderEta';
import { getResponderData, ResponderDataSnapshot, updateIncidentStatus } from '@services/responderData';

const CENTER = [14.3036, 121.0781];
const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
const EMPTY_DATA: ResponderDataSnapshot = { incidents: [], evacuees: [], registeredEvacuees: 0, disasters: [], centers: [], unavailableSources: [] };

function nextIncidentAction(status: string) {
  if (status === 'reported') return { status: 'acknowledged' as const, label: 'Acknowledge' };
  if (status === 'acknowledged') return { status: 'in_progress' as const, label: 'Start response' };
  if (status === 'in_progress') return { status: 'resolved' as const, label: 'Resolve incident' };
  return null;
}

export default function ResponderLiveMap() {
  const webView = useRef<WebView>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const locationFixTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigationSession = useRef<{ name: string; latitude: number; longitude: number; started: boolean; mode: string; profile: string } | null>(null);
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
    return () => {
      clearInterval(refresh);
      locationSubscription.current?.remove();
      locationSubscription.current = null;
      if (locationFixTimeout.current) clearTimeout(locationFixTimeout.current);
      locationFixTimeout.current = null;
    };
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
          html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #e5efe8; font-family: sans-serif; }
          #stage { position: absolute; inset: 0; overflow: hidden; perspective: 900px; perspective-origin: 50% 60%; }
          #map { position: absolute; left: -50%; top: -50%; width: 200%; height: 200%; background: #e5efe8; transform-origin: 50% 50%; transition: transform 450ms ease-out; }
          .navigation-modes { display:grid; grid-template-columns:repeat(3,1fr); gap:5px; margin-top:11px; }
          .navigation-mode { border:1px solid #E0E7EA !important; border-radius:8px !important; background:#fff; color:#415665; font-size:10px; }
          .navigation-mode.active { border-color:#1769AA !important; background:#E9F4FA; color:#125A85; }
          .navigation-start { width:100%; margin-top:9px; min-height:44px !important; border-radius:10px !important; background:#167A5B; color:#fff; font-size:14px; letter-spacing:.3px; }
          .navigation-arrived { margin-top:10px; padding:11px 12px; border-radius:10px; background:#E5F6EE; color:#0F5E44; font-size:14px; font-weight:800; text-align:center; }
          .leaflet-popup-content { min-width: 190px; }
          .map-action { margin-top: 9px; border: 0; border-radius: 4px; padding: 8px 10px; background: #0B3A63; color: #fff; font-weight: 700; }
          .navigation-panel { position: absolute; display: none; z-index: 1000; left: 10px; right: 10px; bottom: 18px; max-width: 460px; margin: 0 auto; padding: 13px 14px; box-sizing: border-box; border: 1px solid rgba(213,225,232,.92); border-radius: 14px; background: rgba(255,255,255,.97); box-shadow: 0 10px 32px rgba(17,39,54,.22); color: #17212B; font: 13px/1.35 InstrumentSans_400Regular,'Avenir Next',sans-serif; }
          .navigation-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
          .navigation-head-actions { display:flex; align-items:center; gap:5px; }
          .navigation-live { display:inline-flex; align-items:center; gap:7px; color:#167A5B; font-size:10px; font-weight:900; letter-spacing:1px; }
          .navigation-live i { width:7px; height:7px; border-radius:50%; background:#24A36A; box-shadow:0 0 0 4px rgba(36,163,106,.13); }
          .navigation-close { width:30px; height:30px; border:0; border-radius:50%; background:#F0F3F5; color:#526474; font-size:19px; }
          .navigation-minimize { width:30px; height:30px; border:0; border-radius:50%; background:#EAF2F8; color:#1769AA; font-size:18px; }
          .navigation-panel.minimized { padding:8px 11px; }
          .navigation-panel.minimized .navigation-head { margin-bottom:3px; }
          .navigation-panel.minimized .navigation-turn-row,.navigation-panel.minimized .navigation-metrics,.navigation-panel.minimized .navigation-routes,.navigation-panel.minimized .navigation-actions,.navigation-panel.minimized .navigation-tools { display:none; }
          .navigation-panel.minimized .navigation-subtitle { display:none; }
          .navigation-top,.navigation-actions,.navigation-tools { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
          .navigation-copy { flex: 1; min-width: 0; }
          .navigation-eyebrow { color:#7B8995; font-size:9px; font-weight:900; letter-spacing:1px; }
          .navigation-title { display: block; overflow-wrap: anywhere; color:#182B3A; font-size:16px; font-weight:800; }
          .navigation-subtitle { display:block; color:#768491; font-size:11px; }
          .navigation-stats { display: block; margin-top: 3px; color: #193448; font-weight: 800; }
          .navigation-turn-row { display:flex; align-items:center; gap:9px; margin-top:12px; padding:10px 11px; border-radius:9px; background:#F1F6FA; color:#254256; font-size:12px; font-weight:700; }
          .navigation-turn-icon { display:grid; place-items:center; flex:none; width:25px; height:25px; border-radius:7px; background:#DDECF5; color:#1769AA; font-size:18px; }
          .navigation-metrics { display:grid; grid-template-columns:1.2fr 1fr .85fr; gap:7px; margin-top:10px; padding:0 2px; }
          .navigation-metric { display:flex; flex-direction:column; gap:2px; min-width:0; }
          .navigation-metric label { color:#83909A; font-size:8px; font-weight:900; letter-spacing:1px; }
          .navigation-metric strong { overflow:hidden; color:#193448; font-size:13px; font-weight:800; text-overflow:ellipsis; white-space:nowrap; }
          .navigation-routes { display: grid; grid-template-columns: repeat(auto-fit,minmax(125px,1fr)); gap: 7px; margin-top: 11px; }
          .navigation-panel button { min-height: 38px; border: 0; border-radius: 5px; padding: 7px 9px; font-weight: 700; }
          .navigation-route { text-align:left; background: #F8FAFB; border: 1px solid #DFE6EA !important; border-radius:9px; color: #203847; }
          .navigation-route.active { background: #EDF6FB; border-color: #2481B4 !important; }
          .navigation-route-top,.navigation-route-bottom { display:flex; align-items:center; justify-content:space-between; gap:5px; }
          .navigation-route-top span { color:#75838D; font-size:8px; }
          .navigation-route-bottom { justify-content:flex-start; margin-top:4px; color:#526674; font-size:10px; }
          .navigation-actions { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-top:11px; }
          .navigation-control { display:flex; align-items:center; justify-content:center; gap:5px; min-height:38px; border:1px solid #E0E7EA !important; border-radius:8px !important; background:#fff; color:#415665; font-size:10px; }
          .navigation-control.active { border-color:#1769AA !important; background:#E9F4FA; color:#125A85; }
          .navigation-3d-arrow { position:relative; display:inline-block; width:15px; height:17px; }
          .navigation-3d-arrow:before { position:absolute; inset:1px 2px 0; content:''; background:linear-gradient(90deg,#39A5E6 0 48%,#1769AA 49% 100%); clip-path:polygon(50% 0,100% 100%,50% 77%,0 100%); filter:drop-shadow(0 2px 1px rgba(11,58,99,.35)); transform:rotateX(18deg); }
          .navigation-tools { margin-top: 7px; }
          .navigation-stop { width:100%; min-height:34px !important; background:#F3F5F6; color:#65727C; font-size:10px; }
          .navigation-stop span { color:#A64343; }
          .nav-user-icon { border:0; background:transparent; }
          .nav-user-dot { width:18px; height:18px; border:3px solid #fff; border-radius:50%; background:#237DB5; box-shadow:0 2px 7px rgba(15,45,66,.45); }
          .nav-user-arrow { position:relative; width:37px; height:44px; filter:drop-shadow(0 4px 3px rgba(10,36,54,.42)); }
          .nav-user-arrow:before { position:absolute; inset:1px 3px 5px; content:''; background:linear-gradient(90deg,#39A5E6 0 48%,#1769AA 49% 100%); clip-path:polygon(50% 0,100% 100%,50% 78%,0 100%); }
          .nav-user-arrow i { position:absolute; left:17px; top:14px; width:3px; height:14px; border-radius:2px; background:#fff; }
          @media(max-width:380px) { .navigation-panel { left:7px; right:7px; bottom:9px; padding:10px; } .navigation-title { font-size:14px; } .navigation-control { gap:3px; padding:5px; font-size:9px; } }
        </style>
      </head>
      <body>
        <div id="stage"><div id="map"></div></div>
        <div id="navigation-panel" class="navigation-panel"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          const center = ${JSON.stringify(CENTER)};
          const map = L.map('map').setView(center, 13);
          const focusMapOnBinan = () => {
            map.invalidateSize({ pan: false });
            map.setView(center, 13, { animate: false });
          };
          requestAnimationFrame(() => requestAnimationFrame(focusMapOnBinan));
          window.addEventListener('resize', () => map.invalidateSize({ pan: false }));
          L.tileLayer(${JSON.stringify(mapboxToken ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}&tileSize=512` : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')}, {
            attribution: ${JSON.stringify(mapboxToken ? '&copy; Mapbox &copy; OpenStreetMap contributors' : '&copy; OpenStreetMap contributors')}, maxZoom: 19
          }).addTo(map);
          const routeRenderer = L.svg({ padding: .35 }).addTo(map);
          const centersLayer = L.layerGroup().addTo(map);
          const incidentsLayer = L.layerGroup().addTo(map);
          const navigationPanel = document.getElementById('navigation-panel');
          let currentPosition = null;
          let locationAccuracy = 0;
          let destination = null;
          let navigationRoutes = [];
          let routeLayers = [];
          let selectedRouteIndex = 0;
          let routeRequestId = 0;
          let offRouteUpdates = 0;
          let lastRerouteAt = 0;
          let currentStepIndex = 0;
          let isThreeDimensional = false;
          let isNavigationMinimized = false;
          let userHeading = 0;
          let isNavigating = false;
          let navigationStarted = false;
          let hasArrived = false;
          let resumeGuidance = false;
          let panelMessage = '';
          let activeProfile = 'driving-traffic';
          let activeMode = 'motorcycle';
          let routePoints = [];
          let progressIndex = 0;
          let displayAngle = 0;
          let headingPosition = null;
          let followingUser = true;
          let userMarker = null;
          const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' })[character]);
          const nextAction = (status) => status === 'reported' ? ['acknowledged', 'Acknowledge'] : status === 'acknowledged' ? ['in_progress', 'Start response'] : status === 'in_progress' ? ['resolved', 'Resolve incident'] : null;
          const statusColors = ${JSON.stringify(INCIDENT_STATUS_COLORS)};
          const statusLabels = ${JSON.stringify(INCIDENT_STATUS_LABELS)};
          window.postIncidentAction = (id, status, label) => window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'incident-action', id, status, label }));
          window.postIncidentNavigation = (name, latitude, longitude) => window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'incident-navigation', name, latitude, longitude }));
          function formatDistance(meters) { return meters < 1000 ? Math.round(meters) + ' m' : (meters / 1000).toFixed(1) + ' km'; }
          function formatDuration(seconds) {
            const minutes = Math.max(1, Math.round(seconds / 60));
            return minutes < 60 ? minutes + ' min' : Math.floor(minutes / 60) + ' hr ' + (minutes % 60) + ' min';
          }
          function distanceMeters(first, second) {
            const radians = Math.PI / 180;
            const latitudeDelta = (second[0] - first[0]) * radians;
            const longitudeDelta = (second[1] - first[1]) * radians;
            const latitude = first[0] * radians;
            const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitude) * Math.cos(second[0] * radians) * Math.sin(longitudeDelta / 2) ** 2;
            return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
          }
          function clearRouteLayers() { routeLayers.forEach((layer) => layer && map.removeLayer(layer)); routeLayers = []; }
          function nearestRouteDistance(position, route) {
            return route.geometry.coordinates.reduce((nearest, point) => Math.min(nearest, distanceMeters(position, [point[1], point[0]])), Number.POSITIVE_INFINITY);
          }
          function locateOnRoute(position, points, from) {
            let index = from;
            let nearest = Number.POSITIVE_INFINITY;
            for (let pointIndex = from; pointIndex < points.length; pointIndex += 1) {
              const distance = distanceMeters(position, points[pointIndex]);
              if (distance < nearest) { nearest = distance; index = pointIndex; }
            }
            return { index, distance: nearest };
          }
          function routeRemainingMeters(position, route) {
            const points = routePoints;
            if (!points.length) return route.distance;
            const located = locateOnRoute(position, points, progressIndex);
            let remaining = located.distance;
            for (let index = located.index; index < points.length - 1; index += 1) remaining += distanceMeters(points[index], points[index + 1]);
            return Math.min(route.distance, remaining);
          }
          function updateRouteProgress() {
            const layer = routeLayers[selectedRouteIndex];
            if (!navigationStarted || !layer || !routePoints.length || !currentPosition) return;
            progressIndex = locateOnRoute(currentPosition, routePoints, progressIndex).index;
            layer.setLatLngs([currentPosition].concat(routePoints.slice(progressIndex + 1)));
          }
          function updateNavigationStats() {
            const route = navigationRoutes[selectedRouteIndex];
            if (!route || !currentPosition) return;
            const remaining = routeRemainingMeters(currentPosition, route);
            const distance = navigationPanel.querySelector('.navigation-distance');
            const eta = navigationPanel.querySelector('.navigation-eta');
            const gps = navigationPanel.querySelector('.navigation-gps');
            if (distance) distance.textContent = formatDistance(remaining);
            if (eta) eta.textContent = new Date(Date.now() + route.duration * (route.distance ? remaining / route.distance : 0) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (gps) gps.textContent = '±' + Math.round(locationAccuracy) + ' m';
            const steps = route.legs?.[0]?.steps || [];
            while (currentStepIndex < steps.length - 1) {
              const point = steps[currentStepIndex].maneuver.location;
              if (distanceMeters(currentPosition, [point[1], point[0]]) > 35) break;
              currentStepIndex += 1;
            }
            const turn = navigationPanel.querySelector('.navigation-turn');
            if (turn && navigationStarted && !hasArrived && !panelMessage && steps[currentStepIndex]?.maneuver?.instruction) turn.textContent = 'Next: ' + steps[currentStepIndex].maneuver.instruction;
          }
          function selectRoute(index, fit) {
            if (!navigationRoutes[index]) return;
            selectedRouteIndex = index;
            routePoints = navigationRoutes[index].geometry.coordinates.map((point) => [point[1], point[0]]);
            progressIndex = 0;
            clearRouteLayers();
            navigationRoutes.forEach((route, routeIndex) => {
              const selected = routeIndex === index;
              if (navigationStarted && !selected) { routeLayers.push(null); return; }
              const points = selected ? routePoints : route.geometry.coordinates.map((point) => [point[1], point[0]]);
              routeLayers.push(L.polyline(points, { color: selected ? '#1769AA' : '#90A4AE', weight: selected ? 7 : 4, opacity: selected ? .95 : .65, dashArray: selected ? null : '7 8', renderer: routeRenderer }).addTo(map));
            });
            if (fit && !navigationStarted && routeLayers[index]) {
              // The map element is twice the viewport, so pad by half the viewport to fit the route on screen.
              const padX = window.innerWidth / 2 + 45;
              const padY = window.innerHeight / 2 + 45;
              map.fitBounds(routeLayers[index].getBounds(), { paddingTopLeft: [padX, padY], paddingBottomRight: [padX, padY + 120] });
            }
            updateRouteProgress();
            updateNavigationStats();
            renderNavigationPanel('', true);
          }
          function renderNavigationPanel(message, showRoutes) {
            navigationPanel.style.display = 'block';
            panelMessage = message || '';
            navigationPanel.classList.toggle('minimized', isNavigationMinimized);
            const routeButtons = showRoutes ? '<div class="navigation-routes">' + navigationRoutes.map((route, index) => '<button type="button" class="navigation-route' + (index === selectedRouteIndex ? ' active' : '') + '" data-route-index="' + index + '"><span class="navigation-route-top"><strong>Route ' + (index + 1) + '</strong><span>' + (index === 0 ? 'Recommended' : 'Alternative') + '</span></span><span class="navigation-route-bottom">' + formatDistance(route.distance) + ' · ' + formatDuration(route.duration) + '</span></button>').join('') + '</div>' : '';
            const modeButtons = !navigationStarted ? '<div class="navigation-modes">' + [['walking', 'walking', 'On foot'], ['motorcycle', 'driving-traffic', 'Motorcycle'], ['car', 'driving-traffic', 'Car']].map((mode) => '<button type="button" class="navigation-mode' + (activeMode === mode[0] ? ' active' : '') + '" data-mode="' + mode[0] + '" data-profile="' + mode[1] + '">' + mode[2] + '</button>').join('') + '</div>' : '';
            const startButton = !navigationStarted ? '<button type="button" class="navigation-start"' + (navigationRoutes.length ? '' : ' disabled') + '>Start Navigating</button>' : '';
            const arrivedBanner = hasArrived ? '<div class="navigation-arrived">You have arrived at ' + escapeHtml(destination?.name || 'your destination') + '</div>' : '';
            const turnMessage = hasArrived ? 'Destination reached' : (message || (navigationStarted ? 'Follow the highlighted route' : 'Choose a route, then tap Start Navigating'));
            navigationPanel.innerHTML = '<div class="navigation-head"><span class="navigation-live"><i></i> ' + (navigationStarted ? 'NAVIGATING' : 'ROUTE PREVIEW') + '</span><div class="navigation-head-actions"><button type="button" class="navigation-minimize" aria-label="' + (isNavigationMinimized ? 'Restore navigation' : 'Minimize navigation') + '" title="' + (isNavigationMinimized ? 'Restore navigation' : 'Minimize navigation') + '">' + (isNavigationMinimized ? '+' : '−') + '</button></div></div><div class="navigation-top"><div class="navigation-copy"><div class="navigation-eyebrow">NAVIGATING TO</div><strong class="navigation-title">' + escapeHtml(destination?.name || '') + '</strong><span class="navigation-subtitle">Biñan City · Incident response</span></div></div>' + arrivedBanner + '<div class="navigation-turn-row"><span class="navigation-turn-icon">↱</span><span class="navigation-turn">' + escapeHtml(turnMessage) + '</span></div><div class="navigation-metrics"><div class="navigation-metric"><label>REMAINING</label><strong class="navigation-distance">--</strong></div><div class="navigation-metric"><label>ARRIVAL</label><strong class="navigation-eta">--</strong></div><div class="navigation-metric"><label>GPS</label><strong class="navigation-gps">Waiting</strong></div></div>' + modeButtons + (navigationStarted ? '' : routeButtons) + '<div class="navigation-actions"><button type="button" class="navigation-control navigation-3d' + (isThreeDimensional ? ' active' : '') + '" aria-pressed="' + isThreeDimensional + '"><span class="navigation-3d-arrow"><i></i></span><span>3D view</span></button><button type="button" class="navigation-control navigation-recenter"><span>◎</span><span>Recenter</span></button><button type="button" class="navigation-control navigation-blocked"><span>!</span><span>Road blocked</span></button></div>' + startButton + '<div class="navigation-tools"><button type="button" class="navigation-stop"><span>■</span> End navigation</button></div>';
            navigationPanel.querySelectorAll('[data-route-index]').forEach((button) => button.addEventListener('click', () => selectRoute(Number(button.dataset.routeIndex), false)));
            navigationPanel.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => {
              if (button.dataset.mode === activeMode) return;
              activeMode = button.dataset.mode;
              activeProfile = button.dataset.profile;
              void loadRoutes('Finding routes…');
            }));
            const startNavigatingButton = navigationPanel.querySelector('.navigation-start');
            if (startNavigatingButton) startNavigatingButton.addEventListener('click', beginGuidance);
            navigationPanel.querySelector('.navigation-recenter').addEventListener('click', () => { followingUser = true; if (navigationStarted) { applyNavigationView(true); } else if (currentPosition) map.setView(currentPosition, Math.max(map.getZoom(), 16), { animate: true }); });
            navigationPanel.querySelector('.navigation-blocked').addEventListener('click', () => { offRouteUpdates = 2; void loadRoutes('Refreshing traffic-aware alternatives…', true); });
            navigationPanel.querySelector('.navigation-3d').addEventListener('click', () => setThreeDimensionalMode(!isThreeDimensional));
            navigationPanel.querySelector('.navigation-minimize').addEventListener('click', () => {
              isNavigationMinimized = !isNavigationMinimized;
              renderNavigationPanel('', navigationRoutes.length > 0);
            });
            navigationPanel.querySelector('.navigation-stop').addEventListener('click', stopNavigation);
            if (navigationRoutes[selectedRouteIndex]) updateNavigationStats();
          }
          const mapElement = document.getElementById('map');
          function applyMapTransform() {
            const tilt = isThreeDimensional ? 55 : 0;
            const rotation = navigationStarted ? -displayAngle : 0;
            mapElement.style.transform = tilt || rotation ? 'rotateX(' + tilt + 'deg) rotateZ(' + rotation + 'deg)' : '';
            if (isThreeDimensional || navigationStarted) map.dragging.disable();
            else map.dragging.enable();
          }
          function applyNavigationView(force) {
            if (!navigationStarted || !followingUser || !currentPosition) return;
            if (force) map.setView(currentPosition, isThreeDimensional ? 18 : 17, { animate: false });
            else map.panTo(currentPosition, { animate: true, duration: .4, noMoveStart: true });
            applyMapTransform();
          }
          function bearingDegrees(first, second) {
            const radians = Math.PI / 180;
            const y = Math.sin((second[1] - first[1]) * radians) * Math.cos(second[0] * radians);
            const x = Math.cos(first[0] * radians) * Math.sin(second[0] * radians) - Math.sin(first[0] * radians) * Math.cos(second[0] * radians) * Math.cos((second[1] - first[1]) * radians);
            return (Math.atan2(y, x) / radians + 360) % 360;
          }
          function updateHeading(position, gpsHeading) {
            let target = null;
            const moved = headingPosition ? distanceMeters(headingPosition, position) : 0;
            if (gpsHeading != null && Number.isFinite(gpsHeading) && gpsHeading >= 0) target = gpsHeading;
            else if (headingPosition && moved > 6) target = bearingDegrees(headingPosition, position);
            if (!headingPosition || moved > 6) headingPosition = position;
            if (target == null) return;
            userHeading = target;
            const delta = ((target - displayAngle) % 360 + 540) % 360 - 180;
            displayAngle += delta;
          }
          function setThreeDimensionalMode(enabled) {
            isThreeDimensional = enabled;
            applyMapTransform();
            if (navigationStarted) applyNavigationView(true);
            updateUserMarker();
            if (navigationRoutes[selectedRouteIndex]) renderNavigationPanel('', !navigationStarted);
          }
          function updateUserMarker() {
            if (!currentPosition) return;
            const showArrow = navigationStarted || isThreeDimensional;
            const iconHtml = showArrow
              ? '<div class="nav-user-arrow" style="transform:rotate(' + (navigationStarted ? displayAngle : userHeading) + 'deg)"><i></i></div>'
              : '<div class="nav-user-dot"></div>';
            const icon = L.divIcon({ className: 'nav-user-icon', html: iconHtml, iconSize: showArrow ? [42, 48] : [22, 22], iconAnchor: showArrow ? [21, 24] : [11, 11] });
            if (!userMarker) userMarker = L.marker(currentPosition, { icon, interactive: false, keyboard: false }).addTo(map);
            else { userMarker.setLatLng(currentPosition); userMarker.setIcon(icon); }
          }
          function postNavigationSession() {
            window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'navigation-session', name: destination?.name, latitude: destination?.position[0], longitude: destination?.position[1], started: navigationStarted, mode: activeMode, profile: activeProfile }));
          }
          function beginGuidance() {
            if (!isNavigating || !navigationRoutes[selectedRouteIndex]) return;
            navigationStarted = true;
            hasArrived = false;
            followingUser = true;
            isNavigationMinimized = false;
            selectRoute(selectedRouteIndex, false);
            applyMapTransform();
            applyNavigationView(true);
            updateUserMarker();
            postNavigationSession();
          }
          async function loadRoutes(message, chooseAlternative) {
            if (!destination || !currentPosition) return;
            if (!${JSON.stringify(mapboxToken)}) { renderNavigationPanel('Directions unavailable. Configure the Mapbox token.'); return; }
            const requestId = ++routeRequestId;
            const rerouting = navigationStarted;
            lastRerouteAt = Date.now();
            renderNavigationPanel(message || 'Finding routes…');
            if (!rerouting) { clearRouteLayers(); navigationRoutes = []; }
            try {
              const url = 'https://api.mapbox.com/directions/v5/mapbox/' + activeProfile + '/' + currentPosition[1] + ',' + currentPosition[0] + ';' + destination.position[1] + ',' + destination.position[0] + '?alternatives=true&steps=true&geometries=geojson&overview=full&access_token=' + ${JSON.stringify(mapboxToken)};
              const response = await fetch(url);
              if (!response.ok) throw new Error('Directions request failed');
              const result = await response.json();
              if (!isNavigating || requestId !== routeRequestId) return;
              if (result.code !== 'Ok' || !Array.isArray(result.routes) || !result.routes.length) throw new Error('No route found');
              navigationRoutes = result.routes;
              selectedRouteIndex = chooseAlternative && navigationRoutes.length > 1 ? 1 : 0;
              currentStepIndex = 0;
              offRouteUpdates = 0;
              lastRerouteAt = Date.now();
              selectRoute(selectedRouteIndex, true);
              if (resumeGuidance) { resumeGuidance = false; beginGuidance(); }
            } catch {
              offRouteUpdates = 0;
              if (isNavigating && requestId === routeRequestId) renderNavigationPanel(rerouting ? 'Could not recalculate the route. Retrying…' : 'Could not load a route. Check your connection and try again.', rerouting);
            }
          }
          function stopNavigation() {
            isNavigating = false;
            navigationStarted = false;
            hasArrived = false;
            resumeGuidance = false;
            destination = null;
            navigationRoutes = [];
            routePoints = [];
            progressIndex = 0;
            isNavigationMinimized = false;
            routeRequestId += 1;
            clearRouteLayers();
            isThreeDimensional = false;
            applyMapTransform();
            updateUserMarker();
            navigationPanel.style.display = 'none';
            window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'navigation-stop' }));
          }
          window.startResponderNavigation = (name, latitude, longitude) => {
            destination = { name, position: [latitude, longitude] };
            isNavigating = true;
            navigationStarted = false;
            hasArrived = false;
            followingUser = true;
            isNavigationMinimized = false;
            navigationRoutes = [];
            routePoints = [];
            progressIndex = 0;
            lastRerouteAt = 0;
            renderNavigationPanel(currentPosition ? 'Finding routes…' : 'Waiting for GPS…');
            if (currentPosition) void loadRoutes();
            postNavigationSession();
          };
          window.resumeResponderNavigation = (name, latitude, longitude, started, mode, profile) => {
            activeMode = mode || activeMode;
            activeProfile = profile || activeProfile;
            resumeGuidance = !!started;
            window.startResponderNavigation(name, latitude, longitude);
          };
          window.setResponderLocationUnavailable = (message) => { if (isNavigating) renderNavigationPanel(message, !navigationStarted && navigationRoutes.length > 0); };
          window.updateResponderLocation = (latitude, longitude, accuracy, heading) => {
            currentPosition = [latitude, longitude];
            locationAccuracy = accuracy || 0;
            updateHeading(currentPosition, heading);
            updateUserMarker();
            if (!isNavigating) return;
            const route = navigationRoutes[selectedRouteIndex];
            if (!route) { if (Date.now() - lastRerouteAt > 5000) void loadRoutes(); return; }
            if (!navigationStarted) { updateNavigationStats(); return; }
            updateRouteProgress();
            updateNavigationStats();
            applyNavigationView(false);
            if (hasArrived) return;
            if (distanceMeters(currentPosition, destination.position) <= Math.max(30, Math.min(locationAccuracy, 60))) {
              hasArrived = true;
              renderNavigationPanel('', false);
              window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'navigation-arrived', name: destination.name }));
              return;
            }
            const threshold = Math.max(45, locationAccuracy * 1.5);
            if (nearestRouteDistance(currentPosition, route) <= threshold) { offRouteUpdates = 0; return; }
            const alternativeIndex = navigationRoutes.findIndex((candidate, index) => index !== selectedRouteIndex && nearestRouteDistance(currentPosition, candidate) <= threshold);
            if (alternativeIndex >= 0) { offRouteUpdates = 0; selectRoute(alternativeIndex, false); return; }
            offRouteUpdates += 1;
            if (offRouteUpdates >= 2 && Date.now() - lastRerouteAt > 6000) void loadRoutes('You left the route · recalculating…');
          };
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
            (data.incidents || []).filter((incident) => incident.status !== 'resolved' && incident.latitude != null && incident.longitude != null && Number.isFinite(Number(incident.latitude)) && Number.isFinite(Number(incident.longitude)) && Math.abs(Number(incident.latitude)) <= 90 && Math.abs(Number(incident.longitude)) <= 180).forEach((incident) => {
              const status = String(incident.status || 'reported');
              const color = statusColors[status] || statusColors.reported;
              const marker = L.circleMarker([Number(incident.latitude), Number(incident.longitude)], {
                radius: 11, color: '#fff', fillColor: color, fillOpacity: .96, weight: 3
              }).addTo(incidentsLayer);
              const action = nextAction(status);
              const popup = document.createElement('div');
              const title = document.createElement('strong');
              title.textContent = String(incident.type || 'Incident');
              popup.appendChild(title);
              const statusLine = document.createElement('div');
              statusLine.textContent = (statusLabels[status] || status.replace('_', ' ')).toUpperCase();
              statusLine.style.color = color;
              statusLine.style.fontWeight = '700';
              popup.appendChild(statusLine);
              for (const text of [String(incident.location || 'Location not provided'), String(incident.description || '')]) {
                const line = document.createElement('div');
                line.textContent = text;
                popup.appendChild(line);
              }
              const navigateButton = document.createElement('button');
              navigateButton.type = 'button';
              navigateButton.className = 'map-action';
              navigateButton.textContent = 'Navigate here';
              navigateButton.addEventListener('click', () => {
                window.startResponderNavigation(String(incident.type || 'Incident'), Number(incident.latitude), Number(incident.longitude));
                window.postIncidentNavigation(String(incident.type || 'Incident'), Number(incident.latitude), Number(incident.longitude));
              });
              popup.appendChild(navigateButton);
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

  const webViewSource = useMemo(() => ({ html: mapHtml }), [mapHtml]);

  const handleMessage = async (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type: string; id?: string; status?: 'acknowledged' | 'in_progress' | 'resolved'; label?: string; name?: string; latitude?: number; longitude?: number; started?: boolean; mode?: string; profile?: string };
      if (message.type === 'map-ready') {
        setMapReady(true);
        webView.current?.injectJavaScript(`window.updateResponderMapData(${JSON.stringify(data)}); true;`);
        const session = navigationSession.current;
        if (session) {
          webView.current?.injectJavaScript(`window.resumeResponderNavigation(${JSON.stringify(session.name)}, ${session.latitude}, ${session.longitude}, ${session.started}, ${JSON.stringify(session.mode)}, ${JSON.stringify(session.profile)}); true;`);
        }
        return;
      }
      if (message.type === 'navigation-session' && Number.isFinite(message.latitude) && Number.isFinite(message.longitude)) {
        navigationSession.current = { name: message.name ?? 'Incident', latitude: Number(message.latitude), longitude: Number(message.longitude), started: !!message.started, mode: message.mode ?? 'motorcycle', profile: message.profile ?? 'driving-traffic' };
        return;
      }
      if (message.type === 'navigation-arrived') {
        Alert.alert('You have arrived', `You have arrived at ${message.name ?? 'your destination'}.`);
        return;
      }
      if (message.type === 'navigation-stop') {
        navigationSession.current = null;
        locationSubscription.current?.remove();
        locationSubscription.current = null;
        if (locationFixTimeout.current) clearTimeout(locationFixTimeout.current);
        locationFixTimeout.current = null;
        return;
      }
      if (message.type === 'incident-navigation' && Number.isFinite(message.latitude) && Number.isFinite(message.longitude)) {
        try {
          const permission = await Location.requestForegroundPermissionsAsync();
          if (!permission.granted) {
            webView.current?.injectJavaScript("window.setResponderLocationUnavailable('Allow location access to calculate a route.'); true;");
            return;
          }
          webView.current?.injectJavaScript("window.setResponderLocationUnavailable('Acquiring GPS fix…'); true;");
          locationSubscription.current?.remove();
          if (locationFixTimeout.current) clearTimeout(locationFixTimeout.current);
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (lastKnown) {
            webView.current?.injectJavaScript(`window.updateResponderLocation(${lastKnown.coords.latitude}, ${lastKnown.coords.longitude}, ${lastKnown.coords.accuracy ?? 0}, ${lastKnown.coords.heading ?? 'null'}); true;`);
          }
          locationSubscription.current = await Location.watchPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 3,
            timeInterval: 1000,
          }, (location) => {
            if (locationFixTimeout.current) clearTimeout(locationFixTimeout.current);
            locationFixTimeout.current = null;
            webView.current?.injectJavaScript(`window.updateResponderLocation(${location.coords.latitude}, ${location.coords.longitude}, ${location.coords.accuracy ?? 0}, ${location.coords.heading ?? 'null'}); true;`);
          });
          locationFixTimeout.current = setTimeout(() => {
            webView.current?.injectJavaScript("window.setResponderLocationUnavailable('GPS signal not found. Check Location Services or move to an open area.'); true;");
          }, 12000);
        } catch {
          webView.current?.injectJavaScript("window.setResponderLocationUnavailable('Device location is unavailable right now.'); true;");
        }
        return;
      }
      if (message.type !== 'incident-action' || !message.id || !message.status) return;
      const incident = data.incidents.find((item) => item.id === message.id);
      const eta = message.status === 'acknowledged' && incident?.latitude != null && incident.longitude != null
        ? await estimateResponseEta({ latitude: Number(incident.latitude), longitude: Number(incident.longitude) })
        : null;
      await updateIncidentStatus(message.id, message.status, eta ? { etaMinutes: eta.minutes } : {});
      await loadData();
    } catch {
      Alert.alert('Update failed', 'The incident status could not be saved. Check your connection and try again.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusBar}>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#218B25' }]} /><Text style={styles.legendText}>Centers</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: INCIDENT_STATUS_COLORS.reported }]} /><Text style={styles.legendText}>Reported</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: INCIDENT_STATUS_COLORS.acknowledged }]} /><Text style={styles.legendText}>Acknowledged</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: INCIDENT_STATUS_COLORS.in_progress }]} /><Text style={styles.legendText}>In progress</Text></View>
        <View style={styles.statusCopy}>{isLoading ? <ActivityIndicator size="small" color={Colors.secondary} /> : <Text style={[styles.syncStatus, loadError && styles.errorStatus]}>{loadError ? data.unavailableSources.length ? `Partial data · ${data.unavailableSources.join(', ')}` : 'Live data unavailable' : `Live · ${lastUpdated?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}</Text>}</View>
      </View>
      <WebView ref={webView} source={webViewSource} style={styles.webView} javaScriptEnabled domStorageEnabled geolocationEnabled originWhitelist={['*']} onMessage={handleMessage} onContentProcessDidTerminate={() => webView.current?.reload()} onRenderProcessGone={() => webView.current?.reload()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 320, backgroundColor: Colors.surfaceMuted },
  statusBar: { minHeight: 38, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 13, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: '#D7E2EA' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { color: Colors.textMuted, fontSize: 10, fontWeight: '600' },
  statusCopy: { flex: 1, alignItems: 'flex-end' },
  syncStatus: { color: '#167A5B', fontSize: 10, fontWeight: '700' },
  errorStatus: { color: Colors.emergency },
  webView: { flex: 1 },
});
