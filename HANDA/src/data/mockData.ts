/**
 * Mock Data for Dashboard
 */

import { DashboardStats, RecentActivity, EvacuationCenter, IncidentReport } from '@types/index';

export const MOCK_DASHBOARD_STATS: DashboardStats = {
  totalEvacuees: 140,
  activeIncidents: 14,
  evacuationCenters: 3,
  pendingSync: 9,
};

export const MOCK_RECENT_ACTIVITY: RecentActivity[] = [
  {
    id: '1',
    icon: 'people',
    description: 'New evacuee registered',
    timestamp: new Date(Date.now() - 5 * 60000), // 5 minutes ago
    status: 'synced',
  },
  {
    id: '2',
    icon: 'alert-circle',
    description: 'Flooding incident reported',
    timestamp: new Date(Date.now() - 15 * 60000), // 15 minutes ago
    status: 'pending',
  },
  {
    id: '3',
    icon: 'map-pin',
    description: 'Evacuation center capacity updated',
    timestamp: new Date(Date.now() - 30 * 60000), // 30 minutes ago
    status: 'synced',
  },
  {
    id: '4',
    icon: 'check-circle',
    description: 'Evacuee reunited with family',
    timestamp: new Date(Date.now() - 45 * 60000), // 45 minutes ago
    status: 'synced',
  },
  {
    id: '5',
    icon: 'alert-triangle',
    description: 'Severe landslide warning issued',
    timestamp: new Date(Date.now() - 60 * 60000), // 1 hour ago
    status: 'pending',
  },
];

export const MOCK_EVACUATION_CENTERS: EvacuationCenter[] = [
  {
    id: 'ec-001',
    name: 'Biñan City Multi-Purpose Hall',
    location: 'Biñan, Laguna',
    capacity: 500,
    currentOccupancy: 234,
    status: 'available',
  },
  {
    id: 'ec-002',
    name: 'Barangay Gym',
    location: 'Biñan, Laguna',
    capacity: 200,
    currentOccupancy: 189,
    status: 'full',
  },
  {
    id: 'ec-003',
    name: 'School Gymnasium',
    location: 'Biñan, Laguna',
    capacity: 300,
    currentOccupancy: 156,
    status: 'available',
  },
];

export const MOCK_ACTIVE_DISASTERS = [
  {
    id: 'disaster-001',
    name: 'Typhoon Simulation',
    status: 'active' as const,
    severity: 'high' as const,
    description: 'Simulated typhoon for exercise and demonstration',
    startTime: new Date(Date.now() - 2 * 60 * 60000), // 2 hours ago
    affectedAreas: 5,
  },
];

export const MOCK_INCIDENTS: IncidentReport[] = [
  {
    id: 'incident-001',
    type: 'Flooding',
    description: 'Street flooding in residential area',
    location: 'Barangay Poblacion',
    severity: 'high',
    timestamp: new Date(Date.now() - 15 * 60000),
    status: 'acknowledged',
  },
  {
    id: 'incident-002',
    type: 'Landslide',
    description: 'Minor landslide on hillside',
    location: 'Barangay Mahabang Parang',
    severity: 'medium',
    timestamp: new Date(Date.now() - 45 * 60000),
    status: 'resolved',
  },
  {
    id: 'incident-003',
    type: 'Infrastructure Damage',
    description: 'Power lines down',
    location: 'Barangay Talipapa',
    severity: 'medium',
    timestamp: new Date(Date.now() - 30 * 60000),
    status: 'acknowledged',
  },
  {
    id: 'incident-004',
    type: 'Road Obstruction',
    description: 'Fallen tree blocking main road',
    location: 'Binan-Laguna Main Road',
    severity: 'low',
    timestamp: new Date(Date.now() - 60 * 60000),
    status: 'resolved',
  },
  {
    id: 'incident-005',
    type: 'Water Supply Issue',
    description: 'Water pipeline rupture',
    location: 'Barangay Zapote',
    severity: 'medium',
    timestamp: new Date(Date.now() - 90 * 60000),
    status: 'acknowledged',
  },
];
