export type IncidentStatus = 'reported' | 'acknowledged' | 'in_progress' | 'resolved';
export type EvacuationStatus = 'registered' | 'checked_in' | 'evacuated' | 'released';
export type CenterStatus = 'available' | 'limited' | 'full' | 'closed';

export type ResponderIncident = {
  id: string;
  type: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  photoUris: string[];
  responsePhotoUris: string[];
  status: IncidentStatus;
  actionNotes: string;
  responsePeople: string;
  responseOrganizations: string;
  responseEtaMinutes?: number;
  responseNotes: string;
  createdAt: string;
  verifiedBy?: string;
};

export type ResponderEvacuee = {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  age: number;
  sex: string;
  contactNumber?: string;
  address?: string;
  householdSize?: number;
  barangay?: string;
  evacuationStatus: EvacuationStatus;
  createdAt: string;
};

export type ResponderDisaster = {
  id: string;
  name: string;
  description: string;
  severity: string;
  status: 'Upcoming' | 'Active' | 'Archived';
  affectedAreas: number;
  startedAt?: string;
};

export type ResponderCenter = {
  id: string;
  name: string;
  location: string;
  capacity: number;
  currentOccupancy: number;
  status: CenterStatus;
  latitude?: number;
  longitude?: number;
};

export type ResponderDataSnapshot = {
  incidents: ResponderIncident[];
  evacuees: ResponderEvacuee[];
  registeredEvacuees: number;
  disasters: ResponderDisaster[];
  centers: ResponderCenter[];
  unavailableSources: string[];
};
import { authenticatedFetch } from './apiClient';
import { fetchJsonWithCache } from './offlineCache';


async function fetchRecords<T>(path: string): Promise<T[]> {
  return (await fetchJsonWithCache<T[]>(path)).data;
}

function normalizeIncident(record: Record<string, any>): ResponderIncident {
  return {
    id: record.id,
    type: record.type,
    description: record.description,
    location: record.location ?? record.location_text ?? '',
    latitude: record.latitude,
    longitude: record.longitude,
    photoUris: record.photoUris ?? record.photo_uris ?? [],
    responsePhotoUris: record.responsePhotoUris ?? record.response_photo_uris ?? [],
    status: record.status ?? 'reported',
    actionNotes: record.actionNotes ?? record.action_notes ?? '',
    responsePeople: record.responsePeople ?? record.response_people ?? '',
    responseOrganizations: record.responseOrganizations ?? record.response_organizations ?? '',
    responseEtaMinutes: record.responseEtaMinutes ?? record.response_eta_minutes ?? undefined,
    responseNotes: record.responseNotes ?? record.response_notes ?? '',
    createdAt: record.createdAt ?? record.created_at,
    verifiedBy: record.verifiedBy ?? record.verified_by ?? undefined,
  };
}

function normalizeEvacuee(record: Record<string, any>): ResponderEvacuee {
  return {
    id: record.id,
    firstName: record.firstName ?? record.first_name,
    middleName: record.middleName ?? record.middle_name ?? undefined,
    lastName: record.lastName ?? record.last_name,
    age: record.age,
    sex: record.sex,
    contactNumber: record.contactNumber ?? record.contact_number ?? undefined,
    address: record.address,
    householdSize: record.householdSize ?? record.household_size ?? undefined,
    barangay: record.barangay,
    evacuationStatus: record.evacuationStatus ?? record.evacuation_status ?? 'registered',
    createdAt: record.createdAt ?? record.created_at,
  };
}

function normalizeDisaster(record: Record<string, any>): ResponderDisaster {
  return {
    id: record.id,
    name: record.name,
    description: record.description ?? '',
    severity: record.severity,
    status: record.status,
    affectedAreas: record.affectedAreas ?? record.affected_areas ?? 0,
    startedAt: record.startedAt ?? record.started_at ?? undefined,
  };
}

function normalizeCenter(record: Record<string, any>): ResponderCenter {
  return {
    id: record.id,
    name: record.name,
    location: record.location ?? record.location_text ?? '',
    capacity: record.capacity ?? 0,
    currentOccupancy: record.currentOccupancy ?? record.current_occupancy ?? 0,
    status: record.status,
    latitude: record.latitude,
    longitude: record.longitude,
  };
}

export type IncidentReporterContact = { name: string; mobileNumber: string; profilePicture?: string | null };

// Responder/admin-only; the public incident list never includes contact details.
export async function getIncidentReporterContacts(): Promise<Record<string, IncidentReporterContact>> {
  const records = await fetchRecords<{ incident_id: string; name: string; mobile_number: string; profile_picture?: string | null }>('/api/v1/incidents/reporters');
  return Object.fromEntries(records.filter((record) => record.mobile_number).map((record) => [record.incident_id, { name: record.name, mobileNumber: record.mobile_number, profilePicture: record.profile_picture ?? null }]));
}

export type IncidentResponderEntry = { id: string; name: string; organization: string; status: 'acknowledged' | 'in_progress'; at: string };

// Responder/admin-only; lists who acknowledged or took each active incident in progress.
export async function getIncidentResponders(): Promise<Record<string, IncidentResponderEntry[]>> {
  const records = await fetchRecords<{ incident_id: string; responder_id: string; name: string; responder_organization?: string | null; status: 'acknowledged' | 'in_progress'; created_at: string }>('/api/v1/incidents/responders');
  const grouped: Record<string, IncidentResponderEntry[]> = {};
  for (const record of records) {
    (grouped[record.incident_id] ??= []).push({ id: record.responder_id, name: record.name, organization: record.responder_organization ?? '', status: record.status, at: record.created_at });
  }
  return grouped;
}

export async function getResponderData(): Promise<ResponderDataSnapshot> {
  const [incidentResult, evacueeResult, disasterResult, centerResult, registrationResult] = await Promise.allSettled([
    fetchRecords<Record<string, any>>('/api/v1/incidents'),
    fetchRecords<Record<string, any>>('/api/v1/evacuees'),
    fetchRecords<Record<string, any>>('/api/v1/disasters'),
    fetchRecords<Record<string, any>>('/api/v1/centers'),
    fetchRecords<Record<string, any>>('/api/v1/evacuation-registrations'),
  ]);
  const unavailableSources: string[] = [];
  const recordsOrEmpty = <T,>(result: PromiseSettledResult<T[]>, source: string): T[] => {
    if (result.status === 'fulfilled') return result.value;
    unavailableSources.push(source);
    return [];
  };
  const incidents = recordsOrEmpty(incidentResult, 'incidents');
  const evacuees = recordsOrEmpty(evacueeResult, 'evacuees');
  const disasters = recordsOrEmpty(disasterResult, 'disasters');
  const centers = recordsOrEmpty(centerResult, 'centers');
  const registrations = recordsOrEmpty(registrationResult, 'registrations');
  return {
    incidents: incidents.map(normalizeIncident),
    evacuees: evacuees.map(normalizeEvacuee),
    registeredEvacuees: registrations.reduce((total, registration) => total + Number(registration.household_size ?? registration.householdSize ?? 0), 0),
    disasters: disasters.map(normalizeDisaster),
    centers: centers.map(normalizeCenter),
    unavailableSources,
  };
}

async function patch(path: string, body: Record<string, unknown>) {
  const response = await authenticatedFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Update failed: ${response.status}`);
}

export type IncidentResponseInput = { people?: string; organizations?: string; etaMinutes?: number; notes?: string };

// Omitted people/organizations let the server fill the acknowledging responder's details.
export function updateIncidentStatus(id: string, status: IncidentStatus, response: IncidentResponseInput = {}) {
  return patch(`/api/v1/incidents/${encodeURIComponent(id)}/status`, {
    status,
    ...(response.notes !== undefined && { actionNotes: response.notes, responseNotes: response.notes }),
    ...(response.people !== undefined && { responsePeople: response.people }),
    ...(response.organizations !== undefined && { responseOrganizations: response.organizations }),
    ...(response.etaMinutes !== undefined && { responseEtaMinutes: response.etaMinutes }),
  });
}

export function updateEvacueeStatus(id: string, evacuationStatus: EvacuationStatus) {
  return patch(`/api/v1/evacuees/${encodeURIComponent(id)}/status`, { evacuationStatus });
}

export type ResponseHistoryEntry = {
  id: string;
  type: string;
  description: string;
  severity: string;
  location: string;
  latitude?: number;
  longitude?: number;
  status: IncidentStatus;
  responseOrganizations: string;
  responseEtaMinutes?: number;
  responseNotes: string;
  createdAt: string;
  timeline: { status: IncidentStatus; at: string }[];
  photoUris: string[];
};

// Only the signed-in responder's own responses are returned; cached copies keep the list readable offline.
export async function getResponseHistory(): Promise<ResponseHistoryEntry[]> {
  const records = await fetchRecords<Record<string, any>>('/api/v1/responders/me/response-history');
  return records.map((record) => ({
    id: record.id,
    type: record.type,
    description: record.description ?? '',
    severity: record.severity ?? 'medium',
    location: record.location ?? '',
    latitude: record.latitude ?? undefined,
    longitude: record.longitude ?? undefined,
    status: record.status ?? 'reported',
    responseOrganizations: record.response_organizations ?? '',
    responseEtaMinutes: record.response_eta_minutes ?? undefined,
    responseNotes: record.response_notes ?? '',
    createdAt: record.created_at,
    timeline: (record.timeline ?? []).map((event: { status: IncidentStatus; at: string }) => ({ status: event.status, at: event.at })),
    photoUris: record.photoUris ?? [],
  }));
}

export async function addIncidentResponsePhoto(incidentId: string, photoUri: string): Promise<void> {
  const response = await authenticatedFetch(`/api/v1/incidents/${encodeURIComponent(incidentId)}/response-photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoUri }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(typeof result?.detail === 'string' ? result.detail : `The photo could not be sent (${response.status}).`);
  }
}
