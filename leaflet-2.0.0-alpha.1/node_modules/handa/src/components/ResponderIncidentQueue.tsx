import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AnimatedPressable } from '@components/Buttons';
import { getResponderData, IncidentStatus, ResponderIncident, updateIncidentStatus } from '@services/responderData';

const GREEN = '#218B25';
const STATUSES: IncidentStatus[] = ['reported', 'acknowledged', 'in_progress', 'resolved'];

export default function ResponderIncidentQueue() {
  const [incidents, setIncidents] = useState<ResponderIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    try {
      setIncidents((await getResponderData()).incidents);
    } catch {
      Alert.alert('Live data unavailable', 'Incident reports could not be loaded from the server database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const refresh = setInterval(() => void load(), 15000);
    return () => clearInterval(refresh);
  }, []);

  const changeStatus = async (incident: ResponderIncident, status: IncidentStatus) => {
    try {
      await updateIncidentStatus(incident.id, status);
      setIncidents((current) => current.map((item) => item.id === incident.id ? { ...item, status } : item));
    } catch {
      Alert.alert('Update failed', 'The incident status was not saved.');
    }
  };

  return <View style={styles.section}>
    <View style={styles.heading}><View><Text style={styles.eyebrow}>FIELD OPERATIONS</Text><Text style={styles.title}>Incident reports</Text></View><MaterialCommunityIcons name="radio-tower" size={22} color={GREEN} /></View>
    {isLoading && <Text style={styles.empty}>Loading live incident reports...</Text>}
    {!isLoading && incidents.length === 0 && <Text style={styles.empty}>No incident reports on the server.</Text>}
    {incidents.map((incident) => <View style={styles.card} key={incident.id}>
      <View style={styles.cardHeader}><View style={styles.icon}><MaterialCommunityIcons name="alert-outline" size={20} color={incident.status === 'resolved' ? '#667085' : '#B42318'} /></View><View style={styles.copy}><Text style={styles.name}>{incident.type}</Text><Text style={styles.detail}>{incident.location} · {incident.severity}</Text></View><Text style={styles.status}>{incident.status.replace('_', ' ')}</Text></View>
      <Text style={styles.description}>{incident.description}</Text>
      <View style={styles.actions}>{STATUSES.map((status) => <AnimatedPressable key={status} style={[styles.action, incident.status === status && styles.activeAction]} onPress={() => void changeStatus(incident, status)}><Text style={[styles.actionText, incident.status === status && styles.activeActionText]}>{status.replace('_', ' ')}</Text></AnimatedPressable>)}</View>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4, backgroundColor: '#F7FAF7' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  eyebrow: { color: GREEN, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  title: { color: '#17212B', fontSize: 17, fontWeight: '800', marginTop: 3 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 7, padding: 11, marginBottom: 9, borderWidth: 1, borderColor: '#DFEADF' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FCE8E8', alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, marginLeft: 9 },
  name: { color: '#17212B', fontSize: 12, fontWeight: '800' },
  detail: { color: '#667085', fontSize: 10, marginTop: 3 },
  status: { color: GREEN, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  description: { color: '#667085', fontSize: 11, lineHeight: 16, marginTop: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 9 },
  action: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 5, backgroundColor: '#E7F0E7' },
  activeAction: { backgroundColor: GREEN },
  actionText: { color: GREEN, fontSize: 9, fontWeight: '700', textTransform: 'capitalize' },
  activeActionText: { color: '#FFFFFF' },
  empty: { color: '#667085', fontSize: 11, paddingVertical: 12 },
});
