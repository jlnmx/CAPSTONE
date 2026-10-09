import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Colors, BorderRadius, Shadows, Spacing } from '@constants/colors';
import { AnimatedPressable } from '@components/Buttons';
import { authenticatedFetch } from '@services/apiClient';
import { useAuth } from '@hooks/useAuth';
import { useWeather } from '@hooks/useWeather';

const GREEN = '#218B25';
const READ_IDS_KEY = 'handa.readNotificationIds';
const ROUTES = {
  incidents: '/(resident)/incidents',
  alerts: '/(resident)/alerts',
  status: '/(resident)/verify-status',
  preparedness: '/(resident)/preparedness-guide',
} as const;

type ServerNotification = { id: string; incident_id?: string | null; title: string; message: string; read_at?: string | null; created_at: string };
type NotificationItem = { id: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; color: string; title: string; detail: string; time: string; route: string; read: boolean; source: 'server' | 'local' };

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Now';
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hr ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function NotificationBell() {
  const { width } = useWindowDimensions();
  const rightGutter = Math.max(18, (width - 900) / 2 + 18);
  const router = useRouter();
  const { user } = useAuth();
  const { presentation, isLoading: isWeatherLoading, isUnavailable: isWeatherUnavailable } = useWeather();
  const [visible, setVisible] = useState(false);
  const [serverNotifications, setServerNotifications] = useState<ServerNotification[]>([]);
  const [disasters, setDisasters] = useState<Array<{ id: string; name: string; description?: string; status: string; severity?: string; started_at?: string | null }>>([]);
  const [evacuationStatus, setEvacuationStatus] = useState<{ status: string; householdCount: number } | null>(null);
  const [readIds, setReadIds] = useState<string[]>([]);

  useEffect(() => {
    void AsyncStorage.getItem(READ_IDS_KEY).then((value) => setReadIds(value ? JSON.parse(value) as string[] : [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (user?.role !== 'resident') return undefined;
    let mounted = true;
    const load = async () => {
      const [notificationResult, disasterResult, statusResult] = await Promise.allSettled([
        authenticatedFetch('/api/v1/notifications'),
        authenticatedFetch('/api/v1/disasters'),
        authenticatedFetch('/api/v1/resident/evacuation-status'),
      ]);
      if (!mounted) return;
      if (notificationResult.status === 'fulfilled' && notificationResult.value.ok) setServerNotifications(await notificationResult.value.json() as ServerNotification[]);
      if (disasterResult.status === 'fulfilled' && disasterResult.value.ok) setDisasters(await disasterResult.value.json() as typeof disasters);
      if (statusResult.status === 'fulfilled' && statusResult.value.ok) setEvacuationStatus(await statusResult.value.json() as typeof evacuationStatus);
    };
    void load();
    const refresh = setInterval(() => void load(), 15000);
    return () => { mounted = false; clearInterval(refresh); };
  }, [user?.role]);

  const notifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = serverNotifications.map((notification) => ({ id: notification.id, icon: 'alert-circle-outline', color: Colors.emergency, title: notification.title, detail: notification.message, time: formatTime(notification.created_at), route: ROUTES.incidents, read: !!notification.read_at, source: 'server' }));
    const active = disasters.find((disaster) => disaster.status.toLowerCase() === 'active');
    const upcoming = disasters.find((disaster) => disaster.status.toLowerCase() === 'upcoming');
    if (active) items.push({ id: `active-disaster-${active.id}`, icon: 'alert-octagon-outline', color: Colors.emergency, title: 'Active disaster', detail: `${active.name}${active.description ? ` · ${active.description}` : ''}`, time: 'Now', route: ROUTES.alerts, read: readIds.includes(`active-disaster-${active.id}`), source: 'local' });
    if (upcoming) items.push({ id: `upcoming-disaster-${upcoming.id}`, icon: 'calendar-alert', color: Colors.warning, title: 'Upcoming disaster', detail: `${upcoming.name}${upcoming.description ? ` · ${upcoming.description}` : ''}`, time: upcoming.started_at ? formatTime(upcoming.started_at) : 'Upcoming', route: ROUTES.alerts, read: readIds.includes(`upcoming-disaster-${upcoming.id}`), source: 'local' });
    if (evacuationStatus && evacuationStatus.status !== 'not_registered') {
      const statusLabel = evacuationStatus.status === 'checked_in' ? 'CHECKED-IN' : evacuationStatus.status.toUpperCase();
      const id = `evacuation-status-${evacuationStatus.status}`;
      items.push({ id, icon: 'account-check-outline', color: Colors.success, title: 'Evacuation status', detail: `Your household is currently ${statusLabel}.`, time: 'Live', route: ROUTES.status, read: readIds.includes(id), source: 'local' });
    }
    if (!isWeatherLoading && !isWeatherUnavailable && /rain|thunder|storm|hot|fog/i.test(presentation.description)) {
      const id = `weather-${presentation.description}`;
      items.push({ id, icon: 'weather-partly-rainy', color: Colors.secondary, title: 'Weather advisory', detail: `${presentation.description} forecast for Biñan City. Review preparedness guidance before travelling.`, time: 'Live', route: ROUTES.preparedness, read: readIds.includes(id), source: 'local' });
    }
    return items.sort((left, right) => Number(left.read) - Number(right.read));
  }, [serverNotifications, disasters, evacuationStatus, readIds, isWeatherLoading, isWeatherUnavailable, presentation.description]);

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const markNotificationRead = async (notification: NotificationItem) => {
    if (notification.read) return;
    if (notification.source === 'server') {
      await authenticatedFetch(`/api/v1/notifications/${encodeURIComponent(notification.id)}/read`, { method: 'PATCH' }).catch(() => undefined);
    } else {
      const nextReadIds = Array.from(new Set([...readIds, notification.id]));
      setReadIds(nextReadIds);
      await AsyncStorage.setItem(READ_IDS_KEY, JSON.stringify(nextReadIds));
    }
    setServerNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
  };

  const openNotification = async (notification: NotificationItem) => {
    await markNotificationRead(notification);
    setVisible(false);
    router.push(notification.route);
  };

  return (
    <>
      <AnimatedPressable
        style={styles.button}
        onPress={() => setVisible(true)}
        accessibilityLabel="Open notifications"
        accessibilityRole="button"
      >
        <MaterialCommunityIcons name="bell-outline" size={29} color={Colors.white} />
        {unreadCount > 0 && <View style={styles.dot}><Text style={styles.dotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>}
      </AnimatedPressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={[styles.backdrop, { paddingRight: rightGutter }]} onPress={() => setVisible(false)}>
          <Pressable style={styles.modal} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.title}>Notifications</Text>
                <Text style={styles.subtitle}>Updates that may affect your safety</Text>
              </View>
              <AnimatedPressable onPress={() => setVisible(false)} accessibilityLabel="Close notifications">
                <MaterialCommunityIcons name="close" size={24} color={Colors.textMuted} />
              </AnimatedPressable>
            </View>
            {notifications.length === 0 && <View style={styles.empty}><MaterialCommunityIcons name="bell-sleep-outline" size={30} color={Colors.textMuted} /><Text style={styles.emptyTitle}>No notifications</Text><Text style={styles.emptyDetail}>Relevant safety updates will appear here.</Text></View>}
            {notifications.map((notification) => (
              <Pressable key={notification.id} onPress={() => void openNotification(notification)} style={[styles.notification, !notification.read && styles.unreadNotification]} accessibilityRole="button" accessibilityLabel={`Open ${notification.title} notification`}>
                <View style={[styles.icon, { backgroundColor: `${notification.color}18` }]}>
                  <MaterialCommunityIcons name={notification.icon} size={22} color={notification.color} />
                </View>
                <View style={styles.copy}>
                  <View style={styles.notificationHeading}>
                    <Text style={[styles.notificationTitle, !notification.read && styles.unreadTitle]}>{notification.title}</Text>
                    <Text style={styles.time}>{notification.time}</Text>
                  </View>
                  <Text style={[styles.detail, !notification.read && styles.unreadDetail]}>{notification.detail}</Text>
                  <View style={styles.readRow}><Text style={styles.readHint}>{notification.read ? 'Read' : 'Tap to open'}</Text>{!notification.read && <Pressable onPress={(event) => { event.stopPropagation(); void markNotificationRead(notification); }} accessibilityRole="button"><Text style={styles.markRead}>Mark as read</Text></Pressable>}</View>
                </View>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: -1, right: -5, zIndex: 2, minWidth: 16, height: 16, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: Colors.warning, borderWidth: 1, borderColor: Colors.white },
  dotText: { color: '#3D3100', fontSize: 8, fontWeight: '900' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)', padding: 18, justifyContent: 'flex-start', alignItems: 'flex-end' },
  modal: { width: '100%', maxWidth: 430, marginTop: 62, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.lg, ...Shadows.md },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.background },
  title: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  subtitle: { color: Colors.textMuted, fontSize: 12, marginTop: 3 },
  notification: { flexDirection: 'row', paddingVertical: 13, paddingHorizontal: 7, borderBottomWidth: 1, borderBottomColor: Colors.background, borderRadius: 6 },
  unreadNotification: { backgroundColor: Colors.surfaceMuted },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  copy: { flex: 1 },
  notificationHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notificationTitle: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  unreadTitle: { color: Colors.text, fontWeight: '900' },
  time: { color: Colors.textMuted, fontSize: 10, marginLeft: 8 },
  detail: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  unreadDetail: { color: Colors.textMuted, fontWeight: '600' },
  readRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 },
  readHint: { color: '#8A9B8C', fontSize: 9 },
  markRead: { color: GREEN, fontSize: 9, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: 34 },
  emptyTitle: { color: Colors.text, fontSize: 14, fontWeight: '800', marginTop: 9 },
  emptyDetail: { color: Colors.textMuted, fontSize: 11, marginTop: 4, textAlign: 'center' },
});
