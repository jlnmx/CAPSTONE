import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import * as Leaflet from '../vendor/leaflet/LeafletWithGlobals.js';
import '../vendor/leaflet/leaflet.css';
import { getIncidentReporterContacts, getResponderData, IncidentReporterContact, ResponderDataSnapshot, ResponderIncident, updateIncidentStatus } from '@services/responderData';
import { estimateResponseEta } from '@services/responderEta';
import { incidentStatusColor, incidentStatusLabel } from '@constants/incidentStatus';
import { Colors } from '@constants/colors';
import { useAuth } from '@hooks/useAuth';

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

export default function ResponderLiveMap() {
  const { user } = useAuth();
  const mapElement = useRef<HTMLDivElement | null>(null);
  const centerLayer = useRef<any>(null);
  const incidentLayer = useRef<any>(null);
  const startIncidentNavigation = useRef<(name: string, position: [number, number]) => void>(() => {});
  const [data, setData] = useState<ResponderDataSnapshot>(EMPTY_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [reporters, setReporters] = useState<Record<string, IncidentReporterContact>>({});

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        const [snapshot, contacts] = await Promise.all([getResponderData(), getIncidentReporterContacts().catch(() => null)]);
        if (!mounted) return;
        if (contacts) setReporters(contacts);
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
    const routeRenderer = new LeafletApi.SVG({ padding: 0.35 });
    routeRenderer.addTo(map);

    centerLayer.current = new LeafletApi.LayerGroup().addTo(map);
    incidentLayer.current = new LeafletApi.LayerGroup().addTo(map);

    const navigationPanel = document.createElement('div');
    Object.assign(navigationPanel.style, {
      position: 'absolute', bottom: '12px', left: '12px', right: '12px', zIndex: '1000',
      maxWidth: '460px', margin: '0 auto', padding: '12px', border: '1px solid #D7E2EA',
      borderRadius: '8px', background: '#FFFFFF', boxShadow: '0 4px 18px rgba(23,33,43,.2)',
      color: '#17212B', font: '13px/1.4 Arial, sans-serif', display: 'none', boxSizing: 'border-box',
    });
    mapElement.current.appendChild(navigationPanel);
    LeafletApi.DomEvent.disableClickPropagation(navigationPanel);
    const navigationStyle = document.createElement('style');
    navigationStyle.textContent = `
      .navigation-hud{padding:13px 14px!important;border:1px solid rgba(213,225,232,.92)!important;border-radius:14px!important;background:rgba(255,255,255,.97)!important;box-shadow:0 10px 32px rgba(17,39,54,.22)!important;color:#17212B;font:13px/1.35 InstrumentSans_400Regular,'Avenir Next',sans-serif!important;backdrop-filter:blur(14px)}
      .nav-hud-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
      .nav-head-actions{display:flex;align-items:center;gap:5px}
      .nav-live{display:inline-flex;align-items:center;gap:7px;color:#167A5B;font-size:10px;font-weight:900;letter-spacing:.08em}
      .nav-live i{width:7px;height:7px;border-radius:50%;background:#24A36A;box-shadow:0 0 0 4px rgba(36,163,106,.13);animation:nav-pulse 1.8s ease-out infinite}
      @keyframes nav-pulse{50%{box-shadow:0 0 0 7px rgba(36,163,106,0)}}
      .nav-icon-button{width:30px;height:30px;border:0;border-radius:50%;background:#F0F3F5;color:#526474;font-size:20px;line-height:1;cursor:pointer}
      .nav-minimize-button{width:30px;height:30px;border:0;border-radius:50%;background:#EAF2F8;color:#1769AA;font-size:18px;line-height:1;cursor:pointer}
      .navigation-hud.minimized{padding:8px 11px!important}
      .navigation-hud.minimized .nav-hud-head{margin-bottom:3px}
      .navigation-hud.minimized .nav-destination-sub,.navigation-hud.minimized .nav-guidance,.navigation-hud.minimized .nav-routes,.navigation-hud.minimized .nav-controls,.navigation-hud.minimized .nav-end{display:none}
      .navigation-hud.minimized .nav-destination-copy strong{font-size:13px}
      .navigation-hud.minimized .nav-route-stats{margin-top:5px}
      .nav-destination{display:flex;align-items:center;gap:11px;min-width:0}
      .nav-arrival-arrow{display:grid;place-items:center;flex:none;width:42px;height:42px;border-radius:12px;background:#EAF2F8}
      .nav-arrival-arrow span{width:17px;height:20px;background:linear-gradient(145deg,#1C76B9,#104C78);clip-path:polygon(50% 0,100% 100%,50% 76%,0 100%);filter:drop-shadow(0 2px 2px #8298a8)}
      .nav-destination-copy{display:flex;flex-direction:column;min-width:0}
      .nav-eyebrow{color:#7B8995;font-size:9px;font-weight:900;letter-spacing:.09em}
      .nav-destination-copy strong{overflow:hidden;color:#182B3A;font-size:16px;font-weight:800;text-overflow:ellipsis;white-space:nowrap}
      .nav-destination-sub{color:#768491;font-size:11px}
      .nav-guidance{display:flex;align-items:center;gap:9px;margin-top:12px;padding:10px 11px;border-radius:9px;background:#F1F6FA;color:#254256;font-size:12px;font-weight:700}
      .nav-guidance-icon{display:grid;place-items:center;flex:none;width:25px;height:25px;border-radius:7px;background:#DDECF5;color:#1769AA;font-size:20px}
      .nav-route-stats{display:grid;grid-template-columns:1.2fr 1fr .85fr;gap:7px;margin-top:10px;padding:0 2px}
      .nav-route-stats div{display:flex;flex-direction:column;gap:2px;min-width:0}
      .nav-route-stats span{color:#83909A;font-size:8px;font-weight:900;letter-spacing:.08em}
      .nav-route-stats strong{overflow:hidden;color:#193448;font-size:13px;font-weight:800;text-overflow:ellipsis;white-space:nowrap}
      .nav-routes{display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:7px;margin-top:11px}
      .nav-route-option{min-width:0;padding:8px 9px;border:1px solid #DFE6EA;border-radius:9px;background:#F8FAFB;color:#203847;text-align:left;cursor:pointer;transition:background .15s,border-color .15s,transform .15s}
      .nav-route-option:hover{transform:translateY(-1px);border-color:#8EB6CE}
      .nav-route-option.active{border-color:#2481B4;background:#EDF6FB;box-shadow:inset 0 0 0 1px rgba(36,129,180,.12)}
      .nav-route-top,.nav-route-bottom{display:flex;align-items:center;justify-content:space-between;gap:5px}
      .nav-route-top strong{font-size:11px}.nav-route-top span{color:#75838D;font-size:8px;font-weight:700}
      .nav-route-bottom{justify-content:flex-start;margin-top:4px;color:#526674;font-size:10px;font-weight:700}.nav-route-bottom i{width:3px;height:3px;border-radius:50%;background:#92A1AB}
      .nav-controls{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:11px}
      .nav-control{display:flex;align-items:center;justify-content:center;gap:6px;min-height:38px;border:1px solid #E0E7EA;border-radius:8px;background:#fff;color:#415665;font:700 10px InstrumentSans_400Regular,'Avenir Next',sans-serif;cursor:pointer}
      .nav-control>span:first-child{font-size:16px;line-height:1}
      .nav-control.nav-3d{background:#F1F5F7;color:#314C5D}.nav-control.nav-3d.active{border-color:#1769AA;background:#E9F4FA;color:#125A85}
      .nav-3d-arrow{position:relative;display:block;width:15px;height:17px;perspective:30px}
      .nav-3d-arrow:before{position:absolute;inset:1px 2px 0;content:'';background:linear-gradient(90deg,#1769AA 0 48%,#0B3A63 49% 100%);clip-path:polygon(50% 0,100% 100%,50% 77%,0 100%);filter:drop-shadow(0 2px 1px rgba(11,58,99,.35));transform:rotateX(18deg)}
      .nav-end{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;min-height:34px;margin-top:7px;border:0;border-radius:8px;background:#F3F5F6;color:#65727C;font:700 10px InstrumentSans_400Regular,'Avenir Next',sans-serif;cursor:pointer}
      .nav-end span{color:#A64343;font-size:9px}
      .nav-user-icon{border:0;background:transparent}
      .nav-user-dot{width:18px;height:18px;border:3px solid #fff;border-radius:50%;background:#237DB5;box-shadow:0 2px 7px rgba(15,45,66,.45)}
      .nav-user-arrow{position:relative;width:37px;height:44px;filter:drop-shadow(0 4px 3px rgba(10,36,54,.42))}
      .nav-user-arrow:before{position:absolute;inset:1px 3px 5px;content:'';background:linear-gradient(90deg,#39A5E6 0 48%,#1769AA 49% 100%);clip-path:polygon(50% 0,100% 100%,50% 78%,0 100%)}
      .nav-user-arrow i{position:absolute;left:17px;top:14px;width:3px;height:14px;border-radius:2px;background:#fff;opacity:.9}
      @media(max-width:480px){.navigation-hud{left:8px!important;right:8px!important;bottom:8px!important;padding:10px!important}.nav-destination-copy strong{font-size:14px}.nav-routes{grid-template-columns:repeat(auto-fit,minmax(112px,1fr))}.nav-control{gap:4px;font-size:9px}}
    `;
    document.head.appendChild(navigationStyle);

    let currentPosition: [number, number] | null = null;
    let locationAccuracy = 0;
    let locationWatchId: number | null = null;
    let userMarker: any = null;
    let routeLayers: any[] = [];
    let routes: any[] = [];
    let selectedRouteIndex = 0;
    let currentStepIndex = 0;
    let isThreeDimensional = false;
    let isNavigationMinimized = false;
    let userHeading = 0;
    let destination: { name: string; position: [number, number] } | null = null;
    let routeRequestId = 0;
    let activeRouteRequestId: number | null = null;
    let offRouteUpdates = 0;
    let lastRerouteAt = 0;
    let followUser = true;
    const formatDistance = (meters: number) => meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
    const formatDuration = (seconds: number) => {
      const minutes = Math.max(1, Math.round(seconds / 60));
      return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
    };
    const haversineMeters = (first: [number, number], second: [number, number]) => {
      const radians = Math.PI / 180;
      const latitudeDelta = (second[0] - first[0]) * radians;
      const longitudeDelta = (second[1] - first[1]) * radians;
      const latitude = first[0] * radians;
      const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitude) * Math.cos(second[0] * radians) * Math.sin(longitudeDelta / 2) ** 2;
      return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    };
    const clearRouteLayers = () => {
      routeLayers.forEach((layer) => layer.remove());
      routeLayers = [];
    };
    const nearestRouteDistance = (position: [number, number], route: any) => {
      const points = route.geometry.coordinates as [number, number][];
      return points.reduce((nearest, [longitude, latitude]) => Math.min(nearest, haversineMeters(position, [latitude, longitude])), Number.POSITIVE_INFINITY);
    };
    const routeRemainingMeters = (position: [number, number], route: any) => {
      const points = route.geometry.coordinates.map(([longitude, latitude]: [number, number]) => [latitude, longitude] as [number, number]);
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      points.forEach((point: [number, number], index: number) => {
        const distance = haversineMeters(position, point);
        if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index; }
      });
      let remaining = nearestDistance;
      for (let index = nearestIndex; index < points.length - 1; index += 1) remaining += haversineMeters(points[index], points[index + 1]);
      return Math.min(route.distance, remaining);
    };
    const updateRouteSummary = () => {
      const route = routes[selectedRouteIndex];
      if (!route || !currentPosition) return;
      const remaining = routeRemainingMeters(currentPosition, route);
      const proportion = route.distance > 0 ? Math.min(1, remaining / route.distance) : 0;
      const etaSeconds = route.duration * proportion;
      const distance = navigationPanel.querySelector<HTMLElement>('[data-navigation-distance]');
      const eta = navigationPanel.querySelector<HTMLElement>('[data-navigation-eta]');
      const gps = navigationPanel.querySelector<HTMLElement>('[data-navigation-gps]');
      if (distance) distance.textContent = formatDistance(remaining);
      if (eta) eta.textContent = new Date(Date.now() + etaSeconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (gps) gps.textContent = `±${Math.round(locationAccuracy)} m`;
      const steps = route.legs?.[0]?.steps ?? [];
      while (currentStepIndex < steps.length - 1) {
        const [longitude, latitude] = steps[currentStepIndex].maneuver.location;
        if (haversineMeters(currentPosition, [latitude, longitude]) > 35) break;
        currentStepIndex += 1;
      }
      const turn = navigationPanel.querySelector<HTMLElement>('[data-navigation-turn]');
      if (turn && steps[currentStepIndex]?.maneuver?.instruction) turn.textContent = `Next: ${steps[currentStepIndex].maneuver.instruction}`;
    };
    const drawRoutes = (fit: boolean) => {
      clearRouteLayers();
      routes.forEach((route, index) => {
        const points = route.geometry.coordinates.map(([longitude, latitude]: [number, number]) => [latitude, longitude]);
        const selected = index === selectedRouteIndex;
        routeLayers.push(new LeafletApi.Polyline(points, {
          color: selected ? '#1769AA' : '#90A4AE', weight: selected ? 7 : 4,
          opacity: selected ? 0.95 : 0.65, dashArray: selected ? undefined : '7 8',
          renderer: routeRenderer,
        }).addTo(map));
      });
      if (fit && routeLayers[selectedRouteIndex]) map.fitBounds(routeLayers[selectedRouteIndex].getBounds(), { padding: [48, 48] });
      updateRouteSummary();
    };
    const renderNavigationPanel = (message: string, showRoutes = false) => {
      navigationPanel.style.display = 'block';
      navigationPanel.classList.add('navigation-hud');
      navigationPanel.innerHTML = `<div class="nav-hud-head"><span class="nav-live"><i></i> LIVE ROUTE</span><div class="nav-head-actions"><button type="button" class="nav-minimize-button" data-navigation-action="minimize" aria-label="${isNavigationMinimized ? 'Restore navigation' : 'Minimize navigation'}" title="${isNavigationMinimized ? 'Restore navigation' : 'Minimize navigation'}">${isNavigationMinimized ? '+' : '−'}</button><button type="button" class="nav-icon-button" data-navigation-action="stop" aria-label="End navigation" title="End navigation">×</button></div></div><div class="nav-destination"><div class="nav-arrival-arrow"><span></span></div><div class="nav-destination-copy"><span class="nav-eyebrow">NAVIGATING TO</span><strong>${destination?.name ?? ''}</strong><span class="nav-destination-sub">Biñan City · Incident response</span></div></div><div class="nav-guidance"><span class="nav-guidance-icon">↱</span><span data-navigation-turn>${message || 'Follow the highlighted route'}</span></div><div class="nav-route-stats"><div><span>REMAINING</span><strong data-navigation-distance>--</strong></div><div><span>ARRIVAL</span><strong data-navigation-eta>--</strong></div><div><span>GPS</span><strong data-navigation-gps>Waiting</strong></div></div>${showRoutes ? `<div class="nav-routes">${routes.map((route, index) => `<button type="button" class="nav-route-option${index === selectedRouteIndex ? ' active' : ''}" data-route-index="${index}"><span class="nav-route-top"><strong>Route ${index + 1}</strong><span>${index === 0 ? 'Recommended' : 'Alternative'}</span></span><span class="nav-route-bottom">${formatDistance(route.distance)} <i></i> ${formatDuration(route.duration)}</span></button>`).join('')}</div>` : ''}<div class="nav-controls"><button type="button" class="nav-control nav-3d${isThreeDimensional ? ' active' : ''}" data-navigation-action="3d" aria-pressed="${isThreeDimensional}"><span class="nav-3d-arrow"><i></i></span><span>3D view</span></button><button type="button" class="nav-control nav-recenter" data-navigation-action="recenter"><span>◎</span><span>Recenter</span></button><button type="button" class="nav-control nav-blocked" data-navigation-action="blocked"><span>!</span><span>Road blocked</span></button></div><button type="button" class="nav-end" data-navigation-action="stop"><span>■</span> End navigation</button>`;
      navigationPanel.classList.toggle('minimized', isNavigationMinimized);
      navigationPanel.querySelector('[data-navigation-action="minimize"]')?.addEventListener('click', () => {
        isNavigationMinimized = !isNavigationMinimized;
        renderNavigationPanel('', routes.length > 0);
      });
      navigationPanel.querySelectorAll<HTMLButtonElement>('[data-route-index]').forEach((button) => button.addEventListener('click', () => {
        selectedRouteIndex = Number(button.dataset.routeIndex);
        currentStepIndex = 0;
        drawRoutes(false);
        renderNavigationPanel('', true);
      }));
      navigationPanel.querySelector('[data-navigation-action="recenter"]')?.addEventListener('click', () => {
        followUser = true;
        if (currentPosition) map.setView(currentPosition, Math.max(map.getZoom(), 16), { animate: true });
      });
      navigationPanel.querySelector('[data-navigation-action="blocked"]')?.addEventListener('click', () => {
        offRouteUpdates = 2;
        void loadRoutes('Checking traffic-aware alternatives…', true);
      });
      navigationPanel.querySelector('[data-navigation-action="3d"]')?.addEventListener('click', () => setThreeDimensionalMode(!isThreeDimensional));
      navigationPanel.querySelectorAll('[data-navigation-action="stop"]').forEach((button) => button.addEventListener('click', stopNavigation));
      if (routes[selectedRouteIndex]) updateRouteSummary();
    };
    const setThreeDimensionalMode = (enabled: boolean) => {
      isThreeDimensional = enabled;
      const mapContainer = map.getContainer();
      const mapPane = map.getPane('mapPane');
      mapContainer.style.perspective = enabled ? '1100px' : '';
      mapContainer.style.perspectiveOrigin = '50% 58%';
      if (mapPane) {
        mapPane.style.rotate = enabled ? '26deg 1 0 0' : '';
        mapPane.style.transformOrigin = '50% 62%';
        mapPane.style.transition = 'rotate 260ms ease';
      }
      if (enabled) map.dragging.disable();
      else map.dragging.enable();
      updateUserMarker();
      if (routes[selectedRouteIndex]) renderNavigationPanel('', true);
    };
    const updateUserMarker = () => {
      if (!currentPosition) return;
      const icon = isThreeDimensional
        ? new LeafletApi.DivIcon({ className: 'nav-user-icon', html: `<div class="nav-user-arrow" style="transform:rotate(${userHeading}deg)"><i></i></div>`, iconSize: [42, 48], iconAnchor: [21, 24] })
        : new LeafletApi.DivIcon({ className: 'nav-user-icon', html: '<div class="nav-user-dot"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
      if (!userMarker) userMarker = new LeafletApi.Marker(currentPosition, { icon, interactive: false, keyboard: false }).addTo(map);
      else {
        userMarker.setLatLng(currentPosition);
        userMarker.setIcon(icon);
      }
    };
    const loadRoutes = async (status = 'Finding routes…', chooseAlternative = false) => {
      if (!destination || !currentPosition || activeRouteRequestId !== null) return;
      if (!mapboxToken) {
        renderNavigationPanel('Directions unavailable. Configure the Mapbox token.');
        return;
      }
      const requestId = ++routeRequestId;
      activeRouteRequestId = requestId;
      renderNavigationPanel(status);
      clearRouteLayers();
      try {
        const profile = 'driving-traffic';
        const endpoint = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${currentPosition[1]},${currentPosition[0]};${destination.position[1]},${destination.position[0]}?alternatives=true&steps=true&geometries=geojson&overview=full&access_token=${mapboxToken}`;
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error('Directions request failed');
        const result = await response.json();
        if (requestId !== routeRequestId || !destination) return;
        if (result.code !== 'Ok' || !Array.isArray(result.routes) || result.routes.length === 0) throw new Error('No routes found');
        routes = result.routes;
        activeRouteRequestId = null;
        selectedRouteIndex = chooseAlternative && routes.length > 1 ? 1 : 0;
        currentStepIndex = 0;
        offRouteUpdates = 0;
        lastRerouteAt = Date.now();
        drawRoutes(true);
        renderNavigationPanel('', true);
      } catch {
        if (requestId === routeRequestId) {
          activeRouteRequestId = null;
          renderNavigationPanel('Could not load a route. Check your connection and try again.');
        }
      }
    };
    const stopNavigation = () => {
      destination = null;
      routes = [];
      routeRequestId += 1;
      activeRouteRequestId = null;
      offRouteUpdates = 0;
      clearRouteLayers();
      if (isThreeDimensional) setThreeDimensionalMode(false);
      isNavigationMinimized = false;
      navigationPanel.style.display = 'none';
      if (locationWatchId != null && navigator.geolocation) navigator.geolocation.clearWatch(locationWatchId);
      locationWatchId = null;
    };
    const updateLocation = (latitude: number, longitude: number, accuracy: number, heading: number | null) => {
      currentPosition = [latitude, longitude];
      locationAccuracy = accuracy;
      if (heading != null && Number.isFinite(heading)) userHeading = heading;
      updateUserMarker();
      if (!destination) return;
      if (followUser) map.panTo(currentPosition, { animate: true, duration: 0.3 });
      const route = routes[selectedRouteIndex];
      if (!route) {
        void loadRoutes('GPS fix received · finding route…');
        return;
      }
      updateRouteSummary();
      const nearestMeters = nearestRouteDistance(currentPosition, route);
      offRouteUpdates = nearestMeters > Math.max(70, accuracy * 1.5) ? offRouteUpdates + 1 : 0;
      if (offRouteUpdates >= 2 && Date.now() - lastRerouteAt > 8000) void loadRoutes('You left the route · recalculating…');
    };
    const startNavigation = (name: string, position: [number, number]) => {
      destination = { name, position };
      routes = [];
      selectedRouteIndex = 0;
      followUser = true;
      isNavigationMinimized = false;
      routeRequestId += 1;
      activeRouteRequestId = null;
      currentPosition = null;
      renderNavigationPanel('Acquiring GPS fix…');
      if (!navigator.geolocation) {
        renderNavigationPanel('Location is unavailable in this browser.');
        return;
      }
      const onPosition = (location: GeolocationPosition) => updateLocation(
        location.coords.latitude,
        location.coords.longitude,
        location.coords.accuracy ?? 0,
        location.coords.heading,
      );
      navigator.geolocation.getCurrentPosition(onPosition, (error) => {
        if (currentPosition) return;
        const message = error.code === error.PERMISSION_DENIED
          ? 'Location permission is required to navigate.'
          : 'Waiting for a GPS fix…';
        renderNavigationPanel(message);
      }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 });
      if (locationWatchId == null) locationWatchId = navigator.geolocation.watchPosition(
        onPosition,
        (error) => {
          if (currentPosition) return;
          const message = error.code === error.PERMISSION_DENIED
            ? 'Location permission is required to navigate.'
            : 'GPS signal unavailable · waiting for a fix…';
          renderNavigationPanel(message);
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
      );
    };
    startIncidentNavigation.current = startNavigation;
    map.on('dragstart', () => { if (destination) followUser = false; });

    return () => {
      if (locationWatchId != null && navigator.geolocation) navigator.geolocation.clearWatch(locationWatchId);
      routeRequestId += 1;
      navigationStyle.remove();
      startIncidentNavigation.current = () => {};
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

      data.incidents.filter((incident) => incident.status !== 'resolved' && incident.latitude != null && incident.longitude != null && Number.isFinite(incident.latitude) && Number.isFinite(incident.longitude) && Math.abs(incident.latitude) <= 90 && Math.abs(incident.longitude) <= 180).forEach((incident) => {
        const color = incidentStatusColor(incident.status);
        const marker = new LeafletApi.CircleMarker([incident.latitude, incident.longitude], {
          radius: 11,
          color: '#FFFFFF',
          fillColor: color,
          fillOpacity: 0.95,
          weight: 3,
        }).addTo(incidentLayer.current);
        const popup = document.createElement('div');
        popup.appendChild(makeText('strong', incident.type, { display: 'block', marginBottom: '4px' }));
        popup.appendChild(makeText('div', incidentStatusLabel(incident.status).toUpperCase(), { color, fontWeight: '800' }));
        popup.appendChild(makeText('div', incident.location || 'Location not provided', { marginTop: '4px' }));
        popup.appendChild(makeText('div', incident.description, { marginTop: '4px', maxWidth: '260px', whiteSpace: 'normal' }));
        if (incident.actionNotes) popup.appendChild(makeText('div', `Response: ${incident.actionNotes}`, { marginTop: '5px', color: '#167A5B' }));
        const reporter = reporters[incident.id];
        if (reporter) {
          const row = makeText('div', '', { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #E3EAEE' });
          const picture = reporter.profilePicture ?? '';
          if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(picture)) {
            const img = document.createElement('img');
            img.src = picture;
            img.alt = 'Reporter profile picture';
            img.style.cssText = 'width:40px;height:40px;border-radius:50%;object-fit:cover;flex:none';
            row.appendChild(img);
          } else {
            const initials = reporter.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?';
            row.appendChild(makeText('div', initials, { width: '40px', height: '40px', borderRadius: '50%', background: '#DCEBDD', color: '#1B6B2A', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }));
          }
          const info = document.createElement('div');
          info.appendChild(makeText('div', 'Reported by', { fontSize: '10px', color: '#768491' }));
          info.appendChild(makeText('strong', reporter.name, {}));
          info.appendChild(makeText('div', reporter.mobileNumber, {}));
          row.appendChild(info);
          popup.appendChild(row);
        }
        const navigateButton = makeText('button', 'Navigate here', { display: 'inline-block', marginTop: '9px', border: '0', borderRadius: '4px', padding: '8px 10px', background: '#1769AA', color: '#FFFFFF', fontWeight: '700', cursor: 'pointer' }) as HTMLButtonElement;
        navigateButton.type = 'button';
        navigateButton.addEventListener('click', () => startIncidentNavigation.current(incident.type || 'Incident', [incident.latitude!, incident.longitude!]));
        popup.appendChild(navigateButton);
        const action = nextIncidentAction(incident.status);
        if (incident.status === 'in_progress' && user?.role === 'responder' && incident.verifiedBy !== user.id) {
          popup.appendChild(makeText('div', 'Only the responder who started this response can resolve it.', { marginTop: '8px', fontSize: '11px', color: '#768491' }));
        } else if (action) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = action.label;
          Object.assign(button.style, { marginTop: '9px', border: '0', borderRadius: '4px', padding: '8px 10px', background: '#0B3A63', color: '#FFFFFF', fontWeight: '700', cursor: 'pointer' });
          button.addEventListener('click', async () => {
            button.disabled = true;
            button.textContent = 'Saving...';
            try {
              const eta = action.status === 'acknowledged' ? await estimateResponseEta({ latitude: incident.latitude!, longitude: incident.longitude! }) : null;
              await updateIncidentStatus(incident.id, action.status, eta ? { etaMinutes: eta.minutes } : {});
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
  }, [data, reporters, user?.id, user?.role]);

  return (
    <View style={styles.container}>
      <View style={styles.statusBar}>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#218B25' }]} /><Text style={styles.legendText}>Centers</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: incidentStatusColor('reported') }]} /><Text style={styles.legendText}>Reported</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: incidentStatusColor('acknowledged') }]} /><Text style={styles.legendText}>Acknowledged</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: incidentStatusColor('in_progress') }]} /><Text style={styles.legendText}>In progress</Text></View>
        <View style={styles.statusCopy}>{isLoading ? <ActivityIndicator size="small" color={Colors.secondary} /> : <Text style={[styles.syncStatus, loadError && styles.errorStatus]}>{loadError ? data.unavailableSources.length ? `Partial data · ${data.unavailableSources.join(', ')}` : 'Live data unavailable' : `Live · ${lastUpdated?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}</Text>}</View>
      </View>
      <div ref={mapElement} style={{ width: '100%', height: '100%', minHeight: 280 }} />
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
  map: { flex: 1, minHeight: 280 },
});
