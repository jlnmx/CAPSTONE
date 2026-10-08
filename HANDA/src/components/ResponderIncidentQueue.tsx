import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AnimatedPressable } from '@components/Buttons';
import { getResponderData, IncidentStatus, ResponderIncident, updateIncidentStatus } from '@services/responderData';

const GREEN = '#218B25';
const STATUSES: IncidentStatus[] = ['reported', 'acknowledged', 'in_progress', 'resolved'];
const ACTIVE_STATUSES: IncidentStatus[] = ['reported', 'acknowledged', 'in_progress'];

export default function ResponderIncidentQueue() {
  const [incidents, setIncidents] = useState<ResponderIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<ResponderIncident | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<IncidentStatus>('acknowledged');
  const [responsePeople, setResponsePeople] = useState('');
  const [responseOrganizations, setResponseOrganizations] = useState('');
  const [responseEta, setResponseEta] = useState('');
  const [responseNotes, setResponseNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    try {
      setIncidents((await getResponderData()).incidents.filter((incident) => ACTIVE_STATUSES.includes(incident.status)));
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

  const openResponseEditor = (incident: ResponderIncident, status: IncidentStatus) => {
    setSelectedIncident(incident);
    setSelectedStatus(status);
    setResponsePeople(incident.responsePeople);
    setResponseOrganizations(incident.responseOrganizations);
    setResponseEta(incident.responseEtaMinutes == null ? '' : String(incident.responseEtaMinutes));
    setResponseNotes(incident.responseNotes || incident.actionNotes);
  };

  const changeStatus = async () => {
    if (!selectedIncident) return;
    const etaMinutes = responseEta.trim() ? Number(responseEta) : undefined;
    if (etaMinutes !== undefined && (!Number.isInteger(etaMinutes) || etaMinutes < 0)) {
      Alert.alert('Invalid ETA', 'Enter ETA as a whole number of minutes.');
      return;
    }
    setIsSaving(true);
    try {
      await updateIncidentStatus(selectedIncident.id, selectedStatus, { people: responsePeople.trim(), organizations: responseOrganizations.trim(), etaMinutes, notes: responseNotes.trim() });
      setIncidents((current) => selectedStatus === 'resolved'
        ? current.filter((item) => item.id !== selectedIncident.id)
        : current.map((item) => item.id === selectedIncident.id ? { ...item, status: selectedStatus, responsePeople: responsePeople.trim(), responseOrganizations: responseOrganizations.trim(), responseEtaMinutes: etaMinutes, responseNotes: responseNotes.trim(), actionNotes: responseNotes.trim() } : item));
      setSelectedIncident(null);
    } catch {
      Alert.alert('Update failed', 'The incident status was not saved.');
    } finally {
      setIsSaving(false);
    }
  };

  return <View style={styles.section}>
    <View style={styles.heading}><View><Text style={styles.eyebrow}>FIELD OPERATIONS</Text><Text style={styles.title}>Active incidents</Text></View><MaterialCommunityIcons name="radio-tower" size={22} color={GREEN} /></View>
    {isLoading && <Text style={styles.empty}>Loading live incident reports...</Text>}
    {!isLoading && incidents.length === 0 && <Text style={styles.empty}>No active incidents on the server.</Text>}
    {incidents.map((incident) => <View style={styles.card} key={incident.id}>
      <View style={styles.cardHeader}><View style={styles.icon}><MaterialCommunityIcons name="alert-outline" size={20} color={incident.status === 'resolved' ? '#667085' : '#B42318'} /></View><View style={styles.copy}><Text style={styles.name}>{incident.type}</Text><Text style={styles.detail}>{incident.location} · {incident.severity}</Text></View><Text style={styles.status}>{incident.status.replace('_', ' ')}</Text></View>
      <Text style={styles.description}>{incident.description}</Text>
      {incident.photoUris.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photos}>{incident.photoUris.map((uri, index) => <Image key={`${incident.id}-photo-${index}`} source={{ uri }} style={styles.photo} />)}</ScrollView>}
      <View style={styles.actions}>{STATUSES.map((status) => <AnimatedPressable key={status} style={[styles.action, incident.status === status && styles.activeAction]} onPress={() => openResponseEditor(incident, status)}><Text style={[styles.actionText, incident.status === status && styles.activeActionText]}>{status.replace('_', ' ')}</Text></AnimatedPressable>)}</View>
    </View>)}
    <Modal transparent visible={!!selectedIncident} animationType="fade" onRequestClose={() => setSelectedIncident(null)}>
      <View style={styles.modalBackdrop}><View style={styles.responseDialog}>
        <Text style={styles.dialogTitle}>{selectedStatus.replace('_', ' ').toUpperCase()} RESPONSE</Text>
        <Text style={styles.dialogSubtitle}>Share operational details with the reporting resident.</Text>
        <TextInput style={styles.input} value={responsePeople} onChangeText={setResponsePeople} placeholder="People involved" placeholderTextColor="#8A9A8A" />
        <TextInput style={styles.input} value={responseOrganizations} onChangeText={setResponseOrganizations} placeholder="Organizations involved" placeholderTextColor="#8A9A8A" />
        <TextInput style={styles.input} value={responseEta} onChangeText={setResponseEta} placeholder="ETA in minutes" placeholderTextColor="#8A9A8A" keyboardType="number-pad" />
        <TextInput style={[styles.input, styles.notesInput]} value={responseNotes} onChangeText={setResponseNotes} placeholder="Response notes" placeholderTextColor="#8A9A8A" multiline textAlignVertical="top" />
        <View style={styles.dialogActions}><AnimatedPressable style={styles.cancelButton} onPress={() => setSelectedIncident(null)} disabled={isSaving}><Text style={styles.cancelText}>Cancel</Text></AnimatedPressable><AnimatedPressable style={styles.confirmButton} onPress={() => void changeStatus()} disabled={isSaving}>{isSaving ? <Text style={styles.confirmText}>Saving...</Text> : <Text style={styles.confirmText}>Save update</Text>}</AnimatedPressable></View>
      </View></View>
    </Modal>
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
  photos: { marginTop: 9 },
  photo: { width: 72, height: 72, marginRight: 6, borderRadius: 6, backgroundColor: '#E5EFE8' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 9 },
  action: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 5, backgroundColor: '#E7F0E7' },
  activeAction: { backgroundColor: GREEN },
  actionText: { color: GREEN, fontSize: 9, fontWeight: '700', textTransform: 'capitalize' },
  activeActionText: { color: '#FFFFFF' },
  empty: { color: '#667085', fontSize: 11, paddingVertical: 12 },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.4)' },
  responseDialog: { width: '100%', maxWidth: 440, padding: 18, borderRadius: 8, backgroundColor: '#FFFFFF' },
  dialogTitle: { color: '#17591D', fontSize: 17, fontWeight: '800' },
  dialogSubtitle: { color: '#667085', fontSize: 11, lineHeight: 16, marginTop: 4, marginBottom: 5 },
  input: { minHeight: 42, marginTop: 10, paddingHorizontal: 10, borderWidth: 1, borderColor: '#D5E2D5', borderRadius: 5, color: '#263B28', fontSize: 12 },
  notesInput: { minHeight: 78, paddingTop: 10 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  cancelButton: { minHeight: 40, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#CCD7CC', borderRadius: 5 },
  cancelText: { color: '#344054', fontSize: 11, fontWeight: '700' },
  confirmButton: { minHeight: 40, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 5, backgroundColor: GREEN },
  confirmText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
