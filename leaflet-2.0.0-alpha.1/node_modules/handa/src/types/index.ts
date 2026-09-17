/**
 * Authentication and User Types
 */

export type UserRole = 'responder' | 'resident' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isDemo?: boolean;
}

export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginAsDemo: (role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
}

export interface DashboardStats {
  totalEvacuees: number;
  activeIncidents: number;
  evacuationCenters: number;
  pendingSync: number;
}

export interface RecentActivity {
  id: string;
  icon: string;
  description: string;
  timestamp: Date;
  status: 'synced' | 'pending' | 'error';
}

export interface EvacuationCenter {
  id: string;
  name: string;
  location: string;
  capacity: number;
  currentOccupancy: number;
  status: 'available' | 'full' | 'closed';
}

export interface IncidentReport {
  id: string;
  type: string;
  description: string;
  location: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  status: 'new' | 'acknowledged' | 'resolved';
}

export interface Evacuee {
  id: string;
  name: string;
  age: number;
  idType: string;
  idNumber: string;
  contactNumber: string;
  evacuationCenter: string;
  status: 'registered' | 'in-transit' | 'arrived' | 'reunited';
  registeredAt: Date;
  familyMembers?: Evacuee[];
}
