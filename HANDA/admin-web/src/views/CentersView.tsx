import { FormEvent, useEffect, useState } from 'react';
import { Building2, MapPin, Pencil, Plus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createCenter, getCenters, updateCenter } from '../api';
import type { CenterRecord } from '../types';
import { EmptyState, InlineNotice, LoadingState, PageHeading } from '../components/UI';

type CenterForm = {
  name: string;
  location: string;
  capacity: string;
  status: CenterRecord['status'];
  coordinatorName: string;
  contactNumber: string;
  notes: string;
  latitude: string;
  longitude: string;
};

const blankForm: CenterForm = { name: '', location: '', capacity: '', status: 'available', coordinatorName: '', contactNumber: '', notes: '', latitude: '', longitude: '' };

function formForCenter(center: CenterRecord): CenterForm {
  return {
    name: center.name,
    location: center.location,
    capacity: String(center.capacity),
    status: center.status,
    coordinatorName: center.coordinatorName,
    contactNumber: center.contactNumber,
    notes: center.notes,
    latitude: center.latitude == null ? '' : String(center.latitude),
    longitude: center.longitude == null ? '' : String(center.longitude),
  };
}

export default function CentersView() {
  const navigate = useNavigate();
  const [centers, setCenters] = useState<CenterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<CenterRecord | null>(null);
  const [form, setForm] = useState<CenterForm>(blankForm);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  async function refresh() {
    setLoading(true);
    try { setCenters(await getCenters()); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load evacuation centers.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  function openCreateForm() {
    setActionError('');
    setEditingCenter(null);
    setForm(blankForm);
    setFormOpen(true);
  }

  function openEditForm(center: CenterRecord) {
    setActionError('');
    setEditingCenter(center);
    setForm(formForCenter(center));
    setFormOpen(true);
  }

  async function submitCenter(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setActionError('');
    try {
      const capacity = Number(form.capacity);
      if (!Number.isInteger(capacity) || capacity < 1) throw new Error('Enter a whole-number capacity greater than zero.');
      const hasLatitude = form.latitude.trim() !== '';
      const hasLongitude = form.longitude.trim() !== '';
      if (hasLatitude !== hasLongitude) throw new Error('Enter both map coordinates, or leave both blank.');
      const latitude = hasLatitude ? Number(form.latitude) : null;
      const longitude = hasLongitude ? Number(form.longitude) : null;
      if (latitude !== null && (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude! < -180 || longitude! > 180)) {
        throw new Error('Enter valid latitude and longitude values.');
      }
      const input = {
        name: form.name.trim(),
        location: form.location.trim(),
        capacity,
        coordinatorName: form.coordinatorName.trim(),
        contactNumber: form.contactNumber.trim(),
        notes: form.notes.trim(),
        latitude,
        longitude,
      };
      if (!input.name) throw new Error('Enter a center name.');
      if (editingCenter) {
        await updateCenter(editingCenter.id, { ...input, status: form.status });
      } else {
        await createCenter(input);
      }
      setFormOpen(false);
      await refresh();
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'The center could not be saved.'); }
    finally { setSaving(false); }
  }

  return <div className="page-content">
    <PageHeading eyebrow="FIELD RESOURCES" title="Evacuation centers" description="Manage center locations, capacity, facilities, contacts, and operating status." action={<button className="button-primary" onClick={openCreateForm}><Plus size={17} /> Add center</button>} />
    {error && <InlineNotice onRetry={() => void refresh()}>{error}</InlineNotice>}
    {loading ? <LoadingState label="Loading center capacity" /> : centers.length === 0 ? <section className="surface-panel"><EmptyState title="No centers registered" detail="Add an evacuation center to begin tracking available shelter capacity." /><button className="button-primary empty-action" onClick={openCreateForm}><Plus size={16} /> Add first center</button></section> : <div className="center-grid">{centers.map((center) => {
      const occupancy = center.capacity > 0 ? Math.min(center.currentOccupancy / center.capacity, 1) : 0;
      const fillTone = occupancy >= 0.9 ? 'capacity-danger' : occupancy >= 0.7 ? 'capacity-warning' : 'capacity-good';
      return <article
        className="center-card center-card-clickable"
        key={center.id}
        role="link"
        tabIndex={0}
        aria-label={`Manage ${center.name}`}
        onClick={() => navigate(`/centers/${encodeURIComponent(center.id)}`)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            navigate(`/centers/${encodeURIComponent(center.id)}`);
          }
        }}
      >
        <div className="center-card-head"><span className="center-emblem"><Building2 size={20} /></span><span className={`status-pill status-${center.status === 'full' || center.status === 'closed' ? 'danger' : center.status === 'limited' ? 'pending' : 'good'}`}><i />{center.status}</span></div>
        <h2>{center.name}</h2><p className="center-location"><MapPin size={14} />{center.location || 'Location unavailable'}</p>
        <div className="capacity-numbers"><span>Current occupancy</span><strong>{center.currentOccupancy.toLocaleString()} <small>/ {center.capacity.toLocaleString()}</small></strong></div>
        <div className="capacity-track"><span className={fillTone} style={{ width: `${occupancy * 100}%` }} /></div>
        <div className="capacity-foot"><span>{Math.max(0, center.capacity - center.currentOccupancy).toLocaleString()} spaces remaining</span><button className="text-button" onClick={(event) => { event.stopPropagation(); openEditForm(center); }}><Pencil size={14} /> Edit center</button></div>
        {(center.coordinatorName || center.contactNumber) && <div className="center-contact"><Users size={14} /><span>{center.coordinatorName || 'Coordinator not set'}</span><span>{center.contactNumber}</span></div>}
        {center.notes && <p className="center-location">{center.notes}</p>}
      </article>;
    })}</div>}
    {formOpen && <Modal title={editingCenter ? 'Edit evacuation center' : 'Add evacuation center'} eyebrow="FIELD RESOURCES" onClose={() => setFormOpen(false)}><form className="form-grid" onSubmit={(event) => void submitCenter(event)}>
      <Field label="Center name" value={form.name} onChange={(name) => setForm({ ...form, name })} placeholder="Barangay covered court" required />
      <Field label="Complete address / location" value={form.location} onChange={(location) => setForm({ ...form, location })} placeholder="Street, barangay, city" required />
      <Field label="Maximum capacity" value={form.capacity} onChange={(capacity) => setForm({ ...form, capacity })} placeholder="0" type="number" required />
      <Field label="Map latitude" value={form.latitude} onChange={(latitude) => setForm({ ...form, latitude })} placeholder="14.3036" type="number" />
      <Field label="Map longitude" value={form.longitude} onChange={(longitude) => setForm({ ...form, longitude })} placeholder="121.0781" type="number" />
      <Field label="Center coordinator" value={form.coordinatorName} onChange={(coordinatorName) => setForm({ ...form, coordinatorName })} placeholder="Full name" />
      <Field label="Contact number" value={form.contactNumber} onChange={(contactNumber) => setForm({ ...form, contactNumber })} placeholder="09XXXXXXXXX" />
      {editingCenter && <label className="form-field"><span>Operating status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as CenterRecord['status'] })}>{(['available', 'limited', 'full', 'closed'] as const).map((status) => <option key={status} value={status}>{status}</option>)}</select></label>}
      <Field label="Facilities and details" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} placeholder="Facilities, access instructions, or other important information" wide />
      {actionError && <InlineNotice tone="error">{actionError}</InlineNotice>}
      <ModalActions onCancel={() => setFormOpen(false)} saving={saving} label={editingCenter ? 'Save changes' : 'Add center'} />
    </form></Modal>}
  </div>;
}

function Field({ label, value, onChange, placeholder, type = 'text', required = false, wide = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; required?: boolean; wide?: boolean }) {
  return <label className={`form-field ${wide ? 'form-field-wide' : ''}`}><span>{label}{required && <i> *</i>}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} min={type === 'number' ? 1 : undefined} /></label>;
}

function Modal({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true"><div className="modal-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close">×</button></div>{children}</section></div>;
}

function ModalActions({ onCancel, saving, label }: { onCancel: () => void; saving: boolean; label: string }) {
  return <div className="modal-actions form-field-wide"><button type="button" className="button-secondary" onClick={onCancel}>Cancel</button><button type="submit" className="button-primary" disabled={saving}>{saving && <span className="button-spinner" />}{label}</button></div>;
}
