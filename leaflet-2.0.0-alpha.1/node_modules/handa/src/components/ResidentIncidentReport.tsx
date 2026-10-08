import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { AnimatedPressable } from '@components/Buttons';
import CurrentLocationMap, { LocationCoordinate } from '@components/CurrentLocationMap';
import { authenticatedFetch } from '@services/apiClient';
import { saveLocalIncident } from '@services/localDatabase';
import { syncPendingLocalData } from '@services/syncService';

const GREEN = '#218B25';
const INCIDENT_TYPES = ['Fire', 'Flooding', 'Earthquake', 'Landslide', 'Typhoon', 'Severe storm', 'Strong winds', 'Road accident', 'Road obstruction', 'Building collapse', 'Power outage', 'Gas leak', 'Water emergency', 'Medical emergency', 'Missing person', 'Crime or security threat', 'Hazardous spill', 'Other emergency'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
type Severity = typeof SEVERITIES[number];
type Photo = { uri: string; name: string };

export default function ResidentIncidentReport() {
  const router = useRouter();
  const [incidentType, setIncidentType] = useState('');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [description, setDescription] = useState('');
  const [coordinate, setCoordinate] = useState<LocationCoordinate | undefined>();
  const [locationLabel, setLocationLabel] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [picker, setPicker] = useState<'type' | 'severity' | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadLocation = async () => {
    setIsGettingLocation(true);
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Location permission is required to place your report on the map.');
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const nextCoordinate = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      setCoordinate(nextCoordinate);
      try {
        const address = await Location.reverseGeocodeAsync(nextCoordinate);
        const place = address[0];
        setLocationLabel([place?.street, place?.district || place?.city, place?.region].filter(Boolean).join(', ') || `Biñan City · ${nextCoordinate.latitude.toFixed(6)}, ${nextCoordinate.longitude.toFixed(6)}`);
      } catch {
        setLocationLabel(`Biñan City · ${nextCoordinate.latitude.toFixed(6)}, ${nextCoordinate.longitude.toFixed(6)}`);
      }
    } catch (locationError) {
      setError(locationError instanceof Error ? locationError.message : 'Unable to get your current location.');
    } finally {
      setIsGettingLocation(false);
    }
  };

  useEffect(() => { void loadLocation(); }, []);

  const addPhotos = async (source: 'camera' | 'library') => {
    if (photos.length >= 4) return;
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.65, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 4 - photos.length, quality: 0.65, base64: true });
    if (result.canceled) return;
    const selected = result.assets.map((asset, index) => ({
      uri: asset.base64 ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}` : asset.uri,
      name: asset.fileName || `incident-photo-${Date.now()}-${index}.jpg`,
    }));
    setPhotos((current) => [...current, ...selected].slice(0, 4));
  };

  const submitReport = async () => {
    if (!incidentType || !description.trim() || !coordinate) {
      setError('Choose an incident type, describe what happened, and allow location access.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    const id = `incident-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const payload = { id, type: incidentType, description: description.trim(), severity, location: locationLabel || `Biñan City · ${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`, latitude: coordinate.latitude, longitude: coordinate.longitude, photoUris: photos.map((photo) => photo.uri), createdAt };
    const abortController = new AbortController();
    const requestTimeout = setTimeout(() => abortController.abort(), 15000);
    try {
      const response = await authenticatedFetch('/api/v1/incidents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: abortController.signal });
      if (!response.ok) {
        let detail = '';
        try {
          const result = await response.json() as { detail?: unknown };
          detail = typeof result.detail === 'string' ? result.detail : '';
        } catch {
        }
        throw new Error(detail || `The incident service returned ${response.status}.`);
      }
      Alert.alert('Incident reported', 'Your report and location are now available to residents and responders.', [{ text: 'View incidents', onPress: () => router.replace('/(resident)/incidents') }]);
    } catch (submitError) {
      let localId: string | null = null;
      try {
        localId = saveLocalIncident(payload);
      } catch {
        localId = null;
      }
      if (localId) {
        void syncPendingLocalData();
        const message = submitError instanceof Error && submitError.name === 'AbortError'
          ? 'The server took too long to respond. Your report was saved on this device and will sync when the connection returns.'
          : 'The report was saved on this device and will sync when the connection returns.';
        setError(message);
      } else {
        setError(submitError instanceof Error && submitError.name === 'AbortError' ? 'The incident service timed out. Check that your phone and API are on the same Wi-Fi network.' : 'The incident could not be saved. Check your connection and try again.');
      }
    } finally {
      clearTimeout(requestTimeout);
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}><View><Text style={styles.eyebrow}>COMMUNITY SAFETY</Text><Text style={styles.title}>REPORT INCIDENT</Text></View><MaterialCommunityIcons name="alert-decagram-outline" size={32} color="#DFF1DF" /></View>
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>What is happening?</Text>
          <FieldLabel label="Incident type" required />
          <AnimatedPressable style={styles.select} onPress={() => setPicker('type')} accessibilityRole="button"><Text style={incidentType ? styles.selectValue : styles.selectPlaceholder}>{incidentType || 'Select an incident or disaster'}</Text><MaterialCommunityIcons name="chevron-down" size={20} color="#5B735F" /></AnimatedPressable>
          <FieldLabel label="Severity" required />
          <AnimatedPressable style={styles.select} onPress={() => setPicker('severity')} accessibilityRole="button"><Text style={[styles.selectValue, styles[`severity_${severity}` as keyof typeof styles] as object]}>{severity.toUpperCase()}</Text><MaterialCommunityIcons name="chevron-down" size={20} color="#5B735F" /></AnimatedPressable>
          <FieldLabel label="Description" required />
          <TextInput style={styles.descriptionInput} placeholder="Tell responders what they need to know" placeholderTextColor="#8EAF8E" value={description} onChangeText={setDescription} multiline textAlignVertical="top" maxLength={1000} />
          <Text style={styles.characterCount}>{description.length}/1000</Text>
          <View style={styles.locationHeading}><View><Text style={styles.sectionTitle}>Where is it?</Text><Text style={styles.helper}>Your current location will be pinned exactly on the map.</Text></View><AnimatedPressable onPress={() => void loadLocation()} style={styles.refreshButton} accessibilityRole="button" accessibilityLabel="Refresh current location"><MaterialCommunityIcons name="crosshairs-gps" size={19} color={GREEN} /></AnimatedPressable></View>
          <View style={styles.mapFrame}><CurrentLocationMap coordinate={coordinate} /></View>
          <View style={styles.locationReadout}><MaterialCommunityIcons name="map-marker" size={18} color={GREEN} /><Text style={styles.locationText}>{isGettingLocation ? 'Getting your current location...' : locationLabel || 'Location unavailable'}</Text></View>
          <View style={styles.photoHeading}><View><Text style={styles.sectionTitle}>Photos</Text><Text style={styles.helper}>Add up to 4 photos to help others understand the situation.</Text></View><Text style={styles.photoCount}>{photos.length}/4</Text></View>
          <View style={styles.photoGrid}>
            {photos.map((photo, index) => <View key={`${photo.name}-${index}`} style={styles.photoItem}><Image source={{ uri: photo.uri }} style={styles.photo} /><AnimatedPressable style={styles.removePhoto} onPress={() => setPhotos((current) => current.filter((_item, photoIndex) => photoIndex !== index))} accessibilityRole="button" accessibilityLabel="Remove photo"><MaterialCommunityIcons name="close" size={15} color="#FFFFFF" /></AnimatedPressable></View>)}
            {photos.length < 4 && <View style={styles.photoActions}><AnimatedPressable style={styles.photoButton} onPress={() => void addPhotos('camera')} accessibilityRole="button"><MaterialCommunityIcons name="camera-outline" size={22} color={GREEN} /><Text style={styles.photoButtonText}>Take photo</Text></AnimatedPressable><AnimatedPressable style={styles.photoButton} onPress={() => void addPhotos('library')} accessibilityRole="button"><MaterialCommunityIcons name="image-multiple-outline" size={22} color={GREEN} /><Text style={styles.photoButtonText}>Upload</Text></AnimatedPressable></View>}
          </View>
          {!!error && <Text style={styles.error}>{error}</Text>}
          <AnimatedPressable style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} onPress={() => void submitReport()} disabled={isSubmitting} accessibilityRole="button">{isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <><MaterialCommunityIcons name="send-check-outline" size={20} color="#FFFFFF" /><Text style={styles.submitText}>Post incident report</Text></>}</AnimatedPressable>
        </View>
      </ScrollView>
      <Modal transparent visible={picker !== null} animationType="fade" onRequestClose={() => setPicker(null)}><Pressable style={styles.modalBackdrop} onPress={() => setPicker(null)}><Pressable style={styles.optionsCard} onPress={(event) => event.stopPropagation()}><Text style={styles.optionsTitle}>{picker === 'type' ? 'Select incident type' : 'Select severity'}</Text><ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>{(picker === 'type' ? INCIDENT_TYPES : SEVERITIES).map((option) => <AnimatedPressable key={option} style={styles.option} onPress={() => { if (picker === 'type') setIncidentType(option); else setSeverity(option as Severity); setPicker(null); }}><Text style={styles.optionText}>{picker === 'type' ? option : option.toUpperCase()}</Text>{((picker === 'type' && incidentType === option) || (picker === 'severity' && severity === option)) && <MaterialCommunityIcons name="check" size={19} color={GREEN} />}</AnimatedPressable>)}</ScrollView></Pressable></Pressable></Modal>
    </SafeAreaView>
  );
}

function FieldLabel({ label, required = false }: { label: string; required?: boolean }) { return <Text style={styles.label}>{label}{required && <Text style={styles.required}> *</Text>}</Text>; }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FAF7' }, content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 30 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 19, paddingBottom: 15, backgroundColor: GREEN }, eyebrow: { color: '#DFF1DF', fontSize: 9, fontWeight: '800', letterSpacing: 1.1 }, title: { color: '#FFFFFF', fontSize: 25, fontWeight: '800', marginTop: 3 }, form: { paddingHorizontal: 16, paddingTop: 18 }, sectionTitle: { color: '#236B27', fontSize: 16, fontWeight: '800' }, label: { color: '#236B27', fontSize: 12, fontWeight: '700', marginTop: 15, marginBottom: 6 }, required: { color: '#D33A3A' }, select: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, borderWidth: 1, borderColor: '#C9DCC9', borderRadius: 9, backgroundColor: '#FFFFFF' }, selectValue: { color: '#263B28', fontSize: 13, fontWeight: '700' }, selectPlaceholder: { color: '#8EAF8E', fontSize: 13 }, severity_low: { color: '#2873A8' }, severity_medium: { color: '#B36E00' }, severity_high: { color: '#B42318' }, severity_critical: { color: '#8B1020' }, descriptionInput: { minHeight: 112, paddingHorizontal: 13, paddingTop: 12, paddingBottom: 10, borderWidth: 1, borderColor: '#C9DCC9', borderRadius: 9, backgroundColor: '#FFFFFF', color: '#263B28', fontSize: 13, lineHeight: 19 }, characterCount: { color: '#718171', fontSize: 10, textAlign: 'right', marginTop: 3 }, locationHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22 }, helper: { color: '#718171', fontSize: 11, lineHeight: 16, marginTop: 3 }, refreshButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#C9DCC9', borderRadius: 19, backgroundColor: '#FFFFFF' }, mapFrame: { height: 230, overflow: 'hidden', marginTop: 10, borderWidth: 1, borderColor: '#B9D1B9', borderRadius: 10, backgroundColor: '#E5EFE8' }, locationReadout: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }, locationText: { flex: 1, color: '#4B6350', fontSize: 11, lineHeight: 16 }, photoHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 17, marginBottom: 9 }, photoCount: { color: '#718171', fontSize: 11, fontWeight: '700' }, photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, photoItem: { width: 86, height: 86, position: 'relative', borderRadius: 8, overflow: 'hidden', backgroundColor: '#E5EFE8' }, photo: { width: '100%', height: '100%' }, removePhoto: { position: 'absolute', top: 4, right: 4, width: 23, height: 23, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(23,33,43,0.72)' }, photoActions: { flexDirection: 'row', gap: 8 }, photoButton: { width: 104, height: 86, alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: '#B9D1B9', borderRadius: 8, backgroundColor: '#FFFFFF' }, photoButtonText: { color: GREEN, fontSize: 11, fontWeight: '700' }, error: { color: '#B42318', fontSize: 12, lineHeight: 17, marginTop: 14 }, submitButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18, borderRadius: 9, backgroundColor: GREEN }, submitButtonDisabled: { opacity: 0.65 }, submitText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' }, modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.35)' }, optionsCard: { width: '100%', maxWidth: 430, maxHeight: '78%', padding: 17, borderRadius: 12, backgroundColor: '#FFFFFF' }, optionsTitle: { color: '#236B27', fontSize: 17, fontWeight: '800', marginBottom: 8 }, optionsScroll: { maxHeight: 410 }, option: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E7EFE7' }, optionText: { color: '#263B28', fontSize: 13 },
});
