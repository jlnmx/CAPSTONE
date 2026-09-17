import React from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@hooks/useAuth';
import { Colors, BorderRadius, Shadows, Spacing, Typography } from '@constants/colors';
import { MOCK_EVACUATION_CENTERS, MOCK_INCIDENTS } from '@data/mockData';

const weeklyActivity = [42, 58, 51, 76, 64, 88, 72];
const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function AdminOverview() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Sign out', 'End this administrator session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login'); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.eyebrow}>HANDA ADMIN CONSOLE</Text>
            <Text style={styles.title}>Command overview</Text>
            <Text style={styles.subtitle}>Monitor readiness, people, and field operations from one place.</Text>
          </View>
          <View style={styles.accountBlock}>
            <View style={styles.avatar}><Text style={styles.avatarText}>HA</Text></View>
            <View><Text style={styles.accountName}>{user?.name || 'Administrator'}</Text><Text style={styles.accountRole}>Authorized official</Text></View>
            <TouchableOpacity onPress={handleLogout} accessibilityLabel="Sign out"><MaterialCommunityIcons name="logout" size={22} color={Colors.textMuted} /></TouchableOpacity>
          </View>
        </View>

        <View style={styles.statGrid}>
          <Metric icon="account-group-outline" label="Registered evacuees" value="1,284" delta="+12.4%" color="#167A5B" />
          <Metric icon="alert-circle-outline" label="Active incidents" value="14" delta="3 high priority" color={Colors.emergency} />
          <Metric icon="home-city-outline" label="Evacuation centers" value={String(MOCK_EVACUATION_CENTERS.length)} delta="86% available" color={Colors.secondary} />
          <Metric icon="account-multiple-outline" label="Active personnel" value="38" delta="6 responders online" color="#8B5E00" />
        </View>

        <View style={styles.mainGrid}>
          <View style={[styles.panel, styles.chartPanel]}>
            <View style={styles.panelHeader}><View><Text style={styles.panelTitle}>Evacuee registrations</Text><Text style={styles.panelMeta}>Last 7 days · all centers</Text></View><Text style={styles.period}>THIS WEEK⌄</Text></View>
            <View style={styles.chart}>
              {weeklyActivity.map((value, index) => <View key={dayLabels[index]} style={styles.barColumn}><Text style={styles.barValue}>{value}</Text><View style={styles.barTrack}><View style={[styles.bar, { height: `${value}%` }]} /></View><Text style={styles.day}>{dayLabels[index]}</Text></View>)}
            </View>
          </View>
          <View style={styles.panel}>
            <View style={styles.panelHeader}><View><Text style={styles.panelTitle}>Incident status</Text><Text style={styles.panelMeta}>Current response workload</Text></View></View>
            <View style={styles.donut}><Text style={styles.donutValue}>14</Text><Text style={styles.donutLabel}>total</Text></View>
            <View style={styles.legend}><Legend color={Colors.emergency} label="High priority" value="3" /><Legend color="#F4A261" label="Acknowledged" value="6" /><Legend color="#2E8B57" label="Resolved" value="5" /></View>
          </View>
        </View>

        <View style={styles.sectionHeading}><Text style={styles.panelTitle}>Needs attention</Text><TouchableOpacity onPress={() => router.push('/(admin)/operations')}><Text style={styles.link}>View operations</Text></TouchableOpacity></View>
        <View style={styles.alertList}>
          <Attention icon="alert-octagon-outline" title="High priority incidents" detail={`${MOCK_INCIDENTS.filter((incident) => incident.severity === 'high' || incident.severity === 'critical').length} reports need review`} color={Colors.emergency} />
          <Attention icon="account-clock-outline" title="Personnel access" detail="4 responder accounts are awaiting approval" color="#8B5E00" />
          <Attention icon="home-alert-outline" title="Center capacity" detail="Barangay Gym is at full capacity" color={Colors.secondary} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ icon, label, value, delta, color }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; value: string; delta: string; color: string }) {
  return <View style={styles.metric}><View style={[styles.metricIcon, { backgroundColor: `${color}18` }]}><MaterialCommunityIcons name={icon} size={22} color={color} /></View><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text><Text style={[styles.metricDelta, { color }]}>{delta}</Text></View>;
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendLabel}>{label}</Text><Text style={styles.legendValue}>{value}</Text></View>;
}

function Attention({ icon, title, detail, color }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; title: string; detail: string; color: string }) {
  return <View style={styles.attention}><MaterialCommunityIcons name={icon} size={23} color={color} /><View style={styles.attentionCopy}><Text style={styles.attentionTitle}>{title}</Text><Text style={styles.attentionDetail}>{detail}</Text></View><MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} /></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7F9' },
  content: { padding: Spacing.xl, paddingBottom: 48, maxWidth: 1240, width: '100%', alignSelf: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.xl, gap: Spacing.lg },
  eyebrow: { color: Colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6 },
  title: { color: Colors.text, fontSize: 30, fontWeight: '800' },
  subtitle: { color: Colors.textMuted, fontSize: 14, marginTop: 6 },
  accountBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, backgroundColor: Colors.white, borderRadius: BorderRadius.md, ...Shadows.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.white, fontSize: 12, fontWeight: '800' },
  accountName: { color: Colors.text, fontSize: 12, fontWeight: '700' },
  accountRole: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  metric: { flex: 1, minWidth: 190, backgroundColor: Colors.white, borderRadius: BorderRadius.md, padding: 16, ...Shadows.sm },
  metricIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  metricLabel: { color: Colors.textMuted, fontSize: 12 },
  metricValue: { color: Colors.text, fontSize: 25, fontWeight: '800', marginTop: 4 },
  metricDelta: { fontSize: 11, fontWeight: '700', marginTop: 5 },
  mainGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  panel: { flex: 1, minWidth: 300, backgroundColor: Colors.white, borderRadius: BorderRadius.md, padding: 18, ...Shadows.sm },
  chartPanel: { minWidth: 460 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  panelTitle: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  panelMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  period: { color: Colors.secondary, fontSize: 10, fontWeight: '800' },
  chart: { height: 190, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', marginTop: 20 },
  barColumn: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barValue: { color: Colors.textMuted, fontSize: 10, marginBottom: 5 },
  barTrack: { height: 125, width: 22, justifyContent: 'flex-end', backgroundColor: '#EAF0F4', borderRadius: 6, overflow: 'hidden' },
  bar: { width: '100%', backgroundColor: Colors.secondary, borderRadius: 6 },
  day: { color: Colors.textMuted, fontSize: 10, marginTop: 8 },
  donut: { alignSelf: 'center', width: 128, height: 128, borderRadius: 64, borderWidth: 20, borderColor: '#DDEAF1', borderTopColor: Colors.emergency, borderRightColor: '#F4A261', alignItems: 'center', justifyContent: 'center', marginVertical: 20 },
  donutValue: { color: Colors.text, fontSize: 28, fontWeight: '800' },
  donutLabel: { color: Colors.textMuted, fontSize: 11 },
  legend: { gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  legendLabel: { flex: 1, color: Colors.textMuted, fontSize: 12 },
  legendValue: { color: Colors.text, fontSize: 12, fontWeight: '800' },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 26, marginBottom: 10 },
  link: { color: Colors.secondary, fontSize: 12, fontWeight: '700' },
  alertList: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  attention: { flex: 1, minWidth: 250, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, padding: 15, borderRadius: BorderRadius.md, borderLeftWidth: 3, borderLeftColor: '#D7E2EA' },
  attentionCopy: { flex: 1 },
  attentionTitle: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  attentionDetail: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
});