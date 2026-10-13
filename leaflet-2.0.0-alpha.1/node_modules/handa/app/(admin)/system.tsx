import React, { useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable as TouchableOpacity } from '@components/Buttons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, BorderRadius, Shadows, Spacing } from '@constants/colors';
import { useAuth } from '@hooks/useAuth';

const logs = [{ label: 'Last data sync', value: 'Today, 10:42 AM', icon: 'sync' as const, color: '#167A5B' }, { label: 'Audit events today', value: '28 recorded actions', icon: 'shield-check-outline' as const, color: Colors.secondary }, { label: 'Pending sync items', value: '9 records', icon: 'cloud-sync-outline' as const, color: '#8B5E00' }];

export default function AdminSystem() {
  const router = useRouter();
  const { logout } = useAuth();
  const [isLogoutPromptOpen, setIsLogoutPromptOpen] = useState(false);

  const confirmLogout = async () => {
    setIsLogoutPromptOpen(false);
    await logout();
    router.replace('/(auth)/login');
  };

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <View><Text style={styles.eyebrow}>SYSTEM</Text><Text style={styles.title}>Logs and settings</Text><Text style={styles.subtitle}>Monitor synchronization, audit activity, and console preferences.</Text></View>
        <TouchableOpacity style={styles.logoutButton} onPress={() => setIsLogoutPromptOpen(true)} accessibilityLabel="Log out"><MaterialCommunityIcons name="logout" size={18} color={Colors.emergency} /><Text style={styles.logoutText}>Log out</Text></TouchableOpacity>
      </View>
      <View style={styles.cards}>{logs.map((log) => <View style={styles.card} key={log.label}><MaterialCommunityIcons name={log.icon} size={24} color={log.color} /><Text style={styles.label}>{log.label}</Text><Text style={styles.value}>{log.value}</Text></View>)}</View>
      <View style={styles.panel}><Text style={styles.panelTitle}>System controls</Text><Control icon="sync" title="Sync logs" detail="Review successful and failed synchronization attempts" action="View logs" onPress={() => router.push('/(admin)/logs?tab=sync')} /><Control icon="shield-check-outline" title="Audit logs" detail="See who changed sensitive application data" action="View audit trail" onPress={() => router.push('/(admin)/logs?tab=audit')} /><Control icon="tune-variant" title="Settings" detail="Configure notifications, retention, and access policies" action="Open settings" onPress={() => router.push('/(admin)/settings')} /></View>
    </ScrollView>
    <Modal visible={isLogoutPromptOpen} transparent animationType="fade" onRequestClose={() => setIsLogoutPromptOpen(false)}>
      <Pressable style={styles.modalBackdrop} onPress={() => setIsLogoutPromptOpen(false)}>
        <Pressable style={styles.confirmCard} onPress={(event) => event.stopPropagation()}>
          <View style={styles.confirmIcon}><MaterialCommunityIcons name="logout" size={22} color={Colors.emergency} /></View>
          <Text style={styles.confirmTitle}>Log out?</Text>
          <Text style={styles.confirmMessage}>Are you sure you want to end this administrator session?</Text>
          <View style={styles.confirmActions}><Pressable style={styles.cancelButton} onPress={() => setIsLogoutPromptOpen(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable style={styles.confirmButton} onPress={() => void confirmLogout()}><MaterialCommunityIcons name="logout" size={17} color={Colors.white} /><Text style={styles.confirmText}>Log out</Text></Pressable></View>
        </Pressable>
      </Pressable>
    </Modal>
  </SafeAreaView>;
}

function Control({ icon, title, detail, action, onPress }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; title: string; detail: string; action: string; onPress?: () => void }) { return <TouchableOpacity style={styles.control} onPress={onPress || (() => undefined)}><MaterialCommunityIcons name={icon} size={23} color={Colors.secondary} /><View style={styles.copy}><Text style={styles.controlTitle}>{title}</Text><Text style={styles.detail}>{detail}</Text></View><MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} /></TouchableOpacity>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surfaceMuted }, content: { padding: Spacing.xl, paddingBottom: 48, maxWidth: 1000, width: '100%', alignSelf: 'center' }, heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22 }, eyebrow: { color: Colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }, title: { color: Colors.text, fontSize: 30, fontWeight: '800', marginTop: 5 }, subtitle: { color: Colors.textMuted, fontSize: 14, marginTop: 6 }, logoutButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: Colors.emergency, borderRadius: BorderRadius.sm }, logoutText: { color: Colors.emergency, fontSize: 12, fontWeight: '800' }, cards: { flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 16 }, card: { flex: 1, backgroundColor: Colors.surface, padding: 17, borderRadius: BorderRadius.md, ...Shadows.sm }, label: { color: Colors.textMuted, fontSize: 12, marginTop: 13 }, value: { color: Colors.text, fontSize: 15, fontWeight: '800', marginTop: 5 }, panel: { backgroundColor: Colors.surface, padding: 18, borderRadius: BorderRadius.md, ...Shadows.sm }, panelTitle: { color: Colors.text, fontSize: 16, fontWeight: '800', marginBottom: 8 }, control: { flexDirection: 'row', alignItems: 'center', gap: 13, borderTopWidth: 1, borderTopColor: '#EDF1F4', paddingVertical: 15 }, copy: { flex: 1 }, controlTitle: { color: Colors.text, fontSize: 13, fontWeight: '700' }, detail: { color: Colors.textMuted, fontSize: 11, marginTop: 4 }, modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, backgroundColor: 'rgba(0, 0, 0, 0.45)' }, confirmCard: { width: '100%', maxWidth: 390, padding: Spacing.xl, borderRadius: BorderRadius.md, backgroundColor: Colors.surface }, confirmIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: Colors.surfaceMuted }, confirmTitle: { marginTop: Spacing.lg, color: Colors.text, fontSize: 20, fontWeight: '800' }, confirmMessage: { marginTop: Spacing.sm, color: Colors.textMuted, fontSize: 13, lineHeight: 20 }, confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.xl }, cancelButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: Spacing.lg, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm }, cancelText: { color: Colors.text, fontSize: 12, fontWeight: '700' }, confirmButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.sm, backgroundColor: Colors.emergency }, confirmText: { color: Colors.white, fontSize: 12, fontWeight: '800' },
});
