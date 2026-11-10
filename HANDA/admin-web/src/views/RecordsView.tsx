import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, Check, Download, Mail, MapPin, Phone, Plus, Search, SlidersHorizontal, Trash2, UserRoundPlus } from 'lucide-react';
import { createEvacuationRegistration, getAdminSnapshot, getCenters, getUsers } from '../api';
import type { AdminSnapshot, CenterRecord, EvacuationHouseholdMemberInput, EvacuationRegistrationInput, EvacueeRecord, IncidentRecord, UserRecord } from '../types';
import { EmptyState, InlineNotice, LoadingState, PageHeading } from '../components/UI';

const emptySnapshot: AdminSnapshot = { incidents: [], evacuees: [], centers: [], activePersonnel: 0, source: 'unavailable' };

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function RecordsView({ mode }: { mode: 'all' | 'evacuees' }) {
  const [data, setData] = useState(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'incidents' | 'evacuees'>(mode === 'evacuees' ? 'evacuees' : 'incidents');
  const [addEvacueeOpen, setAddEvacueeOpen] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setData(await getAdminSnapshot());
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Records could not be loaded.');
    } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  useEffect(() => { if (mode === 'evacuees') setTab('evacuees'); }, [mode]);

  const incidents = useMemo(() => data.incidents.filter((row) => `${row.type} ${row.description} ${row.location} ${row.status}`.toLowerCase().includes(query.toLowerCase())), [data.incidents, query]);
  const evacuees = useMemo(() => data.evacuees.filter((row) => `${row.displayName} ${row.barangay} ${row.centerName} ${row.status}`.toLowerCase().includes(query.toLowerCase())), [data.evacuees, query]);
  const exportRecords = () => tab === 'incidents'
    ? downloadCsv('handa-incidents.csv', [['Type', 'Location', 'Status', 'Created'], ...incidents.map((row) => [row.type, row.location, row.status, row.createdAt])])
    : downloadCsv('handa-evacuees.csv', [['Name', 'Age', 'Barangay', 'Center', 'Status', 'Registered'], ...evacuees.map((row) => [row.displayName, String(row.age), row.barangay, row.centerName, row.status, row.createdAt])]);

  return <div className="page-content records-page">
    <PageHeading eyebrow={tab === 'incidents' ? 'FIELD RESPONSE' : 'COMMUNITY RECORDS'} title={mode === 'evacuees' ? 'Evacuee directory' : 'Operations records'} description="Search, review, and export records from across the response network." action={<div className="heading-actions">{(mode === 'evacuees' || tab === 'evacuees') && <button className="button-primary" onClick={() => setAddEvacueeOpen(true)}><Plus size={16} /> Add household</button>}<button className="button-secondary" onClick={exportRecords} disabled={loading}><Download size={16} /> Export CSV</button></div>} />
    {error && <InlineNotice onRetry={() => void refresh()}>{error}</InlineNotice>}
    <section className="surface-panel records-panel">
      <div className="records-toolbar">
        {mode === 'all' && <div className="segmented-control" role="tablist">{(['incidents', 'evacuees'] as const).map((item) => <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'segment-active' : ''} onClick={() => setTab(item)}>{item === 'incidents' ? 'Incidents' : 'Evacuees'}<span className="segment-count">{item === 'incidents' ? data.incidents.length : data.evacuees.length}</span></button>)}</div>}
        <label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === 'incidents' ? 'Search incidents or locations' : 'Search evacuees, barangay, or center'} /><kbd>/</kbd></label>
        <button className="icon-button filter-button" aria-label="Filter records"><SlidersHorizontal size={17} /></button>
      </div>
      {loading ? <LoadingState label="Loading HANDA records" /> : tab === 'incidents' ? <IncidentTable rows={incidents} /> : <EvacueeTable rows={evacuees} />}
    </section>
    {addEvacueeOpen && <AddEvacueeModal onClose={() => setAddEvacueeOpen(false)} onCreated={async () => { setAddEvacueeOpen(false); await refresh(); }} />}
  </div>;
}

type HouseholdDraft = { name: string; relationship: string; age: string; sex: '' | 'Male' | 'Female'; contactNumber: string };
const emptyMember: HouseholdDraft = { name: '', relationship: '', age: '', sex: '', contactNumber: '' };

function AddEvacueeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [centers, setCenters] = useState<CenterRecord[]>([]);
  const [residents, setResidents] = useState<UserRecord[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [centerId, setCenterId] = useState('');
  const [residentUserId, setResidentUserId] = useState('');
  const [centerQuery, setCenterQuery] = useState('');
  const [centerFilter, setCenterFilter] = useState<'all' | 'many-spaces' | 'few-spaces'>('all');
  const [centerSort, setCenterSort] = useState<'name' | 'spaces'>('name');
  const [residentQuery, setResidentQuery] = useState('');
  const [residentFilter, setResidentFilter] = useState<'all' | 'email' | 'phone'>('all');
  const [residentSort, setResidentSort] = useState<'name' | 'email'>('name');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'Female' | 'Male' | 'Other'>('Female');
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');
  const [members, setMembers] = useState<HouseholdDraft[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all([getCenters(), getUsers()])
      .then(([centerRows, userRows]) => {
        if (!active) return;
        const activeCenters = centerRows.filter((center) => center.status !== 'closed' && center.status !== 'full' && center.currentOccupancy < center.capacity);
        setCenters(activeCenters);
        setCenterId(activeCenters[0]?.id ?? '');
        setResidents(userRows.filter((user) => user.role === 'Resident' && user.status === 'Active'));
        setOptionsError('');
      })
      .catch((cause) => {
        if (active) setOptionsError(cause instanceof Error ? cause.message : 'Centers and Resident accounts could not be loaded.');
      })
      .finally(() => { if (active) setLoadingOptions(false); });
    return () => { active = false; };
  }, []);

  const filteredCenters = useMemo(() => centers
    .filter((center) => `${center.name} ${center.location}`.toLowerCase().includes(centerQuery.trim().toLowerCase()))
    .filter((center) => {
      const spaces = Math.max(0, center.capacity - center.currentOccupancy);
      return centerFilter === 'all' || (centerFilter === 'many-spaces' ? spaces >= 20 : spaces < 20);
    })
    .sort((left, right) => centerSort === 'name'
      ? left.name.localeCompare(right.name)
      : (right.capacity - right.currentOccupancy) - (left.capacity - left.currentOccupancy)), [centers, centerQuery, centerFilter, centerSort]);

  const filteredResidents = useMemo(() => residents
    .filter((resident) => `${resident.name} ${resident.email} ${resident.mobileNumber ?? ''} ${resident.currentAddress ?? ''}`.toLowerCase().includes(residentQuery.trim().toLowerCase()))
    .filter((resident) => residentFilter === 'all'
      || (residentFilter === 'email' ? Boolean(resident.email) : Boolean(resident.mobileNumber)))
    .sort((left, right) => residentSort === 'name'
      ? left.name.localeCompare(right.name)
      : left.email.localeCompare(right.email)), [residents, residentQuery, residentFilter, residentSort]);

  const updateMember = (index: number, patch: Partial<HouseholdDraft>) => {
    setMembers((current) => current.map((member, memberIndex) => memberIndex === index ? { ...member, ...patch } : member));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (!centerId) throw new Error('Choose an evacuation center with available capacity.');
      if (!firstName.trim() || !lastName.trim() || !address.trim()) throw new Error('Enter the evacuee’s name and address.');
      const parsedAge = Number(age);
      if (!Number.isInteger(parsedAge) || parsedAge < 0 || parsedAge > 150) throw new Error('Enter a valid age between 0 and 150.');
      if (members.some((member) => !member.name.trim() || !member.relationship.trim())) {
        throw new Error('Enter a name and relationship for each household member.');
      }
      const payload: EvacuationRegistrationInput = {
        residentUserId: residentUserId || null,
        centerId,
        firstName: firstName.trim(),
        middleName: middleName.trim() || null,
        lastName: lastName.trim(),
        age: parsedAge,
        sex,
        contactNumber: contactNumber.trim() || null,
        address: address.trim(),
        householdSize: members.length + 1,
        members: members.map((member): EvacuationHouseholdMemberInput => ({
          name: member.name.trim(),
          relationship: member.relationship.trim(),
          age: member.age.trim() ? Number(member.age) : null,
          sex: member.sex || null,
          contactNumber: member.contactNumber.trim(),
        })),
      };
      await createEvacuationRegistration(payload);
      await onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The household could not be added.');
    } finally {
      setSaving(false);
    }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="add-evacuee-title">
      <div className="modal-heading"><div><p className="eyebrow">CENTER MANAGEMENT</p><h2 id="add-evacuee-title">Add evacuee household</h2></div><button className="icon-button" onClick={onClose} disabled={saving} aria-label="Close">×</button></div>
      {loadingOptions ? <div className="loading-state"><span className="loader" /><span>Loading centers and Resident accounts</span></div> : optionsError ? <InlineNotice tone="error">{optionsError}</InlineNotice> : <form className="form-grid" onSubmit={(event) => void submit(event)}>
        {!centers.length && <div className="form-field-wide"><InlineNotice tone="error">There are no open evacuation centers with remaining capacity. Update a center before adding this household.</InlineNotice></div>}
        <div className="form-field form-field-wide"><span>Assign to center *</span>
          {centerId && <div className="picker-selection"><MapPin size={16} /><span><strong>{centers.find((center) => center.id === centerId)?.name}</strong><small>{Math.max(0, (centers.find((center) => center.id === centerId)?.capacity ?? 0) - (centers.find((center) => center.id === centerId)?.currentOccupancy ?? 0))} spaces currently available</small></span><Check size={16} /></div>}
          <div className="option-picker-toolbar">
            <label className="option-search"><Search size={15} /><input value={centerQuery} onChange={(event) => setCenterQuery(event.target.value)} placeholder="Search center name or location" aria-label="Search evacuation centers" /></label>
            <label className="option-control"><SlidersHorizontal size={14} /><select value={centerFilter} onChange={(event) => setCenterFilter(event.target.value as typeof centerFilter)} aria-label="Filter centers"><option value="all">Any capacity</option><option value="many-spaces">20+ spaces</option><option value="few-spaces">Under 20</option></select></label>
            <label className="option-control"><ArrowDownUp size={14} /><select value={centerSort} onChange={(event) => setCenterSort(event.target.value as typeof centerSort)} aria-label="Sort centers"><option value="name">Name A–Z</option><option value="spaces">Most spaces</option></select></label>
          </div>
          <div className="option-picker-list" role="listbox" aria-label="Available evacuation centers">
            {filteredCenters.map((center) => {
              const spaces = Math.max(0, center.capacity - center.currentOccupancy);
              const selected = centerId === center.id;
              return <button type="button" key={center.id} role="option" aria-selected={selected} className={`option-picker-item ${selected ? 'option-picker-item-selected' : ''}`} onClick={() => setCenterId(center.id)}>
                <MapPin size={17} /><span><strong>{center.name}</strong><small>{center.location || 'Location not specified'}</small></span><span className="option-capacity">{spaces} {spaces === 1 ? 'space' : 'spaces'}</span>{selected && <Check size={16} />}
              </button>;
            })}
            {!filteredCenters.length && <div className="option-empty">No centers match these search and filter options.</div>}
          </div>
          <small className="option-result-count">Showing {filteredCenters.length} of {centers.length} available centers</small>
        </div>
        <div className="form-field form-field-wide"><span>Link Resident account <small>(optional)</small></span>
          <button type="button" className={`resident-link-choice ${!residentUserId ? 'resident-link-choice-selected' : ''}`} onClick={() => setResidentUserId('')} aria-pressed={!residentUserId}>
            <UserRoundPlus size={17} /><span><strong>Walk-in / no account</strong><small>Record this household without linking a HANDA account</small></span>{!residentUserId && <Check size={16} />}
          </button>
          <div className="option-picker-toolbar">
            <label className="option-search"><Search size={15} /><input value={residentQuery} onChange={(event) => setResidentQuery(event.target.value)} placeholder="Search resident name, email, phone, or address" aria-label="Search Resident accounts" /></label>
            <label className="option-control"><SlidersHorizontal size={14} /><select value={residentFilter} onChange={(event) => setResidentFilter(event.target.value as typeof residentFilter)} aria-label="Filter Resident accounts"><option value="all">All accounts</option><option value="email">Has email</option><option value="phone">Has phone</option></select></label>
            <label className="option-control"><ArrowDownUp size={14} /><select value={residentSort} onChange={(event) => setResidentSort(event.target.value as typeof residentSort)} aria-label="Sort Resident accounts"><option value="name">Name A–Z</option><option value="email">Email A–Z</option></select></label>
          </div>
          <div className="option-picker-list resident-option-list" role="listbox" aria-label="Active Resident accounts">
            {filteredResidents.map((resident) => {
              const selected = residentUserId === resident.id;
              return <button type="button" key={resident.id} role="option" aria-selected={selected} className={`option-picker-item ${selected ? 'option-picker-item-selected' : ''}`} onClick={() => setResidentUserId(resident.id)}>
                <span className="resident-option-avatar">{resident.name.trim().charAt(0).toUpperCase() || 'R'}</span>
                <span><strong>{resident.name}</strong><small><Mail size={12} /> {resident.email || 'No email'}{resident.mobileNumber && <><span className="option-meta-separator">·</span><Phone size={12} /> {resident.mobileNumber}</>}</small></span>
                {selected && <Check size={16} />}
              </button>;
            })}
            {!filteredResidents.length && <div className="option-empty">No active Resident accounts match these search and filter options.</div>}
          </div>
          <small className="option-result-count">Showing {filteredResidents.length} of {residents.length} active Resident accounts</small>
        </div>
        <Field label="First name" value={firstName} onChange={setFirstName} required />
        <Field label="Middle name" value={middleName} onChange={setMiddleName} />
        <Field label="Last name" value={lastName} onChange={setLastName} required />
        <Field label="Age" value={age} onChange={setAge} type="number" min="0" max="150" required />
        <label className="form-field"><span>Sex *</span><select value={sex} onChange={(event) => setSex(event.target.value as typeof sex)}><option>Female</option><option>Male</option><option>Other</option></select></label>
        <Field label="Contact number" value={contactNumber} onChange={setContactNumber} />
        <Field label="Home address" value={address} onChange={setAddress} required wide />

        <div className="form-field-wide household-form-heading">
          <div><strong>Household members</strong><small>{members.length + 1} people in this household; added as registered until checked in.</small></div>
          <button type="button" className="button-secondary" onClick={() => setMembers((current) => current.length < 20 ? [...current, { ...emptyMember }] : current)} disabled={members.length >= 20}><UserRoundPlus size={15} /> Add member</button>
        </div>
        {members.map((member, index) => <div className="form-field-wide household-member-form" key={index}>
          <div className="household-member-title"><strong>Member {index + 1}</strong><button type="button" className="text-button" onClick={() => setMembers((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove household member ${index + 1}`}><Trash2 size={14} /> Remove</button></div>
          <Field label="Full name" value={member.name} onChange={(name) => updateMember(index, { name })} required />
          <Field label="Relationship" value={member.relationship} onChange={(relationship) => updateMember(index, { relationship })} placeholder="Child, spouse, parent" required />
          <Field label="Age" value={member.age} onChange={(value) => updateMember(index, { age: value })} type="number" min="0" max="150" />
          <label className="form-field"><span>Sex</span><select value={member.sex} onChange={(event) => updateMember(index, { sex: event.target.value as HouseholdDraft['sex'] })}><option value="">Not specified</option><option>Female</option><option>Male</option></select></label>
          <Field label="Contact number" value={member.contactNumber} onChange={(contact) => updateMember(index, { contactNumber: contact })} />
        </div>)}
        <div className="form-field-wide"><InlineNotice>Registration is recorded at this center. It does not increase occupancy until center personnel mark the household checked in. The linked Resident, if selected, will receive the assignment status.</InlineNotice></div>
        {error && <div className="form-field-wide"><InlineNotice tone="error">{error}</InlineNotice></div>}
        <div className="modal-actions form-field-wide"><button type="button" className="button-secondary" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="button-primary" disabled={saving || !centers.length}>{saving && <span className="button-spinner" />}Add household</button></div>
      </form>}
    </section>
  </div>;
}

function Field({ label, value, onChange, required = false, type = 'text', min, max, wide = false, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; min?: string; max?: string; wide?: boolean; placeholder?: string }) {
  return <label className={`form-field ${wide ? 'form-field-wide' : ''}`}><span>{label}{required && <i> *</i>}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} min={min} max={max} placeholder={placeholder} /></label>;
}

function IncidentTable({ rows }: { rows: IncidentRecord[] }) {
  if (!rows.length) return <EmptyState title="No incident records found" detail="Incident reports will appear here when they are submitted." />;
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Incident</th><th>Location</th><th>Reporter</th><th>Reported photos</th><th>Scene photos (responders)</th><th>Reported</th><th>Status</th><th>Sync</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.type}</strong><small className="cell-subtitle">{row.description}</small></td><td>{row.location || 'Location unavailable'}</td><td>{row.reporterContact ? <div className="person-cell"><span className="avatar avatar-table" style={row.reporterPicture ? { padding: 0, overflow: 'hidden' } : undefined}>{row.reporterPicture ? <img src={row.reporterPicture} alt={`${row.reporterName || 'Resident'} profile`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : (row.reporterName || 'R').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span><strong>{row.reporterName || 'Resident'}</strong><small className="cell-subtitle">{row.reporterContact}</small></span></div> : '—'}</td><td><PhotoCell photos={row.photoUris || []} title={`${row.type} reported`} /></td><td><PhotoCell photos={row.responsePhotoUris || []} title={`${row.type} scene`} /></td><td>{formatDate(row.createdAt)}</td><td><StatusPill value={row.status} /></td><td><span className="sync-state"><i />{row.syncStatus}</span></td></tr>)}</tbody></table></div>;
}

function PhotoCell({ photos, title }: { photos: string[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) return <>—</>;
  const thumb = { width: 44, height: 44, objectFit: 'cover' as const, borderRadius: 8, border: '1px solid #d8e2d6', cursor: 'pointer' };
  return <>
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {photos.slice(0, 3).map((uri, index) => <img key={index} src={uri} alt={`${title} photo ${index + 1}`} style={thumb} onClick={() => setOpen(index)} />)}
      {photos.length > 3 && <button className="button-secondary" onClick={() => setOpen(3)}>+{photos.length - 3}</button>}
    </div>
    {open !== null && <div role="dialog" aria-label={`${title} photos`} onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 16 }}>
      <img src={photos[open]} alt={`${title} photo ${open + 1}`} style={{ maxWidth: '92vw', maxHeight: '78vh', borderRadius: 10 }} onClick={(event) => event.stopPropagation()} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#fff' }} onClick={(event) => event.stopPropagation()}>
        <button className="button-secondary" disabled={open === 0} onClick={() => setOpen(open - 1)}>Prev</button>
        <span>{open + 1} / {photos.length}</span>
        <button className="button-secondary" disabled={open === photos.length - 1} onClick={() => setOpen(open + 1)}>Next</button>
        <button className="button-secondary" onClick={() => setOpen(null)}>Close</button>
      </div>
    </div>}
  </>;
}

function EvacueeTable({ rows }: { rows: EvacueeRecord[] }) {
  if (!rows.length) return <EmptyState title="No evacuees found" detail="Registered evacuees will appear here." />;
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Person</th><th>Barangay</th><th>Center</th><th>Age</th><th>Registered</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><div className="person-cell"><span className="avatar avatar-table" style={row.profilePicture ? { padding: 0, overflow: 'hidden' } : undefined}>{row.profilePicture ? <img src={row.profilePicture} alt={`${row.displayName} profile`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : row.displayName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><strong>{row.displayName}</strong></div><small className="cell-subtitle">{row.contactNumber}</small></td><td>{row.barangay || 'Not provided'}</td><td>{row.centerName || 'Not assigned'}</td><td>{row.age || '—'}</td><td>{formatDate(row.createdAt)}</td><td><StatusPill value={row.status} /></td></tr>)}</tbody></table></div>;
}

function StatusPill({ value }: { value: string }) {
  const normalized = value.toLowerCase().replace(/_/g, ' ');
  const tone = /resolved|active|registered|success|synced|available/.test(normalized) ? 'good' : /new|pending|acknowledged|limited/.test(normalized) ? 'pending' : /closed|failed|critical|full|inactive/.test(normalized) ? 'danger' : 'neutral';
  return <span className={`status-pill status-${tone}`}><i />{normalized}</span>;
}

function formatDate(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}