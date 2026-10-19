import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { Colors } from '@constants/colors';
import { useTheme } from '@hooks/useTheme';
import { MapEvacuationCenter } from '@types/index';

const BINAN_CENTER = [14.3036, 121.0781];
const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
const tileUrl = mapboxToken
  ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}&tileSize=512`
  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const attribution = mapboxToken
  ? '&copy; <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener noreferrer">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
  : '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

interface LeafletMapProps {
  centers?: MapEvacuationCenter[];
  onSelectCenter?: (centerId: string) => void;
}

export default function LeafletMap({ centers = [], onSelectCenter }: LeafletMapProps) {
  const { palette } = useTheme();
  const [ready, setReady] = useState(false);
  const webView = useRef<WebView | null>(null);
  const mappedCenters = useMemo(() => centers.flatMap((item) => (
    item.latitude == null || item.longitude == null
      ? []
      : [{ ...item, position: [Number(item.latitude), Number(item.longitude)] }]
  )), [centers]);

  useEffect(() => {
    if (!ready) return undefined;
    let isMounted = true;
    let locationSubscription: Location.LocationSubscription | null = null;

    const publishUnavailable = (message: string) => {
      webView.current?.injectJavaScript(`window.setHANDAUserLocationUnavailable(${JSON.stringify(message)}); true;`);
    };

    const startLocationUpdates = async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!isMounted) return;
        if (!permission.granted) {
          publishUnavailable(permission.canAskAgain
            ? 'Allow location access from the app prompt to show your position.'
            : 'Enable location access in device settings to show your position.');
          return;
        }

        const subscription = await Location.watchPositionAsync({
          accuracy: Location.Accuracy.High,
          distanceInterval: 3,
          timeInterval: 1000,
        }, (location) => {
          webView.current?.injectJavaScript(`window.updateHANDAUserLocation(${location.coords.latitude}, ${location.coords.longitude}, ${location.coords.accuracy ?? 0}); true;`);
        });
        if (isMounted) locationSubscription = subscription;
        else subscription.remove();
      } catch {
        publishUnavailable('Device location is unavailable right now.');
      }
    };

    void startLocationUpdates();
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !locationSubscription) void startLocationUpdates();
    });

    return () => {
      isMounted = false;
      locationSubscription?.remove();
      appStateSubscription.remove();
    };
  }, [ready]);

  const html = useMemo(() => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <style>
          html, body, #map { margin: 0; width: 100%; height: 100%; }
          .leaflet-container { background: #e5efe8; }
          .leaflet-control-attribution { margin: 0 5px 5px 0 !important; padding: 2px 5px !important; border-radius: 3px; background: rgba(255,255,255,.82) !important; color: #526052; font-size: 9px !important; line-height: 1.3 !important; }
          .location-panel { position: absolute; top: 14px; left: 14px; right: 14px; z-index: 1000; width: auto; max-width: 390px; box-sizing: border-box; padding: 14px 16px; border: 1px solid ${palette.border}; border-radius: 8px; background: ${palette.surface}; box-shadow: 0 3px 14px rgba(23, 33, 43, 0.22); color: ${palette.text}; font: 13px/1.5 Arial, sans-serif; overflow-wrap: anywhere; }
          .location-panel strong { display: block; margin-bottom: 6px; font-size: 16px; }
          .location-panel .center-name { display: block; font-size: 14px; font-weight: 700; }
          .location-panel .muted { display: block; margin-top: 2px; color: ${palette.textMuted}; font-size: 12px; }
          .location-panel button { margin-top: 10px; border: 0; border-radius: 5px; padding: 9px 12px; background: #218B25; color: #ffffff; font-weight: 700; }
          .location-panel .secondary { margin-right: 7px; background: #E8F2E8; color: #175B19; }
          .evacuation-center-icon { background: transparent; border: 0; }
          .evacuation-center-icon div { width: 32px; height: 32px; border: 3px solid #ffffff; border-radius: 8px; background: #218B25; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 23px; font-weight: 800; line-height: 1; box-shadow: 0 2px 6px rgba(23,33,43,.35); }
          .navigation-panel { position: absolute; display: none; left: 10px; right: 10px; bottom: 18px; z-index: 1100; max-width: 460px; margin: 0 auto; padding: 12px; box-sizing: border-box; border: 1px solid ${palette.border}; border-radius: 12px; background: ${palette.surface}; box-shadow: 0 4px 18px rgba(23,33,43,.2); color: ${palette.text}; font: 13px/1.4 Arial, sans-serif; }
          .navigation-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
          .navigation-copy { display: flex; flex: 1; min-width: 0; flex-direction: column; }
          .navigation-eyebrow { color: ${palette.textMuted}; font-size: 9px; font-weight: 800; letter-spacing: .7px; }
          .navigation-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; font-weight: 800; }
          .navigation-stats { color: ${palette.text}; font-size: 12px; font-weight: 700; }
          .navigation-modes { display: flex; gap: 4px; margin-top: 10px; padding: 4px; border-radius: 7px; background: ${palette.surfaceMuted}; }
          .navigation-panel button { min-height: 38px; border: 0; border-radius: 5px; padding: 7px 9px; font-weight: 700; }
          .navigation-modes button { flex: 1; background: transparent; color: ${palette.textMuted}; font-size: 11px; }
          .navigation-modes button.active { background: ${palette.surface}; color: ${palette.text}; box-shadow: 0 1px 4px rgba(23,33,43,.16); }
          .navigation-recenter { flex-shrink: 0; background: ${palette.surfaceMuted}; color: ${palette.text}; }
          .navigation-routes { display: flex; gap: 6px; overflow-x: auto; margin-top: 8px; }
          .navigation-route { min-width: 100px; flex: 1; text-align: left; background: ${palette.surfaceMuted}; border: 1px solid ${palette.border} !important; color: ${palette.text}; font-size: 11px; }
          .navigation-route.active { border-color: #64A96A !important; background: ${palette.surface}; }
          .navigation-route span { display: block; margin-top: 2px; color: ${palette.textMuted}; font-size: 10px; }
          .navigation-route span { display: block; margin-top: 2px; color: ${palette.textMuted}; font-size: 10px; }
          .navigation-message { margin: 9px 2px 2px; color: ${palette.textMuted}; font-size: 11px; }
          .navigation-stop { width: 100%; margin-top: 8px; background: ${palette.surfaceMuted}; color: ${palette.text}; }
          .navigation-actions { display: flex; gap: 6px; flex-shrink: 0; }
          .navigation-toggle { width: 38px; background: ${palette.surfaceMuted}; color: ${palette.text}; font-size: 17px; }
          .navigation-panel.compact { padding: 8px 10px; }
          .navigation-panel.compact .navigation-modes, .navigation-panel.compact .navigation-routes { display: none; }
          .navigation-panel.compact .navigation-toggle { background: ${palette.surfaceMuted}; color: ${palette.text}; }
          .navigation-panel.compact .navigation-stop { width: auto; min-height: 30px; display: block; margin: 6px auto 0; padding: 4px 12px; }
          .navigation-actions { display: flex; gap: 6px; flex-shrink: 0; }
          .navigation-toggle { width: 38px; font-size: 0; }
          .navigation-chevron { display: block; width: 8px; height: 8px; margin: 0 auto; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(45deg); transition: transform .16s ease; }
          .navigation-toggle[aria-expanded="false"] .navigation-chevron { transform: rotate(225deg); }
          .navigation-title { display: -webkit-box; overflow: hidden; white-space: normal; overflow-wrap: anywhere; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
          .navigation-stats { line-height: 1.35; overflow-wrap: anywhere; }
          .navigation-routes { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 120px), 1fr)); gap: 7px; overflow: visible; }
          .navigation-route { width: 100%; min-width: 0; min-height: 54px; box-sizing: border-box; }
          @media(max-width:350px) { .navigation-panel { left: 5px; right: 5px; bottom: 8px; padding: 9px; } .navigation-actions { gap: 4px; } .navigation-panel button { padding: 6px 7px; font-size: 10px; } .navigation-toggle { width: 34px; } .navigation-modes button { padding: 7px 3px; font-size: 10px; } .navigation-panel.compact { padding: 7px 9px; } .navigation-panel.compact .navigation-stop { min-height: 28px; } }
          @media(max-width:480px) { .navigation-panel { left: 7px; right: 7px; bottom: 10px; padding: 10px; } .navigation-modes button { padding: 7px 3px; font-size: 10px; } }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <div id="location-panel" class="location-panel"></div>
        <div id="navigation-panel" class="navigation-panel"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          const center = ${JSON.stringify(BINAN_CENTER)};
          const map = L.map('map', { zoomControl: true }).setView(center, 13);
          map.attributionControl.setPrefix(false);
          const focusMapOnBinan = () => {
            map.invalidateSize({ pan: false });
            if (!hasLocatedUser) map.setView(center, 14, { animate: false });
          };
          requestAnimationFrame(() => requestAnimationFrame(focusMapOnBinan));
          window.addEventListener('resize', () => map.invalidateSize({ pan: false }));
          const infoPanel = document.getElementById('location-panel');
          const navigationPanel = document.getElementById('navigation-panel');
          let routeLayers = [];
          let navigationRoutes = [];
          let selectedRouteIndex = 0;
          let activeProfile = 'driving';
          let activeDestination = null;
          let currentPosition = center;
          let hasLocatedUser = false;
          let isNavigating = false;
          let followingUser = true;
          let routeRequestId = 0;
          let lastLocationAccuracy = null;
          let userLocationMarker = null;
          let userAccuracyCircle = null;
          let locationUnavailableMessage = '';
          let selectedCenterId = null;
          const navigationStats = () => navigationPanel.querySelector('.navigation-stats');
          function clearRoute() {
            routeLayers.forEach((layer) => map.removeLayer(layer));
            routeLayers = [];
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
          function formatDistance(meters) {
            return meters < 1000 ? Math.max(0, Math.round(meters)) + ' m' : (meters / 1000).toFixed(1) + ' km';
          }
          function formatDuration(seconds) {
            const minutes = Math.max(1, Math.round(seconds / 60));
            return minutes < 60 ? minutes + ' min' : Math.floor(minutes / 60) + ' hr ' + (minutes % 60) + ' min';
          }
          function updateNavigationStats() {
            const route = navigationRoutes[selectedRouteIndex];
            const stats = navigationStats();
            if (!route || !stats) return;
            const points = route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude]);
            let nearestIndex = 0;
            let nearestDistance = Number.POSITIVE_INFINITY;
            points.forEach((point, index) => {
              const distance = distanceInKm(currentPosition, point);
              if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index; }
            });
            let remainingKm = distanceInKm(currentPosition, points[nearestIndex]);
            for (let index = nearestIndex; index < points.length - 1; index += 1) remainingKm += distanceInKm(points[index], points[index + 1]);
            const remainingRatio = route.distance > 0 ? Math.min(1, remainingKm * 1000 / route.distance) : 0;
            stats.textContent = formatDistance(remainingKm * 1000) + ' remaining · ' + formatDuration(route.duration * remainingRatio) + (lastLocationAccuracy == null ? '' : ' · GPS ±' + Math.round(lastLocationAccuracy) + ' m');
          }
          window.setHANDAUserLocationUnavailable = function(message) {
            locationUnavailableMessage = message;
            const stats = navigationStats();
            if (isNavigating && stats) stats.textContent = message;
          };
          window.updateHANDAUserLocation = function(latitude, longitude, accuracy) {
            const hadLocation = hasLocatedUser;
            currentPosition = [latitude, longitude];
            lastLocationAccuracy = accuracy;
            hasLocatedUser = true;
            if (!userLocationMarker) {
              userLocationMarker = L.circleMarker(currentPosition, { radius: 8, color: '#ffffff', fillColor: '#2563eb', fillOpacity: 1, weight: 3, interactive: false }).addTo(map);
            } else userLocationMarker.setLatLng(currentPosition);
            if (!userAccuracyCircle) {
              userAccuracyCircle = L.circle(currentPosition, { radius: accuracy, color: '#2563eb', fillColor: '#2563eb', fillOpacity: .08, weight: 1, interactive: false }).addTo(map);
            } else {
              userAccuracyCircle.setLatLng(currentPosition);
              userAccuracyCircle.setRadius(accuracy);
            }
            if (!hadLocation) map.setView(currentPosition, 15, { animate: false });
            if (isNavigating && followingUser) map.panTo(currentPosition, { animate: true, duration: .35 });
            if (navigationRoutes.length) updateNavigationStats();
            else if (isNavigating) void loadRoutes();
            if (!isNavigating) {
              const selectedCenter = centers.find((item) => item.id === selectedCenterId);
              if (selectedCenter) showCenter(selectedCenter, distanceInKm(currentPosition, selectedCenter.position));
              else void showNearest(currentPosition);
            }
          };
          function selectRoute(index, fit) {
            if (!navigationRoutes[index]) return;
            selectedRouteIndex = index;
            clearRoute();
            navigationRoutes.forEach((route, routeIndex) => {
              const points = route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude]);
              const selected = routeIndex === index;
              const layer = L.polyline(points, { color: selected ? '#1769AA' : '#8FA6B0', weight: selected ? 7 : 4, opacity: selected ? .95 : .65, dashArray: selected ? null : '7 8' }).addTo(map);
              routeLayers.push(layer);
            });
            navigationPanel.querySelectorAll('[data-route-index]').forEach((button) => button.classList.toggle('active', Number(button.dataset.routeIndex) === index));
            if (fit && routeLayers[index]) map.fitBounds(routeLayers[index].getBounds(), { padding: [45, 45] });
            updateNavigationStats();
            navigationPanel.classList.add('compact');
            const toggle = navigationPanel.querySelector('.navigation-toggle');
            if (toggle) {
              toggle.setAttribute('aria-label', 'Show route options');
              toggle.setAttribute('aria-expanded', 'false');
            }
          }
          async function loadRoutes() {
            const stats = navigationStats();
            if (!activeDestination || !hasLocatedUser || !stats) return;
            ${mapboxToken ? '' : "stats.textContent = 'Directions unavailable. Check map routing configuration.'; return;"}
            const requestId = ++routeRequestId;
            stats.textContent = 'Finding routes…';
            clearRoute();
            try {
              const url = 'https://api.mapbox.com/directions/v5/mapbox/' + activeProfile + '/' + currentPosition[1] + ',' + currentPosition[0] + ';' + activeDestination[1] + ',' + activeDestination[0] + '?alternatives=true&steps=true&geometries=geojson&overview=full&access_token=${mapboxToken}';
              const response = await fetch(url);
              if (!response.ok) throw new Error('Route request failed');
              const result = await response.json();
              if (!isNavigating || requestId !== routeRequestId) return;
              if (result.code !== 'Ok' || !Array.isArray(result.routes) || !result.routes.length) throw new Error('No routes found');
              navigationRoutes = result.routes;
              selectedRouteIndex = 0;
              const routeContainer = navigationPanel.querySelector('.navigation-routes');
              routeContainer.innerHTML = navigationRoutes.map((route, index) => '<button class="navigation-route' + (index === 0 ? ' active' : '') + '" type="button" data-route-index="' + index + '"><strong>Route ' + (index + 1) + '</strong><span>' + formatDistance(route.distance) + ' · ' + formatDuration(route.duration) + '</span></button>').join('');
              routeContainer.querySelectorAll('[data-route-index]').forEach((button) => button.addEventListener('click', () => selectRoute(Number(button.dataset.routeIndex), false)));
              selectRoute(0, true);
            } catch (error) {
              if (isNavigating && requestId === routeRequestId) stats.textContent = 'Could not get road directions. Check your connection and try again.';
            }
          }
          function stopNavigation() {
            isNavigating = false;
            activeDestination = null;
            navigationRoutes = [];
            routeRequestId += 1;
            clearRoute();
            navigationPanel.classList.remove('compact');
            navigationPanel.style.display = 'none';
            infoPanel.style.display = 'block';
          }
          function startNavigation(item) {
            isNavigating = true;
            followingUser = true;
            activeProfile = 'driving';
            activeDestination = item.position;
            navigationPanel.classList.remove('compact');
            navigationPanel.innerHTML = '<div class="navigation-top"><div class="navigation-copy"><span class="navigation-eyebrow">NAVIGATING TO</span><strong class="navigation-title">' + escapeHtml(item.name) + '</strong><span class="navigation-stats">' + (hasLocatedUser ? 'Finding routes…' : locationUnavailableMessage || 'Waiting for a GPS signal…') + '</span></div><div class="navigation-actions"><button class="navigation-recenter" type="button">Recenter</button><button class="navigation-toggle" type="button" aria-label="Minimize route options" aria-expanded="true"><span class="navigation-chevron"></span></button></div></div><div class="navigation-modes"><button type="button" data-profile="walking">On foot</button><button type="button" data-profile="cycling">Two wheels</button><button class="active" type="button" data-profile="driving">Four wheels</button></div><div class="navigation-routes"></div><button class="navigation-stop" type="button">End navigation</button>';
            infoPanel.style.display = 'none';
            navigationPanel.style.display = 'block';
            if (hasLocatedUser) void loadRoutes();
          }
          navigationPanel.addEventListener('click', (event) => {
            const target = event.target;
            const profileButton = target.closest('[data-profile]');
            const toggle = target.closest('.navigation-toggle');
            if (toggle) {
              const isExpanded = navigationPanel.classList.toggle('compact') === false;
              toggle.setAttribute('aria-label', isExpanded ? 'Minimize route options' : 'Show route options');
              toggle.setAttribute('aria-expanded', String(isExpanded));
            }
            else if (target.closest('.navigation-recenter')) { followingUser = true; if (hasLocatedUser) map.setView(currentPosition, Math.max(map.getZoom(), 16), { animate: true }); }
            else if (target.closest('.navigation-stop')) stopNavigation();
            else if (profileButton && profileButton.dataset.profile !== activeProfile) {
              activeProfile = profileButton.dataset.profile;
              navigationPanel.querySelectorAll('[data-profile]').forEach((button) => button.classList.toggle('active', button === profileButton));
              navigationRoutes = [];
              void loadRoutes();
            }
          });
          map.on('dragstart', () => { if (isNavigating) followingUser = false; });
          function showInfo(title, position, detail) {
            infoPanel.style.display = 'block';
            infoPanel.innerHTML = '<strong>' + title + '</strong>' + detail + '<br>Latitude: ' + position[0].toFixed(6) + '<br>Longitude: ' + position[1].toFixed(6);
          }
          function escapeHtml(value) {
            return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
          }
          function showCenter(item, distance) {
            selectedCenterId = item.id;
            const capacity = Math.max(0, Number(item.capacity) || 0);
            const occupancy = Math.max(0, Number(item.current_occupancy) || 0);
            const spaces = Math.max(0, capacity - occupancy);
            const accepting = item.status !== 'closed' && item.status !== 'full' && spaces > 0;
            infoPanel.style.display = 'block';
            infoPanel.innerHTML = '<strong>' + escapeHtml(item.name) + '</strong><span class="center-name">' + escapeHtml(item.location || 'Location not provided') + '</span><span class="muted">Capacity: ' + occupancy + ' of ' + capacity + ' · ' + spaces + ' spaces' + (distance == null ? '' : ' · ' + distance.toFixed(1) + ' km straight-line') + '</span><span class="muted" style="color:' + (accepting ? '#218B25' : '#B42318') + ';font-weight:700">' + (accepting ? 'Accepting registrations' : 'Not accepting registrations') + '</span><button id="navigate-button" class="secondary">Navigate</button><button id="select-center-button" ' + (accepting ? '' : 'disabled') + '>' + (accepting ? 'Select center' : 'Unavailable') + '</button>';
            infoPanel.querySelector('#navigate-button').onclick = () => startNavigation(item);
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
            showCenter(nearest.item, nearest.distance);
          }
          L.tileLayer(${JSON.stringify(tileUrl)}, { attribution: ${JSON.stringify(attribution)}, maxZoom: 19 }).addTo(map);
          const centers = ${JSON.stringify(mappedCenters).replace(/</g, '\\u003c')};
          const evacuationIcon = L.divIcon({ className: 'evacuation-center-icon', html: '<div>⌂</div>', iconSize: [32, 32], iconAnchor: [16, 16] });
          centers.forEach((item) => L.marker(item.position, { icon: evacuationIcon }).addTo(map).on('click', () => {
            if (isNavigating) stopNavigation();
            showCenter(item, hasLocatedUser ? distanceInKm(currentPosition, item.position) : null);
          }));
          async function loadReportedIncidents() {
            try {
              const response = await fetch(${JSON.stringify(API_BASE_URL)} + '/api/v1/incidents');
              if (!response.ok) return;
              const incidents = await response.json();
              incidents.filter((incident) => {
                const status = String(incident.verificationStatus || incident.verification_status || 'confirmed').toLowerCase();
                return incident.latitude != null && incident.longitude != null && ['reported', 'acknowledged', 'in_progress', 'resolved', 'confirmed', 'accepted'].includes(status);
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
        </script>
      </body>
    </html>
  `, [mappedCenters, palette]);

  return (
    <View style={styles.container}>
      {!ready && <ActivityIndicator size="large" color="#218B25" style={styles.loader} />}
      <WebView
        ref={webView}
        source={{ html }}
        style={styles.webView}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
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
    backgroundColor: Colors.surfaceMuted,
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
