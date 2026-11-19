import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { useAuth } from '@hooks/useAuth';
import { useIncidentFeed, useNotificationStream } from '@hooks/useRealtime';
import { authenticatedFetch } from '@services/apiClient';
import { ACTIVE_INCIDENT_NOTIFICATIONS_CHANGED } from '@services/incidentNotifications';

export function useUnreadActiveIncidentCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (user?.role !== 'resident' && user?.role !== 'responder') {
        setCount(0);
        return;
      }
      try {
        const response = await authenticatedFetch('/api/v1/notifications/unread-active-incidents');
        if (!response.ok) throw new Error(`Unread incident count request returned ${response.status}.`);
        const result = await response.json() as { count?: unknown };
        if (!active) return;
        const unreadCount = Number(result.count);
        setCount(Number.isFinite(unreadCount) ? Math.max(0, Math.floor(unreadCount)) : 0);
      } catch (error) {
        if (active) console.warn('Unread incident count could not be refreshed.', error);
      }
    };

    refreshRef.current = () => { void refresh(); };
    void refresh();
    const interval = setInterval(() => void refresh(), 15000);
    const subscription = DeviceEventEmitter.addListener(ACTIVE_INCIDENT_NOTIFICATIONS_CHANGED, () => void refresh());
    return () => {
      active = false;
      clearInterval(interval);
      subscription.remove();
      refreshRef.current = () => {};
    };
  }, [user?.id, user?.role]);

  const onIncidentChange = useCallback(() => refreshRef.current(), []);
  const onNotification = useCallback(({ notification }: { notification: { incident_id: string | null } }) => {
    if (notification.incident_id) refreshRef.current();
  }, []);
  useIncidentFeed(onIncidentChange);
  useNotificationStream(onNotification);

  return count;
}
