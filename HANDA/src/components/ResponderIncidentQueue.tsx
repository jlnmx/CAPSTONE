import React, { useEffect, useRef, useState } from 'react';
import { Colors } from '@constants/colors';
import { Alert, Image, Linking, Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AnimatedPressable } from '@components/Buttons';
import { useAuth } from '@hooks/useAuth';
import { incidentStatusColor, incidentStatusLabel } from '@constants/incidentStatus';
import { formatResponderOrganization, parseOrganizations, RESPONDER_ORGANIZATIONS, ResponderOrganization } from '@constants/responderOrganizations';
import { estimateResponseEta } from '@services/responderEta';
import { getIncidentReporterContacts, getResponderData, IncidentReporterContact, IncidentStatus, ResponderIncident, updateIncidentStatus } from '@services/responderData';

const GREEN = '#218B25';
const STATUSES: IncidentStatus[] = ['reported', 'acknowledged', 'in_progress', 'resolved'];
const ACTIVE_STATUSES: IncidentStatus[] = ['reported', 'acknowledged', 'in_progress'];
const NEXT_STATUSES: Record<IncidentStatus, IncidentStatus[]> = {
  reported: ['acknowledged'],
  acknowledged: ['in_progress', 'resolved'],
  in_progress: ['resolved'],
  resolved: [],
};

function canTransitionStatus(current: IncidentStatus, next: IncidentStatus): boolean {
  return NEXT_STATUSES[current].includes(next);
}

function displayLocationLabel(location: string, latitude?: number, longitude?: number): string {
  const label = location.replace(/\s*[·,]\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/, '').trim();
  if (label && !['location not provided', 'location unavailable'].includes(label.toLowerCase())) return label;
  return latitude != null && longitude != null ? 'Pinned incident location' : 'Location unavailable';
}

export default function ResponderIncidentQueue() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<ResponderIncident[]>([]);
  const [reporters, setReporters] = useState<Record<string, IncidentReporterContact>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<ResponderIncident | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<IncidentStatus>('acknowledged');
  const [responsePeople, setResponsePeople] = useState('');
  const [selectedOrganizations, setSelectedOrganizations] = useState<ResponderOrganization[]>([]);
  const [organizationBarangay, setOrganizationBarangay] = useState('');
  const [otherOrganizations, setOtherOrganizations] = useState('');
  const [responseEta, setResponseEta] = useState('');
  const [etaHint, setEtaHint] = useState('');
  const [isEtaLoading, setIsEtaLoading] = useState(false);
  const [responseNotes, setResponseNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const etaRequest = useRef(0);
  const etaEdited = useRef(false);

  const load = async () => {
    try {
      const [snapshot, contacts] = await Promise.all([getResponderData(), user?.role === 'responder' ? getIncidentReporterContacts().catch(() => null) : Promise.resolve(null)]);
      setIncidents(snapshot.incidents.filter((incident) => ACTIVE_STATUSES.includes(incident.status)));
      if (user?.role !== 'responder') setReporters({});
      else if (contacts) setReporters(contacts);
    } catch {
      Alert.alert('Live data unavailable', 'Incident reports could not be loaded right now. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const refresh = setInterval(() => void load(), 15000);
    return () => clearInterval(refresh);
  }, [user?.role]);

  const openResponseEditor = (incident: ResponderIncident, status: IncidentStatus) => {
    const saved = parseOrganizations(incident.responseOrganizations);
    const fillDefaults = status === 'acknowledged';
    const ownOrganization = user?.responderOrganization as ResponderOrganization | null | undefined;
    const useOwnOrganization = fillDefaults && saved.selected.length === 0 && !saved.other && !!ownOrganization && RESPONDER_ORGANIZATIONS.includes(ownOrganization);
    etaRequest.current += 1;
    etaEdited.current = false;
    setSelectedIncident(incident);
    setSelectedStatus(status);
    setResponsePeople(incident.responsePeople || (fillDefaults ? user?.name ?? '' : ''));
    setSelectedOrganizations(useOwnOrganization ? [ownOrganization as ResponderOrganization] : saved.selected);
    setOrganizationBarangay(useOwnOrganization ? user?.responderBarangay ?? '' : saved.barangay);
    setOtherOrganizations(saved.other);
    setResponseEta(incident.responseEtaMinutes == null ? '' : String(incident.responseEtaMinutes));
    setResponseNotes(incident.responseNotes || incident.actionNotes);
    setEtaHint('');
    setIsEtaLoading(false);
    if (status === 'acknowledged' && incident.responseEtaMinutes == null) void calculateEta(incident);
  };

  const handleStatusPress = async (incident: ResponderIncident, status: IncidentStatus) => {
    if (!canTransitionStatus(incident.status, status)) return;
    if (status === 'acknowledged') {
      openResponseEditor(incident, status);
      return;
    }
    if (updatingId) return;
    setUpdatingId(incident.id);
    try {
      // No response fields are sent, so the details saved at acknowledgement are kept.
      await updateIncidentStatus(incident.id, status);
      setIncidents((current) => status === 'resolved'
        ? current.filter((item) => item.id !== incident.id)
        : current.map((item) => item.id === incident.id ? { ...item, status } : item));
    } catch {
      Alert.alert('Update failed', 'The incident status was not saved.');
    } finally {
      setUpdatingId(null);
    }
  };

  const calculateEta = async (incident: ResponderIncident) => {
    if (incident.latitude == null || incident.longitude == null) {
      setEtaHint('This report has no map location, so ETA was not calculated.');
      return;
    }
    const request = ++etaRequest.current;
    setIsEtaLoading(true);
    setEtaHint('Calculating ETA from your current location…');
    const estimate = await estimateResponseEta({ latitude: Number(incident.latitude), longitude: Number(incident.longitude) });
    if (request !== etaRequest.current) return;
    setIsEtaLoading(false);
    if (!estimate) {
      setEtaHint('Allow location access to calculate ETA automatically, or enter it manually.');
      return;
    }
    setEtaHint(estimate.source === 'route' ? 'Calculated from your location along the driving route. You can edit it.' : 'Estimated from your distance to the incident. You can edit it.');
    if (!etaEdited.current) setResponseEta(String(estimate.minutes));
  };

  const toggleOrganization = (organization: ResponderOrganization) => {
    setSelectedOrganizations((current) => {
      if (current.includes(organization)) return current.filter((item) => item !== organization);
      if (organization === 'Barangay Responder' && !organizationBarangay) setOrganizationBarangay(user?.responderBarangay ?? '');
      return [...current, organization];
    });
  };

  const organizationsText = () => [
    ...selectedOrganizations.map((organization) => formatResponderOrganization(organization, organization === 'Barangay Responder' ? organizationBarangay : null)),
    otherOrganizations.trim(),
  ].filter(Boolean).join(', ');

  const changeStatus = async () => {
    if (!selectedIncident) return;
    const etaMinutes = responseEta.trim() ? Number(responseEta) : undefined;
    if (etaMinutes !== undefined && (!Number.isInteger(etaMinutes) || etaMinutes < 0)) {
      Alert.alert('Invalid ETA', 'Enter ETA as a whole number of minutes.');
      return;
    }
    const organizations = organizationsText();
    setIsSaving(true);
    try {
      await updateIncidentStatus(selectedIncident.id, selectedStatus, { people: responsePeople.trim(), organizations, etaMinutes, notes: responseNotes.trim() });
      setIncidents((current) => selectedStatus === 'resolved'
        ? current.filter((item) => item.id !== selectedIncident.id)
        : current.map((item) => item.id === selectedIncident.id ? { ...item, status: selectedStatus, responsePeople: responsePeople.trim(), responseOrganizations: organizations, responseEtaMinutes: etaMinutes, responseNotes: responseNotes.trim(), actionNotes: responseNotes.trim() } : item));
      etaRequest.current += 1;
      setSelectedIncident(null);
    } catch {
      Alert.alert('Update failed', 'The incident status was not saved.');
    } finally {
      setIsSaving(false);
    }
  };

  const closeEditor = () => {
    etaRequest.current += 1;
    setSelectedIncident(null);
  };

  return <View style={styles.section}>
    <View style={styles.heading}><View><Text style={styles.eyebrow}>FIELD OPERATIONS</Text><Text style={styles.title}>Active incidents</Text></View><MaterialCommunityIcons name="radio-tower" size={22} color={GREEN} /></View>
    {isLoading && <Text style={styles.empty}>Loading live incident reports...</Text>}
    {!isLoading && incidents.length === 0 && <Text style={styles.empty}>No active incidents on the server.</Text>}
    {incidents.map((incident) => <View style={styles.card} key={incident.id}>
      <View style={styles.cardHeader}><View style={styles.icon}><MaterialCommunityIcons name="alert-outline" size={20} color={incidentStatusColor(incident.status)} /></View><View style={styles.copy}><Text style={styles.name}>{incident.type}</Text></View><Text style={[styles.status, { color: incidentStatusColor(incident.status) }]}>{incidentStatusLabel(incident.status)}</Text></View>
      <View style={styles.location}>
        <View style={styles.locationIcon}><MaterialCommunityIcons name="map-marker-radius-outline" size={18} color={GREEN} /></View>
        <View style={styles.locationCopy}>
          <Text style={styles.locationLabel}>INCIDENT LOCATION</Text>
          <Text style={styles.locationText}>{displayLocationLabel(incident.location, incident.latitude, incident.longitude)}</Text>
          {incident.latitude != null && incident.longitude != null && Number.isFinite(incident.latitude) && Number.isFinite(incident.longitude) && <Text style={styles.coordinates}>GPS {incident.latitude.toFixed(6)}, {incident.longitude.toFixed(6)}</Text>}
        </View>
      </View>
      <Text style={styles.description}>{incident.description}</Text>
      {user?.role === 'responder' && reporters[incident.id] && <AnimatedPressable style={styles.contact} onPress={() => void Linking.openURL(`tel:${reporters[incident.id].mobileNumber.replace(/[\s()-]/g, '')}`)} accessibilityRole="link" accessibilityLabel={`Call ${reporters[incident.id].name}`}>
        <MaterialCommunityIcons name="phone-outline" size={16} color={GREEN} />
        <Text style={styles.contactText}>Reporter: {reporters[incident.id].name} · {reporters[incident.id].mobileNumber}</Text>
      </AnimatedPressable>}
      {incident.photoUris.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photos}>{incident.photoUris.map((uri, index) => <Image key={`${incident.id}-photo-${index}`} source={{ uri }} style={styles.photo} />)}</ScrollView>}
      <View style={styles.actions}>{STATUSES.map((status) => {
        const canTransition = canTransitionStatus(incident.status, status);
        const isCurrent = incident.status === status;
        return <AnimatedPressable key={status} style={[styles.action, isCurrent && { backgroundColor: incidentStatusColor(status) }, !canTransition && styles.actionDisabled]} onPress={() => void handleStatusPress(incident, status)} disabled={updatingId === incident.id || !canTransition} accessibilityRole="button" accessibilityState={{ disabled: updatingId === incident.id || !canTransition, selected: isCurrent }}>
          <Text style={[styles.actionText, isCurrent && styles.activeActionText]}>{status.replace('_', ' ')}</Text>
        </AnimatedPressable>;
      })}</View>
    </View>)}
    <Modal transparent visible={!!selectedIncident} animationType="fade" onRequestClose={closeEditor}>
      <View style={styles.modalBackdrop}><View style={styles.responseDialog}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.dialogTitle}>{selectedStatus.replace('_', ' ').toUpperCase()} RESPONSE</Text>
        <Text style={styles.dialogSubtitle}>Share operational details with the reporting resident. Every field can be edited.</Text>
        <TextInput style={styles.input} value={responsePeople} onChangeText={setResponsePeople} placeholder="People involved" placeholderTextColor="#8A9A8A" />
        <Text style={styles.fieldLabel}>Organizations involved</Text>
        <View style={styles.chips}>{RESPONDER_ORGANIZATIONS.map((organization) => {
          const checked = selectedOrganizations.includes(organization);
          return <AnimatedPressable key={organization} style={[styles.chip, checked && styles.chipActive]} onPress={() => toggleOrganization(organization)} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={organization}>
            <MaterialCommunityIcons name={checked ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={15} color={checked ? '#FFFFFF' : GREEN} />
            <Text style={[styles.chipText, checked && styles.chipTextActive]}>{organization === 'Barangay Responder' && checked && organizationBarangay ? `Barangay Responder · ${organizationBarangay}` : organization}</Text>
          </AnimatedPressable>;
        })}</View>
        <TextInput style={styles.input} value={otherOrganizations} onChangeText={setOtherOrganizations} placeholder="Other organizations (optional)" placeholderTextColor="#8A9A8A" />
        <TextInput style={styles.input} value={responseEta} onChangeText={(value) => { etaEdited.current = true; setResponseEta(value); }} placeholder="ETA in minutes" placeholderTextColor="#8A9A8A" keyboardType="number-pad" />
        {!!etaHint && <Text style={styles.hint}>{isEtaLoading ? 'Calculating ETA from your current location…' : etaHint}</Text>}
        <TextInput style={[styles.input, styles.notesInput]} value={responseNotes} onChangeText={setResponseNotes} placeholder="Response notes" placeholderTextColor="#8A9A8A" multiline textAlignVertical="top" />
        <View style={styles.dialogActions}><AnimatedPressable style={styles.cancelButton} onPress={closeEditor} disabled={isSaving}><Text style={styles.cancelText}>Cancel</Text></AnimatedPressable><AnimatedPressable style={styles.confirmButton} onPress={() => void changeStatus()} disabled={isSaving}>{isSaving ? <Text style={styles.confirmText}>Saving...</Text> : <Text style={styles.confirmText}>Save update</Text>}</AnimatedPressable></View>
        </ScrollView>
      </View></View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4, backgroundColor: Colors.background },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  eyebrow: { color: GREEN, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  title: { color: Colors.text, fontSize: 17, fontWeight: '800', marginTop: 3 },
  card: { backgroundColor: Colors.surface, borderRadius: 7, padding: 11, marginBottom: 9, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, marginLeft: 9 },
  name: { color: Colors.text, fontSize: 12, fontWeight: '800' },
  detail: { color: Colors.textMuted, fontSize: 10, marginTop: 3 },
  location: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 9, padding: 9, borderWidth: 1, borderColor: '#C9DCC9', borderRadius: 6, backgroundColor: '#F2F7F1' },
  locationIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#E1EFE0' },
  locationCopy: { flex: 1, minWidth: 0 },
  locationLabel: { color: GREEN, fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  locationText: { color: Colors.text, fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 2 },
  coordinates: { color: Colors.textMuted, fontSize: 10, lineHeight: 14, marginTop: 2 },
  status: { color: GREEN, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  description: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 8 },
  photos: { marginTop: 9 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 36, marginTop: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: '#8BC58B', borderRadius: 6, backgroundColor: Colors.surfaceMuted },
  contactText: { color: GREEN, fontSize: 11, fontWeight: '700' },
  photo: { width: 72, height: 72, marginRight: 6, borderRadius: 6, backgroundColor: Colors.surfaceMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 9 },
  action: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 5, backgroundColor: Colors.surfaceMuted },
  actionDisabled: { opacity: 0.4 },
  activeAction: { backgroundColor: GREEN },
  actionText: { color: GREEN, fontSize: 9, fontWeight: '700', textTransform: 'capitalize' },
  activeActionText: { color: '#FFFFFF' },
  empty: { color: Colors.textMuted, fontSize: 11, paddingVertical: 12 },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.4)' },
  responseDialog: { width: '100%', maxWidth: 440, maxHeight: '92%', padding: 18, borderRadius: 8, backgroundColor: Colors.surface },
  dialogTitle: { color: Colors.text, fontSize: 17, fontWeight: '800' },
  dialogSubtitle: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 4, marginBottom: 5 },
  fieldLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },
  chip: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderWidth: 1, borderColor: '#8BC58B', borderRadius: 18, backgroundColor: Colors.surfaceMuted },
  chipActive: { borderColor: GREEN, backgroundColor: GREEN },
  chipText: { color: GREEN, fontSize: 11, fontWeight: '700' },
  chipTextActive: { color: '#FFFFFF' },
  hint: { color: Colors.textMuted, fontSize: 10, lineHeight: 14, marginTop: 5 },
  input: { minHeight: 42, marginTop: 10, paddingHorizontal: 10, borderWidth: 1, borderColor: Colors.border, borderRadius: 5, color: Colors.textMuted, fontSize: 12 },
  notesInput: { minHeight: 78, paddingTop: 10 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  cancelButton: { minHeight: 40, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 5 },
  cancelText: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  confirmButton: { minHeight: 40, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 5, backgroundColor: GREEN },
  confirmText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
