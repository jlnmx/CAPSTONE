import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Eye, Mail, MapPin, Pencil, Phone, Plus, RotateCcw, Search, ShieldCheck, UserRoundPlus, UserRoundX, Users, X } from 'lucide-react';
import { createUser, getResponderVerificationDocument, getUsers, reviewResponderApplication, updateUser } from '../api';
import type { UserInput, UserRecord } from '../types';
import type { ResponderVerificationDocument } from '../api';
import { EmptyState, InlineNotice, LoadingState, MetricCard, PageHeading } from '../components/UI';
import { useAuth } from '../auth';

const blankUser: UserInput = { name: '', email: '', role: 'Responder', status: 'Active', birthday: '', mobileNumber: '', currentAddress: '', password: '', isSuperAdmin: false, adminCategory: null };
const roles: UserRecord['role'][] = ['Responder', 'Resident', 'Administrator'];
const statuses: UserRecord['status'][] = ['Active', 'Inactive', 'Pending'];

function formatUserDate(value?: string, includeTime = false) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Not provided';
  return includeTime
    ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function profileValue(value?: string | null) {
  return value?.trim() || 'Not provided';
}

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
  const { user: activeUser } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All roles');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name-asc' | 'name-desc'>('newest');
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ user: UserRecord; status: 'Active' | 'Inactive' } | null>(null);
  const [reviewTarget, setReviewTarget] = useState<UserRecord | null>(null);
  const [reviewDocument, setReviewDocument] = useState<ResponderVerificationDocument | null>(null);
  const [reviewError, setReviewError] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewIdLoaded, setReviewIdLoaded] = useState(false);
  const [reviewFaceLoaded, setReviewFaceLoaded] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [form, setForm] = useState<UserInput>(blankUser);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    try { setUsers(await getUsers({ includeHouseholdMembers: activeUser?.isSuperAdmin === true })); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'User accounts could not be loaded.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, [activeUser?.id, activeUser?.isSuperAdmin]);

  const visible = useMemo(() => users.filter((user) => {
    const searchText = `${user.name} ${user.email} ${user.role} ${user.mobileNumber || ''} ${user.currentAddress || ''} ${user.responderOrganization || ''} ${user.responderBarangay || ''}`.toLowerCase();
    const matchesSearch = searchText.includes(query.trim().toLowerCase());
    return matchesSearch && (roleFilter === 'All roles' || user.role === roleFilter) && (statusFilter === 'All statuses' || user.status === statusFilter);
  }).sort((left, right) => {
    if (sortOrder === 'name-asc' || sortOrder === 'name-desc') {
      const byName = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
      return sortOrder === 'name-asc' ? byName : -byName;
    }
    const leftCreated = Date.parse(left.createdAt);
    const rightCreated = Date.parse(right.createdAt);
    const leftValid = Number.isFinite(leftCreated);
    const rightValid = Number.isFinite(rightCreated);
    if (!leftValid || !rightValid) return leftValid === rightValid ? 0 : leftValid ? -1 : 1;
    return sortOrder === 'newest' ? rightCreated - leftCreated : leftCreated - rightCreated;
  }), [users, query, roleFilter, statusFilter, sortOrder]);
  const responders = users.filter((user) => user.role === 'Responder').length;
  const pending = users.filter((user) => user.status === 'Pending').length;
  const filtersActive = Boolean(query.trim()) || roleFilter !== 'All roles' || statusFilter !== 'All statuses' || sortOrder !== 'newest';

  function openCreate() { setEditing(null); setForm(blankUser); setFormError(''); setFormOpen(true); }
  function resetFilters() { setQuery(''); setRoleFilter('All roles'); setStatusFilter('All statuses'); setSortOrder('newest'); }
  function openUserOverview(user: UserRecord) {
    if (activeUser?.isSuperAdmin) setSelectedUser(user);
  }
  function openEdit(user: UserRecord) {
    setEditing(user);
    setFormOpen(true);
    setForm({ name: user.name, email: user.email, role: user.role, status: user.status, birthday: user.birthday?.slice(0, 10) || '', mobileNumber: user.mobileNumber || '', currentAddress: user.currentAddress || '', password: '', isSuperAdmin: user.isSuperAdmin ?? false, adminCategory: user.adminCategory ?? null });
    setFormError('');
  }
  function closeForm() { setFormOpen(false); setEditing(null); }

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
    if (!editing && form.isSuperAdmin && form.role !== 'Administrator') { setFormError('Superadmin access requires the Administrator role.'); return; }
    if (!editing && form.isSuperAdmin && form.status !== 'Active') { setFormError('A superadmin account must be active.'); return; }
    if (form.role === 'Administrator' && !form.isSuperAdmin && !form.adminCategory) { setFormError('Choose BCDRRMO or CSWD for this sub-admin account.'); return; }

    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim(), email: form.email.trim().toLowerCase(), mobileNumber: phone };
      if (editing) {
        const changes: Partial<UserInput> = {};
        const editableFields: Array<keyof UserInput> = ['name', 'role', 'birthday', 'mobileNumber', 'currentAddress', 'adminCategory'];
        editableFields.forEach((key) => {
          const currentValue = key === 'adminCategory' ? editing.adminCategory ?? null : formValue(editing, key);
          const nextValue = key === 'adminCategory' ? payload.adminCategory ?? null : payload[key];
          if (nextValue !== currentValue) changes[key] = nextValue as never;
        });
        if (!Object.keys(changes).length) { setFormError('No account details have changed.'); return; }
        await updateUser(editing.id, changes);
      } else await createUser(payload);
      closeForm();
      await refresh();
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : 'The account could not be saved.'); }
    finally { setSaving(false); }
  }

  function formValue(user: UserRecord, key: keyof UserInput) {
    if (key === 'password') return '';
    return user[key as keyof UserRecord] ?? '';
  }

  async function confirmStatusChange() {
    if (!statusTarget) return;
    setSaving(true);
    try { await updateUser(statusTarget.user.id, { status: statusTarget.status }); setStatusTarget(null); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The account status could not be changed.'); }
    finally { setSaving(false); }
  }

  async function openResponderReview(user: UserRecord) {
    setReviewTarget(user);
    setReviewDocument(null);
    setReviewIdLoaded(false);
    setReviewFaceLoaded(false);
    setReviewError('');
    setReviewLoading(true);
    try { setReviewDocument(await getResponderVerificationDocument(user.id)); }
    catch (cause) { setReviewError(cause instanceof Error ? cause.message : 'The responder ID could not be loaded.'); }
    finally { setReviewLoading(false); }
  }

  async function decideResponderApplication(decision: 'approved' | 'rejected') {
    if (!reviewTarget || !reviewDocument || !reviewIdLoaded || (reviewDocument.faceBase64 && !reviewFaceLoaded)) return;
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
      <div className="user-filter-toolbar">
        <label className="search-field user-search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, phone, or location" aria-label="Search user accounts" />{query && <button type="button" className="user-search-clear" onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}</label>
        <label className="user-filter-control"><span>Role</span><select className="select-control" aria-label="Filter role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option>All roles</option>{roles.map((role) => <option key={role}>{role}</option>)}</select></label>
        <label className="user-filter-control"><span>Status</span><select className="select-control" aria-label="Filter status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
        <label className="user-filter-control"><span>Sort by</span><select className="select-control" aria-label="Sort user accounts" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as typeof sortOrder)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name-asc">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
        </select></label>
        <div className="user-filter-summary"><span>Showing <strong>{visible.length}</strong> of {users.length} accounts</span>{filtersActive && <button type="button" className="user-reset-filters" onClick={resetFilters}><RotateCcw size={14} /> Clear filters</button>}</div>
      </div>
      {loading ? <LoadingState label="Loading user accounts" /> : visible.length === 0 ? <EmptyState title="No accounts found" detail="Adjust your filters or create a new account." /> : (
        <div className="table-scroll">
          <table className="data-table user-table">
            <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{visible.map((user) => <tr key={user.id} className={activeUser?.isSuperAdmin ? 'user-row-clickable' : undefined} onClick={() => openUserOverview(user)} onKeyDown={(event) => {
              if (activeUser?.isSuperAdmin && event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                openUserOverview(user);
              }
            }} tabIndex={activeUser?.isSuperAdmin ? 0 : undefined} aria-label={activeUser?.isSuperAdmin ? `View ${user.name}'s profile` : undefined}>
              <td><div className="person-cell">
                <span className="avatar avatar-table" style={user.profilePicture ? { padding: 0, overflow: 'hidden' } : undefined}>
                  {user.profilePicture ? <img src={user.profilePicture} alt={`${user.name} profile`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : user.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}
                </span>
                <span><strong>{user.name}{user.id === activeUser?.id ? ' · You' : ''}{user.isSuperAdmin ? ' · Superadmin' : ''}</strong><small className="cell-subtitle">{user.email}</small></span>
              </div></td>
              <td>{user.role}{user.adminCategory && <small className="cell-subtitle">{user.adminCategory} admin</small>}</td>
              <td><span className={`status-pill status-${user.status === 'Active' ? 'good' : user.status === 'Pending' ? 'pending' : 'neutral'}`}><i />{user.status}</span></td>
              <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</td>
              <td onClick={(event) => event.stopPropagation()}><div className="row-actions">
                {activeUser?.isSuperAdmin && <button className="button-secondary user-view-button" aria-label={`View profile for ${user.name}`} onClick={() => openUserOverview(user)}><Eye size={14} /><span>View</span></button>}
                {user.role === 'Responder' && user.status === 'Pending' && user.hasVerificationDocument && <button className="button-secondary" onClick={() => void openResponderReview(user)}>Review ID &amp; face</button>}
                <button className="icon-button action-edit" aria-label={`Edit ${user.name}`} onClick={() => openEdit(user)} disabled={!!user.isSuperAdmin && user.id !== activeUser?.id}><Pencil size={16} /></button>
                {!user.isSuperAdmin && user.id !== activeUser?.id && user.status === 'Active' && <button className="button-secondary user-deactivate-button" aria-label={`Deactivate ${user.name}`} onClick={() => setStatusTarget({ user, status: 'Inactive' })}><UserRoundX size={15} /><span>Deactivate</span></button>}
                {!user.isSuperAdmin && user.id !== activeUser?.id && user.status === 'Inactive' && <button className="button-secondary user-activate-button" aria-label={`Reactivate ${user.name}`} onClick={() => setStatusTarget({ user, status: 'Active' })}><ShieldCheck size={15} /><span>Reactivate</span></button>}
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </section>

    {formOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}><section className="modal-card modal-wide" role="dialog" aria-modal="true"><div className="modal-heading"><div><p className="eyebrow">ACCESS CONTROL</p><h2>{editing ? 'Edit account' : 'Create account'}</h2></div><button className="icon-button" onClick={closeForm} aria-label="Close">×</button></div><form className="form-grid" onSubmit={(event) => void submit(event)}>
      <label className="form-field"><span>Full name *</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label className="form-field"><span>Email address *</span><input type="email" required readOnly={!!editing} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />{editing && <small className="user-email-help">Email changes must be verified by the account owner in their account settings.</small>}</label>
      <label className="form-field"><span>Role *</span><select disabled={editing?.id === activeUser?.id || editing?.isSuperAdmin} value={form.role} onChange={(event) => { const role = event.target.value as UserInput['role']; setForm({ ...form, role, adminCategory: role === 'Administrator' ? form.adminCategory : null, isSuperAdmin: role === 'Administrator' && form.isSuperAdmin }); }}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label>
      {editing ? <div className="form-field"><span>Account status</span><div className="user-edit-status"><span className={`status-pill status-${editing.status === 'Active' ? 'good' : editing.status === 'Pending' ? 'pending' : 'neutral'}`}><i />{editing.status}</span><small>Change access using the confirmed status action on the account list.</small></div></div> : <label className="form-field"><span>Account status *</span><select disabled={!editing && !!form.isSuperAdmin} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as UserInput['status'] })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>}
      {form.role === 'Administrator' && !form.isSuperAdmin && <label className="form-field"><span>Sub-admin category *</span><select disabled={editing?.id === activeUser?.id} required={!form.isSuperAdmin} value={form.adminCategory ?? ''} onChange={(event) => setForm({ ...form, adminCategory: (event.target.value || null) as UserInput['adminCategory'] })}><option value="">Select category</option><option value="BCDRRMO">BCDRRMO · Dispatch and incidents</option><option value="CSWD">CSWD · Evacuation and centers</option></select></label>}
      {!editing && <label className="superadmin-option form-field-wide"><input type="checkbox" checked={!!form.isSuperAdmin} onChange={(event) => setForm({ ...form, isSuperAdmin: event.target.checked, adminCategory: event.target.checked ? null : form.adminCategory, role: event.target.checked ? 'Administrator' : form.role, status: event.target.checked ? 'Active' : form.status })} /><span><strong>Create as superadmin</strong><small>{form.role === 'Administrator' ? 'Full Command Center access, including user management. Leave unchecked to create a sub-admin.' : 'Grants full Command Center access, including user management and account administration.'}</small></span></label>}
      <label className="form-field"><span>Birthday</span><input type="date" value={form.birthday} onChange={(event) => setForm({ ...form, birthday: event.target.value })} /></label>
      <label className="form-field"><span>Mobile number</span><input value={form.mobileNumber} onChange={(event) => setForm({ ...form, mobileNumber: event.target.value })} placeholder="09XXXXXXXXX" /></label>
      <label className="form-field form-field-wide"><span>Current address</span><input value={form.currentAddress} onChange={(event) => setForm({ ...form, currentAddress: event.target.value })} /></label>
      {!editing && <label className="form-field form-field-wide"><span>Initial password *</span><input type="password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="new-password" /></label>}
      {editing && <p className="user-password-help form-field-wide">Password changes are handled through the account’s secure password reset process.</p>}
      {formError && <InlineNotice tone="error">{formError}</InlineNotice>}
      <div className="modal-actions form-field-wide"><button type="button" className="button-secondary" onClick={closeForm}>Cancel</button><button type="submit" className="button-primary" disabled={saving}>{saving && <span className="button-spinner" />}{editing ? 'Save changes' : 'Create account'}</button></div>
    </form></section></div>}

    {selectedUser && <div className="modal-backdrop user-overview-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedUser(null); }}><section className="modal-card user-overview-modal" role="dialog" aria-modal="true" aria-labelledby="user-overview-title">
      <div className="user-overview-heading">
        <div className="user-overview-identity">
          <span className="user-overview-avatar">{selectedUser.profilePicture ? <img src={selectedUser.profilePicture} alt="" /> : selectedUser.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>
          <div className="user-overview-title-copy"><p className="eyebrow">ACCOUNT PROFILE</p><h2 id="user-overview-title">{selectedUser.name}</h2><p>{selectedUser.email}</p><div className="user-overview-badges"><span className={`status-pill status-${selectedUser.status === 'Active' ? 'good' : selectedUser.status === 'Pending' ? 'pending' : 'neutral'}`}><i />{selectedUser.status}</span><span className="user-overview-role">{selectedUser.isSuperAdmin ? 'Superadmin' : selectedUser.adminCategory ? `${selectedUser.adminCategory} admin` : selectedUser.role}</span></div></div>
        </div>
        <button className="icon-button user-overview-close" onClick={() => setSelectedUser(null)} aria-label="Close profile overview"><X size={18} /></button>
      </div>
      <div className="user-overview-body">
        <section className="user-overview-section">
          <h3><Users size={15} /> Personal information</h3>
          <dl className="user-overview-grid">
            <div><dt><Mail size={14} /> Email</dt><dd>{profileValue(selectedUser.email)}</dd></div>
            <div><dt><Phone size={14} /> Mobile number</dt><dd>{profileValue(selectedUser.mobileNumber)}</dd></div>
            <div><dt><CalendarDays size={14} /> Birthday</dt><dd>{formatUserDate(selectedUser.birthday)}</dd></div>
            <div><dt>Sex</dt><dd>{profileValue(selectedUser.sex)}</dd></div>
            <div className="user-overview-wide"><dt><MapPin size={14} /> Current address</dt><dd>{profileValue(selectedUser.currentAddress)}</dd></div>
          </dl>
        </section>
        <section className="user-overview-section">
          <h3><ShieldCheck size={15} /> Account and access</h3>
          <dl className="user-overview-grid">
            <div><dt>Role</dt><dd>{selectedUser.role}</dd></div>
            {selectedUser.adminCategory && <div><dt>Admin category</dt><dd>{selectedUser.adminCategory}</dd></div>}
            <div><dt>Account created</dt><dd>{formatUserDate(selectedUser.createdAt, true)}</dd></div>
            <div><dt>Last updated</dt><dd>{formatUserDate(selectedUser.updatedAt, true)}</dd></div>
            {selectedUser.role === 'Responder' && <>
              <div><dt>Responder type</dt><dd>{profileValue(selectedUser.responderType)}</dd></div>
              <div><dt>Organization</dt><dd>{profileValue(selectedUser.responderOrganization)}</dd></div>
              <div><dt>Barangay</dt><dd>{profileValue(selectedUser.responderBarangay)}</dd></div>
              <div><dt>Verification document</dt><dd>{selectedUser.hasVerificationDocument ? 'Submitted' : 'Not submitted'}</dd></div>
            </>}
            <div className="user-overview-wide"><dt>Account ID</dt><dd className="user-overview-id">{selectedUser.id}</dd></div>
          </dl>
        </section>
        {selectedUser.role === 'Resident' && <section className="user-overview-section">
          <div className="user-overview-section-heading"><h3><Users size={15} /> Household members</h3><span>{selectedUser.householdMembers?.length ?? 0}</span></div>
          {selectedUser.householdMembers?.length ? <div className="user-household-list">{selectedUser.householdMembers.map((member, index) => <article className="user-household-member" key={`${selectedUser.id}-household-${index}`}>
            <div><strong>{profileValue(member.name)}</strong><small>{profileValue(member.relationship)}</small></div>
            <span>{member.age == null ? 'Age not provided' : `${member.age} years`}</span>
            <span>{profileValue(member.contactNumber)}</span>
          </article>)}</div> : <p className="user-overview-empty">No household members have been added to this profile.</p>}
        </section>}
      </div>
      <div className="user-overview-actions"><button className="button-secondary" onClick={() => setSelectedUser(null)}>Close</button><button className="button-primary" onClick={() => { const userToEdit = selectedUser; setSelectedUser(null); openEdit(userToEdit); }} disabled={!!selectedUser.isSuperAdmin && selectedUser.id !== activeUser?.id}><Pencil size={15} /> Edit account</button></div>
    </section></div>}

    {reviewTarget && <div className="modal-backdrop"><section className="modal-card responder-review-modal" role="dialog" aria-modal="true" aria-labelledby="responder-review-title">
      <div className="modal-heading"><div><p className="eyebrow">RESPONDER APPLICATION</p><h2 id="responder-review-title">Review ID &amp; face photo</h2><p className="modal-copy">{reviewTarget.name} · {reviewTarget.email}</p></div><button className="icon-button" onClick={() => setReviewTarget(null)} aria-label="Close review">×</button></div>
      {reviewLoading ? <LoadingState label="Loading responder documents" /> : reviewDocument ? <div className="responder-review-content">
        <article className="responder-review-document">
          <h3>Responder ID</h3>
          <img
            src={`data:${reviewDocument.mimeType};base64,${reviewDocument.base64}`}
            alt={`Identification document submitted by ${reviewTarget.name}`}
            onLoad={() => setReviewIdLoaded(true)}
            onError={() => { setReviewIdLoaded(false); setReviewError('The responder ID image could not be displayed.'); }}
          />
          <p className="cell-subtitle">{reviewDocument.fileName}</p>
        </article>
        {reviewDocument.faceBase64 && reviewDocument.faceMimeType ? <article className="responder-review-document">
          <h3>Face photo</h3>
          <img
            src={`data:${reviewDocument.faceMimeType};base64,${reviewDocument.faceBase64}`}
            alt={`Face photo submitted by ${reviewTarget.name}`}
            onLoad={() => setReviewFaceLoaded(true)}
            onError={() => { setReviewFaceLoaded(false); setReviewError('The responder face photo could not be displayed.'); }}
          />
          <p className="cell-subtitle">{reviewDocument.faceFileName}</p>
        </article> : <div className="responder-review-legacy"><strong>Face photo not available</strong><p className="modal-copy">This application predates the face-photo requirement. Review the submitted ID before deciding.</p></div>}
        <p className="modal-copy responder-review-guidance">Check that the ID is legible and that the face photo is suitable for manual review. Face detection only checks for a visible face; it does not identify or match a person.</p>
      </div> : !reviewError && <p className="modal-copy">The applicant has not submitted an ID document.</p>}
      {reviewError && <InlineNotice tone="error">{reviewError}</InlineNotice>}
      <div className="modal-actions"><button className="button-secondary" onClick={() => setReviewTarget(null)} disabled={reviewSaving}>Close</button><button className="button-danger" onClick={() => void decideResponderApplication('rejected')} disabled={!reviewDocument || !reviewIdLoaded || (!!reviewDocument.faceBase64 && !reviewFaceLoaded) || reviewSaving}>{reviewSaving ? 'Saving…' : 'Reject'}</button><button className="button-primary" onClick={() => void decideResponderApplication('approved')} disabled={!reviewDocument || !reviewIdLoaded || (!!reviewDocument.faceBase64 && !reviewFaceLoaded) || reviewSaving}>{reviewSaving ? 'Saving…' : 'Approve'}</button></div>
    </section></div>}

    {statusTarget && <div className="modal-backdrop"><section className="modal-card confirm-modal" role="alertdialog" aria-modal="true"><p className="eyebrow">ACCESS CONTROL</p><h2>{statusTarget.status === 'Inactive' ? 'Deactivate this account?' : 'Reactivate this account?'}</h2><p className="modal-copy"><strong>{statusTarget.user.name}</strong>{statusTarget.status === 'Inactive' ? ' will lose access to HANDA and active sessions will be signed out. Their account and records will be retained.' : ' will regain access to HANDA and can sign in again.'}</p>{error && <InlineNotice tone="error">{error}</InlineNotice>}<div className="modal-actions"><button className="button-secondary" onClick={() => setStatusTarget(null)}>Cancel</button>{statusTarget.status === 'Inactive' ? <button className="button-danger" onClick={() => void confirmStatusChange()} disabled={saving}>{saving ? 'Deactivating…' : 'Deactivate account'}</button> : <button className="button-primary" onClick={() => void confirmStatusChange()} disabled={saving}>{saving ? 'Reactivating…' : 'Reactivate account'}</button>}</div></section></div>}
  </div>;
}