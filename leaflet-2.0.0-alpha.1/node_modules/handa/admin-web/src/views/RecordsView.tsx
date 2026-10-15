import { useEffect, useMemo, useState } from 'react';
import { Download, Search, SlidersHorizontal } from 'lucide-react';
import { getAdminSnapshot } from '../api';
import type { AdminSnapshot, EvacueeRecord, IncidentRecord } from '../types';
import { EmptyState, InlineNotice, LoadingState, PageHeading } from '../components/UI';

const emptySnapshot: AdminSnapshot = { incidents: [], evacuees: [], centers: [], activePersonnel: 0, source: 'unavailable' };

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
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
    <PageHeading eyebrow={tab === 'incidents' ? 'FIELD RESPONSE' : 'COMMUNITY RECORDS'} title={mode === 'evacuees' ? 'Evacuee directory' : 'Operations records'} description="Search, review, and export records from across the response network." action={<button className="button-secondary" onClick={exportRecords} disabled={loading}><Download size={16} /> Export CSV</button>} />
    {error && <InlineNotice onRetry={() => void refresh()}>{error}</InlineNotice>}
    <section className="surface-panel records-panel">
      <div className="records-toolbar">
        {mode === 'all' && <div className="segmented-control" role="tablist">{(['incidents', 'evacuees'] as const).map((item) => <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'segment-active' : ''} onClick={() => setTab(item)}>{item === 'incidents' ? 'Incidents' : 'Evacuees'}<span className="segment-count">{item === 'incidents' ? data.incidents.length : data.evacuees.length}</span></button>)}</div>}
        <label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === 'incidents' ? 'Search incidents or locations' : 'Search evacuees, barangay, or center'} /><kbd>/</kbd></label>
        <button className="icon-button filter-button" aria-label="Filter records"><SlidersHorizontal size={17} /></button>
      </div>
      {loading ? <LoadingState label="Loading HANDA records" /> : tab === 'incidents' ? <IncidentTable rows={incidents} /> : <EvacueeTable rows={evacuees} />}
    </section>
  </div>;
}

function IncidentTable({ rows }: { rows: IncidentRecord[] }) {
  if (!rows.length) return <EmptyState title="No incident records found" detail="Incident reports will appear here when they are submitted." />;
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Incident</th><th>Location</th><th>Reported</th><th>Status</th><th>Sync</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.type}</strong><small className="cell-subtitle">{row.description}</small></td><td>{row.location || 'Location unavailable'}</td><td>{formatDate(row.createdAt)}</td><td><StatusPill value={row.status} /></td><td><span className="sync-state"><i />{row.syncStatus}</span></td></tr>)}</tbody></table></div>;
}

function EvacueeTable({ rows }: { rows: EvacueeRecord[] }) {
  if (!rows.length) return <EmptyState title="No evacuees found" detail="Registered evacuees will appear here." />;
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Person</th><th>Barangay</th><th>Center</th><th>Age</th><th>Registered</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><div className="person-cell"><span className="avatar avatar-table">{row.displayName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><strong>{row.displayName}</strong></div><small className="cell-subtitle">{row.contactNumber}</small></td><td>{row.barangay || 'Not provided'}</td><td>{row.centerName || 'Not assigned'}</td><td>{row.age || '—'}</td><td>{formatDate(row.createdAt)}</td><td><StatusPill value={row.status} /></td></tr>)}</tbody></table></div>;
}

function StatusPill({ value }: { value: string }) {
  const normalized = value.toLowerCase().replaceAll('_', ' ');
  const tone = /resolved|active|registered|success|synced|available/.test(normalized) ? 'good' : /new|pending|acknowledged|limited/.test(normalized) ? 'pending' : /closed|failed|critical|full|inactive/.test(normalized) ? 'danger' : 'neutral';
  return <span className={`status-pill status-${tone}`}><i />{normalized}</span>;
}

function formatDate(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}