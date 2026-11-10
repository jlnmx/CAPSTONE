import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors } from '@constants/colors';
import { AppBoldFontFamily, AppFontFamily, AppHeadingFontFamily, AppMediumFontFamily, AppSemiboldFontFamily } from '@constants/typography';
import { AnimatedPressable } from '@components/Buttons';
import { authenticatedFetch } from '@services/apiClient';
import { useAuth } from '@hooks/useAuth';
import { useNotificationStream } from '@hooks/useRealtime';
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
  const { width, height } = useWindowDimensions();
  const horizontalPadding = width < 500 ? 14 : Math.max(18, (width - 900) / 2 + 18);
  const router = useRouter();
  const { user } = useAuth();
  const { presentation, isLoading: isWeatherLoading, isUnavailable: isWeatherUnavailable } = useWeather();
  const [visible, setVisible] = useState(false);
  const [serverNotifications, setServerNotifications] = useState<ServerNotification[]>([]);
  const [disasters, setDisasters] = useState<Array<{ id: string; name: string; description?: string; status: string; severity?: string; started_at?: string | null }>>([]);
  const [evacuationStatus, setEvacuationStatus] = useState<{ status: string; householdCount: number } | null>(null);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [updatingIds, setUpdatingIds] = useState<string[]>([]);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [actionError, setActionError] = useState('');

  useNotificationStream(({ notification }) => {
    setServerNotifications((current) => current.some((item) => item.id === notification.id) ? current : [{ ...notification, read_at: null }, ...current]);
  });

  useEffect(() => {
    void AsyncStorage.getItem(READ_IDS_KEY).then((value) => setReadIds(value ? JSON.parse(value) as string[] : [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (user?.role !== 'resident' && user?.role !== 'responder') return undefined;
    let mounted = true;
    const load = async () => {
      const notificationResult = await authenticatedFetch('/api/v1/notifications').catch(() => null);
      if (!mounted) return;
      if (notificationResult?.ok) setServerNotifications(await notificationResult.json() as ServerNotification[]);
      if (user?.role !== 'resident') return;
      const [disasterResult, statusResult] = await Promise.allSettled([
        authenticatedFetch('/api/v1/disasters'),
        authenticatedFetch('/api/v1/resident/evacuation-status'),
      ]);
      if (!mounted) return;
      if (disasterResult.status === 'fulfilled' && disasterResult.value.ok) setDisasters(await disasterResult.value.json() as typeof disasters);
      if (statusResult.status === 'fulfilled' && statusResult.value.ok) setEvacuationStatus(await statusResult.value.json() as typeof evacuationStatus);
    };
    void load();
    const refresh = setInterval(() => void load(), 15000);
    return () => { mounted = false; clearInterval(refresh); };
  }, [user?.role]);

  const notifications = useMemo<NotificationItem[]>(() => {
    const incidentRoute = user?.role === 'responder' ? '/(responder)/incidents' : ROUTES.incidents;
    const items: NotificationItem[] = serverNotifications.map((notification) => ({ id: notification.id, icon: 'alert-circle-outline', color: Colors.emergency, title: notification.title, detail: notification.message, time: formatTime(notification.created_at), route: incidentRoute, read: !!notification.read_at, source: 'server' }));
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
  }, [serverNotifications, disasters, evacuationStatus, readIds, isWeatherLoading, isWeatherUnavailable, presentation.description, user?.role]);

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const markNotificationRead = async (notification: NotificationItem) => {
    if (notification.read) return true;
    if (updatingIds.includes(notification.id)) return false;
    setActionError('');
    setUpdatingIds((current) => [...current, notification.id]);
    try {
      if (notification.source === 'server') {
        const response = await authenticatedFetch(`/api/v1/notifications/${encodeURIComponent(notification.id)}/read`, { method: 'PATCH' });
        if (!response.ok) throw new Error('Unable to mark this notification as read. Please try again.');
      } else {
        const nextReadIds = Array.from(new Set([...readIds, notification.id]));
        await AsyncStorage.setItem(READ_IDS_KEY, JSON.stringify(nextReadIds));
        setReadIds(nextReadIds);
      }
      setServerNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
      return true;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to mark this notification as read. Please try again.');
      return false;
    } finally {
      setUpdatingIds((current) => current.filter((id) => id !== notification.id));
    }
  };

  const openNotification = async (notification: NotificationItem) => {
    const markedRead = await markNotificationRead(notification);
    if (!markedRead) return;
    setVisible(false);
    router.push(notification.route);
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((notification) => !notification.read);
    if (!unread.length || isMarkingAllRead) return;
    setIsMarkingAllRead(true);
    setActionError('');
    try {
      const serverItems = unread.filter((notification) => notification.source === 'server');
      const responses = await Promise.all(serverItems.map((notification) =>
        authenticatedFetch(`/api/v1/notifications/${encodeURIComponent(notification.id)}/read`, { method: 'PATCH' }),
      ));
      if (responses.some((response) => !response.ok)) {
        throw new Error('Some notifications could not be marked as read. Please try again.');
      }

      const localIds = unread.filter((notification) => notification.source === 'local').map((notification) => notification.id);
      const nextReadIds = Array.from(new Set([...readIds, ...localIds]));
      if (localIds.length) {
        await AsyncStorage.setItem(READ_IDS_KEY, JSON.stringify(nextReadIds));
        setReadIds(nextReadIds);
      }
      const readAt = new Date().toISOString();
      const serverIds = new Set(serverItems.map((notification) => notification.id));
      setServerNotifications((current) => current.map((item) => serverIds.has(item.id) ? { ...item, read_at: readAt } : item));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to mark notifications as read. Please try again.');
    } finally {
      setIsMarkingAllRead(false);
    }
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

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)} statusBarTranslucent>
        <View style={[styles.backdrop, { paddingHorizontal: horizontalPadding, paddingVertical: Math.max(14, Math.min(42, height * 0.06)) }]}>
          <Pressable style={styles.backdropDismiss} onPress={() => setVisible(false)} accessibilityLabel="Close notifications" accessibilityRole="button" />
          <View style={[styles.modal, { maxHeight: height - Math.max(28, Math.min(84, height * 0.12)) }]}>
            <View style={styles.modalHeader}>
              <View style={styles.headerCopy}>
                <View style={styles.titleRow}>
                  <Text style={styles.title}>Notifications</Text>
                  {unreadCount > 0 && <View style={styles.unreadBadge}><Text style={styles.unreadBadgeText}>{unreadCount} new</Text></View>}
                </View>
                <Text style={styles.subtitle}>Safety updates and important activity</Text>
              </View>
              <AnimatedPressable style={styles.closeButton} onPress={() => setVisible(false)} accessibilityLabel="Close notifications" accessibilityRole="button">
                <MaterialCommunityIcons name="close" size={24} color={Colors.textMuted} />
              </AnimatedPressable>
            </View>
            {unreadCount > 0 && (
              <AnimatedPressable
                style={[styles.markAllButton, isMarkingAllRead && styles.disabledButton]}
                onPress={() => void markAllAsRead()}
                disabled={isMarkingAllRead}
                accessibilityRole="button"
                accessibilityLabel="Mark all notifications as read"
              >
                <MaterialCommunityIcons name="check-all" size={19} color={GREEN} />
                <Text style={styles.markAllText}>{isMarkingAllRead ? 'Marking as read…' : 'Mark all as read'}</Text>
              </AnimatedPressable>
            )}
            {actionError ? (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color={Colors.emergency} />
                <Text style={styles.errorText}>{actionError}</Text>
              </View>
            ) : null}
            {notifications.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}><MaterialCommunityIcons name="bell-sleep-outline" size={30} color={GREEN} /></View>
                <Text style={styles.emptyTitle}>You’re all caught up</Text>
                <Text style={styles.emptyDetail}>Relevant safety updates will appear here.</Text>
              </View>
            ) : (
              <ScrollView
                style={[styles.list, { maxHeight: Math.max(100, height - 250) }]}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
              >
                {notifications.map((notification, index) => (
                  <Animated.View
                    key={notification.id}
                    entering={FadeInDown.duration(220).delay(Math.min(index * 35, 180))}
                    style={[styles.notification, !notification.read && styles.unreadNotification]}
                  >
                    <Pressable
                      style={styles.notificationOpen}
                      onPress={() => void openNotification(notification)}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${notification.title} notification`}
                    >
                      <View style={[styles.icon, { backgroundColor: `${notification.color}18` }]}>
                        <MaterialCommunityIcons name={notification.icon} size={21} color={notification.color} />
                      </View>
                      <View style={styles.copy}>
                        <View style={styles.notificationHeading}>
                          <Text style={[styles.notificationTitle, !notification.read && styles.unreadTitle]}>{notification.title}</Text>
                          <Text style={styles.time}>{notification.time}</Text>
                        </View>
                        <Text style={[styles.detail, !notification.read && styles.unreadDetail]}>{notification.detail}</Text>
                      </View>
                      {!notification.read && <View style={styles.unreadDot} />}
                    </Pressable>
                    <View style={styles.notificationFooter}>
                      {notification.read ? (
                        <View style={styles.readStatus}>
                          <MaterialCommunityIcons name="check-circle-outline" size={14} color="#7C8B80" />
                          <Text style={styles.readHint}>Read</Text>
                        </View>
                      ) : (
                        <AnimatedPressable
                          style={[styles.markReadButton, updatingIds.includes(notification.id) && styles.disabledButton]}
                          onPress={() => void markNotificationRead(notification)}
                          disabled={updatingIds.includes(notification.id) || isMarkingAllRead}
                          accessibilityRole="button"
                          accessibilityLabel={`Mark ${notification.title} as read`}
                        >
                          <MaterialCommunityIcons name="check" size={16} color={GREEN} />
                          <Text style={styles.markRead}>Mark as read</Text>
                        </AnimatedPressable>
                      )}
                    </View>
                  </Animated.View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: -1, right: -5, zIndex: 2, minWidth: 16, height: 16, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: Colors.warning, borderWidth: 1, borderColor: Colors.white },
  dotText: { color: '#3D3100', fontSize: 8, fontWeight: '900' },
  backdrop: { flex: 1, backgroundColor: 'rgba(10, 22, 14, 0.48)', justifyContent: 'flex-start', alignItems: 'center' },
  backdropDismiss: { ...StyleSheet.absoluteFillObject },
  modal: { width: '100%', maxWidth: 500, backgroundColor: Colors.surface, borderRadius: 22, padding: 18, shadowColor: '#152A19', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.2, shadowRadius: 28, elevation: 10, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#E8EEE9' },
  headerCopy: { flex: 1, paddingRight: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 9 },
  title: { color: Colors.text, fontFamily: AppHeadingFontFamily, fontSize: 20, letterSpacing: -0.3 },
  subtitle: { color: Colors.textMuted, fontFamily: AppFontFamily, fontSize: 12, lineHeight: 18, marginTop: 3 },
  unreadBadge: { backgroundColor: '#E7F5E9', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  unreadBadgeText: { color: GREEN, fontFamily: AppSemiboldFontFamily, fontSize: 11 },
  closeButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F6F4' },
  markAllButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, backgroundColor: '#EFF8F0', borderWidth: 1, borderColor: '#D5EBD7', marginTop: 14, marginBottom: 8 },
  markAllText: { color: GREEN, fontFamily: AppBoldFontFamily, fontSize: 14 },
  disabledButton: { opacity: 0.55 },
  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 11, borderRadius: 12, backgroundColor: '#FFF3F2', borderWidth: 1, borderColor: '#F3D0CD', marginVertical: 8 },
  errorText: { flex: 1, color: Colors.emergency, fontFamily: AppMediumFontFamily, fontSize: 12, lineHeight: 18 },
  list: { flexGrow: 0, marginTop: 8 },
  listContent: { paddingBottom: 4 },
  notification: { paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#EDF1EE', borderRadius: 14, marginBottom: 7 },
  unreadNotification: { backgroundColor: '#F3F8F4', borderWidth: 1, borderColor: '#E5F0E7' },
  notificationOpen: { flexDirection: 'row', alignItems: 'flex-start' },
  icon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  copy: { flex: 1, minWidth: 0 },
  notificationHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  notificationTitle: { flex: 1, color: Colors.text, fontFamily: AppSemiboldFontFamily, fontSize: 14, lineHeight: 19 },
  unreadTitle: { color: Colors.text, fontFamily: AppBoldFontFamily },
  time: { color: Colors.textMuted, fontFamily: AppMediumFontFamily, fontSize: 11, marginTop: 2 },
  detail: { color: Colors.textMuted, fontFamily: AppFontFamily, fontSize: 13, lineHeight: 19, marginTop: 5 },
  unreadDetail: { color: '#46564A', fontFamily: AppMediumFontFamily },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN, marginTop: 7, marginLeft: 7 },
  notificationFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 7 },
  readStatus: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8 },
  readHint: { color: '#718076', fontFamily: AppMediumFontFamily, fontSize: 12 },
  markReadButton: { minHeight: 40, minWidth: 132, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 11, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CDE5D0' },
  markRead: { color: GREEN, fontFamily: AppBoldFontFamily, fontSize: 13 },
  empty: { alignItems: 'center', paddingVertical: 34, paddingHorizontal: 12 },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF5EB' },
  emptyTitle: { color: Colors.text, fontFamily: AppHeadingFontFamily, fontSize: 16, marginTop: 12 },
  emptyDetail: { color: Colors.textMuted, fontFamily: AppFontFamily, fontSize: 13, lineHeight: 19, marginTop: 5, textAlign: 'center' },
});
