import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Archive, ArrowRight, Camera, Check, Cloud, Download, FileClock, LockKeyhole, Mail, RefreshCw, Save, ShieldCheck, Sun, Moon, SunMoon, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ACCESS_TOKEN_KEY, apiRequest, getAdminSnapshot, getLogs } from '../api';
import type { AdminSnapshot, LogRecord } from '../types';
import { useAuth } from '../auth';
import { EmptyState, InlineNotice, LoadingState, MetricCard, PageHeading } from '../components/UI';

const blankSnapshot: AdminSnapshot = { incidents: [], evacuees: [], centers: [], activePersonnel: 0, source: 'unavailable' };

export function AnalyticsView() {
  const { user } = useAuth();
  const [data, setData] = useState(blankSnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    void getAdminSnapshot(user?.isSuperAdmin ? undefined : user?.adminCategory ?? null).then((snapshot) => { setData(snapshot); setError(snapshot.source === 'remote' ? '' : 'Some statistics are incomplete because one or more data sources are unavailable.'); }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Analytics could not be loaded.')).finally(() => setLoading(false));
  }, [user?.id, user?.adminCategory, user?.isSuperAdmin]);
  const canSeeIncidents = !!user?.isSuperAdmin || user?.adminCategory === 'BCDRRMO';
  const canSeeEvacuation = !!user?.isSuperAdmin || user?.adminCategory === 'CSWD';
  const hasScope = !!user?.isSuperAdmin || Boolean(user?.adminCategory);
  const week = useMemo(() => Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(); date.setDate(date.getDate() - (6 - offset));
    const key = date.toISOString().slice(0, 10);
    return { label: date.toLocaleDateString(undefined, { weekday: 'short' }), value: data.evacuees.filter((item) => item.createdAt.slice(0, 10) === key).length };
  }), [data.evacuees]);
  const max = Math.max(1, ...week.map((item) => item.value));
  const resolved = data.incidents.filter((item) => item.status === 'resolved').length;
  const active = data.incidents.length - resolved;
  const resolution = data.incidents.length ? Math.round(resolved / data.incidents.length * 100) : 0;
  const activeDegrees = data.incidents.length ? active / data.incidents.length * 360 : 0;
  const openCenters = data.centers.filter((center) => center.status !== 'closed');
  const capacity = openCenters.reduce((total, center) => total + center.capacity, 0);
  const occupied = openCenters.reduce((total, center) => total + center.currentOccupancy, 0);
  return <div className="page-content">
    <PageHeading eyebrow="DECISION SUPPORT" title="Analytics" description="Operational metrics for the services assigned to your department." action={<button className="button-secondary" onClick={() => window.print()}><Download size={16} /> Print report</button>} />
    {!hasScope && <InlineNotice>Your sub-admin category has not been assigned. Contact a superadmin to enable department access.</InlineNotice>}
    {error && <InlineNotice>{error}</InlineNotice>}
    {loading ? <LoadingState label="Calculating operational metrics" /> : <>
      <div className="metric-grid">{canSeeEvacuation && <MetricCard label="Evacuees registered" value={data.evacuees.length} detail="Assigned evacuation records" icon={Activity} />}{canSeeIncidents && <MetricCard label="Incidents reported" value={data.incidents.length} detail={`${data.incidents.filter((item) => item.status !== 'resolved').length} active`} icon={AlertTriangle} tone="red" />}{canSeeIncidents && <MetricCard label="Resolution rate" value={`${resolution}%`} detail={`${resolved} resolved incidents`} icon={Check} tone="green" />}{canSeeEvacuation && <MetricCard label="Center utilization" value={capacity ? `${Math.round(occupied / capacity * 100)}%` : '—'} detail={`${occupied} of ${capacity} places`} icon={Cloud} tone="blue" />}</div>
      <div className="dashboard-grid analytics-grid">
        {canSeeEvacuation && <section className="surface-panel activity-panel analytics-registration-panel">
          <div className="panel-heading"><div><p className="eyebrow">REGISTRATION TREND</p><h2>Evacuees by day</h2><p className="panel-subtitle">New records during the last seven days</p></div></div>
          <div className="chart-area" role="img" aria-label="Evacuee registrations during the last seven days">
            {week.map((item) => <div className="chart-column" key={item.label}><span className="chart-count">{item.value}</span><div className="chart-track"><span className="chart-bar" style={{ height: `${Math.max(item.value ? 12 : 4, item.value / max * 100)}%` }} /></div><span className="chart-label">{item.label}</span></div>)}
          </div>
        </section>}
        {canSeeIncidents && <section className="surface-panel pie-panel">
          <p className="eyebrow">RESPONSE STATUS</p><h2>Incident breakdown</h2><p className="panel-subtitle">Active and resolved reports</p>
          <div className="incident-pie-layout">
            <div className="incident-pie" role="img" aria-label={`${active} active and ${resolved} resolved incidents`} style={{ background: `conic-gradient(var(--red) 0deg ${activeDegrees}deg, #929f94 ${activeDegrees}deg 360deg)` }}>
              <span><strong>{data.incidents.length}</strong><small>incidents</small></span>
            </div>
            <div className="incident-pie-legend">
              <div><i className="pie-active" /><span>Active</span><strong>{active}</strong></div>
              <div><i className="pie-resolved" /><span>Resolved</span><strong>{resolved}</strong></div>
            </div>
          </div>
        </section>}
        {canSeeEvacuation && <section className="surface-panel utilization-panel">
          <p className="eyebrow">SHELTER READINESS</p><h2>Center capacity</h2><p className="panel-subtitle">Occupancy in centers not marked closed</p>
          <div className="utilization-number">{capacity ? `${Math.round(occupied / capacity * 100)}%` : '—'}</div>
          <div className="capacity-track"><span className="capacity-good" style={{ width: `${capacity ? Math.min(occupied / capacity * 100, 100) : 0}%` }} /></div>
          <div className="utilization-meta"><span>Occupied <strong>{occupied}</strong></span><span>Available <strong>{Math.max(0, capacity - occupied)}</strong></span></div>
        </section>}
      </div>
    </>}
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
  const { user, refreshUser } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [middleName, setMiddleName] = useState(user?.middleName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [suffix, setSuffix] = useState(user?.suffix || '');
  const [birthday, setBirthday] = useState(user?.birthday || '');
  const [address, setAddress] = useState(user?.currentAddress || '');
  const [position, setPosition] = useState(user?.position || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [emailChannel, setEmailChannel] = useState<'email' | 'sms'>(user?.mobileNumber ? 'sms' : 'email');
  const [emailChangeToken, setEmailChangeToken] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailDestination, setEmailDestination] = useState('');
  const [passwordCurrentPassword, setPasswordCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChannel, setPasswordChannel] = useState<'email' | 'sms'>(user?.mobileNumber ? 'sms' : 'email');
  const [passwordChangeToken, setPasswordChangeToken] = useState('');
  const [passwordOtp, setPasswordOtp] = useState('');
  const [passwordDestination, setPasswordDestination] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('handa.adminTheme') || 'light');

  useEffect(() => {
    if (!user) return;
    const nameParts = user.name.split(' ');
    setFirstName(user.firstName || nameParts[0] || '');
    setMiddleName(user.middleName || '');
    setLastName(user.lastName || nameParts.slice(1).join(' '));
    setSuffix(user.suffix || '');
    setBirthday(user.birthday || '');
    setAddress(user.currentAddress || '');
    setPosition(user.position || '');
    setEmail(user.email);
    setEmailChannel(user.mobileNumber ? 'sms' : 'email');
    setPasswordChannel(user.mobileNumber ? 'sms' : 'email');
  }, [user]);

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('handa.adminTheme', theme); }, [theme]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setProfileSaving(true);
    setProfileMessage('');
    setProfileError('');
    try {
      if (!user) throw new Error('Administrator session is unavailable.');
      if (!firstName.trim() || !lastName.trim()) throw new Error('Enter your first and last name.');
      await apiRequest('/api/v1/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          middleName: middleName.trim() || null,
          lastName: lastName.trim(),
          suffix: suffix.trim() || null,
          position: position.trim() || null,
          birthday: birthday || null,
          currentAddress: address.trim(),
        }),
      });
      await refreshUser();
      setProfileMessage('Profile details saved.');
    } catch (cause) {
      setProfileError(cause instanceof Error ? cause.message : 'Profile details could not be saved.');
    } finally {
      setProfileSaving(false);
    }
  }

  async function savePicture(file?: File) {
    if (!file) return;
    setPhotoSaving(true);
    setProfileMessage('');
    setProfileError('');
    try {
      const picture = await profilePictureDataUri(file);
      await apiRequest('/api/v1/auth/profile-picture', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profilePicture: picture }),
      });
      await refreshUser();
      setProfileMessage('Profile picture updated.');
    } catch (cause) {
      setProfileError(cause instanceof Error ? cause.message : 'Profile picture could not be updated.');
    } finally {
      setPhotoSaving(false);
    }
  }

  async function removePicture() {
    setPhotoSaving(true);
    setProfileMessage('');
    setProfileError('');
    try {
      await apiRequest('/api/v1/auth/profile-picture', { method: 'DELETE' });
      await refreshUser();
      setProfileMessage('Profile picture removed.');
    } catch (cause) {
      setProfileError(cause instanceof Error ? cause.message : 'Profile picture could not be removed.');
    } finally {
      setPhotoSaving(false);
    }
  }

  async function saveEmail(event: FormEvent) {
    event.preventDefault();
    setEmailSaving(true);
    setEmailMessage('');
    setEmailError('');
    try {
      if (!user) throw new Error('Administrator session is unavailable.');
      if (!emailCurrentPassword) throw new Error('Enter your current password.');
      if (email.trim().toLowerCase() === user.email.toLowerCase()) throw new Error('Enter an email address different from your current one.');
      if (!emailChangeToken) {
        const result = await apiRequest<{ emailChangeToken?: string; destination?: string }>('/api/v1/auth/email-change/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newEmail: email.trim().toLowerCase(), currentPassword: emailCurrentPassword, channel: emailChannel }),
        });
        if (!result.emailChangeToken) throw new Error('The verification request did not return a token.');
        setEmailChangeToken(result.emailChangeToken);
        setEmailDestination(result.destination || (emailChannel === 'email' ? user.email : user.mobileNumber || ''));
        setEmailOtp('');
        setEmailMessage(`A verification code was sent to ${result.destination || 'your selected contact'}.`);
        return;
      }
      if (!/^\d{6}$/.test(emailOtp)) throw new Error('Enter the 6-digit verification code.');
      const result = await apiRequest<{ accessToken?: string }>('/api/v1/resident/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          currentPassword: emailCurrentPassword,
          emailChangeToken,
          emailChangeOtp: emailOtp,
        }),
      });
      if (result.accessToken) sessionStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
      await refreshUser();
      setEmailCurrentPassword('');
      setEmailChangeToken('');
      setEmailOtp('');
      setEmailDestination('');
      setEmailMessage('Email address updated.');
    } catch (cause) {
      setEmailError(cause instanceof Error ? cause.message : 'Email address could not be updated.');
    } finally {
      setEmailSaving(false);
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordSaving(true);
    setPasswordMessage('');
    setPasswordError('');
    try {
      if (!user) throw new Error('Administrator session is unavailable.');
      if (!passwordCurrentPassword) throw new Error('Enter your current password.');
      if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
        throw new Error('Use at least 8 characters with uppercase, lowercase, a number, and a symbol.');
      }
      if (newPassword !== confirmPassword) throw new Error('The new passwords do not match.');
      if (newPassword === passwordCurrentPassword) throw new Error('Choose a password different from your current password.');
      if (!passwordChangeToken) {
        const result = await apiRequest<{ resetToken?: string; destination?: string }>('/api/v1/auth/password-change/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword: passwordCurrentPassword, channel: passwordChannel }),
        });
        if (!result.resetToken) throw new Error('The verification request did not return a token.');
        setPasswordChangeToken(result.resetToken);
        setPasswordDestination(result.destination || (passwordChannel === 'email' ? user?.email || '' : user?.mobileNumber || ''));
        setPasswordOtp('');
        setPasswordMessage(`A verification code was sent to ${result.destination || 'your selected contact'}.`);
        return;
      }
      if (!/^\d{6}$/.test(passwordOtp)) throw new Error('Enter the 6-digit verification code.');
      const result = await apiRequest<{ accessToken?: string }>('/api/v1/resident/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordCurrentPassword,
          newPassword,
          passwordChangeToken,
          passwordChangeOtp: passwordOtp,
        }),
      });
      if (result.accessToken) sessionStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
      await refreshUser();
      setPasswordCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordChangeToken('');
      setPasswordOtp('');
      setPasswordDestination('');
      setPasswordMessage('Password updated.');
    } catch (cause) {
      setPasswordError(cause instanceof Error ? cause.message : 'Password could not be updated.');
    } finally {
      setPasswordSaving(false);
    }
  }

  function chooseEmailChannel(channel: 'email' | 'sms') {
    setEmailChannel(channel);
    setEmailChangeToken('');
    setEmailOtp('');
    setEmailDestination('');
    setEmailMessage('');
  }

  function choosePasswordChannel(channel: 'email' | 'sms') {
    setPasswordChannel(channel);
    setPasswordChangeToken('');
    setPasswordOtp('');
    setPasswordDestination('');
    setPasswordMessage('');
  }

  return <div className="page-content"><PageHeading eyebrow="PREFERENCES" title="Settings" description="Manage your profile, sign-in credentials, and console appearance." />
    <div className="settings-layout"><section className="surface-panel settings-panel"><div className="panel-heading"><div><p className="eyebrow">ACCOUNT</p><h2>Administrator profile</h2><p className="panel-subtitle">Update the personal information shown on your account.</p></div></div>
      <div className="settings-avatar-row">
        <div className="settings-avatar">{user?.profilePicture ? <img src={user.profilePicture} alt="Profile" /> : <span>{(firstName[0] || user?.name[0] || 'A').toUpperCase()}</span>}</div>
        <div className="settings-avatar-actions"><strong>Profile picture</strong><small>Square images are cropped and optimized automatically.</small><div className="settings-avatar-buttons"><label className="button-secondary settings-upload-button"><Camera size={15} />{photoSaving ? 'Uploading…' : user?.profilePicture ? 'Change photo' : 'Upload photo'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoSaving} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void savePicture(file); }} /></label>{user?.profilePicture && <button className="button-secondary" type="button" disabled={photoSaving} onClick={() => void removePicture()}><Trash2 size={15} /> Remove</button>}</div></div>
      </div>
      <form className="form-grid" onSubmit={(event) => void saveProfile(event)}>
        <label className="form-field"><span>First name</span><input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" required /></label>
        <label className="form-field"><span>Middle name <small>(optional)</small></span><input value={middleName} onChange={(event) => setMiddleName(event.target.value)} autoComplete="additional-name" /></label>
        <label className="form-field"><span>Surname</span><input value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" required /></label>
        <label className="form-field"><span>Suffix <small>(optional)</small></span><input value={suffix} onChange={(event) => setSuffix(event.target.value)} placeholder="Jr., Sr., III" /></label>
        <label className="form-field"><span>Birthdate</span><input type="date" value={birthday} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setBirthday(event.target.value)} /></label>
        <label className="form-field"><span>Position</span><input value={position} onChange={(event) => setPosition(event.target.value)} placeholder="Position or job title" /></label>
        <label className="form-field form-field-wide"><span>Address</span><textarea value={address} onChange={(event) => setAddress(event.target.value)} rows={3} /></label>
        {profileMessage && <InlineNotice tone="success">{profileMessage}</InlineNotice>}{profileError && <InlineNotice tone="error">{profileError}</InlineNotice>}
        <div className="modal-actions form-field-wide"><button className="button-primary" disabled={profileSaving}>{profileSaving && <span className="button-spinner" />}<Save size={16} /> Save profile</button></div>
      </form>
    </section>
    <section className="surface-panel settings-panel"><div className="panel-heading"><div><p className="eyebrow">DISPLAY</p><h2>Appearance</h2><p className="panel-subtitle">Choose a console theme for this browser.</p></div></div><div className="theme-options">{[{ id: 'light', label: 'Light', icon: Sun }, { id: 'dark', label: 'Dark', icon: Moon }, { id: 'system', label: 'System', icon: SunMoon }].map(({ id, label, icon: Icon }) => <button key={id} className={`theme-option ${theme === id ? 'theme-selected' : ''}`} onClick={() => setTheme(id)} aria-pressed={theme === id}><Icon size={18} /><span>{label}</span>{theme === id && <Check size={15} />}</button>)}</div></section></div>
    <div className="settings-credentials-grid">
      <section className="surface-panel settings-panel">
        <div className="panel-heading"><div><p className="eyebrow">SIGN-IN SECURITY</p><h2>Change email address</h2><p className="panel-subtitle">A one-time code goes to your currently registered contact.</p></div><Mail size={18} /></div>
        <form className="form-grid" onSubmit={(event) => void saveEmail(event)}>
          <label className="form-field form-field-wide"><span>New email address</span><input type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setEmailChangeToken(''); setEmailOtp(''); setEmailDestination(''); setEmailMessage(''); }} required /></label>
          <label className="form-field form-field-wide"><span>Current password</span><input type="password" autoComplete="current-password" value={emailCurrentPassword} onChange={(event) => setEmailCurrentPassword(event.target.value)} required /></label>
          <div className="form-field form-field-wide"><span className="field-label-text">Send code to</span><div className="credential-channel-options">{(['email', 'sms'] as const).map((channel) => <button type="button" key={channel} disabled={channel === 'sms' && !user?.mobileNumber} className={`credential-channel-option ${emailChannel === channel ? 'selected' : ''}`} onClick={() => chooseEmailChannel(channel)} aria-pressed={emailChannel === channel}>{channel === 'email' ? 'Current email' : 'Current mobile (SMS)'}</button>)}</div></div>
          {emailChangeToken && <label className="form-field form-field-wide"><span>6-digit verification code <small>sent to {emailDestination}</small></span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={emailOtp} onChange={(event) => setEmailOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} required /></label>}
          {emailMessage && <InlineNotice tone="success">{emailMessage}</InlineNotice>}{emailError && <InlineNotice tone="error">{emailError}</InlineNotice>}
          <div className="modal-actions form-field-wide"><button className="button-primary" disabled={emailSaving}>{emailSaving && <span className="button-spinner" />}<Mail size={16} /> {emailChangeToken ? 'Verify and update email' : 'Send verification code'}</button></div>
        </form>
      </section>
      <section className="surface-panel settings-panel">
        <div className="panel-heading"><div><p className="eyebrow">SIGN-IN SECURITY</p><h2>Change password</h2><p className="panel-subtitle">Use a strong password and verify the change with a one-time code.</p></div><LockKeyhole size={18} /></div>
        <form className="form-grid" onSubmit={(event) => void savePassword(event)}>
          <label className="form-field form-field-wide"><span>Current password</span><input type="password" autoComplete="current-password" value={passwordCurrentPassword} onChange={(event) => setPasswordCurrentPassword(event.target.value)} required /></label>
          <label className="form-field form-field-wide"><span>New password</span><input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setPasswordChangeToken(''); setPasswordOtp(''); setPasswordMessage(''); }} required /></label>
          <label className="form-field form-field-wide"><span>Confirm new password</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
          <div className="form-field form-field-wide"><span className="field-label-text">Send code to</span><div className="credential-channel-options">{(['email', 'sms'] as const).map((channel) => <button type="button" key={channel} disabled={channel === 'sms' && !user?.mobileNumber} className={`credential-channel-option ${passwordChannel === channel ? 'selected' : ''}`} onClick={() => choosePasswordChannel(channel)} aria-pressed={passwordChannel === channel}>{channel === 'email' ? 'Current email' : 'Current mobile (SMS)'}</button>)}</div></div>
          {passwordChangeToken && <label className="form-field form-field-wide"><span>6-digit verification code <small>sent to {passwordDestination}</small></span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={passwordOtp} onChange={(event) => setPasswordOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} required /></label>}
          {passwordMessage && <InlineNotice tone="success">{passwordMessage}</InlineNotice>}{passwordError && <InlineNotice tone="error">{passwordError}</InlineNotice>}
          <div className="modal-actions form-field-wide"><button className="button-primary" disabled={passwordSaving}>{passwordSaving && <span className="button-spinner" />}<LockKeyhole size={16} /> {passwordChangeToken ? 'Verify and update password' : 'Send verification code'}</button></div>
        </form>
      </section>
    </div>
  </div>;
}

async function profilePictureDataUri(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image.');
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 320;
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The profile picture could not be processed by this browser.');
    const side = Math.min(bitmap.width, bitmap.height);
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 320, 320);
    const dataUri = canvas.toDataURL('image/jpeg', 0.7);
    if (dataUri.length > 400_000) throw new Error('This image is too large after compression. Choose a smaller image.');
    return dataUri;
  } finally {
    bitmap.close();
  }
}

function SettingRow({ icon: Icon, title, detail, to }: { icon: LucideIcon; title: string; detail: string; to: string }) {
  return <a href={to} className="setting-row"><span className="setting-row-icon"><Icon size={18} /></span><span className="setting-row-copy"><strong>{title}</strong><small>{detail}</small></span><ArrowRight size={16} /></a>;
}
