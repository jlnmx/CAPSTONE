import { authenticatedFetch } from './apiClient';
import { LocalEvacueeRecord, LocalIncidentRecord } from './localDatabase';

export type AdminIncidentRecord = LocalIncidentRecord & {
  status: 'acknowledged' | 'resolved';
};

export type AdminEvacueeRecord = LocalEvacueeRecord & {
  displayName?: string;
  householdRole?: string;
  registrationId?: string;
  centerName?: string;
};

export type AdminCenterRecord = {
  id: string;
  name: string;
  location: string;
  capacity: number;
  currentOccupancy: number;
  status: 'available' | 'limited' | 'full' | 'closed';
  coordinatorName: string;
  contactNumber: string;
  notes: string;
  latitude?: number | null;
  longitude?: number | null;
};

export type AdminCenterInput = Pick<AdminCenterRecord, 'name' | 'location' | 'capacity' | 'coordinatorName' | 'contactNumber' | 'notes'>;

export type AdminDataSnapshot = {
  incidents: AdminIncidentRecord[];
  evacuees: AdminEvacueeRecord[];
  centers: AdminCenterRecord[];
  activePersonnel: number;
  source: 'remote' | 'unavailable';
};

export type AdminUserRecord = {
  id: string;
  name: string;
  email: string;
  role: 'Responder' | 'Resident' | 'Administrator';
  status: 'Active' | 'Inactive' | 'Pending';
  responderType?: 'Official' | 'Volunteer' | null;
  hasVerificationDocument: boolean;
  birthday?: string;
  mobileNumber?: string;
  currentAddress?: string;
  createdAt: string;
  updatedAt: string;
};

export type ResponderVerificationDocument = {
  fileName: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  base64: string;
  responderType: 'Official' | 'Volunteer' | null;
};

export type AdminUserInput = {
  name: string;
  email: string;
  role: AdminUserRecord['role'];
  status: AdminUserRecord['status'];
  birthday: string;
  mobileNumber: string;
  currentAddress: string;
  password?: string;
};

export type AdminLogRecord = {
  id: number;
  action: string;
  entity_type: string;
  entity_id?: string;
  details: string;
  status: string;
  created_at: string;
  actor_name: string;
};

function normalizeIncident(record: Record<string, any>): AdminIncidentRecord {
  return {
    id: record.id,
    type: record.type,
    description: record.description,
    location: record.location ?? record.location_text ?? '',
    photoUris: record.photoUris ?? record.photo_uris ?? [],
    syncStatus: record.syncStatus ?? 'synced',
    createdAt: record.createdAt ?? record.created_at,
    status: record.status ?? 'acknowledged',
  };
}

function normalizeEvacuee(record: Record<string, any>): AdminEvacueeRecord {
  return {
    id: record.id,
    firstName: record.firstName ?? record.first_name,
    middleName: record.middleName ?? record.middle_name ?? undefined,
    lastName: record.lastName ?? record.last_name,
    age: Number(record.age ?? 0),
    sex: record.sex ?? '',
    contactNumber: record.contactNumber ?? record.contact_number ?? undefined,
    address: record.address ?? undefined,
    householdSize: record.householdSize ?? record.household_size ?? undefined,
    barangay: record.barangay ?? undefined,
    syncStatus: record.syncStatus ?? record.sync_status ?? 'synced',
    createdAt: record.createdAt ?? record.created_at,
  };
}

function normalizeRegistrationPeople(registration: Record<string, any>): AdminEvacueeRecord[] {
  const registrationId = String(registration.id);
  const headName = [registration.first_name, registration.middle_name, registration.last_name].filter(Boolean).join(' ');
  const common = {
    address: registration.address ?? undefined,
    householdSize: Number(registration.household_size ?? 1),
    barangay: undefined,
    syncStatus: registration.status ?? 'registered',
    createdAt: registration.registered_at,
    registrationId,
    centerName: registration.center_name,
  };
  const head: AdminEvacueeRecord = {
    ...common,
    id: `${registrationId}:head`,
    firstName: registration.first_name,
    middleName: registration.middle_name ?? undefined,
    lastName: registration.last_name,
    age: Number(registration.age ?? 0),
    sex: registration.sex ?? '',
    contactNumber: registration.contact_number ?? undefined,
    displayName: headName,
    householdRole: 'Registrant',
  };
  const members = Array.isArray(registration.members) ? registration.members : [];
  return [head, ...members.map((member: Record<string, any>): AdminEvacueeRecord => ({
    ...common,
    id: `${registrationId}:member:${member.id}`,
    firstName: member.name,
    middleName: undefined,
    lastName: '',
    age: 0,
    sex: '',
    contactNumber: undefined,
    displayName: member.name,
    householdRole: member.relationship,
  }))];
}

async function fetchRecords<T>(path: string): Promise<T[]> {
  const response = await authenticatedFetch(path);
  if (!response.ok) throw new Error(`Admin data request failed: ${response.status}`);
  return response.json() as Promise<T[]>;
}

function normalizeCenter(record: Record<string, any>): AdminCenterRecord {
  return {
    id: record.id,
    name: record.name,
    location: record.location ?? record.location_text ?? '',
    capacity: Number(record.capacity ?? 0),
    currentOccupancy: Number(record.current_occupancy ?? record.currentOccupancy ?? 0),
    status: record.status,
    coordinatorName: record.coordinator_name ?? record.coordinatorName ?? '',
    contactNumber: record.contact_number ?? record.contactNumber ?? '',
    notes: record.notes ?? '',
    latitude: record.latitude ?? null,
    longitude: record.longitude ?? null,
  };
}

export async function getAdminCenters(): Promise<AdminCenterRecord[]> {
  return (await fetchRecords<Record<string, any>>('/api/v1/centers')).map(normalizeCenter);
}

async function submitCenterRequest(path: string, method: 'POST' | 'PATCH', input: AdminCenterInput | { capacity: number }) {
  const response = await authenticatedFetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { detail?: string };
    throw new Error(result.detail || `Center request failed (${response.status}).`);
  }
  return normalizeCenter(await response.json() as Record<string, any>);
}

export function createAdminCenter(input: AdminCenterInput) {
  return submitCenterRequest('/api/v1/centers', 'POST', input);
}

export function updateAdminCenterCapacity(id: string, capacity: number) {
  return submitCenterRequest(`/api/v1/centers/${encodeURIComponent(id)}`, 'PATCH', { capacity });
}

export async function getAdminLogs(category: 'sync' | 'audit'): Promise<AdminLogRecord[]> {
  return fetchRecords<AdminLogRecord>(`/api/v1/logs/${category}`);
}

export async function getAdminData(): Promise<AdminDataSnapshot> {
  const results = await Promise.allSettled([
    fetchRecords<Record<string, any>>('/api/v1/incidents'),
    fetchRecords<Record<string, any>>('/api/v1/evacuees'),
    fetchRecords<Record<string, any>>('/api/v1/evacuation-registrations'),
    fetchRecords<Record<string, any>>('/api/v1/centers'),
    fetchRecords<Record<string, any>>('/api/v1/users'),
  ]);
  const recordsOrEmpty = (result: PromiseSettledResult<Record<string, any>[]>) => result.status === 'fulfilled' ? result.value : [];
  const [remoteIncidents, remoteEvacuees, registrations, centers, users] = results.map(recordsOrEmpty);
  const registrationPeople = registrations.flatMap(normalizeRegistrationPeople);

  return {
    incidents: remoteIncidents.map(normalizeIncident),
    evacuees: [...remoteEvacuees.map(normalizeEvacuee), ...registrationPeople],
    centers: centers.map(normalizeCenter),
    activePersonnel: users.filter((user) => user.role === 'Responder' && user.status === 'Active').length,
    source: results.every((result) => result.status === 'fulfilled') ? 'remote' : 'unavailable',
  };
}

export async function getAdminUsers(): Promise<AdminUserRecord[]> {
  const records = await fetchRecords<Record<string, any>>('/api/v1/users');
  return records.map((record) => ({
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    status: record.status,
    responderType: record.responder_type ?? record.responderType ?? null,
    hasVerificationDocument: Boolean(record.has_verification_document ?? record.hasVerificationDocument),
    birthday: record.birthday,
    mobileNumber: record.mobile_number ?? record.mobileNumber,
    currentAddress: record.current_address ?? record.currentAddress,
    createdAt: record.createdAt ?? record.created_at,
    updatedAt: record.updatedAt ?? record.updated_at,
  }));
}

export async function getResponderVerificationDocument(userId: string): Promise<ResponderVerificationDocument> {
  const response = await authenticatedFetch(`/api/v1/users/${encodeURIComponent(userId)}/verification-document`);
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { detail?: string };
    throw new Error(result.detail || `The responder ID could not be loaded (${response.status}).`);
  }
  return response.json() as Promise<ResponderVerificationDocument>;
}

export async function reviewResponderApplication(userId: string, decision: 'approved' | 'rejected'): Promise<void> {
  const response = await authenticatedFetch(`/api/v1/users/${encodeURIComponent(userId)}/responder-application`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { detail?: string };
    throw new Error(result.detail || `The responder application could not be reviewed (${response.status}).`);
  }
}

async function submitUserRequest(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: Record<string, string>) {
  const response = await authenticatedFetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { detail?: string };
    const detail = Array.isArray(result.detail)
      ? result.detail.map((issue: { loc?: Array<string | number>; msg?: string }) => `${issue.loc?.slice(1).join('.') || 'Account'}: ${issue.msg || 'Invalid value'}`).join(' ')
      : result.detail;
    throw new Error(detail || `Account request failed (${response.status}).`);
  }
  if (response.status === 204) return null;
  return response.json() as Promise<Record<string, any>>;
}

export async function createAdminUser(input: AdminUserInput) {
  return submitUserRequest('/api/v1/users', 'POST', input as unknown as Record<string, string>);
}

export async function updateAdminUser(id: string, input: Partial<AdminUserInput>) {
  return submitUserRequest(`/api/v1/users/${encodeURIComponent(id)}`, 'PATCH', input as Record<string, string>);
}

export async function deleteAdminUser(id: string) {
  await submitUserRequest(`/api/v1/users/${encodeURIComponent(id)}`, 'DELETE');
}
