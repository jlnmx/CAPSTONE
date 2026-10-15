export type UserRole = 'admin' | 'resident' | 'responder';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface IncidentRecord {
  id: string;
  type: string;
  description: string;
  location: string;
  createdAt: string;
  status: string;
  syncStatus: string;
}

export interface EvacueeRecord {
  id: string;
  displayName: string;
  age: number;
  barangay: string;
  contactNumber: string;
  centerName: string;
  status: string;
  createdAt: string;
}

export interface CenterRecord {
  id: string;
  name: string;
  location: string;
  capacity: number;
  currentOccupancy: number;
  status: 'available' | 'limited' | 'full' | 'closed';
  coordinatorName: string;
  contactNumber: string;
  notes: string;
}

export interface AdminSnapshot {
  incidents: IncidentRecord[];
  evacuees: EvacueeRecord[];
  centers: CenterRecord[];
  activePersonnel: number;
  source: 'remote' | 'unavailable';
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: 'Responder' | 'Resident' | 'Administrator';
  status: 'Active' | 'Inactive' | 'Pending';
  birthday?: string;
  mobileNumber?: string;
  currentAddress?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserInput {
  name: string;
  email: string;
  role: UserRecord['role'];
  status: UserRecord['status'];
  birthday?: string;
  mobileNumber?: string;
  currentAddress?: string;
  password?: string;
}

export interface DisasterRecord {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'Upcoming' | 'Active' | 'Archived';
  affected_areas: number;
  started_at: string | null;
}

export interface LogRecord {
  id: number;
  action: string;
  entity_type: string;
  entity_id?: string;
  details: string;
  status: string;
  created_at: string;
  actor_name: string;
}