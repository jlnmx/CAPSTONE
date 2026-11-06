/**
 * Realtime topics, event names and payload types. Keep in sync with
 * database/migrations/20261106_realtime_broadcast.sql.
 */

import type { UserRole } from '@/types/index';

export const INCIDENTS_TOPIC = 'incidents:feed';
export const EVACUATION_CENTERS_TOPIC = 'evacuation_centers:feed';
export const RESPONDERS_TOPIC = 'responders:live';
export const notificationsTopic = (userId: string) => `user:${userId}:notifications`;

export const INCIDENT_EVENT = 'incident_changed';
export const CENTER_EVENT = 'center_changed';
export const NOTIFICATION_EVENT = 'notification_created';
export const LOCATION_EVENT = 'location';

export type ChangeOp = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimeIncident {
  id: string;
  type?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  status?: string;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface IncidentChange {
  op: ChangeOp;
  incident: RealtimeIncident;
}

export interface RealtimeEvacuationCenter {
  id: string;
  name?: string;
  location?: string;
  capacity?: number;
  current_occupancy?: number;
  status?: 'available' | 'limited' | 'full' | 'closed';
  latitude?: number | null;
  longitude?: number | null;
  updated_at?: string;
}

export interface CenterChange {
  op: ChangeOp;
  center: RealtimeEvacuationCenter;
}

export interface RealtimeNotification {
  id: string;
  incident_id: string | null;
  title: string;
  message: string;
  created_at: string;
}

export interface NotificationCreated {
  notification: RealtimeNotification;
}

export type ResponderAvailability = 'available' | 'busy';

export interface ResponderPresence {
  availability: ResponderAvailability;
  online_at: string;
}

export interface ResponderLocation {
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  ts: number;
}

export interface ResponderLive extends ResponderPresence {
  user_id: string;
  location?: ResponderLocation;
}

export const RESPONDER_LIVE_ROLES: readonly UserRole[] = ['responder', 'admin'];
