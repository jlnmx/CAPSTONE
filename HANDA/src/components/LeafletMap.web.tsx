import React, { useEffect, useRef } from 'react';
import { Colors } from '@constants/colors';
import * as Leaflet from '../vendor/leaflet/LeafletWithGlobals.js';
import '../vendor/leaflet/leaflet.css';
import { MapEvacuationCenter } from '@types/index';

const BINAN_CENTER: [number, number] = [14.3036, 121.0781];
const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
const LeafletApi = (Leaflet as any).default ?? Leaflet;
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
const hasAppLocationPermission = () => typeof window !== 'undefined'
  && (window as Window & { __handaLocationGranted?: boolean }).__handaLocationGranted === true;

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
    let isDisposed = false;
    map.setView(BINAN_CENTER, 14);
    map.attributionControl.setPrefix(false);
    Object.assign(map.attributionControl.getContainer().style, {
      margin: '0 5px 5px 0',
      padding: '2px 5px',
      borderRadius: '3px',
      backgroundColor: 'rgba(255, 255, 255, 0.82)',
      color: '#526052',
      fontSize: '9px',
      lineHeight: '1.3',
    });
    new LeafletApi.TileLayer(
      `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}&tileSize=512`,
      {
        attribution: '&copy; <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener noreferrer">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
      },
    ).addTo(map);

    let userLocationMarker: any = null;
    let userAccuracyCircle: any = null;

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
      color: Colors.text,
      overflowWrap: 'anywhere',
      pointerEvents: 'auto',
      display: 'none',
    });
    mapElement.current.appendChild(infoPanel);
    LeafletApi.DomEvent.disableClickPropagation(infoPanel);

    const navigationPanel = document.createElement('div');
    navigationPanel.className = 'handa-navigation-panel';
    navigationPanel.innerHTML = '<div class="handa-navigation-top"><div class="handa-navigation-copy"><span class="handa-navigation-eyebrow">NAVIGATING TO</span><strong class="handa-navigation-title"></strong><span class="handa-navigation-stats">Finding your location…</span></div><div class="handa-navigation-actions"><button class="handa-recenter" type="button">Recenter</button><button class="handa-navigation-toggle" type="button" aria-label="Minimize route options" aria-expanded="true"><span class="handa-navigation-chevron"></span></button></div></div><div class="handa-navigation-modes"><button type="button" data-profile="walking">On foot</button><button type="button" data-profile="cycling">Two wheels</button><button class="active" type="button" data-profile="driving">Four wheels</button></div><div class="handa-navigation-routes"></div><button class="handa-navigation-stop" type="button">End navigation</button>';
    mapElement.current.appendChild(navigationPanel);
    const navigationStyle = document.createElement('style');
    navigationStyle.textContent = '.handa-navigation-panel{position:absolute;z-index:1000;left:12px;right:12px;bottom:24px;max-width:460px;margin:0 auto;padding:14px;background:#fff;border:1px solid #D7E2EA;border-radius:12px;box-shadow:0 4px 18px rgba(23,33,43,.2);font:14px/1.4 InstrumentSans_400Regular,Arial,sans-serif;color:#17212B;display:none;box-sizing:border-box}.handa-navigation-top{display:flex;align-items:center;justify-content:space-between;gap:12px}.handa-navigation-copy{min-width:0;display:flex;flex-direction:column}.handa-navigation-eyebrow{color:#667085;font-size:10px;font-weight:800;letter-spacing:.7px}.handa-navigation-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:16px}.handa-navigation-stats{color:#175B19;font-size:13px;font-weight:700;margin-top:2px}.handa-navigation-modes{display:flex;gap:4px;padding:4px;margin-top:12px;border-radius:8px;background:#F0F2F5}.handa-navigation-modes button,.handa-recenter,.handa-navigation-route,.handa-navigation-stop{min-height:40px;border:0;border-radius:6px;padding:8px 10px;font:600 12px InstrumentSans_400Regular,Arial,sans-serif;cursor:pointer}.handa-navigation-modes button{flex:1;background:transparent;color:#526052}.handa-navigation-modes button.active{background:#fff;color:#218B25;box-shadow:0 1px 4px rgba(23,33,43,.16)}.handa-recenter{flex-shrink:0;background:#E8F2E8;color:#175B19}.handa-navigation-routes{display:flex;gap:7px;margin-top:9px;overflow-x:auto}.handa-navigation-route{min-width:112px;flex:1;text-align:left;background:#F7F9FA;border:1px solid #D7E2EA;color:#17212B}.handa-navigation-route.active{border-color:#218B25;background:#EDF7EE}.handa-navigation-route strong,.handa-navigation-route span{display:block}.handa-navigation-route span{margin-top:2px;color:#667085;font-size:11px}.handa-navigation-message{margin:10px 2px 2px;color:#667085;font-size:12px}.handa-navigation-stop{width:100%;margin-top:9px;background:#FCEEEE;color:#A52D2D;font-weight:700}@media(max-width:480px){.handa-navigation-panel{left:8px;right:8px;bottom:12px;padding:11px}.handa-navigation-modes button{padding:8px 4px;font-size:11px}.handa-navigation-route{min-width:100px}}';
    document.head.appendChild(navigationStyle);
    const compactNavigationStyle = document.createElement('style');
    compactNavigationStyle.textContent = '.handa-navigation-actions{display:flex;gap:6px;flex-shrink:0}.handa-navigation-toggle{width:40px;min-height:40px;border:0;border-radius:6px;background:#F0F2F5;color:#344054;font-size:18px;cursor:pointer}.handa-navigation-panel.compact{padding:9px 12px}.handa-navigation-panel.compact .handa-navigation-modes,.handa-navigation-panel.compact .handa-navigation-routes{display:none}.handa-navigation-panel.compact .handa-navigation-toggle{background:#E8F2E8;color:#175B19}.handa-navigation-panel.compact .handa-navigation-stop{width:auto;min-height:32px;display:block;margin:7px auto 0;padding:5px 12px}@media(max-width:480px){.handa-navigation-panel.compact{padding:8px 10px}.handa-navigation-panel.compact .handa-navigation-top{gap:6px}.handa-navigation-panel.compact .handa-navigation-title{font-size:14px}.handa-navigation-panel.compact .handa-navigation-stats{font-size:11px}.handa-navigation-toggle,.handa-recenter{min-height:36px;padding:6px 8px}}';
    compactNavigationStyle.textContent += '.handa-navigation-chevron{display:block;width:8px;height:8px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);transition:transform .16s ease}.handa-navigation-toggle[aria-expanded="false"] .handa-navigation-chevron{transform:rotate(225deg)}.handa-navigation-title{white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere}.handa-navigation-stats{line-height:1.35;overflow-wrap:anywhere}.handa-navigation-routes{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,120px),1fr));gap:7px;margin-top:9px;overflow:visible}.handa-navigation-route{width:100%;min-width:0;min-height:54px;box-sizing:border-box}.handa-navigation-route span{overflow-wrap:anywhere}@media(max-width:350px){.handa-navigation-panel{left:5px;right:5px;bottom:8px;padding:9px}.handa-navigation-actions{gap:4px}.handa-navigation-recenter{min-height:34px;padding:6px 7px;font-size:11px}.handa-navigation-toggle{width:34px;min-height:34px}.handa-navigation-modes button{padding:7px 3px;font-size:10px}.handa-navigation-stop{min-height:34px;font-size:11px}.handa-navigation-panel.compact{padding:7px 9px}.handa-navigation-panel.compact .handa-navigation-stop{min-height:28px}}';
    document.head.appendChild(compactNavigationStyle);
    LeafletApi.DomEvent.disableClickPropagation(navigationPanel);

    const escapeHtml = (value: string) =>
      value.replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character]);

    const showInfoPanel = (title: string, content: string) => {
      infoPanel.style.display = 'block';
      infoPanel.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px"><strong style="margin:0;font-size:13px">${escapeHtml(title)}</strong><div style="display:flex;gap:4px;flex-shrink:0"><button id="minimize-info-button" type="button" title="Minimize map details" aria-label="Minimize map details" style="margin:0;padding:3px 8px;border:0;border-radius:4px;background:#E8F2E8;color:#175B19;font-weight:700;cursor:pointer">-</button><button id="close-info-button" type="button" title="Close map details" aria-label="Close map details" style="margin:0;padding:3px 8px;border:0;border-radius:4px;background:#F0F2F5;color:#526052;font-weight:700;cursor:pointer">x</button></div></div><div id="info-panel-content">${content}</div>`;
      const contentElement = infoPanel.querySelector<HTMLElement>('#info-panel-content');
      const minimizeButton = infoPanel.querySelector<HTMLButtonElement>('#minimize-info-button');
      minimizeButton?.addEventListener('click', () => {
        if (!contentElement || !minimizeButton) return;
        const isMinimized = contentElement.style.display === 'none';
        contentElement.style.display = isMinimized ? 'block' : 'none';
        minimizeButton.textContent = isMinimized ? '-' : '+';
        minimizeButton.title = isMinimized ? 'Minimize map details' : 'Restore map details';
        minimizeButton.setAttribute('aria-label', minimizeButton.title);
      });
      infoPanel.querySelector('#close-info-button')?.addEventListener('click', () => {
        infoPanel.style.display = 'none';
      });
    };

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
    let routeLayers: any[] = [];
    let trackedPosition: [number, number] | null = null;
    let navigationDestination: [number, number] | null = null;
    let navigationRoutes: any[] = [];
    let selectedRouteIndex = 0;
    let activeProfile = 'driving';
    let locationWatchId: number | null = null;
    let locationAccuracy = 0;
    let routeRequestId = 0;
    let followingUser = true;
    let isNavigating = false;

    const updateUserLocation = (position: [number, number], accuracy: number) => {
      trackedPosition = position;
      locationAccuracy = accuracy;
      if (!userLocationMarker) {
        userLocationMarker = new LeafletApi.CircleMarker(position, {
          radius: 8,
          color: '#ffffff',
          fillColor: '#2563eb',
          fillOpacity: 1,
          weight: 3,
          interactive: false,
        }).addTo(map);
      } else {
        userLocationMarker.setLatLng(position);
      }
      if (!userAccuracyCircle) {
        userAccuracyCircle = new LeafletApi.Circle(position, accuracy, {
          color: '#2563eb',
          fillColor: '#2563eb',
          fillOpacity: 0.08,
          weight: 1,
          interactive: false,
        }).addTo(map);
      } else {
        userAccuracyCircle.setLatLng(position);
        userAccuracyCircle.setRadius(accuracy);
      }
    };

    const clearRoute = () => {
      routeLayers.forEach((layer) => layer.remove());
      routeLayers = [];
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

    const formatDistance = (meters: number) => meters < 1000 ? `${Math.max(0, Math.round(meters))} m` : `${(meters / 1000).toFixed(1)} km`;
    const formatDuration = (seconds: number) => {
      const minutes = Math.max(1, Math.round(seconds / 60));
      return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
    };
    const navigationStats = navigationPanel.querySelector<HTMLElement>('.handa-navigation-stats');
    const navigationTitle = navigationPanel.querySelector<HTMLElement>('.handa-navigation-title');
    const navigationRoutesElement = navigationPanel.querySelector<HTMLElement>('.handa-navigation-routes');

    const updateNavigationStats = (position: [number, number]) => {
      const route = navigationRoutes[selectedRouteIndex];
      if (!route || !navigationStats) return;
      const coordinates = route.geometry.coordinates.map(([longitude, latitude]: [number, number]) => [latitude, longitude] as [number, number]);
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      coordinates.forEach((coordinate: [number, number], index: number) => {
        const distance = distanceInKm(position, coordinate);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });
      let remainingKm = distanceInKm(position, coordinates[nearestIndex]);
      for (let index = nearestIndex; index < coordinates.length - 1; index += 1) {
        remainingKm += distanceInKm(coordinates[index], coordinates[index + 1]);
      }
      const remainingRatio = route.distance > 0 ? Math.min(1, remainingKm * 1000 / route.distance) : 0;
      navigationStats.textContent = `${formatDistance(remainingKm * 1000)} remaining · ${formatDuration(route.duration * remainingRatio)}${trackedPosition ? ` · GPS ±${Math.round(locationAccuracy)} m` : ''}`;
    };

    const selectRoute = (index: number, fit = false) => {
      if (!navigationRoutes[index]) return;
      selectedRouteIndex = index;
      clearRoute();
      navigationRoutes.forEach((route, routeIndex) => {
        const coordinates = route.geometry.coordinates.map(([longitude, latitude]: [number, number]) => [latitude, longitude] as [number, number]);
        const selected = routeIndex === selectedRouteIndex;
        const layer = new LeafletApi.Polyline(coordinates, {
          color: selected ? '#1769AA' : '#8FA6B0',
          weight: selected ? 7 : 4,
          opacity: selected ? 0.95 : 0.65,
          dashArray: selected ? undefined : '7 8',
        }).addTo(map);
        routeLayers.push(layer);
      });
      navigationRoutesElement?.querySelectorAll<HTMLButtonElement>('[data-route-index]').forEach((button) => {
        button.classList.toggle('active', Number(button.dataset.routeIndex) === selectedRouteIndex);
      });
      if (fit && routeLayers[index]) map.fitBounds(routeLayers[index].getBounds(), { padding: [48, 48] });
      if (trackedPosition) updateNavigationStats(trackedPosition);
      navigationPanel.classList.add('compact');
      const toggle = navigationPanel.querySelector<HTMLButtonElement>('.handa-navigation-toggle');
      if (toggle) {
        toggle.setAttribute('aria-label', 'Show route options');
        toggle.setAttribute('aria-expanded', 'false');
      }
    };

    const loadRoutes = async () => {
      if (!trackedPosition || !navigationDestination || !navigationStats) return;
      if (!mapboxToken) {
        navigationStats.textContent = 'Directions unavailable. Check the map routing configuration.';
        return;
      }
      const requestId = ++routeRequestId;
      navigationStats.textContent = 'Finding routes…';
      clearRoute();
      try {
        const start = trackedPosition;
        const destination = navigationDestination;
        const url = `https://api.mapbox.com/directions/v5/mapbox/${activeProfile}/${start[1]},${start[0]};${destination[1]},${destination[0]}?alternatives=true&steps=true&geometries=geojson&overview=full&access_token=${mapboxToken}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Route request failed');
        const result = await response.json();
        if (isDisposed || requestId !== routeRequestId) return;
        if (result.code !== 'Ok' || !Array.isArray(result.routes) || result.routes.length === 0) throw new Error('No routes found');
        navigationRoutes = result.routes;
        selectedRouteIndex = 0;
        if (navigationRoutesElement) {
          navigationRoutesElement.innerHTML = navigationRoutes.map((route: any, index: number) => `<button class="handa-navigation-route${index === 0 ? ' active' : ''}" type="button" data-route-index="${index}" aria-label="Route ${index + 1}, ${formatDistance(route.distance)}, ${formatDuration(route.duration)}"><strong>Route ${index + 1}</strong><span>${formatDistance(route.distance)} · ${formatDuration(route.duration)}</span></button>`).join('');
          navigationRoutesElement.querySelectorAll<HTMLButtonElement>('[data-route-index]').forEach((button) => {
            button.addEventListener('click', () => selectRoute(Number(button.dataset.routeIndex)));
          });
        }
        selectRoute(0, true);
      } catch {
        if (!isDisposed && requestId === routeRequestId) navigationStats.textContent = 'Could not get road directions. Check your connection and try again.';
      }
    };

    const startLocationWatch = () => {
      if (!hasAppLocationPermission()) {
        if (navigationStats) navigationStats.textContent = 'Allow location access from the app startup dialog before navigating.';
        return;
      }
      if (!navigator.geolocation) {
        if (navigationStats) navigationStats.textContent = 'Location is unavailable in this browser.';
        return;
      }
      if (locationWatchId != null) return;
      locationWatchId = navigator.geolocation.watchPosition((position) => {
        if (isDisposed) return;
        const previousPosition = trackedPosition;
        const nextPosition: [number, number] = [position.coords.latitude, position.coords.longitude];
        updateUserLocation(nextPosition, position.coords.accuracy);
        if (!previousPosition) {
          map.setView(nextPosition, 15, { animate: false });
          void updateInfoPanel({ lat: nextPosition[0], lng: nextPosition[1] });
        }
        if (isNavigating && followingUser) map.panTo(trackedPosition, { animate: true, duration: 0.35 });
        if (isNavigating && navigationRoutes.length > 0) updateNavigationStats(trackedPosition);
        else if (isNavigating) void loadRoutes();
      }, () => {
        if (navigationStats) navigationStats.textContent = 'Waiting for a GPS signal…';
      }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 });
    };

    const stopNavigation = () => {
      isNavigating = false;
      navigationDestination = null;
      navigationRoutes = [];
      routeRequestId += 1;
      clearRoute();
      navigationPanel.classList.remove('compact');
      navigationPanel.style.display = 'none';
      infoPanel.style.display = 'block';
    };

    const startNavigation = (center: MapEvacuationCenter, destination: [number, number]) => {
      isNavigating = true;
      navigationDestination = destination;
      followingUser = true;
      activeProfile = 'driving';
      navigationPanel.querySelectorAll<HTMLButtonElement>('[data-profile]').forEach((button) => button.classList.toggle('active', button.dataset.profile === activeProfile));
      navigationPanel.classList.remove('compact');
      navigationTitle && (navigationTitle.textContent = center.name);
      infoPanel.style.display = 'none';
      navigationPanel.style.display = 'block';
      startLocationWatch();
      if (trackedPosition) void loadRoutes();
    };

    navigationPanel.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const toggle = target.closest<HTMLButtonElement>('.handa-navigation-toggle');
      if (toggle) {
        const isExpanded = navigationPanel.classList.toggle('compact') === false;
        toggle.setAttribute('aria-label', isExpanded ? 'Minimize route options' : 'Show route options');
        toggle.setAttribute('aria-expanded', String(isExpanded));
      } else if (target.closest('.handa-recenter')) {
        followingUser = true;
        if (trackedPosition) map.setView(trackedPosition, Math.max(map.getZoom(), 16), { animate: true });
      } else if (target.closest('.handa-navigation-stop')) {
        stopNavigation();
      } else {
        const profileButton = target.closest<HTMLButtonElement>('[data-profile]');
        if (profileButton && profileButton.dataset.profile !== activeProfile) {
          activeProfile = profileButton.dataset.profile ?? 'driving';
          navigationPanel.querySelectorAll<HTMLButtonElement>('[data-profile]').forEach((button) => button.classList.toggle('active', button === profileButton));
          void loadRoutes();
        }
      }
    });
    map.on('dragstart', () => {
      if (isNavigating) followingUser = false;
    });

    const showCenter = (center: MapEvacuationCenter, destination: [number, number], distance?: number) => {
      const capacity = Math.max(0, Number(center.capacity) || 0);
      const occupancy = Math.max(0, Number(center.current_occupancy) || 0);
      const spaces = Math.max(0, capacity - occupancy);
      const acceptingRegistrations = center.status !== 'closed' && center.status !== 'full' && spaces > 0;
      showInfoPanel('Evacuation center', `<strong style="display:block;font-size:16px;margin-bottom:5px">${escapeHtml(center.name)}</strong><span style="display:block;font-size:12px;color:#667085">${escapeHtml(center.location || 'Location not provided')}${distance == null ? '' : ` · ${distance.toFixed(1)} km straight-line`}</span><span style="display:block;font-size:12px;margin-top:6px">Capacity: ${occupancy} of ${capacity} · ${spaces} spaces available</span><span style="display:block;font-size:12px;color:${acceptingRegistrations ? '#218B25' : '#B42318'};font-weight:700;margin-top:2px">${acceptingRegistrations ? 'Accepting registrations' : 'Not accepting registrations'}</span><button id="navigate-button" style="margin-top:10px;margin-right:7px;border:0;border-radius:5px;padding:9px 12px;background:#E8F2E8;color:#175B19;font-weight:700;cursor:pointer">Navigate</button><button id="select-center-button" ${acceptingRegistrations ? '' : 'disabled'} style="margin-top:10px;border:0;border-radius:5px;padding:9px 12px;background:${acceptingRegistrations ? '#218B25' : '#98A29A'};color:#fff;font-weight:700;cursor:${acceptingRegistrations ? 'pointer' : 'not-allowed'}">${acceptingRegistrations ? 'Select center' : 'Unavailable'}</button>`);
      infoPanel.querySelector('#navigate-button')?.addEventListener('click', () => startNavigation(center, destination));
      infoPanel.querySelector('#select-center-button')?.addEventListener('click', () => onSelectCenter?.(center.id));
    };

    const updateInfoPanel = async (position: any) => {
      if (isDisposed) return;
      const userPosition: [number, number] = [position.lat, position.lng];
      const nearest = findNearestCenter(userPosition);
      if (!nearest.item) {
        showInfoPanel('Evacuation centers', '<strong>No evacuation centers available on the map.</strong>');
        clearRoute();
        return;
      }
      showCenter(nearest.item.center, nearest.item.position, nearest.distance);
      clearRoute();
    };

    const loadReportedIncidents = async () => {
      try {
        if (isDisposed) return;
        reportedMarkers.forEach((reportedMarker) => reportedMarker.remove());
        reportedMarkers = [];
        const response = await fetch(`${API_BASE_URL}/api/v1/incidents`);
        if (!response.ok || isDisposed) return;
        const incidents = await response.json() as Array<Record<string, unknown>>;
        if (isDisposed) return;
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
              showInfoPanel('Incident report', `<strong style="display:block;font-size:16px;margin-bottom:5px;color:${color}">Incident report</strong><span style="display:block;font-size:14px;font-weight:700">${escapeHtml(String(incident.type ?? 'Incident'))}</span><span style="display:block;font-size:12px;color:${color};margin-top:3px">${escapeHtml(String(incident.severity ?? 'Medium'))} severity · ${escapeHtml(status.replace('_', ' '))}</span><span style="display:block;font-size:12px;line-height:1.5;margin-top:6px">${escapeHtml(String(incident.description ?? 'No description provided.'))}</span>${actionNotes ? `<span style="display:block;font-size:12px;line-height:1.5;margin-top:6px;color:#218B25">Action: ${escapeHtml(actionNotes)}</span>` : ''}`);
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
        if (isNavigating) stopNavigation();
        clearRoute();
        const selected = mappedCenters[index];
        showCenter(selected.center, selected.position, trackedPosition ? distanceInKm(trackedPosition, selected.position) : undefined);
      });
    });

    const requestCurrentPosition = () => {
      if (!hasAppLocationPermission() || !navigator.geolocation) {
        map.setView(BINAN_CENTER, 14);
        return;
      }
      navigator.geolocation.getCurrentPosition((position) => {
        if (isDisposed) return;
        const currentPosition: [number, number] = [position.coords.latitude, position.coords.longitude];
        updateUserLocation(currentPosition, position.coords.accuracy);
        map.setView(currentPosition, 15, { animate: false });
        void updateInfoPanel({ lat: currentPosition[0], lng: currentPosition[1] });
      }, () => {
        map.setView(BINAN_CENTER, 14);
      }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 });
    };
    window.addEventListener('handa-location-permission-changed', requestCurrentPosition);
    requestCurrentPosition();

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
        if (!isDisposed) map.invalidateSize();
      });
    resizeObserver?.observe(mapElement.current);

    return () => {
      isDisposed = true;
      resizeObserver?.disconnect();
      window.clearInterval(incidentRefresh);
      window.removeEventListener('handa-location-permission-changed', requestCurrentPosition);
      if (locationWatchId != null && navigator.geolocation) navigator.geolocation.clearWatch(locationWatchId);
      infoPanel.remove();
      navigationPanel.remove();
      navigationStyle.remove();
      compactNavigationStyle.remove();
      destinationMarkers.forEach((destinationMarker) => destinationMarker.remove());
      userLocationMarker?.remove();
      userAccuracyCircle?.remove();
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
    backgroundColor: 'var(--handa-surface-muted, #F0F2F5)',
  },
};
