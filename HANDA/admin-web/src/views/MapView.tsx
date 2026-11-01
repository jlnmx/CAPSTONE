import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, Building2, Clock3, Expand, LocateFixed, MapPin, RefreshCw, Shrink } from 'lucide-react';
import * as Leaflet from '../../../src/vendor/leaflet/Leaflet.js';
import '../../../src/vendor/leaflet/leaflet.css';
import { getCommandMapSnapshot } from '../api';
import type { CenterRecord, IncidentRecord } from '../types';

const BINAN: [number, number] = [14.3036, 121.0781];
const LeafletApi = Leaflet as any;

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

function hasCoordinates(record: { latitude?: number | null; longitude?: number | null }) {
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

export default function MapView() {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapFrame = useRef<HTMLElement | null>(null);
  const mapRef = useRef<any>(null);
  const centerLayer = useRef<any>(null);
  const incidentLayer = useRef<any>(null);
  const incidentMarkers = useRef(new Map<string, any>());
  const [data, setData] = useState<{ incidents: IncidentRecord[]; centers: CenterRecord[] }>({ incidents: [], centers: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showCenters, setShowCenters] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const refresh = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const snapshot = await getCommandMapSnapshot();
      setData(snapshot);
      setLastUpdated(new Date());
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Live map data could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(true), 15_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (!mapElement.current) return undefined;
    const map = new LeafletApi.Map(mapElement.current, { zoomControl: true, minZoom: 11, maxZoom: 19 });
    map.setView(BINAN, 13);
    map.attributionControl.setPrefix(false);
    new LeafletApi.TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
      maxZoom: 19,
    }).addTo(map);
    centerLayer.current = new LeafletApi.LayerGroup().addTo(map);
    incidentLayer.current = new LeafletApi.LayerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      centerLayer.current = null;
      incidentLayer.current = null;
      incidentMarkers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!centerLayer.current || !incidentLayer.current) return;
    centerLayer.current.clearLayers();
    incidentLayer.current.clearLayers();
    incidentMarkers.current.clear();

    data.centers.filter(hasCoordinates).forEach((center) => {
      const marker = new LeafletApi.CircleMarker([center.latitude, center.longitude], {
        radius: 9, color: '#fff', weight: 2, fillColor: centerColors[center.status] || '#737f78', fillOpacity: 0.97,
      }).addTo(centerLayer.current);
      const popup = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = center.name;
      const status = document.createElement('div');
      status.textContent = `${labelStatus(center.status)} · ${center.currentOccupancy.toLocaleString()} / ${center.capacity.toLocaleString()} occupants`;
      popup.append(name, status);
      marker.bindPopup(popup);
    });

    data.incidents.filter((incident) => hasCoordinates(incident) && incident.status.toLowerCase() !== 'resolved').forEach((incident) => {
      const status = incident.status.toLowerCase();
      const marker = new LeafletApi.CircleMarker([incident.latitude, incident.longitude], {
        radius: status === 'reported' ? 10 : 8,
        color: '#fff',
        weight: 2,
        fillColor: incidentColors[status] || '#737f78',
        fillOpacity: 0.96,
        className: status === 'reported' ? 'command-marker-alert' : '',
      }).addTo(incidentLayer.current);
      const popup = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = incident.type;
      const state = document.createElement('div');
      state.textContent = `${labelStatus(status).toUpperCase()} · ${incident.severity || 'medium'} severity`;
      const location = document.createElement('div');
      location.textContent = incident.location || 'Location not provided';
      const detail = document.createElement('div');
      detail.textContent = incident.actionNotes || incident.responseNotes || incident.description;
      popup.append(name, state, location, detail);
      if (incident.reporterContact) {
        const reporter = document.createElement('div');
        reporter.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid #E3EAEE';
        const picture = incident.reporterPicture ?? '';
        const reporterName = incident.reporterName || 'Resident';
        if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(picture)) {
          const img = document.createElement('img');
          img.src = picture;
          img.alt = `${reporterName} profile picture`;
          img.style.cssText = 'width:40px;height:40px;border-radius:50%;object-fit:cover;flex:none';
          reporter.append(img);
        } else {
          const initials = document.createElement('div');
          initials.textContent = reporterName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?';
          initials.style.cssText = 'width:40px;height:40px;border-radius:50%;background:#DCEBDD;color:#1B6B2A;font-weight:800;display:flex;align-items:center;justify-content:center;flex:none';
          reporter.append(initials);
        }
        const info = document.createElement('div');
        const label = document.createElement('div');
        label.textContent = 'Reported by';
        label.style.cssText = 'font-size:10px;color:#768491';
        const strong = document.createElement('strong');
        strong.textContent = reporterName;
        const contact = document.createElement('div');
        contact.textContent = incident.reporterContact;
        info.append(label, strong, contact);
        reporter.append(info);
        popup.append(reporter);
      }
      marker.bindPopup(popup);
      incidentMarkers.current.set(incident.id, marker);
    });

    if (showCenters) centerLayer.current.addTo(mapRef.current);
    else mapRef.current.removeLayer(centerLayer.current);
    if (showIncidents) incidentLayer.current.addTo(mapRef.current);
    else mapRef.current.removeLayer(incidentLayer.current);
  }, [data, showCenters, showIncidents]);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === mapFrame.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const frame = window.requestAnimationFrame(() => mapRef.current?.invalidateSize());
    return () => window.cancelAnimationFrame(frame);
  }, [isFullscreen]);

  const activeIncidents = useMemo(() => data.incidents.filter((incident) => incident.status.toLowerCase() !== 'resolved'), [data.incidents]);
  const visibleIncidents = useMemo(() => [...activeIncidents]
    .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
    .slice(0, 12), [activeIncidents]);
  const geolocatedIncidents = activeIncidents.filter(hasCoordinates).length;
  const geolocatedCenters = data.centers.filter(hasCoordinates).length;
  const unlocatedCount = activeIncidents.length - geolocatedIncidents + data.centers.length - geolocatedCenters;

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
    const marker = incidentMarkers.current.get(incident.id);
    if (!marker || !mapRef.current) return;
    mapRef.current.setView(marker.getLatLng(), Math.max(mapRef.current.getZoom(), 16), { animate: true });
    marker.openPopup();
  }

  return <section className="command-map-view" ref={mapFrame} aria-label="Biñan City live operations map">
    <header className="command-map-toolbar">
      <div className="command-map-title"><span className="map-title-mark"><MapPin size={19} /></span><div><p className="map-kicker">HANDA · FIELD SITUATION</p><h1>Biñan City, Laguna</h1></div></div>
      <div className="command-map-live"><span className={`map-live-dot ${error ? 'map-live-offline' : ''}`} /><span>{error ? 'DATA INTERRUPTED' : loading ? 'CONNECTING' : 'LIVE MONITORING'}</span><small>{lastUpdated ? `${error ? 'Last good update' : 'Updated'} ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : error ? 'No successful sync' : 'Awaiting feed'}</small></div>
      <div className="command-map-actions">
        <button className="map-icon-action" onClick={() => mapRef.current?.setView(BINAN, 13, { animate: true })} aria-label="Center map on Biñan City" title="Center on Biñan"><LocateFixed size={17} /></button>
        <button className="map-icon-action" onClick={() => void refresh(true)} disabled={refreshing} aria-label="Refresh map data" title="Refresh data"><RefreshCw size={16} className={refreshing ? 'map-refreshing' : ''} /></button>
        <button className="map-fullscreen-action" onClick={() => void toggleFullscreen()} title={isFullscreen ? 'Exit fullscreen' : 'Display fullscreen'}>{isFullscreen ? <Shrink size={16} /> : <Expand size={16} />}<span>{isFullscreen ? 'Exit fullscreen' : 'Display fullscreen'}</span></button>
      </div>
    </header>

    {error && <div className="map-error-banner" role="alert"><AlertTriangle size={15} />{error}<button onClick={() => void refresh()}>Retry</button></div>}

    <div className="command-map-body">
      <div className="command-map-canvas-wrap">
        <div ref={mapElement} className="command-map-canvas" aria-label="Map of incidents and evacuation centers in Biñan City" />
        <div className="map-layer-control" aria-label="Map layers">
          <label><input type="checkbox" checked={showIncidents} onChange={(event) => setShowIncidents(event.target.checked)} /><i className="map-legend-dot legend-incident" /><span>Incidents</span><strong>{activeIncidents.length}</strong></label>
          <label><input type="checkbox" checked={showCenters} onChange={(event) => setShowCenters(event.target.checked)} /><i className="map-legend-dot legend-center" /><span>Evacuation centers</span><strong>{data.centers.length}</strong></label>
          <div className="map-status-key"><span><i className="legend-incident" />Needs response</span><span><i className="legend-acknowledged" />Acknowledged</span><span><i className="legend-progress" />Responding</span></div>
        </div>
        {loading && <div className="map-loading-indicator"><span className="loader" />Loading live field data</div>}
        {!loading && geolocatedIncidents + geolocatedCenters === 0 && <div className="map-empty-indicator"><MapPin size={17} /><span>No geolocated records</span><small>Reports without GPS coordinates remain listed at right.</small></div>}
        <div className="map-attribution-note">Map tiles © OpenStreetMap contributors</div>
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