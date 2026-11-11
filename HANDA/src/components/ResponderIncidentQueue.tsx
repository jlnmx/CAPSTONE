import React, { useEffect, useRef, useState } from 'react';
import { PhotoGallery } from '@components/PhotoGallery';
import { Colors } from '@constants/colors';
import { Alert, Linking, Modal, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AnimatedPressable } from '@components/Buttons';
import Avatar from '@components/Avatar';
import { useAuth } from '@hooks/useAuth';
import { useIncidentFeed } from '@hooks/useRealtime';
import { incidentStatusColor, incidentStatusLabel } from '@constants/incidentStatus';
import { formatResponderOrganization, parseOrganizations, RESPONDER_ORGANIZATIONS, ResponderOrganization } from '@constants/responderOrganizations';
import { estimateResponseEta } from '@services/responderEta';
import { addIncidentResponsePhoto, getIncidentReporterContacts, getIncidentResponders, getResponderData, IncidentReporterContact, IncidentResponderEntry, IncidentStatus, ResponderIncident, updateIncidentStatus } from '@services/responderData';
import { IncidentTypeBadge, KIT_GREEN as GREEN, ProgressSteps, Reveal, StatusPill, kitFonts } from '@components/IncidentCardKit';

const STATUSES: IncidentStatus[] = ['reported', 'acknowledged', 'in_progress', 'resolved'];
const ACTIVE_STATUSES: IncidentStatus[] = ['reported', 'acknowledged', 'in_progress'];
const NEXT_STATUSES: Record<IncidentStatus, IncidentStatus[]> = {
  reported: ['acknowledged'],
  acknowledged: ['in_progress', 'resolved'],
  in_progress: ['resolved'],
  resolved: [],
};

function canTransitionStatus(current: IncidentStatus, next: IncidentStatus, incident?: ResponderIncident, userId?: string, role?: string): boolean {
  if (!NEXT_STATUSES[current].includes(next)) return false;
  return !(incident && current === 'in_progress' && role === 'responder' && incident.verifiedBy !== userId);
}

function displayLocationLabel(location: string, latitude?: number, longitude?: number): string {
  const label = location.replace(/\s*[·,]\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/, '').trim();
  if (label && !['location not provided', 'location unavailable'].includes(label.toLowerCase())) return label;
  return latitude != null && longitude != null ? 'Pinned incident location' : 'Location unavailable';
}

function formatReportedTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Reported recently' : `Reported ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function ResponderIncidentQueue() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<ResponderIncident[]>([]);
  const [reporters, setReporters] = useState<Record<string, IncidentReporterContact>>({});
  const [responders, setResponders] = useState<Record<string, IncidentResponderEntry[]>>({});
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
  const [photoBusyId, setPhotoBusyId] = useState<string | null>(null);
  const etaRequest = useRef(0);
  const etaEdited = useRef(false);

  const load = async () => {
    try {
      const [snapshot, contacts, crew] = await Promise.all([getResponderData(), user?.role === 'responder' ? getIncidentReporterContacts().catch(() => null) : Promise.resolve(null), getIncidentResponders()]);
      setIncidents(snapshot.incidents.filter((incident) => ACTIVE_STATUSES.includes(incident.status)));
      setResponders(crew);
      if (user?.role !== 'responder') setReporters({});
      else if (contacts) setReporters(contacts);
    } catch {
      Alert.alert('Live data unavailable', 'Incident reports could not be loaded right now. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useIncidentFeed(() => void load());

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

  const takeScenePhoto = async (incident: ResponderIncident) => {
    if (photoBusyId) return;
    setPhotoBusyId(incident.id);
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Camera access needed', permission.canAskAgain ? 'Allow camera access to take a photo of the scene.' : 'Camera access is turned off for HANDA. Enable it in your device settings.');
          return;
        }
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5, base64: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64) {
        Alert.alert('Photo not ready', 'The photo could not be prepared. Please try again.');
        return;
      }
      let coordinates: { latitude: number; longitude: number } | undefined;
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Location unavailable', 'The photo will still be sent and the incident will move in progress, but your arrival coordinates will not be recorded.');
        } else {
          const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        }
      } catch (error) {
        Alert.alert('Location unavailable', error instanceof Error ? error.message : 'Your photo will still be sent, but arrival coordinates could not be read.');
      }
      await addIncidentResponsePhoto(incident.id, `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`, coordinates);
      Alert.alert('Arrival recorded', coordinates
        ? 'Your scene photo and GPS location were sent. This incident is now in progress.'
        : 'Your scene photo was sent and this incident is now in progress. Arrival GPS was unavailable.');
      await load();
    } catch (error) {
      Alert.alert('Photo not sent', error instanceof Error ? error.message : 'Check your connection and try again.');
    } finally {
      setPhotoBusyId(null);
    }
  };

  const resolveAssignedIncident = async (incident: ResponderIncident) => {
    if (incident.status !== 'in_progress' || updatingId) return;
    setUpdatingId(incident.id);
    try {
      await updateIncidentStatus(incident.id, 'resolved');
      setIncidents((current) => current.filter((item) => item.id !== incident.id));
      Alert.alert('Incident resolved', 'The resolution time has been recorded in your response history.');
    } catch (error) {
      Alert.alert('Update failed', error instanceof Error ? error.message : 'The incident could not be resolved.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusPress = async (incident: ResponderIncident, status: IncidentStatus) => {
    if (!canTransitionStatus(incident.status, status, incident, user?.id, user?.role)) return;
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
    <Reveal index={0}><View style={styles.heading}><View><Text style={styles.eyebrow}>FIELD OPERATIONS</Text><Text style={styles.title}>Active incidents</Text></View><View style={styles.liveBadge}><MaterialCommunityIcons name="radio-tower" size={20} color={GREEN} /><Text style={styles.liveCount}>{incidents.length}</Text></View></View></Reveal>
    {isLoading && <Text style={styles.empty}>Loading live incident reports...</Text>}
    {!isLoading && incidents.length === 0 && <Text style={styles.empty}>No active incidents on the server.</Text>}
    {incidents.map((incident, index) => <Reveal index={index + 1} key={incident.id}><View style={styles.card}>
      <View style={[styles.accent, { backgroundColor: incidentStatusColor(incident.status) }]} />
      <View style={styles.cardHeader}><IncidentTypeBadge type={incident.type} status={incident.status} /><View style={styles.copy}><Text style={styles.name} numberOfLines={1}>{incident.type}</Text><Text style={styles.detail}>{formatReportedTime(incident.createdAt)}</Text></View><StatusPill status={incident.status} /></View>
      <View style={styles.crew}>
        <View style={styles.crewHeading}><MaterialCommunityIcons name="account-group-outline" size={14} color={GREEN} /><Text style={styles.crewLabel}>{(responders[incident.id]?.length ?? 0) > 0 ? `DEPLOYED RESPONDERS · ${responders[incident.id].length}` : 'DEPLOYMENT STATUS'}</Text></View>
        {(responders[incident.id]?.length ?? 0) === 0 && <Text style={styles.unassignedText}>Awaiting responder deployment</Text>}
        {(responders[incident.id] ?? []).map((responder) => <View key={responder.id} style={styles.crewRow}>
          <Avatar name={responder.name} size={26} />
          <View style={styles.crewCopy}><Text style={styles.crewName} numberOfLines={1}>{responder.id === user?.id ? `${responder.name} (You)` : responder.name}</Text>{!!responder.organization && <Text style={styles.crewOrg} numberOfLines={1}>{responder.organization}</Text>}</View>
          <View style={[styles.crewTag, { backgroundColor: `${incidentStatusColor(responder.status)}1A` }]}><Text style={[styles.crewTagText, { color: incidentStatusColor(responder.status) }]}>{responder.id === user?.id ? 'YOU · DEPLOYED' : 'DEPLOYED'}</Text></View>
        </View>)}
      </View>
      <View style={styles.location}>
        <View style={styles.locationIcon}><MaterialCommunityIcons name="map-marker-radius-outline" size={18} color={GREEN} /></View>
        <View style={styles.locationCopy}>
          <Text style={styles.locationLabel}>INCIDENT LOCATION</Text>
          <Text style={styles.locationText}>{displayLocationLabel(incident.location, incident.latitude, incident.longitude)}</Text>
          {incident.latitude != null && incident.longitude != null && Number.isFinite(incident.latitude) && Number.isFinite(incident.longitude) && <Text style={styles.coordinates}>GPS {incident.latitude.toFixed(6)}, {incident.longitude.toFixed(6)}</Text>}
        </View>
      </View>
      <Text style={styles.description}>{incident.description}</Text>
      <ProgressSteps status={incident.status} />
      {user?.role === 'responder' && reporters[incident.id] && <AnimatedPressable style={styles.contact} onPress={() => void Linking.openURL(`tel:${reporters[incident.id].mobileNumber.replace(/[\s()-]/g, '')}`)} accessibilityRole="link" accessibilityLabel={`Call ${reporters[incident.id].name}`}>
        <Avatar uri={reporters[incident.id].profilePicture} name={reporters[incident.id].name} size={28} />
        <Text style={styles.contactText}>Reporter: {reporters[incident.id].name} · {reporters[incident.id].mobileNumber}</Text>
      </AnimatedPressable>}
      {incident.photoUris.length > 0 && <><Text style={styles.photoLabel}>REPORTED PHOTOS</Text><PhotoGallery uris={incident.photoUris} style={styles.photos} thumbnailStyle={styles.photo} /></>}
      {incident.responsePhotoUris.length > 0 && <><Text style={styles.photoLabel}>RESPONDER SCENE PHOTOS</Text><PhotoGallery uris={incident.responsePhotoUris} style={styles.photos} thumbnailStyle={styles.photo} /></>}
      {user?.role === 'responder' && (incident.status === 'acknowledged' || incident.status === 'in_progress') && <AnimatedPressable style={styles.photoButton} onPress={() => void takeScenePhoto(incident)} disabled={photoBusyId === incident.id} accessibilityRole="button" accessibilityLabel="Take a photo of the scene and send it to the command center">
        <MaterialCommunityIcons name="camera-outline" size={18} color={GREEN} />
        <Text style={styles.contactText}>{photoBusyId === incident.id ? 'Sending photo...' : 'Take scene photo'}</Text>
      </AnimatedPressable>}
      {user?.role === 'responder' && incident.status === 'in_progress' && <AnimatedPressable style={styles.resolveButton} onPress={() => void resolveAssignedIncident(incident)} disabled={updatingId === incident.id} accessibilityRole="button" accessibilityLabel="Mark this incident resolved">
        <MaterialCommunityIcons name="check-circle-outline" size={18} color="#FFFFFF" />
        <Text style={styles.resolveButtonText}>{updatingId === incident.id ? 'Saving resolution...' : 'Incident Resolved'}</Text>
      </AnimatedPressable>}
      {user?.role === 'admin' && <View style={styles.actions}>{STATUSES.map((status) => {
        const canTransition = canTransitionStatus(incident.status, status, incident, user?.id, user?.role);
        const isCurrent = incident.status === status;
        return <AnimatedPressable key={status} style={[styles.action, isCurrent && { backgroundColor: incidentStatusColor(status) }, !canTransition && styles.actionDisabled]} onPress={() => void handleStatusPress(incident, status)} disabled={updatingId === incident.id || !canTransition} accessibilityRole="button" accessibilityState={{ disabled: updatingId === incident.id || !canTransition, selected: isCurrent }}>
          <Text style={[styles.actionText, isCurrent && styles.activeActionText]}>{status.replace('_', ' ')}</Text>
        </AnimatedPressable>;
      })}</View>}
    </View></Reveal>)}
    <Modal transparent visible={user?.role === 'admin' && !!selectedIncident} animationType="fade" onRequestClose={closeEditor}>
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
  section: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8, backgroundColor: Colors.background },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  eyebrow: { color: GREEN, fontFamily: kitFonts.bold, fontSize: 10, letterSpacing: 1.6 },
  title: { color: Colors.text, fontFamily: kitFonts.heading, fontSize: 21, marginTop: 3 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 40, borderRadius: 20, backgroundColor: '#E4F1E4', borderWidth: 1, borderColor: '#BFDDBF' },
  liveCount: { color: GREEN, fontFamily: kitFonts.heading, fontSize: 15 },
  card: { backgroundColor: Colors.surface, borderRadius: 20, padding: 14, paddingLeft: 18, marginBottom: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', shadowColor: '#103A18', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.09, shadowRadius: 14, elevation: 3 },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  name: { color: Colors.text, fontFamily: kitFonts.heading, fontSize: 16 },
  detail: { color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 11, marginTop: 2 },
  crew: { marginTop: 12, padding: 10, borderRadius: 14, backgroundColor: '#F2F7F1', borderWidth: 1, borderColor: '#D5E6D5', gap: 8 },
  crewHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  crewLabel: { color: GREEN, fontFamily: kitFonts.bold, fontSize: 9, letterSpacing: 0.8 },
  crewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  crewCopy: { flex: 1, minWidth: 0 },
  crewName: { color: Colors.text, fontFamily: kitFonts.semibold, fontSize: 12 },
  crewOrg: { color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 10, marginTop: 1 },
  crewTag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  crewTagText: { fontFamily: kitFonts.bold, fontSize: 8, letterSpacing: 0.6 },
  unassignedText: { color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 11 },
  location: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12, padding: 10, borderRadius: 14, backgroundColor: '#F2F7F1' },
  locationIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#E1EFE0' },
  locationCopy: { flex: 1, minWidth: 0 },
  locationLabel: { color: GREEN, fontFamily: kitFonts.bold, fontSize: 9, letterSpacing: 0.8 },
  locationText: { color: Colors.text, fontFamily: kitFonts.semibold, fontSize: 13, lineHeight: 18, marginTop: 2 },
  coordinates: { color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 10, lineHeight: 14, marginTop: 2 },
  status: { color: GREEN, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  description: { color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 12, lineHeight: 18, marginTop: 10 },
  photos: { marginTop: 6 },
  photoLabel: { color: GREEN, fontFamily: kitFonts.bold, fontSize: 9, letterSpacing: 0.8, marginTop: 12 },
  photoButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 40, marginTop: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: '#8BC58B', borderRadius: 20, backgroundColor: Colors.surfaceMuted },
  resolveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 46, marginTop: 12, paddingHorizontal: 18, borderRadius: 14, backgroundColor: '#218B25' },
  resolveButtonText: { color: '#FFFFFF', fontFamily: kitFonts.bold, fontSize: 13 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 38, marginTop: 10, paddingHorizontal: 10, borderWidth: 1, borderColor: '#8BC58B', borderRadius: 20, backgroundColor: Colors.surfaceMuted },
  contactText: { color: GREEN, fontFamily: kitFonts.semibold, fontSize: 11 },
  photo: { width: 72, height: 72, marginRight: 6, borderRadius: 12, backgroundColor: Colors.surfaceMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  action: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: Colors.surfaceMuted },
  actionDisabled: { opacity: 0.4 },
  activeAction: { backgroundColor: GREEN },
  actionText: { color: GREEN, fontFamily: kitFonts.bold, fontSize: 10, textTransform: 'capitalize' },
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
