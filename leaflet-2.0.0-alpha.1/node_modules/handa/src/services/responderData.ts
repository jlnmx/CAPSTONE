export type IncidentStatus = 'reported' | 'acknowledged' | 'in_progress' | 'resolved';
export type EvacuationStatus = 'registered' | 'checked_in' | 'evacuated' | 'released';
export type CenterStatus = 'available' | 'limited' | 'full' | 'closed';

export type ResponderIncident = {
  id: string;
  type: string;
  description: string;
  severity: string;
  location: string;
  latitude?: number;
  longitude?: number;
  photoUris: string[];
  status: IncidentStatus;
  actionNotes: string;
  createdAt: string;
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
  disasters: ResponderDisaster[];
  centers: ResponderCenter[];
};
import { authenticatedFetch } from './apiClient';


async function fetchRecords<T>(path: string): Promise<T[]> {
  const response = await authenticatedFetch(path);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T[]>;
}

function normalizeIncident(record: Record<string, any>): ResponderIncident {
  return {
    id: record.id,
    type: record.type,
    description: record.description,
    severity: record.severity,
    location: record.location ?? record.location_text ?? '',
    latitude: record.latitude,
    longitude: record.longitude,
    photoUris: record.photoUris ?? record.photo_uris ?? [],
    status: record.status ?? 'reported',
    actionNotes: record.actionNotes ?? record.action_notes ?? '',
    createdAt: record.createdAt ?? record.created_at,
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

export async function getResponderData(): Promise<ResponderDataSnapshot> {
  const [incidents, evacuees, disasters, centers] = await Promise.all([
    fetchRecords<Record<string, any>>('/api/v1/incidents'),
    fetchRecords<Record<string, any>>('/api/v1/evacuees'),
    fetchRecords<Record<string, any>>('/api/v1/disasters'),
    fetchRecords<Record<string, any>>('/api/v1/centers'),
  ]);
  return {
    incidents: incidents.map(normalizeIncident),
    evacuees: evacuees.map(normalizeEvacuee),
    disasters: disasters.map(normalizeDisaster),
    centers: centers.map(normalizeCenter),
  };
}

async function patch(path: string, body: Record<string, string>) {
  const response = await authenticatedFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Update failed: ${response.status}`);
}

export function updateIncidentStatus(id: string, status: IncidentStatus, actionNotes = '') {
  return patch(`/api/v1/incidents/${encodeURIComponent(id)}/status`, { status, actionNotes });
}

export function updateEvacueeStatus(id: string, evacuationStatus: EvacuationStatus) {
  return patch(`/api/v1/evacuees/${encodeURIComponent(id)}/status`, { evacuationStatus });
}
