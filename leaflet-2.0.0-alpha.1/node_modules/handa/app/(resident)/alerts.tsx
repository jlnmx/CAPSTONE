import React, { useEffect, useState } from 'react';
import { Colors } from '@constants/colors';
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AnimatedPressable } from '@components/Buttons';
import { authenticatedFetch } from '@services/apiClient';

type Notification = { id: string; title: string; message: string; read_at?: string | null; created_at: string };
const GREEN = '#218B25';

export default function ResidentAlertsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    try {
      const response = await authenticatedFetch('/api/v1/notifications');
      if (!response.ok) throw new Error('Notification service unavailable.');
      setNotifications(await response.json() as Notification[]);
      setError('');
    } catch {
      setError('Alerts could not be loaded. Check your connection and try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
    const refresh = setInterval(() => void load(), 15000);
    return () => clearInterval(refresh);
  }, []);

  const markRead = async (notification: Notification) => {
    if (notification.read_at) return;
    await authenticatedFetch(`/api/v1/notifications/${encodeURIComponent(notification.id)}/read`, { method: 'PATCH' });
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
  };

  return <SafeAreaView style={styles.container}><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void load(true)} tintColor={GREEN} />}>
    <View style={styles.header}><View><Text style={styles.eyebrow}>LIVE UPDATES</Text><Text style={styles.title}>ALERTS</Text><Text style={styles.subtitle}>Updates from responders about your reported incidents.</Text></View><MaterialCommunityIcons name="bell-alert-outline" size={30} color={GREEN} /></View>
    {isLoading && <ActivityIndicator color={GREEN} style={styles.loader} />}
    {!!error && <Text style={styles.error}>{error}</Text>}
    {!isLoading && !error && notifications.length === 0 && <View style={styles.empty}><MaterialCommunityIcons name="bell-check-outline" size={35} color={GREEN} /><Text style={styles.emptyTitle}>No response updates</Text><Text style={styles.emptyText}>Responder acknowledgements and response details will appear here.</Text></View>}
    {notifications.map((notification) => <AnimatedPressable key={notification.id} style={[styles.card, !notification.read_at && styles.unread]} onPress={() => void markRead(notification)} accessibilityRole="button" accessibilityLabel={`Read alert: ${notification.title}`}><View style={styles.cardIcon}><MaterialCommunityIcons name="message-alert-outline" size={21} color={GREEN} /></View><View style={styles.cardCopy}><View style={styles.cardHeading}><Text style={styles.cardTitle}>{notification.title}</Text>{!notification.read_at && <View style={styles.dot} />}</View><Text style={styles.message}>{notification.message}</Text><Text style={styles.time}>{formatTime(notification.created_at)}</Text></View></AnimatedPressable>)}
  </ScrollView></SafeAreaView>;
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recently' : date.toLocaleString();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background }, content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 14, paddingBottom: 24 }, header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }, eyebrow: { color: GREEN, fontSize: 9, fontWeight: '800', letterSpacing: 1 }, title: { color: Colors.text, fontSize: 24, fontWeight: '800', marginTop: 3 }, subtitle: { maxWidth: 300, color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 4 }, loader: { marginVertical: 24 }, error: { color: '#B42318', fontSize: 12, paddingVertical: 12 }, empty: { alignItems: 'center', padding: 35, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, backgroundColor: Colors.surface }, emptyTitle: { color: Colors.text, fontSize: 15, fontWeight: '800', marginTop: 9 }, emptyText: { color: Colors.textMuted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 5 }, card: { padding: 12, marginBottom: 9, flexDirection: 'row', borderWidth: 1, borderColor: Colors.border, borderRadius: 8, backgroundColor: Colors.surface }, unread: { borderColor: '#91C891', backgroundColor: Colors.surfaceMuted }, cardIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: Colors.surfaceMuted }, cardCopy: { flex: 1, marginLeft: 10 }, cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 }, cardTitle: { color: Colors.text, fontSize: 13, fontWeight: '800' }, dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D63F43' }, message: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 5 }, time: { color: Colors.textMuted, fontSize: 10, marginTop: 7 },
});
