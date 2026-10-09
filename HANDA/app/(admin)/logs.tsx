import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, BorderRadius, Shadows, Spacing } from '@constants/colors';
import { AdminLogRecord, getAdminLogs } from '@services/adminData';
import { useTheme } from '@hooks/useTheme';

type LogTab = 'sync' | 'audit';

export default function AdminLogs() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { palette } = useTheme();
  const [tab, setTab] = useState<LogTab>(params.tab === 'audit' ? 'audit' : 'sync');
  const [logs, setLogs] = useState<AdminLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (params.tab === 'sync' || params.tab === 'audit') setTab(params.tab);
  }, [params.tab]);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setError('');
    void getAdminLogs(tab).then((records) => {
      if (mounted) setLogs(records);
    }).catch(() => {
      if (mounted) {
        setLogs([]);
        setError('Logs could not be loaded. Check the server connection and administrator session.');
      }
    }).finally(() => {
      if (mounted) setIsLoading(false);
    });
    return () => { mounted = false; };
  }, [tab]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Go back"><MaterialCommunityIcons name="arrow-left" size={23} color={Colors.white} /></Pressable>
          <View><Text style={styles.eyebrow}>SYSTEM MONITORING</Text><Text style={styles.title}>Logs</Text></View>
        </View>
        <View style={styles.intro}><Text style={[styles.introTitle, { color: palette.text }]}>Application activity</Text><Text style={[styles.introText, { color: palette.textMuted }]}>Review data synchronization from user devices and changes made in the application.</Text></View>
        <View style={[styles.tabs, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <LogTabButton active={tab === 'sync'} label="Sync logs" icon="sync" onPress={() => setTab('sync')} palette={palette} />
          <LogTabButton active={tab === 'audit'} label="Audit logs" icon="shield-check-outline" onPress={() => setTab('audit')} palette={palette} />
        </View>
        <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.panelHeading}><View><Text style={[styles.panelTitle, { color: palette.text }]}>{tab === 'sync' ? 'Synchronization history' : 'Audit history'}</Text><Text style={[styles.panelDetail, { color: palette.textMuted }]}>{tab === 'sync' ? 'Uploads and rejected records from user devices' : 'Changes made to protected application data'}</Text></View><MaterialCommunityIcons name={tab === 'sync' ? 'cloud-sync-outline' : 'clipboard-text-clock-outline'} size={24} color={Colors.secondary} /></View>
          {isLoading && <View style={styles.state}><ActivityIndicator color={Colors.secondary} /><Text style={[styles.stateText, { color: palette.textMuted }]}>Loading logs...</Text></View>}
          {!isLoading && error && <View style={styles.state}><MaterialCommunityIcons name="alert-circle-outline" size={28} color={Colors.emergency} /><Text style={[styles.stateText, { color: palette.textMuted }]}>{error}</Text></View>}
          {!isLoading && !error && logs.length === 0 && <View style={styles.state}><MaterialCommunityIcons name="text-box-search-outline" size={30} color={palette.textMuted} /><Text style={[styles.stateText, { color: palette.textMuted }]}>No {tab} activity recorded yet.</Text></View>}
          {!isLoading && !error && logs.map((log) => <LogRow key={log.id} log={log} palette={palette} />)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LogTabButton({ active, label, icon, onPress, palette }: { active: boolean; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; onPress: () => void; palette: { text: string; textMuted: string } }) {
  return <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}><MaterialCommunityIcons name={icon} size={18} color={active ? Colors.white : palette.textMuted} /><Text style={[styles.tabText, { color: active ? Colors.white : palette.text }]}>{label}</Text></Pressable>;
}

function LogRow({ log, palette }: { log: AdminLogRecord; palette: { text: string; textMuted: string; surfaceMuted: string; border: string } }) {
  const successful = log.status === 'success';
  return <View style={[styles.logRow, { borderTopColor: palette.border }]}><View style={[styles.logIcon, { backgroundColor: successful ? '#E5F3ED' : '#FCE8E8' }]}><MaterialCommunityIcons name={successful ? 'check-circle-outline' : 'alert-circle-outline'} size={20} color={successful ? '#167A5B' : Colors.emergency} /></View><View style={styles.logCopy}><View style={styles.logTop}><Text style={[styles.logAction, { color: palette.text }]}>{log.action}</Text><Text style={[styles.logDate, { color: palette.textMuted }]}>{new Date(log.created_at).toLocaleString()}</Text></View><Text style={[styles.logDetails, { color: palette.textMuted }]}>{log.details}</Text><Text style={[styles.logMeta, { color: palette.textMuted }]}>{log.actor_name} · {log.entity_type}{log.entity_id ? ` · ${log.entity_id}` : ''}</Text></View></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { width: '100%', maxWidth: 1000, alignSelf: 'center', paddingBottom: Spacing['3xl'] },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, backgroundColor: '#218B25', flexDirection: 'row', alignItems: 'center', gap: Spacing.md }, backButton: { width: 42, height: 42, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' }, eyebrow: { color: '#D8F0D8', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 }, title: { marginTop: 2, color: Colors.white, fontSize: 28, fontWeight: '800' },
  intro: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.lg }, introTitle: { fontSize: 21, fontWeight: '800' }, introText: { maxWidth: 640, marginTop: Spacing.xs, fontSize: 13, lineHeight: 20 },
  tabs: { flexDirection: 'row', marginHorizontal: Spacing.lg, marginBottom: Spacing.lg, padding: 5, borderWidth: 1, borderRadius: BorderRadius.md, gap: 5 }, tab: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: BorderRadius.sm }, tabActive: { backgroundColor: Colors.primary }, tabText: { fontSize: 12, fontWeight: '800' },
  panel: { marginHorizontal: Spacing.lg, padding: Spacing.lg, borderWidth: 1, borderRadius: BorderRadius.md, ...Shadows.sm }, panelHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md, marginBottom: Spacing.md }, panelTitle: { fontSize: 16, fontWeight: '800' }, panelDetail: { marginTop: 4, fontSize: 11 }, state: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm }, stateText: { maxWidth: 420, textAlign: 'center', fontSize: 12 },
  logRow: { flexDirection: 'row', gap: Spacing.md, paddingVertical: 14, borderTopWidth: 1 }, logIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 }, logCopy: { flex: 1 }, logTop: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md }, logAction: { fontSize: 13, fontWeight: '800', textTransform: 'capitalize' }, logDate: { fontSize: 10 }, logDetails: { marginTop: 4, fontSize: 12, lineHeight: 17 }, logMeta: { marginTop: 5, fontSize: 10 },
});
