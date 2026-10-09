import React, { useEffect, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable as TouchableOpacity } from '@components/Buttons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, Shadows, Spacing } from '@constants/colors';
import { AdminDataSnapshot, getAdminData } from '@services/adminData';

type Filter = 'All' | 'Incidents' | 'Evacuees';

export default function AdminOperations() {
  const [filter, setFilter] = useState<Filter>('All');
  const [data, setData] = useState<AdminDataSnapshot>({ incidents: [], evacuees: [], centers: [], activePersonnel: 0, source: 'unavailable' });

  useEffect(() => {
    void getAdminData().then(setData);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <View>
            <Text style={styles.eyebrow}>DATA MANAGEMENT</Text>
            <Text style={styles.title}>Operations records</Text>
            <Text style={styles.subtitle}>Live incident and evacuee records from {data.source === 'remote' ? 'PostgreSQL' : 'PostgreSQL unavailable'}.</Text>
          </View>
          <TouchableOpacity style={styles.exportButton} onPress={() => Alert.alert('Export', 'Export is available after the synchronized reporting API is enabled.')}>
            <MaterialCommunityIcons name="download-outline" size={18} color={Colors.text} />
            <Text style={styles.exportText}>Export data</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filters}>
          {(['All', 'Incidents', 'Evacuees'] as Filter[]).map((item) => (
            <TouchableOpacity key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.filterActive]}>
              <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {filter !== 'Evacuees' && (
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View><Text style={styles.panelTitle}>Incident reports</Text><Text style={styles.panelMeta}>Latest reports across the response network</Text></View>
              <Text style={styles.count}>{data.incidents.length} records</Text>
            </View>
            {data.incidents.map((incident) => (
              <View style={styles.row} key={incident.id}>
                <View style={[styles.severity, { backgroundColor: incident.severity === 'high' || incident.severity === 'critical' ? '#FCE8E8' : '#FFF3E5' }]}>
                  <MaterialCommunityIcons name="alert-outline" size={20} color={incident.severity === 'high' || incident.severity === 'critical' ? Colors.emergency : '#B36B00'} />
                </View>
                <View style={styles.copy}><Text style={styles.rowTitle}>{incident.type}</Text><Text style={styles.rowDetail}>{incident.location} · {incident.description}</Text></View>
                <View style={styles.statusWrap}><Text style={styles.severityText}>{incident.severity.toUpperCase()}</Text><Text style={styles.statusText}>{incident.syncStatus}</Text></View>
              </View>
            ))}
            {data.incidents.length === 0 && <Text style={styles.empty}>No incident records found.</Text>}
          </View>
        )}

        {filter !== 'Incidents' && (
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View><Text style={styles.panelTitle}>Evacuee directory</Text><Text style={styles.panelMeta}>Registered residents and synchronization state</Text></View>
              <Text style={styles.count}>{data.evacuees.length} records</Text>
            </View>
            {data.evacuees.slice(0, 25).map((evacuee) => (
              <View style={styles.row} key={evacuee.id}>
                <MaterialCommunityIcons name="account-outline" size={24} color={Colors.secondary} />
                <View style={styles.copy}><Text style={styles.rowTitle}>{evacuee.firstName} {evacuee.lastName}</Text><Text style={styles.rowDetail}>{evacuee.barangay || 'Barangay not provided'} · Age {evacuee.age}</Text></View>
                <Text style={styles.statusText}>{evacuee.syncStatus}</Text>
              </View>
            ))}
            {data.evacuees.length === 0 && <Text style={styles.empty}>No evacuee records found.</Text>}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surfaceMuted },
  content: { padding: Spacing.xl, paddingBottom: 48, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  heading: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, marginBottom: 22 },
  eyebrow: { color: Colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: Colors.text, fontSize: 30, fontWeight: '800', marginTop: 5 },
  subtitle: { color: Colors.textMuted, fontSize: 14, marginTop: 6 },
  exportButton: { flexDirection: 'row', gap: 7, alignItems: 'center', borderWidth: 1, borderColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 11, borderRadius: BorderRadius.md },
  exportText: { color: Colors.text, fontWeight: '700', fontSize: 12 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  filter: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 18, backgroundColor: Colors.surfaceMuted },
  filterActive: { backgroundColor: Colors.primary },
  filterText: { color: Colors.text, fontSize: 12, fontWeight: '700' },
  filterTextActive: { color: Colors.white },
  panel: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: 18, marginBottom: 16, ...Shadows.sm },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 7 },
  panelTitle: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  panelMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  count: { color: Colors.textMuted, fontSize: 11 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderTopWidth: 1, borderTopColor: '#EDF1F4', gap: 11 },
  severity: { width: 37, height: 37, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  copy: { flex: 1 },
  rowTitle: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  rowDetail: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
  statusWrap: { width: 85 },
  severityText: { color: Colors.textMuted, fontSize: 9, fontWeight: '800' },
  statusText: { color: '#167A5B', fontSize: 11, fontWeight: '700' },
  empty: { color: Colors.textMuted, paddingVertical: 14, fontSize: 12 },
});
