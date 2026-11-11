import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, ArrowLeft, Building2, Check, Clock3, LogOut, MapPin, Phone, Plus, RefreshCw, Search, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { getCenterEvacuationRegistrations, getCenters, updateEvacuationRegistrationStatus } from '../api';
import type { CenterRecord, EvacuationRegistrationRecord } from '../types';
import { EmptyState, InlineNotice, LoadingState, MetricCard, PageHeading } from '../components/UI';
import { AddEvacueeModal } from './RecordsView';

type StatusFilter = 'active' | 'all' | EvacuationRegistrationRecord['status'];
type SortOrder = 'recent' | 'oldest' | 'name';

function registrationName(registration: EvacuationRegistrationRecord) {
  return [registration.first_name, registration.middle_name, registration.last_name].filter(Boolean).join(' ');
}

function statusLabel(status: EvacuationRegistrationRecord['status']) {
  return status.replace('_', ' ');
}

export default function CenterDetailView() {
  const { centerId = '' } = useParams();
  const navigate = useNavigate();
  const [center, setCenter] = useState<CenterRecord | null>(null);
  const [registrations, setRegistrations] = useState<EvacuationRegistrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent');
  const [updatingId, setUpdatingId] = useState('');
  const [actionError, setActionError] = useState('');
  const [addHouseholdOpen, setAddHouseholdOpen] = useState(false);

  const refresh = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const [centers, centerRegistrations] = await Promise.all([
        getCenters(),
        getCenterEvacuationRegistrations(centerId),
      ]);
      setCenter(centers.find((item) => item.id === centerId) ?? null);
      setRegistrations(centerRegistrations);
      setError(centers.some((item) => item.id === centerId) ? '' : 'This evacuation center could not be found.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Center records could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [centerId]);

  useEffect(() => {
    void refresh(true);
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const activeRegistrations = registrations.filter((item) => item.status !== 'released');
  const checkedInHouseholds = activeRegistrations.filter((item) => item.status === 'checked_in' || item.status === 'evacuated').length;
  const registeredPeople = activeRegistrations.reduce((total, item) => total + item.household_size, 0);
  const filteredRegistrations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return registrations
      .filter((registration) => statusFilter === 'all'
        || (statusFilter === 'active' ? registration.status !== 'released' : registration.status === statusFilter))
      .filter((registration) => !normalizedQuery || [
        registrationName(registration),
        registration.resident_name ?? '',
        registration.contact_number,
        registration.address,
        ...registration.members.map((member) => member.name),
      ].join(' ').toLowerCase().includes(normalizedQuery))
      .sort((left, right) => sortOrder === 'name'
        ? registrationName(left).localeCompare(registrationName(right))
        : sortOrder === 'oldest'
          ? left.registered_at.localeCompare(right.registered_at)
          : right.registered_at.localeCompare(left.registered_at));
  }, [registrations, query, sortOrder, statusFilter]);

  async function changeStatus(registration: EvacuationRegistrationRecord, nextStatus: 'checked_in' | 'evacuated' | 'released') {
    if (nextStatus === 'released' && !window.confirm(`Release ${registrationName(registration)} from ${center?.name}? The registration will remain in the history${registration.status === 'checked_in' || registration.status === 'evacuated' ? ' and occupied capacity will be freed' : ''}.`)) return;
    setUpdatingId(registration.id);
    setActionError('');
    try {
      await updateEvacuationRegistrationStatus(registration.id, nextStatus);
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'The evacuation status could not be updated.');
    } finally {
      setUpdatingId('');
    }
  }

  if (loading) return <div className="page-content"><LoadingState label="Loading evacuation center" /></div>;

  if (!center) return <div className="page-content">
    <button className="button-secondary center-back-button" onClick={() => navigate('/centers')}><ArrowLeft size={15} /> All centers</button>
    <InlineNotice tone={error ? 'error' : 'warning'} onRetry={() => void refresh(true)}>{error || 'This evacuation center is unavailable.'}</InlineNotice>
  </div>;

  const remaining = Math.max(0, center.capacity - center.currentOccupancy);
  const occupancyPercent = center.capacity > 0 ? Math.min(100, Math.round(center.currentOccupancy / center.capacity * 100)) : 0;
  const fillTone = occupancyPercent >= 90 ? 'capacity-danger' : occupancyPercent >= 70 ? 'capacity-warning' : 'capacity-good';

  return <div className="page-content center-detail-page">
    <button className="button-secondary center-back-button" onClick={() => navigate('/centers')}><ArrowLeft size={15} /> All centers</button>
    <PageHeading
      eyebrow="EVACUATION CENTER"
      title={center.name}
      description={center.location || 'Location unavailable'}
      action={<>
        <button className="button-secondary" onClick={() => void refresh()} disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'is-spinning' : ''} /> Refresh</button>
        <button className="button-primary" onClick={() => setAddHouseholdOpen(true)} disabled={center.status === 'closed' || center.status === 'full'}><Plus size={16} /> Add household</button>
      </>}
    />
    {error && <InlineNotice tone="error" onRetry={() => void refresh(true)}>{error}</InlineNotice>}
    {actionError && <InlineNotice tone="error">{actionError}</InlineNotice>}

    <div className="center-detail-metrics">
      <MetricCard label="Current occupancy" value={`${center.currentOccupancy} / ${center.capacity}`} detail={`${occupancyPercent}% of center capacity`} icon={Building2} tone={occupancyPercent >= 90 ? 'red' : 'green'} />
      <MetricCard label="Spaces remaining" value={remaining} detail={center.status.replace('_', ' ')} icon={MapPin} tone={remaining === 0 ? 'red' : remaining < 20 ? 'amber' : 'green'} />
      <MetricCard label="Active households" value={activeRegistrations.length} detail="Not yet released" icon={Users} tone="blue" />
      <MetricCard label="People registered" value={registeredPeople} detail={`${checkedInHouseholds} checked-in households`} icon={Check} tone="green" />
    </div>

    <section className="surface-panel center-detail-info">
      <div className="center-detail-info-heading"><span className="center-emblem"><Building2 size={19} /></span><div><p className="eyebrow">CENTER INFORMATION</p><h2>{center.name}</h2></div><span className={`status-pill status-${center.status === 'full' || center.status === 'closed' ? 'danger' : center.status === 'limited' ? 'pending' : 'good'}`}><i />{center.status}</span></div>
      <div className="center-detail-info-grid">
        <div><MapPin size={15} /><span><small>Location</small><strong>{center.location || 'Not provided'}</strong></span></div>
        <div><Users size={15} /><span><small>Coordinator</small><strong>{center.coordinatorName || 'Not assigned'}</strong></span></div>
        <div><Phone size={15} /><span><small>Contact</small><strong>{center.contactNumber || 'Not provided'}</strong></span></div>
        <div><Clock3 size={15} /><span><small>Capacity</small><strong>{center.currentOccupancy.toLocaleString()} occupied · {remaining.toLocaleString()} remaining</strong></span></div>
      </div>
      <div className="capacity-track center-detail-capacity"><span className={fillTone} style={{ width: `${occupancyPercent}%` }} /></div>
      {center.notes && <p className="center-detail-notes">{center.notes}</p>}
    </section>

    <section className="surface-panel center-evacuees-panel">
      <div className="center-evacuees-heading">
        <div><p className="eyebrow">CENTER ROSTER</p><h2>Evacuee households</h2><p className="panel-subtitle">Review registrations, update arrival status, or release a household while preserving its record.</p></div>
        <span className="results-count">{filteredRegistrations.length} of {registrations.length} households</span>
      </div>
      <div className="center-evacuees-toolbar">
        <label className="search-field"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, contact, address, or household member" /></label>
        <label className="option-control"><Users size={14} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} aria-label="Filter households by status">
          <option value="active">Active households</option><option value="all">All statuses</option><option value="registered">Registered</option><option value="checked_in">Checked in</option><option value="evacuated">Evacuated</option><option value="released">Released</option>
        </select></label>
        <label className="option-control"><ArrowDownUp size={14} /><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)} aria-label="Sort households">
          <option value="recent">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option>
        </select></label>
      </div>
      {!filteredRegistrations.length
        ? <EmptyState title={query || statusFilter !== 'active' ? 'No matching households' : 'No active households yet'} detail={query || statusFilter !== 'active' ? 'Try another search or status filter.' : 'Add a household to start this center’s evacuation roster.'} />
        : <div className="table-scroll center-evacuees-table-scroll"><table className="data-table center-evacuees-table">
          <thead><tr><th>Household</th><th>Contact</th><th>Age / sex</th><th>Address</th><th>Registered</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{filteredRegistrations.map((registration) => {
            const name = registrationName(registration);
            const busy = updatingId === registration.id;
            return <tr key={registration.id}>
              <td><div className="center-household-cell">
                <span className="center-household-avatar">{registration.resident_profile_picture ? <img src={registration.resident_profile_picture} alt="" /> : name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>
                <span><strong>{name}</strong><small>{registration.resident_name ? `Linked account · ${registration.resident_name}` : 'Walk-in registration'} · {registration.household_size} {registration.household_size === 1 ? 'person' : 'people'}</small>
                  {registration.members.length > 0 && <small className="center-household-members">{registration.members.map((member) => `${member.name} (${member.relationship})`).join(' · ')}</small>}
                </span>
              </div></td>
              <td>{registration.contact_number || '—'}</td>
              <td>{registration.age} · {registration.sex || '—'}</td>
              <td>{registration.address || '—'}</td>
              <td>{registration.registered_at ? new Date(registration.registered_at).toLocaleDateString() : '—'}</td>
              <td><span className={`registration-status registration-status-${registration.status}`}>{statusLabel(registration.status)}</span></td>
              <td><div className="center-household-actions">
                {registration.status === 'registered' && <button className="text-button" disabled={busy} onClick={() => void changeStatus(registration, 'checked_in')}><Check size={14} /> Check in</button>}
                {registration.status === 'checked_in' && <button className="text-button" disabled={busy} onClick={() => void changeStatus(registration, 'evacuated')}><MapPin size={14} /> Mark evacuated</button>}
                {registration.status !== 'released' && <button className="text-button center-release-action" disabled={busy} onClick={() => void changeStatus(registration, 'released')}><LogOut size={14} /> {busy ? 'Saving…' : 'Release'}</button>}
              </div></td>
            </tr>;
          })}</tbody>
        </table></div>}
    </section>
    {addHouseholdOpen && <AddEvacueeModal initialCenterId={center.id} onClose={() => setAddHouseholdOpen(false)} onCreated={async () => { setAddHouseholdOpen(false); await refresh(); }} />}
  </div>;
}
