import { LocalEvacueeRecord, LocalIncidentRecord } from './localDatabase';

export type AdminIncidentRecord = LocalIncidentRecord & {
  status: 'acknowledged' | 'resolved';
};

export type AdminEvacueeRecord = LocalEvacueeRecord;

export type AdminDataSnapshot = {
  incidents: AdminIncidentRecord[];
  evacuees: AdminEvacueeRecord[];
  source: 'remote' | 'unavailable';
};

export type AdminUserRecord = {
  id: string;
  name: string;
  email: string;
  role: 'Responder' | 'Resident' | 'Administrator';
  status: 'Active' | 'Inactive' | 'Pending';
  createdAt: string;
  updatedAt: string;
};
import { authenticatedFetch } from './apiClient';


function normalizeIncident(record: Record<string, any>): AdminIncidentRecord {
  return {
    id: record.id,
    type: record.type,
    description: record.description,
    severity: record.severity,
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
    age: record.age,
    sex: record.sex,
    contactNumber: record.contactNumber ?? record.contact_number ?? undefined,
    address: record.address ?? undefined,
    householdSize: record.householdSize ?? record.household_size ?? undefined,
    barangay: record.barangay ?? undefined,
    syncStatus: record.syncStatus ?? 'synced',
    createdAt: record.createdAt ?? record.created_at,
  };
}

async function fetchRecords<T>(path: string): Promise<T[]> {
  const response = await authenticatedFetch(path);
  if (!response.ok) {
    throw new Error(`Admin data request failed: ${response.status}`);
  }
  return response.json() as Promise<T[]>;
}

export async function getAdminData(): Promise<AdminDataSnapshot> {
  try {
    const [remoteIncidents, remoteEvacuees] = await Promise.all([
      fetchRecords<Record<string, any>>('/api/v1/incidents'),
      fetchRecords<Record<string, any>>('/api/v1/evacuees'),
    ]);

    return {
      incidents: remoteIncidents.map(normalizeIncident),
      evacuees: remoteEvacuees.map(normalizeEvacuee),
      source: 'remote',
    };
  } catch {
    return {
      incidents: [],
      evacuees: [],
      source: 'unavailable',
    };
  }
}

export async function getAdminUsers(): Promise<AdminUserRecord[]> {
  try {
    const records = await fetchRecords<Record<string, any>>('/api/v1/users');
    return records.map((record) => ({
      id: record.id,
      name: record.name,
      email: record.email,
      role: record.role,
      status: record.status,
      createdAt: record.createdAt ?? record.created_at,
      updatedAt: record.updatedAt ?? record.updated_at,
    }));
  } catch {
    return [];
  }
}