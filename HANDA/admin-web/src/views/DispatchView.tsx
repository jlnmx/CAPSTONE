import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Check, Clock3, MapPin, Radio, RefreshCw, Search, Send, Users, X } from 'lucide-react';
import { dispatchIncident, getDispatchData, updateIncidentStatus } from '../api';
import { EmptyState, InlineNotice, LoadingState, PageHeading } from '../components/UI';
import type { IncidentAssignment, IncidentRecord } from '../types';
import { useResponderLive } from '../responderLive';

const ACTIVE_STATUSES = new Set(['reported', 'acknowledged', 'in_progress']);
const STATUS_ORDER: Record<string, number> = { reported: 0, acknowledged: 1, in_progress: 2 };
const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function distanceKm(from: { latitude?: number | null; longitude?: number | null }, to?: { latitude: number; longitude: number }) {
  if (from.latitude == null || from.longitude == null || !to) return null;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const lat1 = radians(from.latitude);
  const lat2 = radians(to.latitude);
  const deltaLat = lat2 - lat1;
  const deltaLon = radians(to.longitude - from.longitude);
  const arc = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

function locationLabel(incident: IncidentRecord) {
  return incident.location || (incident.latitude != null && incident.longitude != null ? 'Pinned incident location' : 'Location unavailable');
}

function formatDistance(distance: number | null, live?: { location?: { latitude: number; longitude: number } }) {
  if (distance != null) return `${distance < 1 ? Math.round(distance * 1000) + ' m' : distance.toFixed(1) + ' km'} away`;
  if (!live) return 'Offline · no live GPS';
  if (!live.location) return 'Online · waiting for GPS';
  return 'Incident pin unavailable';
}

function DispatchPhotoViewer({ photo, onClose }: { photo: { uri: string; title: string }; onClose: () => void }) {
  return createPortal(<div className="photo-viewer-backdrop incident-photo-viewer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="photo-viewer incident-photo-viewer" role="dialog" aria-modal="true" aria-label={photo.title}>
      <div className="photo-viewer-heading">
        <div><p className="eyebrow">INCIDENT PHOTO</p><h2>{photo.title}</h2></div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close photo viewer"><X size={18} /></button>
      </div>
      <div className="incident-photo-viewer-stage"><img src={photo.uri} alt={photo.title} /></div>
    </section>
  </div>, document.body);
}

export default function DispatchView() {
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [responders, setResponders] = useState<Awaited<ReturnType<typeof getDispatchData>>['responders']>([]);
  const [assignments, setAssignments] = useState<Record<string, IncidentAssignment[]>>({});
  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [incidentSearch, setIncidentSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [incidentSort, setIncidentSort] = useState('newest');
  const [previewPhoto, setPreviewPhoto] = useState<{ uri: string; title: string } | null>(null);
  const [responderSearch, setResponderSearch] = useState('');
  const [responderStatusFilter, setResponderStatusFilter] = useState('all');
  const [responderSort, setResponderSort] = useState('nearest');
  const [selectedResponderIds, setSelectedResponderIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const {
    responders: liveResponders,
    status: realtimeStatus,
    errorMessage: realtimeError,
    apiStatus,
    apiErrorMessage,
  } = useResponderLive();

  const refresh = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getDispatchData();
      const activeIncidents = data.incidents.filter((incident) => ACTIVE_STATUSES.has(incident.status.toLowerCase()));
      setIncidents(activeIncidents);
      setResponders(data.responders);
      setAssignments(data.assignments);
      setSelectedIncidentId((current) => activeIncidents.some((incident) => incident.id === current) ? current : activeIncidents[0]?.id ?? '');
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Dispatch data could not be loaded.');
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
    setSelectedResponderIds([]);
  }, [selectedIncidentId]);

  useEffect(() => {
    if (!previewPhoto) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewPhoto(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [previewPhoto]);

  const filteredIncidents = useMemo(() => {
    const query = incidentSearch.trim().toLowerCase();
    return incidents.filter((item) => {
      if (statusFilter !== 'all' && item.status.toLowerCase() !== statusFilter) return false;
      if (severityFilter !== 'all' && (item.severity || 'medium').toLowerCase() !== severityFilter) return false;
      if (!query) return true;
      return [item.type, item.location, item.description, item.status, item.severity]
        .some((value) => value?.toLowerCase().includes(query));
    }).sort((a, b) => {
      if (incidentSort === 'oldest') return Date.parse(a.createdAt) - Date.parse(b.createdAt);
      if (incidentSort === 'severity') {
        const severityDelta = (SEVERITY_ORDER[(a.severity || 'medium').toLowerCase()] ?? 99)
          - (SEVERITY_ORDER[(b.severity || 'medium').toLowerCase()] ?? 99);
        if (severityDelta) return severityDelta;
      }
      if (incidentSort === 'status') {
        const statusDelta = (STATUS_ORDER[a.status.toLowerCase()] ?? 99) - (STATUS_ORDER[b.status.toLowerCase()] ?? 99);
        if (statusDelta) return statusDelta;
      }
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
  }, [incidents, incidentSearch, statusFilter, severityFilter, incidentSort]);

  useEffect(() => {
    if (!filteredIncidents.some((item) => item.id === selectedIncidentId)) {
      setSelectedIncidentId(filteredIncidents[0]?.id ?? '');
    }
  }, [filteredIncidents, selectedIncidentId]);

  const incident = filteredIncidents.find((item) => item.id === selectedIncidentId) ?? filteredIncidents[0];
  const assigned = incident ? assignments[incident.id] ?? [] : [];
  const assignedIds = useMemo(() => new Set(assigned.map((item) => item.responder_id)), [assigned]);
  const sortedResponders = useMemo(() => [...responders].map((responder) => {
    const live = liveResponders[responder.id];
    const distance = incident
      ? distanceKm(incident, live?.location)
      : null;
    return { responder, live, distance };
  }).sort((a, b) => {
    if (responderSort === 'name') return a.responder.name.localeCompare(b.responder.name);
    if (responderSort === 'online') {
      const onlineDelta = Number(Boolean(b.live)) - Number(Boolean(a.live));
      if (onlineDelta) return onlineDelta;
    }
    if (a.distance != null && b.distance != null) return a.distance - b.distance || a.responder.name.localeCompare(b.responder.name);
    if (a.distance != null) return -1;
    if (b.distance != null) return 1;
    if (a.live?.location && !b.live?.location) return -1;
    if (b.live?.location && !a.live?.location) return 1;
    return a.responder.name.localeCompare(b.responder.name);
  }), [responders, liveResponders, incident, responderSort]);
  const filteredResponders = useMemo(() => {
    const query = responderSearch.trim().toLowerCase();
    return sortedResponders.filter(({ responder, live }) => {
      if (responderStatusFilter === 'online' && !live) return false;
      if (responderStatusFilter === 'offline' && live) return false;
      if (!query) return true;
      return [
        responder.name,
        responder.responder_organization,
        responder.responder_barangay,
        live?.location?.city,
        live?.location?.barangay,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [sortedResponders, responderSearch, responderStatusFilter]);
  const onlineResponderCount = responders.filter((responder) => liveResponders[responder.id]).length;

  const toggleResponder = (responderId: string) => {
    setSelectedResponderIds((current) => current.includes(responderId)
      ? current.filter((id) => id !== responderId)
      : [...current, responderId]);
    setNotice('');
  };

  const submitDispatch = async () => {
    if (!incident || selectedResponderIds.length === 0 || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await dispatchIncident(incident.id, selectedResponderIds);
      setNotice(`${result.responders.length} responder${result.responders.length === 1 ? '' : 's'} dispatched to ${incident.type}.`);
      setSelectedResponderIds([]);
      await refresh(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Responders could not be dispatched.');
    } finally {
      setBusy(false);
    }
  };

  const resolveIncident = async () => {
    if (!incident || busy) return;
    setBusy(true);
    setError('');
    try {
      await updateIncidentStatus(incident.id, 'resolved');
      setNotice(`${incident.type} marked resolved.`);
      await refresh(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Incident status could not be updated.');
    } finally {
      setBusy(false);
    }
  };

  const markIncidentInProgress = async () => {
    if (!incident || busy) return;
    setBusy(true);
    setError('');
    try {
      await updateIncidentStatus(incident.id, 'in_progress');
      setNotice(`${incident.type} marked in progress.`);
      await refresh(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Incident status could not be updated.');
    } finally {
      setBusy(false);
    }
  };

  const realtimeMessage = apiStatus === 'ready'
    ? realtimeStatus === 'SUBSCRIBED'
      ? 'Responder status and GPS are live (API backup active)'
      : 'Responder status and GPS refresh through HANDA API'
    : apiStatus === 'error'
      ? 'Responder live status is unavailable; retrying'
      : 'Connecting to live responder status';

  return <div className="page-content dispatch-page">
    <PageHeading eyebrow="FIELD OPERATIONS" title="Dispatch responders" description="Select an active incident, then choose active responders to deploy. Responders are ordered by their latest live GPS position relative to the incident." action={<button className="button-secondary" onClick={() => void refresh(true)} disabled={loading || refreshing}><RefreshCw size={15} /> Refresh</button>} />
    {error && <InlineNotice tone="error" onRetry={() => void refresh()}>{error}</InlineNotice>}
    {notice && <InlineNotice tone="success">{notice}</InlineNotice>}
    <div className={`dispatch-live-banner ${apiStatus === 'ready' ? 'dispatch-live-on' : ''}`}>
      <span className="dispatch-live-dot" />
      <span>{realtimeMessage}</span>
      {apiStatus === 'ready' && <small>Heartbeat every 15s · offline after 45s without a check-in · GPS hidden when its fix is over 60s old</small>}
      {apiStatus === 'error' && <small>{apiErrorMessage || realtimeError}</small>}
    </div>

    {loading ? <LoadingState label="Loading incidents and active responders" /> : <div className="dispatch-workspace">
      <section className="surface-panel dispatch-incident-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">INCIDENT CONTROL</p><h2>Active incidents</h2><p className="panel-subtitle">Select an incident to review its details and dispatch responders.</p></div>
          <span className="dispatch-count"><Activity size={15} /> {filteredIncidents.length} / {incidents.length}</span>
        </div>
        <div className="dispatch-incident-filters">
          <label className="form-field dispatch-search-field"><span>Search incidents</span><span className="dispatch-search-input"><Search size={15} /><input type="search" placeholder="Type, location, or details" value={incidentSearch} onChange={(event) => setIncidentSearch(event.target.value)} /></span></label>
          <label className="form-field"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All active statuses</option>
            <option value="reported">Reported</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="in_progress">In progress</option>
          </select></label>
          <label className="form-field"><span>Severity</span><select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
            <option value="all">All severity levels</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select></label>
          <label className="form-field"><span>Sort by</span><select value={incidentSort} onChange={(event) => setIncidentSort(event.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="severity">Highest severity</option>
            <option value="status">Status</option>
          </select></label>
          {(incidentSearch || statusFilter !== 'all' || severityFilter !== 'all' || incidentSort !== 'newest') && <button className="button-secondary dispatch-clear-filters" onClick={() => { setIncidentSearch(''); setStatusFilter('all'); setSeverityFilter('all'); setIncidentSort('newest'); }}>Clear filters</button>}
        </div>

        {incidents.length === 0
          ? <EmptyState title="No active incidents" detail="New reports will appear here for response planning." />
          : filteredIncidents.length === 0
            ? <EmptyState title="No incidents match these filters" detail="Try changing your search or clearing one or more filters." />
            : <div className="dispatch-incident-grid">
              {filteredIncidents.map((item) => {
                const selected = incident?.id === item.id;
                const severity = (item.severity || 'medium').toLowerCase();
                return <button
                  type="button"
                  className={`dispatch-incident-card ${selected ? 'is-selected' : ''} severity-${severity}`}
                  key={item.id}
                  onClick={() => { setSelectedIncidentId(item.id); setSelectedResponderIds([]); setNotice(''); }}
                  aria-pressed={selected}
                >
                  <span className="dispatch-card-topline">
                    <span className={`dispatch-status-pill status-${item.status.toLowerCase()}`}>{item.status.replace(/_/g, ' ')}</span>
                    <span className={`dispatch-severity severity-text-${severity}`}>{severity}</span>
                  </span>
                  <strong className="dispatch-card-title">{item.type}</strong>
                  <span className="dispatch-card-location"><MapPin size={14} />{locationLabel(item)}</span>
                  <span className="dispatch-card-description">{item.description || 'No additional details provided.'}</span>
                  <span className="dispatch-card-time"><Clock3 size={13} />{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Time unavailable'}</span>
                </button>;
              })}
            </div>}

        {incident && <div className="dispatch-selected-incident">
          <div className="dispatch-selected-heading">
            <div><p className="eyebrow">SELECTED INCIDENT</p><h3>{incident.type}</h3></div>
            <div className="dispatch-selected-actions">
              {incident.status === 'acknowledged' && assigned.length > 0 && <button className="button-secondary" onClick={() => void markIncidentInProgress()} disabled={busy}><Activity size={15} /> Mark in progress</button>}
              {incident.status === 'in_progress' && <button className="button-danger" onClick={() => void resolveIncident()} disabled={busy}><Check size={15} /> Mark resolved</button>}
            </div>
          </div>
          <p className="dispatch-incident-location"><MapPin size={15} /> {locationLabel(incident)}</p>
          {incident.latitude != null && incident.longitude != null && <small className="dispatch-coordinates">{incident.latitude.toFixed(5)}, {incident.longitude.toFixed(5)}</small>}
          <p className="dispatch-description">{incident.description || 'No additional details provided.'}</p>
          {[
            { title: 'Resident photos', photos: incident.photoUris ?? [] },
            { title: 'Responder photos', photos: incident.responsePhotoUris ?? [] },
          ].map((group) => <section className="dispatch-incident-photo-section" key={group.title}>
            <div className="incident-overview-section-heading"><h3>{group.title}</h3><span>{group.photos.length}</span></div>
            {group.photos.length ? <div className="incident-overview-photos">
              {group.photos.map((uri, index) => <button
                type="button"
                key={`${group.title}-${index}`}
                onClick={() => setPreviewPhoto({ uri, title: `${incident.type} · ${group.title} ${index + 1}` })}
                aria-label={`View ${group.title.toLowerCase()} photo ${index + 1}`}
              ><img src={uri} alt={`${group.title} ${index + 1}`} loading="lazy" /></button>)}
            </div> : <p className="dispatch-no-photos">No {group.title.toLowerCase()} uploaded.</p>}
          </section>)}
          <div className="dispatch-assignment-section">
            <div className="dispatch-assignment-heading"><strong>Currently dispatched</strong><span>{assigned.length}</span></div>
            {assigned.length ? assigned.map((assignment) => <div className="dispatch-assignment-row" key={assignment.responder_id}><span className="dispatch-assignment-mark"><Check size={13} /></span><span><strong>{assignment.name}</strong><small>{assignment.responder_organization || 'Responder'}</small></span><span className="dispatch-assignment-status">Deployed</span></div>) : <p className="dispatch-no-assignment">No responders deployed to this incident yet.</p>}
          </div>
        </div>}
      </section>

      <section className="surface-panel dispatch-roster-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">AVAILABLE PERSONNEL</p><h2>Active responders</h2><p className="panel-subtitle">Online status and the latest shared location are shown below.</p></div>
          <div className="dispatch-responder-summary"><span className="dispatch-count"><Users size={15} /> {filteredResponders.length} / {responders.length}</span><span className="dispatch-online-summary"><i /> {onlineResponderCount} online</span></div>
        </div>
        {incident && incident.latitude != null && incident.longitude != null && <p className="dispatch-sort-note"><MapPin size={14} /> Distances are measured from the selected incident. Responders without fresh GPS appear last.</p>}
        <div className="dispatch-responder-filters">
          <label className="form-field dispatch-search-field"><span>Search responders</span><span className="dispatch-search-input"><Search size={15} /><input type="search" placeholder="Name, organization, or location" value={responderSearch} onChange={(event) => setResponderSearch(event.target.value)} /></span></label>
          <label className="form-field"><span>Availability</span><select value={responderStatusFilter} onChange={(event) => setResponderStatusFilter(event.target.value)}>
            <option value="all">Online and offline</option>
            <option value="online">Online only</option>
            <option value="offline">Offline only</option>
          </select></label>
          <label className="form-field"><span>Sort by</span><select value={responderSort} onChange={(event) => setResponderSort(event.target.value)}>
            <option value="nearest">Nearest to incident</option>
            <option value="online">Online first</option>
            <option value="name">Name A–Z</option>
          </select></label>
          {(responderSearch || responderStatusFilter !== 'all' || responderSort !== 'nearest') && <button className="button-secondary dispatch-clear-filters" onClick={() => { setResponderSearch(''); setResponderStatusFilter('all'); setResponderSort('nearest'); }}>Clear filters</button>}
        </div>
        {responders.length === 0
          ? <EmptyState title="No active responders" detail="Active responder accounts will appear here when available." />
          : filteredResponders.length === 0
            ? <EmptyState title="No responders match these filters" detail="Try changing your search or availability filter." />
            : <div className="dispatch-responder-grid">
              {filteredResponders.map(({ responder, live, distance }) => {
                const alreadyAssigned = assignedIds.has(responder.id);
                const checked = selectedResponderIds.includes(responder.id);
                const currentArea = live?.location?.barangay
                  ? `Brgy. ${live.location.barangay}${live.location.city ? `, ${live.location.city}` : ''}`
                  : live?.location?.city || responder.responder_barangay || '';
                const coordinates = live?.location
                  ? `${live.location.latitude.toFixed(5)}, ${live.location.longitude.toFixed(5)}`
                  : '';
                return <label className={`dispatch-responder-card ${checked ? 'is-selected' : ''}`} key={responder.id}>
                  <input type="checkbox" checked={checked} onChange={() => toggleResponder(responder.id)} disabled={busy || alreadyAssigned} aria-label={`Select ${responder.name} for dispatch`} />
                  <span className="dispatch-avatar">{responder.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?'}</span>
                  <span className="dispatch-responder-card-main">
                    <span className="dispatch-responder-card-heading"><strong>{responder.name}</strong><span className={`dispatch-presence ${live ? 'is-online' : ''}`}><i />{live ? 'Online' : 'Offline'}</span></span>
                    <small>{responder.responder_organization || 'Responder'}</small>
                    <span className="dispatch-responder-location"><MapPin size={13} />{currentArea ? `Current: ${currentArea}` : 'Current location unavailable'}</span>
                    {coordinates && <span className="dispatch-responder-coordinates">{coordinates}</span>}
                    <span className="dispatch-responder-card-footer">
                      <span>{formatDistance(distance, live)}</span>
                      {alreadyAssigned && <span className="dispatch-assigned-tag"><Check size={12} /> Assigned</span>}
                    </span>
                  </span>
                </label>;
              })}
            </div>}
        <div className="dispatch-roster-footer">
          <span>{selectedResponderIds.length} selected</span>
          <button className="button-primary" onClick={() => void submitDispatch()} disabled={!incident || selectedResponderIds.length === 0 || busy}>
            <Send size={15} /> {busy ? 'Dispatching…' : `Dispatch ${selectedResponderIds.length || ''} responder${selectedResponderIds.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </section>
    </div>}
    {previewPhoto && <DispatchPhotoViewer photo={previewPhoto} onClose={() => setPreviewPhoto(null)} />}
    <div className="dispatch-footnote"><Radio size={14} /> Live GPS updates while responders are signed in, online, and have granted location permission. The roster refreshes every 15 seconds.</div>
  </div>;
}
