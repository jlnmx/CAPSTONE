import type { AdminSnapshot, CenterRecord, DisasterRecord, EvacueeRecord, IncidentRecord, LogRecord, UserInput, UserRecord } from './types';

const API_BASE = (import.meta.env.VITE_API_URL?.trim() || 'http://localhost:8000').replace(/\/$/, '');
export const ACCESS_TOKEN_KEY = 'handa.accessToken';

let onUnauthorized: () => void = () => undefined;

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export function clearAccessToken() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (response.status === 401 && token) {
    clearAccessToken();
    onUnauthorized();
  }
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { detail?: unknown };
    const message = Array.isArray(result.detail)
      ? result.detail.map((issue: { msg?: string }) => issue.msg || 'Invalid value').join(' ')
      : typeof result.detail === 'string' ? result.detail : `Request failed (${response.status}).`;
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function normalizeIncident(record: Record<string, any>): IncidentRecord {
  return {
    id: String(record.id),
    type: record.type || 'Incident',
    description: record.description || '',
    location: record.location ?? record.location_text ?? '',
    createdAt: record.createdAt ?? record.created_at ?? '',
    status: record.status || 'acknowledged',
    syncStatus: record.syncStatus ?? record.sync_status ?? 'synced',
    latitude: record.latitude ?? null,
    longitude: record.longitude ?? null,
    severity: record.severity || 'medium',
    actionNotes: record.actionNotes ?? record.action_notes ?? '',
    responsePeople: record.responsePeople ?? record.response_people ?? '',
    responseOrganizations: record.responseOrganizations ?? record.response_organizations ?? '',
    responseEtaMinutes: record.responseEtaMinutes ?? record.response_eta_minutes ?? null,
    responseNotes: record.responseNotes ?? record.response_notes ?? '',
  };
}

function normalizeEvacuee(record: Record<string, any>): EvacueeRecord {
  const displayName = record.displayName
    ?? [record.firstName ?? record.first_name, record.middleName ?? record.middle_name, record.lastName ?? record.last_name].filter(Boolean).join(' ');
  return {
    id: String(record.id),
    displayName: displayName || 'Unnamed evacuee',
    age: Number(record.age || 0),
    barangay: record.barangay || record.address || '',
    contactNumber: record.contactNumber ?? record.contact_number ?? '',
    centerName: record.centerName ?? record.center_name ?? '',
    status: record.status ?? record.syncStatus ?? record.sync_status ?? 'registered',
    createdAt: record.createdAt ?? record.created_at ?? record.registered_at ?? '',
    profilePicture: record.profilePicture ?? null,
  };
}

function normalizeCenter(record: Record<string, any>): CenterRecord {
  return {
    id: String(record.id),
    name: record.name,
    location: record.location ?? record.location_text ?? '',
    capacity: Number(record.capacity || 0),
    currentOccupancy: Number(record.current_occupancy ?? record.currentOccupancy ?? 0),
    status: record.status || 'available',
    coordinatorName: record.coordinator_name ?? record.coordinatorName ?? '',
    contactNumber: record.contact_number ?? record.contactNumber ?? '',
    notes: record.notes || '',
    latitude: record.latitude ?? null,
    longitude: record.longitude ?? null,
  };
}

async function records<T>(path: string): Promise<T[]> {
  return apiRequest<T[]>(path);
}

export async function getCommandMapSnapshot() {
  const [incidents, centers, reporters] = await Promise.all([
    records<Record<string, any>>('/api/v1/incidents'),
    records<Record<string, any>>('/api/v1/centers'),
    getReporterContacts(),
  ]);
  return { incidents: incidents.map((record) => withReporter(normalizeIncident(record), reporters)), centers: centers.map(normalizeCenter) };
}

// Contact details come from an admin/responder-only endpoint; a failure just hides them.
async function getReporterContacts() {
  try {
    const rows = await records<{ incident_id: string; name: string; mobile_number: string; profile_picture?: string | null }>('/api/v1/incidents/reporters');
    return new Map(rows.map((row) => [row.incident_id, row]));
  } catch {
    return new Map<string, { incident_id: string; name: string; mobile_number: string; profile_picture?: string | null }>();
  }
}

function withReporter(incident: IncidentRecord, reporters: Map<string, { name: string; mobile_number: string; profile_picture?: string | null }>): IncidentRecord {
  const reporter = reporters.get(incident.id);
  return reporter ? { ...incident, reporterName: reporter.name, reporterContact: reporter.mobile_number, reporterPicture: reporter.profile_picture ?? null } : incident;
}

export async function getAdminSnapshot(): Promise<AdminSnapshot> {
  const results = await Promise.allSettled([
    records<Record<string, any>>('/api/v1/incidents'),
    records<Record<string, any>>('/api/v1/evacuees'),
    records<Record<string, any>>('/api/v1/evacuation-registrations'),
    records<Record<string, any>>('/api/v1/centers'),
    records<Record<string, any>>('/api/v1/users'),
  ]);
  const reporters = await getReporterContacts();
  const value = <T,>(index: number): T[] => results[index].status === 'fulfilled' ? results[index].value as T[] : [];
  const registrations = value<Record<string, any>>(2);
  const registeredPeople = registrations.flatMap((registration) => {
    const shared = {
      barangay: registration.address || '',
      centerName: registration.center_name || '',
      status: registration.status || 'registered',
      createdAt: registration.registered_at || '',
    };
    const head = normalizeEvacuee({
      ...shared,
      id: `${registration.id}:head`,
      displayName: [registration.first_name, registration.middle_name, registration.last_name].filter(Boolean).join(' '),
      age: registration.age,
      contact_number: registration.contact_number,
      profilePicture: registration.resident_profile_picture ?? null,
    });
    const members = Array.isArray(registration.members) ? registration.members.map((member: Record<string, any>) => normalizeEvacuee({
      ...shared,
      id: `${registration.id}:member:${member.id}`,
      displayName: member.name,
      age: 0,
    })) : [];
    return [head, ...members];
  });
  const users = value<Record<string, any>>(4);
  return {
    incidents: value<Record<string, any>>(0).map((record) => withReporter(normalizeIncident(record), reporters)),
    evacuees: [...value<Record<string, any>>(1).map(normalizeEvacuee), ...registeredPeople],
    centers: value<Record<string, any>>(3).map(normalizeCenter),
    activePersonnel: users.filter((user) => user.role === 'Responder' && user.status === 'Active').length,
    source: results.every((result) => result.status === 'fulfilled') ? 'remote' : 'unavailable',
  };
}

export async function getCenters() {
  return (await records<Record<string, any>>('/api/v1/centers')).map(normalizeCenter);
}

export function createCenter(input: Omit<CenterRecord, 'id' | 'currentOccupancy' | 'status'>) {
  return apiRequest<CenterRecord>('/api/v1/centers', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
}

export function updateCenterCapacity(id: string, capacity: number) {
  return apiRequest<CenterRecord>(`/api/v1/centers/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ capacity }),
  });
}

export async function getUsers() {
  const users = await records<Record<string, any>>('/api/v1/users');
  return users.map((user): UserRecord => ({
    id: String(user.id), name: user.name, email: user.email, role: user.role, status: user.status,
    responderType: user.responder_type ?? user.responderType ?? null,
    hasVerificationDocument: Boolean(user.has_verification_document ?? user.hasVerificationDocument),
    birthday: user.birthday, mobileNumber: user.mobile_number ?? user.mobileNumber,
    currentAddress: user.current_address ?? user.currentAddress,
    profilePicture: user.profile_picture ?? null,
    createdAt: user.createdAt ?? user.created_at ?? '', updatedAt: user.updatedAt ?? user.updated_at ?? '',
  }));
}

export type ResponderVerificationDocument = {
  fileName: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  base64: string;
  responderType: 'Official' | 'Volunteer' | null;
};

export function getResponderVerificationDocument(userId: string) {
  return apiRequest<ResponderVerificationDocument>(`/api/v1/users/${encodeURIComponent(userId)}/verification-document`);
}

export function reviewResponderApplication(userId: string, decision: 'approved' | 'rejected') {
  return apiRequest<void>(`/api/v1/users/${encodeURIComponent(userId)}/responder-application`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  });
}

export function createUser(input: UserInput) {
  return apiRequest<UserRecord>('/api/v1/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
}

export function updateUser(id: string, input: Partial<UserInput>) {
  return apiRequest<UserRecord>(`/api/v1/users/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
}

export function deleteUser(id: string) {
  return apiRequest<void>(`/api/v1/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function getDisasters() {
  return records<DisasterRecord>('/api/v1/disasters');
}

export function createDisaster(input: Pick<DisasterRecord, 'name' | 'description' | 'severity' | 'status'> & { affectedAreas: number }) {
  return apiRequest<DisasterRecord>('/api/v1/disasters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
}

export function getLogs(category: 'sync' | 'audit') {
  return records<LogRecord>(`/api/v1/logs/${category}`);
}