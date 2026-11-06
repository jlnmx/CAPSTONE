import { useEffect, useRef } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@hooks/useAuth';
import { registerPushDevice } from '@services/pushNotifications';
import { pushNotificationRoute } from '@utils/pushNotificationRoute';

export default function PushNotificationManager() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const lastHandled = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android' || !user || user.isDemo || isLoading || (user.role !== 'resident' && user.role !== 'responder')) return undefined;
    let active = true;
    let warned = false;
    let removeListeners = () => {};
    const register = () => {
      void registerPushDevice().catch((error: unknown) => {
        console.error('Push notification registration failed:', error);
        if (active && !warned) {
          warned = true;
          Alert.alert('Notifications unavailable', 'HANDA could not enable phone notifications. Check your connection and reopen the app.');
        }
      });
    };
    register();
    void import('expo-notifications').then((notifications) => {
      if (!active) return;
      notifications.setNotificationHandler({
        handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
      });
      const handleResponse = (response: import('expo-notifications').NotificationResponse) => {
        const request = response.notification.request;
        const route = pushNotificationRoute(request.content.data.type, user.role);
        if (!route || lastHandled.current === request.identifier) return;
        lastHandled.current = request.identifier;
        router.push(route);
      };
      const responseListener = notifications.addNotificationResponseReceivedListener(handleResponse);
      const tokenListener = notifications.addPushTokenListener(register);
      void notifications.getLastNotificationResponseAsync().then((previous) => {
        if (active && previous) handleResponse(previous);
      }).catch((error: unknown) => console.error('Could not read the last notification response:', error));
      removeListeners = () => { responseListener.remove(); tokenListener.remove(); };
    }).catch((error: unknown) => console.error('Push notification listeners could not start:', error));
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') register();
    });
    const timer = setInterval(register, 15 * 60 * 1000);
    return () => {
      active = false;
      subscription.remove();
      clearInterval(timer);
      removeListeners();
    };
  }, [user?.id, user?.role, user?.isDemo, isLoading, router]);

  return null;
}
