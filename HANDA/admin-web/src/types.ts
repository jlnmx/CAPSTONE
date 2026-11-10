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
  latitude?: number | null;
  longitude?: number | null;
  severity?: string;
  actionNotes?: string;
  responsePeople?: string;
  responseOrganizations?: string;
  responseEtaMinutes?: number | null;
  responseNotes?: string;
  photoUris?: string[];
  responsePhotoUris?: string[];
  reporterName?: string;
  reporterContact?: string;
  reporterPicture?: string | null;
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
  profilePicture?: string | null;
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
  latitude?: number | null;
  longitude?: number | null;
}

export interface EvacuationHouseholdMemberInput {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  name?: string;
  relationship: string;
  age?: number | null;
  sex?: 'Male' | 'Female' | null;
  contactNumber?: string;
}

export interface EvacuationRegistrationInput {
  residentUserId?: string | null;
  centerId: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  age: number;
  sex: 'Female' | 'Male' | 'Other';
  contactNumber?: string | null;
  address: string;
  householdSize: number;
  members: EvacuationHouseholdMemberInput[];
}

export interface AdminSnapshot {
  incidents: IncidentRecord[];
  evacuees: EvacueeRecord[];
  centers: CenterRecord[];
  activePersonnel: number;
  source: 'remote' | 'unavailable';
}

export interface ActiveResponderRecord {
  id: string;
  name: string;
  responder_organization?: string | null;
  responder_barangay?: string | null;
}

export interface IncidentAssignment {
  incident_id: string;
  responder_id: string;
  name: string;
  responder_organization?: string | null;
  status: 'in_progress';
  created_at: string;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: 'Responder' | 'Resident' | 'Administrator';
  status: 'Active' | 'Inactive' | 'Pending';
  responderType?: 'Official' | 'Volunteer' | null;
  hasVerificationDocument?: boolean;
  birthday?: string;
  mobileNumber?: string;
  currentAddress?: string;
  profilePicture?: string | null;
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