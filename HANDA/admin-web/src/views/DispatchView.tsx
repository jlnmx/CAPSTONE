import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Check, Clock3, MapPin, Radio, RefreshCw, Send, Users } from 'lucide-react';
import { dispatchIncident, getDispatchData, updateIncidentStatus } from '../api';
import { EmptyState, InlineNotice, LoadingState, PageHeading } from '../components/UI';
import type { IncidentAssignment, IncidentRecord } from '../types';
import { useResponderLive } from '../responderLive';

const ACTIVE_STATUSES = new Set(['reported', 'acknowledged', 'in_progress']);

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

export default function DispatchView() {
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [responders, setResponders] = useState<Awaited<ReturnType<typeof getDispatchData>>['responders']>([]);
  const [assignments, setAssignments] = useState<Record<string, IncidentAssignment[]>>({});
  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [selectedResponderIds, setSelectedResponderIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const { responders: liveResponders, status: realtimeStatus } = useResponderLive();

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

  const incident = incidents.find((item) => item.id === selectedIncidentId);
  const assigned = incident ? assignments[incident.id] ?? [] : [];
  const assignedIds = useMemo(() => new Set(assigned.map((item) => item.responder_id)), [assigned]);
  const sortedResponders = useMemo(() => [...responders].map((responder) => {
    const live = liveResponders[responder.id];
    const distance = incident
      ? distanceKm(incident, live?.location)
      : null;
    return { responder, live, distance };
  }).sort((a, b) => {
    if (a.distance != null && b.distance != null) return a.distance - b.distance || a.responder.name.localeCompare(b.responder.name);
    if (a.distance != null) return -1;
    if (b.distance != null) return 1;
    if (a.live?.location && !b.live?.location) return -1;
    if (b.live?.location && !a.live?.location) return 1;
    return a.responder.name.localeCompare(b.responder.name);
  }), [responders, liveResponders, incident]);

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

  const realtimeMessage = realtimeStatus === 'SUBSCRIBED'
    ? 'Responder locations are live'
    : realtimeStatus === 'NOT_CONFIGURED'
      ? 'Live locations are not configured'
      : realtimeStatus === 'AUTH_ERROR'
        ? 'Live location authorization unavailable'
        : ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(realtimeStatus)
          ? 'Live updates unavailable; the responder roster refreshes every 15 seconds'
          : 'Connecting to live responder locations';

  return <div className="page-content dispatch-page">
    <PageHeading eyebrow="FIELD OPERATIONS" title="Dispatch responders" description="Select an active incident, then choose active responders to deploy. Responders are ordered by their latest live GPS position relative to the incident." action={<button className="button-secondary" onClick={() => void refresh(true)} disabled={loading || refreshing}><RefreshCw size={15} /> Refresh</button>} />
    {error && <InlineNotice tone="error" onRetry={() => void refresh()}>{error}</InlineNotice>}
    {notice && <InlineNotice tone="success">{notice}</InlineNotice>}
    <div className={`dispatch-live-banner ${realtimeStatus === 'SUBSCRIBED' ? 'dispatch-live-on' : ''}`}>
      <span className="dispatch-live-dot" />
      <span>{realtimeMessage}</span>
      {realtimeStatus === 'SUBSCRIBED' && <small>GPS locations expire after 60 seconds</small>}
    </div>

    {loading ? <LoadingState label="Loading incidents and active responders" /> : <div className="dispatch-layout">
      <section className="surface-panel dispatch-roster-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">AVAILABLE PERSONNEL</p><h2>Active responders</h2><p className="panel-subtitle">Only administrator-approved active accounts can be selected.</p></div>
          <span className="dispatch-count"><Users size={15} /> {responders.length}</span>
        </div>
        {incident && incident.latitude != null && incident.longitude != null && <p className="dispatch-sort-note"><MapPin size={14} /> Sorted by distance to {incident.type}; responders without fresh GPS are listed last.</p>}
        {incident && (incident.latitude == null || incident.longitude == null) && <p className="dispatch-sort-note"><MapPin size={14} /> This incident has no GPS pin; responders with fresh locations are listed first, then by name.</p>}
        {!incident && <p className="dispatch-sort-note">Choose an active incident to rank responders by proximity.</p>}
        {responders.length === 0 ? <EmptyState title="No active responders" detail="Active responder accounts will appear here when available." /> : <div className="dispatch-responder-list">
          {sortedResponders.map(({ responder, live, distance }) => {
            const alreadyAssigned = assignedIds.has(responder.id);
            const checked = selectedResponderIds.includes(responder.id);
            return <label className={`dispatch-responder ${checked ? 'dispatch-responder-selected' : ''}`} key={responder.id}>
              <input type="checkbox" checked={checked} onChange={() => toggleResponder(responder.id)} disabled={busy || alreadyAssigned} />
              <span className="dispatch-avatar">{responder.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?'}</span>
              <span className="dispatch-responder-copy">
                <strong>{responder.name}</strong>
                <small>{responder.responder_organization || 'Responder'}{responder.responder_barangay ? ` · ${responder.responder_barangay}` : ''}</small>
              </span>
              <span className="dispatch-responder-meta">
                {alreadyAssigned ? <span className="dispatch-assigned-tag"><Check size={12} /> Assigned</span> : <span className={`dispatch-presence ${live ? 'is-online' : ''}`}>{live ? 'Online' : 'Offline'}</span>}
                <small>{formatDistance(distance, live)}</small>
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

      <section className="surface-panel dispatch-incident-panel">
        <div className="panel-heading"><div><p className="eyebrow">INCIDENT CONTROL</p><h2>Select an incident</h2><p className="panel-subtitle">Dispatch acknowledges responders. Their first scene photo records arrival and moves the incident in progress.</p></div><span className="dispatch-count"><Activity size={15} /> {incidents.length}</span></div>
        {incidents.length === 0 ? <EmptyState title="No active incidents" detail="New reports will appear here for response planning." /> : <>
          <label className="form-field dispatch-incident-select"><span>Active incident</span><select value={selectedIncidentId} onChange={(event) => { setSelectedIncidentId(event.target.value); setSelectedResponderIds([]); setNotice(''); }}>
            {incidents.map((item) => <option value={item.id} key={item.id}>{item.type} · {item.status.replace(/_/g, ' ').toUpperCase()} · {locationLabel(item)}</option>)}
          </select></label>
          {incident && <div className="dispatch-incident-detail">
            <div className="dispatch-incident-heading"><div><span className="dispatch-status-pill">{incident.status.replace(/_/g, ' ')}</span><h3>{incident.type}</h3></div><span className="dispatch-severity">{incident.severity || 'medium'} severity</span></div>
            <p className="dispatch-incident-location"><MapPin size={15} /> {locationLabel(incident)}</p>
            {incident.latitude != null && incident.longitude != null && <small className="dispatch-coordinates">{incident.latitude.toFixed(5)}, {incident.longitude.toFixed(5)}</small>}
            <p className="dispatch-description">{incident.description}</p>
            <div className="dispatch-incident-meta"><Clock3 size={14} /> Reported {incident.createdAt ? new Date(incident.createdAt).toLocaleString() : 'time unavailable'}</div>
          </div>}
          <div className="dispatch-assignment-section">
            <div className="dispatch-assignment-heading"><strong>Currently dispatched</strong><span>{assigned.length}</span></div>
            {assigned.length ? assigned.map((assignment) => <div className="dispatch-assignment-row" key={assignment.responder_id}><span className="dispatch-assignment-mark"><Check size={13} /></span><span><strong>{assignment.name}</strong><small>{assignment.responder_organization || 'Responder'}</small></span><span className="dispatch-assignment-status">Deployed</span></div>) : <p className="dispatch-no-assignment">No responders deployed to this incident yet.</p>}
          </div>
          {incident?.status === 'acknowledged' && assigned.length > 0 && <button className="button-secondary dispatch-resolve" onClick={() => void markIncidentInProgress()} disabled={busy}><Activity size={15} /> Mark in progress</button>}
          {incident?.status === 'in_progress' && <button className="button-danger dispatch-resolve" onClick={() => void resolveIncident()} disabled={busy}><Check size={15} /> Mark incident resolved</button>}
        </>}
      </section>
    </div>}
    <div className="dispatch-footnote"><Radio size={14} /> Live GPS updates while responders are signed in, online, and have granted location permission. The roster refreshes every 15 seconds.</div>
  </div>;
}
