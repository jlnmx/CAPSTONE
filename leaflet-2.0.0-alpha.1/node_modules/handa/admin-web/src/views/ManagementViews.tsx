import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Archive, ArrowRight, Check, Cloud, Download, FileClock, Plus, RefreshCw, Save, ShieldCheck, Sun, Moon, SunMoon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createDisaster, getAdminSnapshot, getDisasters, getLogs, updateUser } from '../api';
import type { AdminSnapshot, DisasterRecord, LogRecord } from '../types';
import { useAuth } from '../auth';
import { EmptyState, InlineNotice, LoadingState, MetricCard, PageHeading } from '../components/UI';

const blankSnapshot: AdminSnapshot = { incidents: [], evacuees: [], centers: [], activePersonnel: 0, source: 'unavailable' };

export function AnalyticsView() {
  const [data, setData] = useState(blankSnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    void getAdminSnapshot().then((snapshot) => { setData(snapshot); setError(snapshot.source === 'remote' ? '' : 'Some statistics are incomplete because one or more data sources are unavailable.'); }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Analytics could not be loaded.')).finally(() => setLoading(false));
  }, []);
  const week = useMemo(() => Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(); date.setDate(date.getDate() - (6 - offset));
    const key = date.toISOString().slice(0, 10);
    return { label: date.toLocaleDateString(undefined, { weekday: 'short' }), value: data.evacuees.filter((item) => item.createdAt.slice(0, 10) === key).length };
  }), [data.evacuees]);
  const max = Math.max(1, ...week.map((item) => item.value));
  const resolved = data.incidents.filter((item) => item.status === 'resolved').length;
  const resolution = data.incidents.length ? Math.round(resolved / data.incidents.length * 100) : 0;
  const openCenters = data.centers.filter((center) => center.status !== 'closed');
  const capacity = openCenters.reduce((total, center) => total + center.capacity, 0);
  const occupied = openCenters.reduce((total, center) => total + center.currentOccupancy, 0);
  return <div className="page-content">
    <PageHeading eyebrow="DECISION SUPPORT" title="Analytics" description="A clear summary of registration, response, and shelter capacity." action={<button className="button-secondary" onClick={() => window.print()}><Download size={16} /> Print report</button>} />
    {error && <InlineNotice>{error}</InlineNotice>}
    {loading ? <LoadingState label="Calculating operational metrics" /> : <>
      <div className="metric-grid"><MetricCard label="Evacuees registered" value={data.evacuees.length} detail="All available records" icon={Activity} /><MetricCard label="Incidents reported" value={data.incidents.length} detail={`${data.incidents.filter((item) => item.status !== 'resolved').length} active`} icon={AlertTriangle} tone="red" /><MetricCard label="Resolution rate" value={`${resolution}%`} detail={`${resolved} resolved incidents`} icon={Check} tone="green" /><MetricCard label="Center utilization" value={capacity ? `${Math.round(occupied / capacity * 100)}%` : '—'} detail={`${occupied} of ${capacity} places`} icon={Cloud} tone="blue" /></div>
      <div className="dashboard-grid analytics-grid"><section className="surface-panel activity-panel"><div className="panel-heading"><div><p className="eyebrow">REGISTRATION TREND</p><h2>Evacuees by day</h2><p className="panel-subtitle">New records during the last seven days</p></div></div><div className="chart-area">{week.map((item) => <div className="chart-column" key={item.label}><span className="chart-count">{item.value}</span><div className="chart-track"><span className="chart-bar" style={{ height: `${Math.max(item.value ? 12 : 4, item.value / max * 100)}%` }} /></div><span className="chart-label">{item.label}</span></div>)}</div></section><section className="surface-panel utilization-panel"><p className="eyebrow">SHELTER READINESS</p><h2>Center capacity</h2><p className="panel-subtitle">Occupancy in centers not marked closed</p><div className="utilization-number">{capacity ? `${Math.round(occupied / capacity * 100)}%` : '—'}</div><div className="capacity-track"><span className="capacity-good" style={{ width: `${capacity ? Math.min(occupied / capacity * 100, 100) : 0}%` }} /></div><div className="utilization-meta"><span>Occupied <strong>{occupied}</strong></span><span>Available <strong>{Math.max(0, capacity - occupied)}</strong></span></div></section></div>
    </>}
  </div>;
}

export function DisastersView() {
  const [events, setEvents] = useState<DisasterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<DisasterRecord['severity']>('medium');
  const [status, setStatus] = useState<DisasterRecord['status']>('Active');
  const [affectedAreas, setAffectedAreas] = useState('0');

  async function refresh() {
    setLoading(true);
    try { setEvents(await getDisasters()); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Disaster records could not be loaded.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try { await createDisaster({ name: name.trim(), description: description.trim(), severity, status, affectedAreas: Number(affectedAreas) || 0 }); setOpen(false); setName(''); setDescription(''); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The event could not be saved.'); }
    finally { setSaving(false); }
  }
  return <div className="page-content">
    <PageHeading eyebrow="EVENT CONTROL" title="Disaster events" description="Track active and upcoming events affecting the response network." action={<button className="button-primary" onClick={() => setOpen(true)}><Plus size={17} /> Create event</button>} />
    {error && <InlineNotice tone="error" onRetry={() => void refresh()}>{error}</InlineNotice>}
    {loading ? <LoadingState label="Loading disaster events" /> : events.length === 0 ? <section className="surface-panel"><EmptyState title="No disaster events" detail="Create an event to coordinate an active or anticipated response." /></section> : <div className="event-list">{events.map((event) => <article className="event-row" key={event.id}><span className={`event-icon severity-${event.severity}`}><AlertTriangle size={19} /></span><span className="event-copy"><strong>{event.name}</strong><small>{event.description || 'No description provided'}</small><span className="event-meta">{event.id} · {event.affected_areas} affected areas{event.started_at ? ` · Started ${new Date(event.started_at).toLocaleString()}` : ''}</span></span><span className={`status-pill status-${event.status === 'Active' ? 'danger' : event.status === 'Upcoming' ? 'pending' : 'neutral'}`}><i />{event.status}</span></article>)}</div>}
    {open && <Modal title="Create disaster event" eyebrow="EVENT CONTROL" onClose={() => setOpen(false)}><form className="form-grid" onSubmit={(event) => void submit(event)}>
      <label className="form-field form-field-wide"><span>Event name *</span><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Typhoon or local incident name" /></label>
      <label className="form-field form-field-wide"><span>Description</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Situation summary" /></label>
      <label className="form-field"><span>Severity</span><select value={severity} onChange={(event) => setSeverity(event.target.value as DisasterRecord['severity'])}>{['low', 'medium', 'high', 'critical'].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="form-field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as DisasterRecord['status'])}>{['Upcoming', 'Active', 'Archived'].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="form-field"><span>Affected areas</span><input type="number" min="0" value={affectedAreas} onChange={(event) => setAffectedAreas(event.target.value)} /></label>
      {error && <InlineNotice tone="error">{error}</InlineNotice>}
      <div className="modal-actions form-field-wide"><button type="button" className="button-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="button-primary" disabled={saving}>{saving && <span className="button-spinner" />} Create event</button></div>
    </form></Modal>}
  </div>;
}

export function LogsView() {
  const [category, setCategory] = useState<'sync' | 'audit'>('sync');
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    void getLogs(category).then((result) => { if (active) setLogs(result); }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Logs could not be loaded.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [category]);
  return <div className="page-content">
    <PageHeading eyebrow="SYSTEM MONITORING" title="Activity logs" description="Review device synchronization and sensitive data changes." />
    <div className="segmented-control log-tabs" role="tablist"><button role="tab" aria-selected={category === 'sync'} className={category === 'sync' ? 'segment-active' : ''} onClick={() => setCategory('sync')}><RefreshCw size={15} /> Sync activity</button><button role="tab" aria-selected={category === 'audit'} className={category === 'audit' ? 'segment-active' : ''} onClick={() => setCategory('audit')}><ShieldCheck size={15} /> Audit trail</button></div>
    {error && <InlineNotice tone="error">{error}</InlineNotice>}
    <section className="surface-panel log-panel"><div className="panel-heading"><div><p className="eyebrow">{category === 'sync' ? 'DEVICE TRANSFERS' : 'PROTECTED CHANGES'}</p><h2>{category === 'sync' ? 'Synchronization history' : 'Audit history'}</h2></div><span className="results-count">{logs.length} events</span></div>
      {loading ? <LoadingState label="Loading activity" /> : logs.length === 0 ? <EmptyState title="No activity recorded" detail={`New ${category} events will appear here.`} /> : logs.map((log) => <article className="log-row" key={log.id}><span className={`log-icon ${log.status === 'success' ? 'log-success' : 'log-warning'}`}>{log.status === 'success' ? <Check size={17} /> : <AlertTriangle size={17} />}</span><span className="log-content"><span className="log-title-line"><strong>{log.action}</strong><time>{new Date(log.created_at).toLocaleString()}</time></span><span>{log.details}</span><small>{log.actor_name} · {log.entity_type}{log.entity_id ? ` · ${log.entity_id}` : ''}</small></span></article>)}
    </section>
  </div>;
}

export function SystemView() {
  const [apiReady, setApiReady] = useState<boolean | null>(null);
  const [logCount, setLogCount] = useState<number | null>(null);
  const { user } = useAuth();
  useEffect(() => {
    let active = true;
    void Promise.allSettled([getLogs('sync'), getLogs('audit')]).then((results) => {
      if (!active) return;
      setApiReady(results.some((result) => result.status === 'fulfilled'));
      setLogCount(results.reduce((total, result) => total + (result.status === 'fulfilled' ? result.value.length : 0), 0));
    });
    return () => { active = false; };
  }, []);
  const status = apiReady === null ? 'Checking' : apiReady ? 'Connected' : 'Unavailable';
  return <div className="page-content"><PageHeading eyebrow="PLATFORM HEALTH" title="System status" description="Review the health of the command console and account session." />
    <div className="system-status-banner"><span className={`system-health-icon ${apiReady ? 'health-on' : apiReady === false ? 'health-off' : ''}`}><Activity size={21} /></span><span><strong>{apiReady ? 'HANDA services operational' : apiReady === false ? 'HANDA API unavailable' : 'Checking HANDA services'}</strong><small>Last checked just now · Authenticated through the HANDA API</small></span><span className={`status-pill status-${apiReady ? 'good' : apiReady === false ? 'danger' : 'neutral'}`}><i />{status}</span></div>
    <div className="metric-grid metric-grid-compact"><MetricCard label="Current administrator" value={user?.name || '—'} detail={user?.email || ''} icon={ShieldCheck} /><MetricCard label="Accessible activity" value={logCount ?? '—'} detail="Sync and audit events" icon={FileClock} tone="blue" /><MetricCard label="API connection" value={status} detail="Authenticated session" icon={Cloud} tone={apiReady ? 'green' : 'amber'} /></div>
    <section className="surface-panel settings-panel"><div className="panel-heading"><div><p className="eyebrow">OPERATIONS</p><h2>System controls</h2></div></div><SettingRow icon={RefreshCw} title="Synchronization logs" detail="Review successful and failed uploads from field devices" to="/logs" /><SettingRow icon={ShieldCheck} title="Audit history" detail="Track changes made to protected response records" to="/logs" /><SettingRow icon={Archive} title="Data and access settings" detail="Manage your administrator profile and appearance" to="/settings" /></section>
  </div>;
}

export function SettingsView() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('handa.adminTheme') || 'light');
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('handa.adminTheme', theme); }, [theme]);
  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage(''); setError('');
    try {
      if (!user) throw new Error('Administrator session is unavailable.');
      const patch: { name?: string; email?: string; password?: string } = {};
      if (name.trim() !== user.name) patch.name = name.trim();
      if (email.trim().toLowerCase() !== user.email) patch.email = email.trim().toLowerCase();
      if (newPassword) patch.password = newPassword;
      if (!Object.keys(patch).length) { setMessage('Your account details are up to date.'); return; }
      if (patch.password && patch.password.length < 8) throw new Error('Password must contain at least 8 characters.');
      await updateUser(user.id, patch);
      setMessage('Account settings saved. Sign in again if you changed your password.');
      setNewPassword('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Settings could not be saved.'); }
    finally { setSaving(false); }
  }
  return <div className="page-content"><PageHeading eyebrow="PREFERENCES" title="Settings" description="Manage your administrator profile and console appearance." />
    <div className="settings-layout"><section className="surface-panel settings-panel"><div className="panel-heading"><div><p className="eyebrow">ACCOUNT</p><h2>Administrator profile</h2></div></div><form className="form-grid" onSubmit={(event) => void saveProfile(event)}>
      <label className="form-field form-field-wide"><span>Full name</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
      <label className="form-field form-field-wide"><span>Email address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label className="form-field form-field-wide"><span>New password <small>(leave blank to keep current)</small></span><input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
      {message && <InlineNotice tone="success">{message}</InlineNotice>}{error && <InlineNotice tone="error">{error}</InlineNotice>}
      <div className="modal-actions form-field-wide"><button className="button-primary" disabled={saving}>{saving && <span className="button-spinner" />}<Save size={16} /> Save account</button></div>
    </form></section>
    <section className="surface-panel settings-panel"><div className="panel-heading"><div><p className="eyebrow">DISPLAY</p><h2>Appearance</h2><p className="panel-subtitle">Choose a console theme for this browser.</p></div></div><div className="theme-options">{[{ id: 'light', label: 'Light', icon: Sun }, { id: 'dark', label: 'Dark', icon: Moon }, { id: 'system', label: 'System', icon: SunMoon }].map(({ id, label, icon: Icon }) => <button key={id} className={`theme-option ${theme === id ? 'theme-selected' : ''}`} onClick={() => setTheme(id)} aria-pressed={theme === id}><Icon size={18} /><span>{label}</span>{theme === id && <Check size={15} />}</button>)}</div></section></div>
  </div>;
}

function SettingRow({ icon: Icon, title, detail, to }: { icon: LucideIcon; title: string; detail: string; to: string }) {
  return <a href={to} className="setting-row"><span className="setting-row-icon"><Icon size={18} /></span><span className="setting-row-copy"><strong>{title}</strong><small>{detail}</small></span><ArrowRight size={16} /></a>;
}

function Modal({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card modal-wide" role="dialog" aria-modal="true"><div className="modal-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close">×</button></div>{children}</section></div>;
}