import React, { useEffect, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, Shadows, Spacing } from '@constants/colors';
import { AdminDataSnapshot, getAdminData } from '@services/adminData';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function AdminAnalytics() {
  const [data, setData] = useState<AdminDataSnapshot>({ incidents: [], evacuees: [], source: 'unavailable' });

  useEffect(() => {
    void getAdminData().then(setData);
  }, []);

  const registrations = DAYS.map((_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - index));
    const key = day.toISOString().slice(0, 10);
    return data.evacuees.filter((evacuee) => evacuee.createdAt.slice(0, 10) === key).length;
  });
  const highSeverity = data.incidents.filter((incident) => incident.severity === 'high' || incident.severity === 'critical').length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}><View><Text style={styles.eyebrow}>REPORTING</Text><Text style={styles.title}>Analytics</Text><Text style={styles.subtitle}>Calculated from {data.source === 'remote' ? 'PostgreSQL' : 'PostgreSQL unavailable'} records.</Text></View><TouchableOpacity style={styles.export} onPress={() => Alert.alert('Report', 'Export is available after the reporting API is enabled.')}><MaterialCommunityIcons name="file-chart-outline" size={18} color={Colors.primary} /><Text style={styles.exportText}>Generate report</Text></TouchableOpacity></View>
        <View style={styles.stats}><Stat label="Registered evacuees" value={String(data.evacuees.length)} icon="account-group-outline" /><Stat label="Reported incidents" value={String(data.incidents.length)} icon="alert-circle-outline" /><Stat label="High severity incidents" value={String(highSeverity)} icon="alert-octagon-outline" /></View>
        <View style={styles.panel}><Text style={styles.panelTitle}>Registration trend</Text><Text style={styles.meta}>New evacuee records by day, last seven days</Text><View style={styles.chart}>{registrations.map((value, index) => <View style={styles.column} key={DAYS[index]}><Text style={styles.value}>{value}</Text><View style={styles.track}><View style={[styles.bar, { height: `${Math.min(value * 20, 100)}%` }]} /></View><Text style={styles.day}>{DAYS[index]}</Text></View>)}</View></View>
        <View style={styles.panel}><Text style={styles.panelTitle}>Data availability</Text><Text style={styles.meta}>Metrics unavailable until their source tables are connected.</Text><Availability label="Evacuee registrations" value={`${data.evacuees.length} records`} /><Availability label="Incident reports" value={`${data.incidents.length} records`} /><Availability label="Incident resolution rate" value="N/A" /><Availability label="Evacuation center utilization" value="N/A" /></View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }) { return <View style={styles.stat}><MaterialCommunityIcons name={icon} size={23} color={Colors.secondary} /><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function Availability({ label, value }: { label: string; value: string }) { return <View style={styles.availability}><Text style={styles.availabilityLabel}>{label}</Text><Text style={styles.availabilityValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F7F9' },
  content: { padding: Spacing.xl, paddingBottom: 48, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  heading: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, marginBottom: 22 },
  eyebrow: { color: Colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: Colors.text, fontSize: 30, fontWeight: '800', marginTop: 5 },
  subtitle: { color: Colors.textMuted, fontSize: 14, marginTop: 6 },
  export: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: Colors.primary, padding: 11, borderRadius: BorderRadius.md },
  exportText: { color: Colors.primary, fontWeight: '700', fontSize: 12 },
  stats: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  stat: { flex: 1, backgroundColor: Colors.white, padding: 17, borderRadius: BorderRadius.md, ...Shadows.sm },
  statValue: { color: Colors.text, fontSize: 25, fontWeight: '800', marginTop: 11 },
  statLabel: { color: Colors.textMuted, fontSize: 12, marginTop: 3 },
  panel: { backgroundColor: Colors.white, padding: 18, borderRadius: BorderRadius.md, marginBottom: 16, ...Shadows.sm },
  panelTitle: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  meta: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  chart: { height: 220, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', marginTop: 22 },
  column: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  value: { color: Colors.textMuted, fontSize: 10, marginBottom: 5 },
  track: { height: 150, width: 24, justifyContent: 'flex-end', backgroundColor: '#EAF0F4', borderRadius: 5, overflow: 'hidden' },
  bar: { width: '100%', backgroundColor: Colors.secondary, borderRadius: 5 },
  day: { color: Colors.textMuted, fontSize: 10, marginTop: 8 },
  availability: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#EDF1F4', paddingVertical: 13, marginTop: 8 },
  availabilityLabel: { color: Colors.textMuted, fontSize: 12 },
  availabilityValue: { color: Colors.text, fontSize: 12, fontWeight: '800' },
});
