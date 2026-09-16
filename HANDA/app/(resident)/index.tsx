import React from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@constants/colors';
import { MOCK_ACTIVE_DISASTERS } from '@data/mockData';

const actions = [
  { icon: 'account-plus-outline' as const, label: 'Register Evacuee', route: '/(resident)/report' },
  { icon: 'checkbox-marked-outline' as const, label: 'Verify Check-in', route: '/(resident)/alerts' },
  { icon: 'alert-circle-outline' as const, label: 'Report incident', route: '/(resident)/report' },
  { icon: 'home-city-outline' as const, label: 'Center status', route: '/(resident)/map' },
];

export default function ResidentDashboard() {
  const activeDisaster = MOCK_ACTIVE_DISASTERS[0];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.brandRow}><Text style={styles.brand}>HANDA</Text></View>
          <TouchableOpacity style={styles.notificationButton} onPress={() => Alert.alert('Notifications', 'No new notifications.')} accessibilityLabel="Notifications"><MaterialCommunityIcons name="bell-outline" size={29} color={Colors.white} /><View style={styles.notificationDot} /></TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.disasterCard} onPress={() => router.push('/(resident)/alerts')} activeOpacity={0.85}>
          <View style={styles.alertIcon}><MaterialCommunityIcons name="alert-outline" size={29} color={Colors.white} /></View>
          <View style={styles.disasterCopy}><Text style={styles.disasterName}>{activeDisaster?.name || 'Flood Response'}</Text><Text style={styles.disasterStatus}>Active Disaster</Text></View>
          <MaterialCommunityIcons name="chevron-right" size={30} color={Colors.white} />
        </TouchableOpacity>

        <View style={styles.statusRow}>
          <StatusTile icon="account-outline" title="MY STATUS" detail="Checked in" />
          <StatusTile icon="account-multiple-outline" title="HOUSEHOLD" detail="4 members" />
        </View>

        <Text style={styles.sectionTitle}>QUICK ACTION</Text>
        <View style={styles.actionGrid}>{actions.map((action) => <TouchableOpacity key={action.label} style={styles.actionButton} onPress={() => router.push(action.route)} activeOpacity={0.75}><MaterialCommunityIcons name={action.icon} size={25} color="#218B25" /><Text style={styles.actionLabel}>{action.label}</Text></TouchableOpacity>)}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusTile({ icon, title, detail }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; title: string; detail: string }) {
  return <View style={styles.statusTile}><MaterialCommunityIcons name={icon} size={29} color="#1E5987" /><View style={styles.statusCopy}><Text style={styles.statusTitle}>{title}</Text><Text style={styles.statusDetail}>{detail}</Text></View></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.white },
  container: { flex: 1, backgroundColor: Colors.white },
  content: { paddingBottom: 22 },
  header: { height: 86, paddingHorizontal: 18, backgroundColor: '#218B25', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brand: { color: Colors.white, fontSize: 32, fontWeight: '800', letterSpacing: 1 },
  notificationButton: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  notificationDot: { position: 'absolute', top: 6, right: 5, width: 6, height: 6, borderRadius: 3, backgroundColor: '#F5D14B' },
  disasterCard: { minHeight: 103, marginHorizontal: 18, marginTop: 12, marginBottom: 30, paddingHorizontal: 14, borderRadius: 9, backgroundColor: '#D63F43', flexDirection: 'row', alignItems: 'center' },
  alertIcon: { width: 38, height: 38, borderWidth: 3, borderColor: Colors.white, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  disasterCopy: { flex: 1, marginLeft: 10 },
  disasterName: { color: Colors.white, fontSize: 18, fontWeight: '800' },
  disasterStatus: { color: Colors.white, fontSize: 13, marginTop: 2 },
  statusRow: { flexDirection: 'row', gap: 9, marginHorizontal: 18, marginBottom: 14 },
  statusTile: { flex: 1, minHeight: 87, paddingHorizontal: 12, borderRadius: 9, backgroundColor: '#EEF2EF', flexDirection: 'row', alignItems: 'center' },
  statusCopy: { marginLeft: 8 },
  statusTitle: { color: '#1E5987', fontSize: 12, fontWeight: '800' },
  statusDetail: { color: '#218B25', fontSize: 9, marginTop: 3 },
  sectionTitle: { color: '#218B25', fontSize: 18, fontWeight: '800', marginHorizontal: 18, marginTop: 0, marginBottom: 8 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginHorizontal: 18 },
  actionButton: { width: '48%', minHeight: 46, borderRadius: 8, backgroundColor: '#EEF2EF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  actionLabel: { color: '#218B25', fontSize: 9, marginLeft: 6, flexShrink: 1 },
});
