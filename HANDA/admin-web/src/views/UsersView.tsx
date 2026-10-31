import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, UserRoundPlus, Users } from 'lucide-react';
import { createUser, deleteUser, getResponderVerificationDocument, getUsers, reviewResponderApplication, updateUser } from '../api';
import type { UserInput, UserRecord } from '../types';
import type { ResponderVerificationDocument } from '../api';
import { EmptyState, InlineNotice, LoadingState, MetricCard, PageHeading } from '../components/UI';

const blankUser: UserInput = { name: '', email: '', role: 'Responder', status: 'Active', birthday: '', mobileNumber: '', currentAddress: '', password: '' };
const roles: UserRecord['role'][] = ['Responder', 'Resident', 'Administrator'];
const statuses: UserRecord['status'][] = ['Active', 'Inactive', 'Pending'];

function validBirthday(input: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day);
}

function strongPassword(value: string) {
  return value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

export default function UsersView() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All roles');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [reviewTarget, setReviewTarget] = useState<UserRecord | null>(null);
  const [reviewDocument, setReviewDocument] = useState<ResponderVerificationDocument | null>(null);
  const [reviewError, setReviewError] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewImageLoaded, setReviewImageLoaded] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [form, setForm] = useState<UserInput>(blankUser);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    try { setUsers(await getUsers()); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'User accounts could not be loaded.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  const visible = useMemo(() => users.filter((user) => {
    const matchesSearch = `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(query.toLowerCase());
    return matchesSearch && (roleFilter === 'All roles' || user.role === roleFilter) && (statusFilter === 'All statuses' || user.status === statusFilter);
  }), [users, query, roleFilter, statusFilter]);
  const responders = users.filter((user) => user.role === 'Responder').length;
  const pending = users.filter((user) => user.status === 'Pending').length;

  function openCreate() { setEditing(null); setForm(blankUser); setFormError(''); }
  function openEdit(user: UserRecord) {
    setEditing(user);
    setForm({ name: user.name, email: user.email, role: user.role, status: user.status, birthday: user.birthday?.slice(0, 10) || '', mobileNumber: user.mobileNumber || '', currentAddress: user.currentAddress || '', password: '' });
    setFormError('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    if (!form.name.trim() || !form.email.trim()) { setFormError('Name and email are required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setFormError('Enter a valid email address.'); return; }
    if (form.birthday && !validBirthday(form.birthday)) { setFormError('Enter a valid birthday.'); return; }
    const phone = (form.mobileNumber || '').replace(/[\s()-]/g, '');
    if (phone && !/^(09\d{9}|\+639\d{9}|639\d{9})$/.test(phone)) { setFormError('Enter a valid Philippine mobile number.'); return; }
    if (!editing && !strongPassword(form.password || '')) { setFormError('Password needs 8+ characters with uppercase, lowercase, number, and symbol.'); return; }
    if (!editing && (!form.birthday || !phone || !form.currentAddress?.trim())) { setFormError('Birthday, mobile number, and current address are required for new accounts.'); return; }

    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim(), email: form.email.trim().toLowerCase(), mobileNumber: phone };
      if (editing) {
        const changes: Partial<UserInput> = {};
        (Object.keys(payload) as Array<keyof UserInput>).forEach((key) => {
          if (key === 'password' && !payload.password) return;
          if (payload[key] !== formValue(editing, key)) changes[key] = payload[key] as never;
        });
        if (!Object.keys(changes).length) { setFormError('No account details have changed.'); return; }
        await updateUser(editing.id, changes);
      } else await createUser(payload);
      setEditing(null);
      await refresh();
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : 'The account could not be saved.'); }
    finally { setSaving(false); }
  }

  function formValue(user: UserRecord, key: keyof UserInput) {
    if (key === 'password') return '';
    return user[key as keyof UserRecord] ?? '';
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try { await deleteUser(deleteTarget.id); setDeleteTarget(null); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The account could not be deleted.'); }
    finally { setSaving(false); }
  }

  async function openResponderReview(user: UserRecord) {
    setReviewTarget(user);
    setReviewDocument(null);
    setReviewImageLoaded(false);
    setReviewError('');
    setReviewLoading(true);
    try { setReviewDocument(await getResponderVerificationDocument(user.id)); }
    catch (cause) { setReviewError(cause instanceof Error ? cause.message : 'The responder ID could not be loaded.'); }
    finally { setReviewLoading(false); }
  }

  async function decideResponderApplication(decision: 'approved' | 'rejected') {
    if (!reviewTarget || !reviewDocument || !reviewImageLoaded) return;
    setReviewSaving(true);
    setReviewError('');
    try {
      await reviewResponderApplication(reviewTarget.id, decision);
      setReviewTarget(null);
      setReviewDocument(null);
      await refresh();
    } catch (cause) { setReviewError(cause instanceof Error ? cause.message : 'The responder application could not be reviewed.'); }
    finally { setReviewSaving(false); }
  }

  return <div className="page-content users-page">
    <PageHeading eyebrow="ACCESS CONTROL" title="User accounts" description="Manage resident and responder access across the HANDA network." action={<button className="button-primary" onClick={openCreate}><Plus size={17} /> Add account</button>} />
    <div className="metric-grid metric-grid-compact"><MetricCard label="All accounts" value={users.length} detail="Registered profiles" icon={Users} /><MetricCard label="Responders" value={responders} detail="Field personnel" icon={UserRoundPlus} tone="blue" /><MetricCard label="Pending approval" value={pending} detail="Requires review" icon={Users} tone="amber" /></div>
    {error && <InlineNotice tone="error" onRetry={() => void refresh()}>{error}</InlineNotice>}
    <section className="surface-panel records-panel">
      <div className="records-toolbar user-toolbar">
        <label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or email" /></label>
        <select className="select-control" aria-label="Filter role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option>All roles</option>{roles.map((role) => <option key={role}>{role}</option>)}</select>
        <select className="select-control" aria-label="Filter status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
        <span className="results-count">{visible.length} of {users.length}</span>
      </div>
      {loading ? <LoadingState label="Loading user accounts" /> : visible.length === 0 ? <EmptyState title="No accounts found" detail="Adjust your filters or create a new account." /> : <div className="table-scroll"><table className="data-table user-table"><thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.map((user) => <tr key={user.id}><td><div className="person-cell"><span className="avatar avatar-table">{user.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span><strong>{user.name}{user.id === users.find((candidate) => candidate.role === 'Administrator')?.id ? ' · You' : ''}</strong><small className="cell-subtitle">{user.email}</small></span></div></td><td>{user.role}</td><td><span className={`status-pill status-${user.status === 'Active' ? 'good' : user.status === 'Pending' ? 'pending' : 'neutral'}`}><i />{user.status}</span></td><td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</td><td><div className="row-actions">{user.role === 'Responder' && user.status === 'Pending' && user.hasVerificationDocument && <button className="button-secondary" onClick={() => void openResponderReview(user)}>Review ID</button>}<button className="icon-button action-edit" aria-label={`Edit ${user.name}`} onClick={() => openEdit(user)}><Pencil size={16} /></button>{user.role !== 'Administrator' && <button className="icon-button action-delete" aria-label={`Delete ${user.name}`} onClick={() => setDeleteTarget(user)}><Trash2 size={16} /></button>}</div></td></tr>)}</tbody></table></div>}
    </section>

    {editing !== null && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}><section className="modal-card modal-wide" role="dialog" aria-modal="true"><div className="modal-heading"><div><p className="eyebrow">ACCESS CONTROL</p><h2>{editing ? 'Edit account' : 'Create account'}</h2></div><button className="icon-button" onClick={() => setEditing(null)} aria-label="Close">×</button></div><form className="form-grid" onSubmit={(event) => void submit(event)}>
      <label className="form-field"><span>Full name *</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label className="form-field"><span>Email address *</span><input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label className="form-field"><span>Role *</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as UserInput['role'] })}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label>
      <label className="form-field"><span>Account status *</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as UserInput['status'] })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
      <label className="form-field"><span>Birthday</span><input type="date" value={form.birthday} onChange={(event) => setForm({ ...form, birthday: event.target.value })} /></label>
      <label className="form-field"><span>Mobile number</span><input value={form.mobileNumber} onChange={(event) => setForm({ ...form, mobileNumber: event.target.value })} placeholder="09XXXXXXXXX" /></label>
      <label className="form-field form-field-wide"><span>Current address</span><input value={form.currentAddress} onChange={(event) => setForm({ ...form, currentAddress: event.target.value })} /></label>
      <label className="form-field form-field-wide"><span>{editing ? 'New password (leave blank to keep current)' : 'Initial password *'}</span><input type="password" required={!editing} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="new-password" /></label>
      {formError && <InlineNotice tone="error">{formError}</InlineNotice>}
      <div className="modal-actions form-field-wide"><button type="button" className="button-secondary" onClick={() => setEditing(null)}>Cancel</button><button type="submit" className="button-primary" disabled={saving}>{saving && <span className="button-spinner" />}{editing ? 'Save changes' : 'Create account'}</button></div>
    </form></section></div>}

    {reviewTarget && <div className="modal-backdrop"><section className="modal-card responder-review-modal" role="dialog" aria-modal="true" aria-labelledby="responder-review-title">
      <div className="modal-heading"><div><p className="eyebrow">RESPONDER APPLICATION</p><h2 id="responder-review-title">Review {reviewTarget.responderType || 'responder'} ID</h2><p className="modal-copy">{reviewTarget.name} · {reviewTarget.email}</p></div><button className="icon-button" onClick={() => setReviewTarget(null)} aria-label="Close review">×</button></div>
      {reviewLoading ? <LoadingState label="Loading submitted ID" /> : reviewDocument ? <div className="responder-review-content">
        <img
          src={`data:${reviewDocument.mimeType};base64,${reviewDocument.base64}`}
          alt={`Identification document submitted by ${reviewTarget.name}`}
          onLoad={() => setReviewImageLoaded(true)}
          onError={() => { setReviewImageLoaded(false); setReviewError('The responder ID image could not be displayed.'); }}
        />
        <p className="cell-subtitle">{reviewDocument.fileName}</p>
        <p className="modal-copy">Check that the identification is legible and matches the applicant before deciding.</p>
      </div> : !reviewError && <p className="modal-copy">The applicant has not submitted an ID document.</p>}
      {reviewError && <InlineNotice tone="error">{reviewError}</InlineNotice>}
      <div className="modal-actions"><button className="button-secondary" onClick={() => setReviewTarget(null)} disabled={reviewSaving}>Close</button><button className="button-danger" onClick={() => void decideResponderApplication('rejected')} disabled={!reviewImageLoaded || reviewSaving}>{reviewSaving ? 'Saving…' : 'Reject'}</button><button className="button-primary" onClick={() => void decideResponderApplication('approved')} disabled={!reviewImageLoaded || reviewSaving}>{reviewSaving ? 'Saving…' : 'Approve'}</button></div>
    </section></div>}

    {deleteTarget && <div className="modal-backdrop"><section className="modal-card confirm-modal" role="alertdialog" aria-modal="true"><p className="eyebrow">REMOVE ACCESS</p><h2>Delete this account?</h2><p className="modal-copy"><strong>{deleteTarget.name}</strong> will immediately lose access to HANDA. This action cannot be undone.</p>{error && <InlineNotice tone="error">{error}</InlineNotice>}<div className="modal-actions"><button className="button-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button><button className="button-danger" onClick={() => void confirmDelete()} disabled={saving}>{saving ? 'Deleting…' : 'Delete account'}</button></div></section></div>}
  </div>;
}