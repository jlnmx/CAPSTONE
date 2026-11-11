import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, Building2, Clock3, Expand, LocateFixed, MapPin, RefreshCw, Shrink, Satellite } from 'lucide-react';
import { getCommandMapSnapshot } from '../api';
import type { CenterRecord, IncidentRecord } from '../types';

const BINAN: [number, number] = [14.3036, 121.0781];
const GOOGLE_MAPS_CALLBACK = '__handaGoogleMapsReady';
const MAP_SNAPSHOT_STORAGE_KEY = 'handa.admin.map.snapshot.v1';
let googleMapsLoad: Promise<any> | null = null;
type MapSnapshot = { incidents: IncidentRecord[]; centers: CenterRecord[] };
type CachedMapSnapshot = { data: MapSnapshot; savedAt: string };

const incidentColors: Record<string, string> = {
  reported: '#d83b36',
  acknowledged: '#f28c28',
  in_progress: '#267da4',
  resolved: '#737f78',
};

const centerColors: Record<string, string> = {
  available: '#24834a',
  limited: '#dc9a2d',
  full: '#c13b32',
  closed: '#737f78',
};

function hasCoordinates<T extends { latitude?: number | null; longitude?: number | null }>(
  record: T,
): record is T & { latitude: number; longitude: number } {
  return Number.isFinite(record.latitude) && Number.isFinite(record.longitude);
}

function labelStatus(status: string) {
  return status.replace(/_/g, ' ');
}

function formatTime(value: string) {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function readCachedMapSnapshot(): CachedMapSnapshot | null {
  try {
    const raw = localStorage.getItem(MAP_SNAPSHOT_STORAGE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedMapSnapshot;
    if (!Array.isArray(cached.data?.incidents) || !Array.isArray(cached.data?.centers)
      || typeof cached.savedAt !== 'string' || Number.isNaN(Date.parse(cached.savedAt))) return null;
    return cached;
  } catch {
    return null;
  }
}

function createCachedMapSnapshot(data: MapSnapshot, savedAt: Date): CachedMapSnapshot {
  return {
    savedAt: savedAt.toISOString(),
    data: {
      incidents: data.incidents.map((incident) => ({
        id: incident.id,
        type: incident.type,
        description: incident.description,
        location: incident.location,
        createdAt: incident.createdAt,
        status: incident.status,
        syncStatus: incident.syncStatus,
        latitude: incident.latitude,
        longitude: incident.longitude,
        severity: incident.severity,
        actionNotes: incident.actionNotes,
        responseNotes: incident.responseNotes,
      })),
      centers: data.centers.map((center) => ({
        id: center.id,
        name: center.name,
        location: center.location,
        capacity: center.capacity,
        currentOccupancy: center.currentOccupancy,
        status: center.status,
        coordinatorName: '',
        contactNumber: '',
        notes: '',
        latitude: center.latitude,
        longitude: center.longitude,
      })),
    },
  };
}

function loadGoogleMaps(apiKey: string) {
  if ((window as any).google?.maps) return Promise.resolve((window as any).google.maps);
  if (googleMapsLoad) return googleMapsLoad;
  googleMapsLoad = new Promise((resolve, reject) => {
    const priorCallback = (window as any)[GOOGLE_MAPS_CALLBACK];
    const script = document.createElement('script');
    let settled = false;
    const timeout = window.setTimeout(() => finish(new Error('Google Maps did not finish loading. Check your connection and API key restrictions, then retry.')), 20_000);
    const finish = (cause?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      delete (window as any)[GOOGLE_MAPS_CALLBACK];
      if (priorCallback) (window as any)[GOOGLE_MAPS_CALLBACK] = priorCallback;
      if (cause) {
        script.remove();
        googleMapsLoad = null;
        reject(cause);
      } else {
        resolve((window as any).google.maps);
      }
    };
    (window as any)[GOOGLE_MAPS_CALLBACK] = () => finish();
    script.async = true;
    script.onerror = () => finish(new Error('Google Maps could not be loaded. Check your connection, API key, and allowed referrers, then retry.'));
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${GOOGLE_MAPS_CALLBACK}&loading=async`;
    document.head.append(script);
  });
  return googleMapsLoad;
}

function popupContent(record: CenterRecord | IncidentRecord, center: boolean) {
  const popup = document.createElement('div');
  popup.className = `map-info-popup ${center ? 'map-info-popup-center' : 'map-info-popup-incident'}`;
  const name = document.createElement('strong');
  name.textContent = center ? (record as CenterRecord).name : (record as IncidentRecord).type;
  name.className = 'map-info-popup-title';
  popup.append(name);
  if (center) {
    const value = record as CenterRecord;
    const status = document.createElement('div');
    status.className = `map-info-popup-status status-${value.status}`;
    status.textContent = labelStatus(value.status);
    const occupancy = document.createElement('div');
    occupancy.className = 'map-info-popup-detail';
    occupancy.textContent = `${value.currentOccupancy.toLocaleString()} of ${value.capacity.toLocaleString()} occupants`;
    popup.append(status, occupancy);
    return popup;
  }
  const incident = record as IncidentRecord;
  const isSos = /sos/i.test(incident.type);
  if (isSos) {
    const alertLabel = document.createElement('span');
    alertLabel.className = 'map-info-popup-sos-label';
    alertLabel.textContent = 'SOS EMERGENCY';
    popup.append(alertLabel);
  }
  const state = document.createElement('div');
  state.className = `map-info-popup-status status-${incident.status.toLowerCase()}`;
  state.textContent = `${labelStatus(incident.status.toLowerCase()).toUpperCase()} · ${incident.severity || 'medium'} severity`;
  const location = document.createElement('div');
  location.className = 'map-info-popup-detail';
  location.textContent = incident.location || 'Location not provided';
  const detail = document.createElement('div');
  detail.className = 'map-info-popup-detail map-info-popup-description';
  detail.textContent = incident.actionNotes || incident.responseNotes || incident.description;
  popup.append(state, location, detail);
  if (incident.reporterContact) {
    const reporter = document.createElement('div');
    reporter.className = 'map-popup-reporter';
    const picture = incident.reporterPicture ?? '';
    const reporterName = incident.reporterName || 'Resident';
    if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(picture)) {
      const img = document.createElement('img');
      img.src = picture;
      img.alt = `${reporterName} profile picture`;
      img.className = 'map-popup-reporter-picture';
      reporter.append(img);
    } else {
      const initials = document.createElement('div');
      initials.textContent = reporterName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?';
      initials.className = 'map-popup-reporter-initials';
      reporter.append(initials);
    }
    const info = document.createElement('div');
    const label = document.createElement('div');
    label.textContent = 'Reported by';
    label.className = 'map-popup-reporter-label';
    const strong = document.createElement('strong');
    strong.textContent = reporterName;
    const contact = document.createElement('div');
    contact.textContent = incident.reporterContact;
    contact.className = 'map-popup-reporter-contact';
    info.append(label, strong, contact);
    reporter.append(info);
    popup.append(reporter);
  }
  return popup;
}

export default function MapView() {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapFrame = useRef<HTMLElement | null>(null);
  const mapRef = useRef<any>(null);
  const mapKind = useRef<'google' | 'offline' | null>(null);
  const incidentMarkers = useRef(new Map<string, any>());
  const centerMarkers = useRef<any[]>([]);
  const googleInfoWindow = useRef<any>(null);
  const [cachedMapSnapshot] = useState(readCachedMapSnapshot);
  const [data, setData] = useState<MapSnapshot>(() => cachedMapSnapshot?.data ?? { incidents: [], centers: [] });
  const [loading, setLoading] = useState(() => navigator.onLine && !cachedMapSnapshot);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => cachedMapSnapshot ? new Date(cachedMapSnapshot.savedAt) : null);
  const [showCenters, setShowCenters] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [mapRetry, setMapRetry] = useState(0);
  const [isSatellite, setIsSatellite] = useState(false);
  const [focusedOfflineMarker, setFocusedOfflineMarker] = useState<string | null>(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || '';

  const refresh = useCallback(async (quiet = false) => {
    if (!navigator.onLine) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const snapshot = await getCommandMapSnapshot();
      setData(snapshot);
      const savedAt = new Date();
      setLastUpdated(savedAt);
      let storageFailed = false;
      try {
        localStorage.setItem(MAP_SNAPSHOT_STORAGE_KEY, JSON.stringify(createCachedMapSnapshot(snapshot, savedAt)));
      } catch {
        storageFailed = true;
      }
      setError(storageFailed ? 'Live map data loaded, but the browser could not save an offline snapshot. Check local storage availability.' : '');
    } catch (cause) {
      if (navigator.onLine) setError(cause instanceof Error ? cause.message : 'Live map data could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!online) {
      setLoading(false);
      setRefreshing(false);
      setError('');
      return undefined;
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(true), 15_000);
    return () => window.clearInterval(interval);
  }, [refresh, online]);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  useEffect(() => {
    if (!online) {
      mapKind.current = 'offline';
      setMapReady(true);
      setMapError('');
      return () => {
        mapKind.current = null;
        setMapReady(false);
      };
    }
    if (!mapElement.current) return undefined;
    let cancelled = false;
    setMapReady(false);
    setMapError('');
    mapRef.current = null;
    mapKind.current = null;
    incidentMarkers.current.clear();
    centerMarkers.current = [];

    const showLoadError = (event: Event) => {
      event.preventDefault();
      setMapError('Google Maps rejected the API key or project configuration. Verify billing, enable Maps JavaScript API, and check allowed referrers.');
    };
    window.addEventListener('handa-google-maps-auth-error', showLoadError);

    const initialize = async () => {
      try {
        if (!apiKey) throw new Error('Google Maps is not configured. Set VITE_GOOGLE_MAPS_API_KEY in the admin-web environment, then reload.');
        const google = await loadGoogleMaps(apiKey);
        if (cancelled || !mapElement.current) return;
        const map = new google.Map(mapElement.current, {
          center: { lat: BINAN[0], lng: BINAN[1] },
          zoom: 13,
          minZoom: 11,
          maxZoom: 19,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;
        mapKind.current = 'google';
        googleInfoWindow.current = new google.InfoWindow({ maxWidth: 300 });
        setMapReady(true);
      } catch (cause) {
        if (!cancelled) setMapError(cause instanceof Error ? cause.message : 'Google Maps could not be initialized. Check the API configuration and retry.');
      }
    };
    void initialize();

    return () => {
      cancelled = true;
      window.removeEventListener('handa-google-maps-auth-error', showLoadError);
      if (mapKind.current === 'google') {
        incidentMarkers.current.forEach((marker) => marker.setMap(null));
        centerMarkers.current.forEach((marker) => marker.setMap(null));
        googleInfoWindow.current?.close();
      }
      mapRef.current = null;
      mapKind.current = null;
      incidentMarkers.current.clear();
      centerMarkers.current = [];
      googleInfoWindow.current = null;
    };
  }, [online, apiKey, mapRetry]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (mapKind.current !== 'google') return;
    const google = (window as any).google?.maps;
    incidentMarkers.current.forEach((marker) => marker.setMap(null));
    centerMarkers.current.forEach((marker) => marker.setMap(null));
    centerMarkers.current = [];
    incidentMarkers.current.clear();

    data.centers.filter(hasCoordinates).forEach((center) => {
      const color = centerColors[center.status] || '#737f78';
      const marker = new google.Marker({ map: showCenters ? mapRef.current : null, position: { lat: center.latitude, lng: center.longitude },
        title: center.name, icon: { path: google.SymbolPath.CIRCLE, scale: 9, fillColor: color, fillOpacity: 0.97, strokeColor: '#fff', strokeWeight: 2 } });
      marker.addListener('click', () => {
        googleInfoWindow.current.setContent(popupContent(center, true));
        googleInfoWindow.current.open({ map: mapRef.current, anchor: marker });
      });
      centerMarkers.current.push(marker);
    });

    data.incidents.filter(hasCoordinates).filter((incident) => incident.status.toLowerCase() !== 'resolved').forEach((incident) => {
      const status = incident.status.toLowerCase();
      const marker = new google.Marker({ map: showIncidents ? mapRef.current : null, position: { lat: incident.latitude, lng: incident.longitude },
        title: incident.type, icon: { path: google.SymbolPath.CIRCLE, scale: status === 'reported' ? 10 : 8, fillColor: incidentColors[status] || '#737f78', fillOpacity: 0.96, strokeColor: '#fff', strokeWeight: 2 } });
      marker.addListener('click', () => {
        googleInfoWindow.current.setContent(popupContent(incident, false));
        googleInfoWindow.current.open({ map: mapRef.current, anchor: marker });
      });
      incidentMarkers.current.set(incident.id, marker);
    });
  }, [data, showCenters, showIncidents, mapReady]);

  useEffect(() => {
    if (!mapReady || mapKind.current !== 'google' || !mapRef.current) return;
    mapRef.current.setMapTypeId(isSatellite ? 'satellite' : 'roadmap');
  }, [isSatellite, mapReady]);

  useEffect(() => {
    const prior = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      window.dispatchEvent(new Event('handa-google-maps-auth-error'));
      if (typeof prior === 'function') prior();
    };
    return () => { (window as any).gm_authFailure = prior; };
  }, []);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === mapFrame.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      if (mapKind.current === 'google') (window as any).google?.maps?.event?.trigger(mapRef.current, 'resize');
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isFullscreen]);

  const activeIncidents = useMemo(() => data.incidents.filter((incident) => incident.status.toLowerCase() !== 'resolved'), [data.incidents]);
  const visibleIncidents = useMemo(() => [...activeIncidents]
    .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
    .slice(0, 12), [activeIncidents]);
  const geolocatedIncidents = activeIncidents.filter(hasCoordinates).length;
  const geolocatedCenters = data.centers.filter(hasCoordinates).length;
  const unlocatedCount = activeIncidents.length - geolocatedIncidents + data.centers.length - geolocatedCenters;
  const offlineLocations = useMemo(() => {
    const records = [
      ...data.centers.filter(hasCoordinates).map((record) => ({
        key: `center:${record.id}`, name: record.name, latitude: record.latitude, longitude: record.longitude,
        color: centerColors[record.status] || '#737f78', kind: 'center' as const, record,
      })),
      ...activeIncidents.filter(hasCoordinates).map((record) => ({
        key: `incident:${record.id}`, name: record.type, latitude: record.latitude, longitude: record.longitude,
        color: incidentColors[record.status.toLowerCase()] || '#737f78', kind: 'incident' as const, record,
      })),
    ];
    if (!records.length) return [];
    const latitudes = records.map((record) => record.latitude);
    const longitudes = records.map((record) => record.longitude);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    const latSpan = maxLat - minLat || 0.001;
    const lngSpan = maxLng - minLng || 0.001;
    return records.map((record) => ({
      ...record,
      x: 8 + ((record.longitude - minLng) / lngSpan) * 84,
      y: 12 + ((maxLat - record.latitude) / latSpan) * 76,
    }));
  }, [data.centers, activeIncidents]);
  const focusedOfflineLocation = offlineLocations.find((location) => location.key === focusedOfflineMarker
    && (location.kind === 'center' ? showCenters : showIncidents));

  async function toggleFullscreen() {
    if (!mapFrame.current) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await mapFrame.current.requestFullscreen();
    } catch {
      setError('Fullscreen is unavailable in this browser.');
    }
  }

  function focusIncident(incident: IncidentRecord) {
    if (!online) {
      setFocusedOfflineMarker(`incident:${incident.id}`);
      return;
    }
    const marker = incidentMarkers.current.get(incident.id);
    if (!marker || !mapRef.current) return;
    const position = marker.getPosition();
    mapRef.current.panTo(position);
    mapRef.current.setZoom(Math.max(mapRef.current.getZoom(), 16));
    googleInfoWindow.current?.setContent(popupContent(data.incidents.find((item) => item.id === incident.id)!, false));
    googleInfoWindow.current?.open({ map: mapRef.current, anchor: marker });
  }

  return <section className="command-map-view" ref={mapFrame} aria-label="Biñan City live operations map">
    <header className="command-map-toolbar">
      <div className="command-map-title"><span className="map-title-mark"><MapPin size={19} /></span><div><p className="map-kicker">HANDA · FIELD SITUATION</p><h1>Biñan City, Laguna</h1></div></div>
      <div className="command-map-live"><span className={`map-live-dot ${error || mapError || !online ? 'map-live-offline' : ''}`} /><span>{!online ? 'OFFLINE · CACHED MARKERS' : error || mapError ? 'DATA INTERRUPTED' : loading ? 'CONNECTING' : 'LIVE MONITORING'}</span><small>{!online ? lastUpdated ? `Cached snapshot · ${lastUpdated.toLocaleString()}` : 'No cached snapshot available' : lastUpdated ? `${error ? 'Last good update' : 'Updated'} ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : error || mapError ? 'No successful sync' : 'Awaiting feed'}</small></div>
      <div className="command-map-actions">
        <button className="map-icon-action" onClick={() => online ? mapRef.current?.panTo({ lat: BINAN[0], lng: BINAN[1] }) : setFocusedOfflineMarker(null)} aria-label={online ? 'Center map on Biñan City' : 'Show all cached markers'} title={online ? 'Center on Biñan' : 'Show all cached markers'}><LocateFixed size={17} /></button>
        <button className="map-icon-action" onClick={() => void refresh(true)} disabled={refreshing} aria-label="Refresh map data" title="Refresh data"><RefreshCw size={16} className={refreshing ? 'map-refreshing' : ''} /></button>
        <button className="map-fullscreen-action" onClick={() => void toggleFullscreen()} title={isFullscreen ? 'Exit fullscreen' : 'Display fullscreen'}>{isFullscreen ? <Shrink size={16} /> : <Expand size={16} />}<span>{isFullscreen ? 'Exit fullscreen' : 'Display fullscreen'}</span></button>
      </div>
    </header>

    {(error || mapError) && <div className="map-error-banner" role="alert"><AlertTriangle size={15} /><span>{[mapError, error].filter(Boolean).join(' ')}</span><button onClick={() => { if (mapError) setMapRetry((value) => value + 1); void refresh(); }}>Retry</button></div>}

    <div className="command-map-body">
      <div className="command-map-canvas-wrap">
        {online ? <div ref={mapElement} className="command-map-canvas" aria-label="Map of incidents and evacuation centers in Biñan City" /> : <div className="command-map-canvas map-offline-canvas" role="group" aria-label="Offline cached incident and evacuation center markers; no basemap">
          <div className="map-offline-caption">OFFLINE · CACHED MARKERS ONLY · NO BASEMAP</div>
          {offlineLocations.filter((location) => location.kind === 'center' ? showCenters : showIncidents).map((location) => <button
            type="button"
            key={location.key}
            className={`map-offline-marker ${location.kind === 'center' ? 'map-offline-marker-center' : 'map-offline-marker-incident'} ${focusedOfflineMarker === location.key ? 'is-selected' : ''}`}
            style={{ left: `${location.x}%`, top: `${location.y}%`, '--marker-color': location.color } as React.CSSProperties}
            onClick={() => setFocusedOfflineMarker(location.key)}
            aria-label={`${location.kind === 'center' ? 'Evacuation center' : 'Incident'}: ${location.name}`}
            title={location.name}
          ><span /></button>)}
          {focusedOfflineLocation && <div className="map-offline-popup" role="status">
            <button type="button" className="map-offline-popup-close" onClick={() => setFocusedOfflineMarker(null)} aria-label="Close marker details">×</button>
            <strong>{focusedOfflineLocation.name}</strong>
            {focusedOfflineLocation.kind === 'center' ? <><span>{labelStatus(focusedOfflineLocation.record.status)}</span><span>{focusedOfflineLocation.record.currentOccupancy.toLocaleString()} / {focusedOfflineLocation.record.capacity.toLocaleString()} occupants</span></> : <><span>{labelStatus(focusedOfflineLocation.record.status).toUpperCase()} · {focusedOfflineLocation.record.severity || 'medium'} severity</span><span>{focusedOfflineLocation.record.location || 'Location not provided'}</span><span>{focusedOfflineLocation.record.actionNotes || focusedOfflineLocation.record.responseNotes || focusedOfflineLocation.record.description}</span></>}
          </div>}
        </div>}
        {online && <div className="map-maptype-control">
          <button type="button" className={`map-satellite-action ${isSatellite ? 'is-active' : ''}`} onClick={() => setIsSatellite((value) => !value)} disabled={!mapReady || mapKind.current !== 'google'} aria-pressed={isSatellite} title={isSatellite ? 'Switch to road map' : 'Switch to satellite map'}>
            <Satellite size={14} /><span>{isSatellite ? 'Road' : 'Satellite'}</span>
          </button>
        </div>}
        <div className="map-layer-control" aria-label="Map layers">
          <label><input type="checkbox" checked={showIncidents} onChange={(event) => setShowIncidents(event.target.checked)} /><i className="map-legend-dot legend-incident" /><span>Incidents</span><strong>{activeIncidents.length}</strong></label>
          <label><input type="checkbox" checked={showCenters} onChange={(event) => setShowCenters(event.target.checked)} /><i className="map-legend-dot legend-center" /><span>Evacuation centers</span><strong>{data.centers.length}</strong></label>
          <div className="map-status-key"><span><i className="legend-incident" />Needs response</span><span><i className="legend-acknowledged" />Acknowledged</span><span><i className="legend-progress" />Responding</span></div>
        </div>
        {loading && <div className="map-loading-indicator"><span className="loader" />Loading live field data</div>}
        {!loading && geolocatedIncidents + geolocatedCenters === 0 && <div className="map-empty-indicator"><MapPin size={17} /><span>{!online && data.incidents.length + data.centers.length === 0 ? 'No cached map records' : 'No geolocated records'}</span><small>{!online && data.incidents.length + data.centers.length === 0 ? 'Connect to refresh and save locations for offline use.' : 'Reports without GPS coordinates remain listed at right.'}</small></div>}
      </div>

      <aside className="command-map-rail">
        <div className="map-rail-stats">
          <div><span>ACTIVE INCIDENTS</span><strong className={activeIncidents.length ? 'stat-emergency' : ''}>{activeIncidents.length.toString().padStart(2, '0')}</strong></div>
          <div><span>CENTERS OPEN</span><strong>{data.centers.filter((center) => center.status !== 'closed').length.toString().padStart(2, '0')}</strong></div>
          <div><span>UNLOCATED</span><strong className={unlocatedCount ? 'stat-warning' : ''}>{unlocatedCount.toString().padStart(2, '0')}</strong></div>
        </div>
        <div className="map-feed-heading"><div><p className="map-kicker">FIELD ACTIVITY</p><h2>Incident feed</h2></div><span><Activity size={14} /> Auto refresh · 15s</span></div>
        <div className="map-incident-feed">
          {visibleIncidents.length ? visibleIncidents.map((incident) => {
            const status = incident.status.toLowerCase();
            const located = hasCoordinates(incident);
            return <button type="button" className={`map-incident-row ${located ? '' : 'map-incident-unlocated'}`} key={incident.id} onClick={() => focusIncident(incident)} disabled={!located}>
              <span className="map-incident-marker" style={{ '--incident-color': incidentColors[status] || '#737f78' } as React.CSSProperties}><AlertTriangle size={15} /></span>
              <span className="map-incident-copy"><strong>{incident.type}</strong><small><MapPin size={11} />{incident.location || 'Location not provided'}</small><span><Clock3 size={11} />{formatTime(incident.createdAt)}</span></span>
              <span className={`map-incident-status status-${status}`}>{labelStatus(status)}</span>
            </button>;
          }) : <div className="map-feed-empty"><AlertTriangle size={17} /><span>No incidents reported</span><small>New reports will appear here automatically.</small></div>}
        </div>
        <footer className="map-rail-footer"><Building2 size={14} /><span>{geolocatedCenters} of {data.centers.length} centers have map coordinates</span><span className="map-footer-divider" /><span>{geolocatedIncidents} of {data.incidents.length} incidents mapped</span></footer>
      </aside>
    </div>
  </section>;
}