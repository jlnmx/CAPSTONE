import { DeviceEventEmitter } from 'react-native';
import { authenticatedFetch } from '@services/apiClient';

export const ACTIVE_INCIDENT_NOTIFICATIONS_CHANGED = 'handa:active-incident-notifications-changed';

export function notifyActiveIncidentNotificationsChanged() {
  DeviceEventEmitter.emit(ACTIVE_INCIDENT_NOTIFICATIONS_CHANGED);
}

export async function markActiveIncidentNotificationsRead() {
  const response = await authenticatedFetch('/api/v1/notifications/active-incidents/read', { method: 'PATCH' });
  if (!response.ok) throw new Error('Active incident notifications could not be marked as read.');
  const result = await response.json() as { updated: number };
  notifyActiveIncidentNotificationsChanged();
  return result;
}
