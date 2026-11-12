import React, { useEffect, useState } from 'react';
import { Colors } from '@constants/colors';
import { ActivityIndicator, Image, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { AnimatedPressable } from '@components/Buttons';
import CurrentLocationMap, { LocationCoordinate } from '@components/CurrentLocationMap';
import { incidentTypeIcon, kitFonts, Reveal } from '@components/IncidentCardKit';
import { authenticatedFetch } from '@services/apiClient';
import { saveLocalIncident } from '@services/localDatabase';
import { syncPendingLocalData } from '@services/syncService';
import AppBackArrow from '@components/AppBackArrow';
import { PhotoViewer } from '@components/PhotoGallery';

const GREEN = '#218B25';
const INCIDENT_TYPES = ['Fire', 'Flooding', 'Earthquake', 'Landslide', 'Typhoon', 'Severe storm', 'Strong winds', 'Road accident', 'Road obstruction', 'Building collapse', 'Power outage', 'Gas leak', 'Water emergency', 'Medical emergency', 'Missing person', 'Crime or security threat', 'Hazardous spill', 'Other emergency'];
type Photo = { uri: string; name: string };

export default function ResidentIncidentReport() {
  const router = useRouter();
  const [incidentType, setIncidentType] = useState('');
  const [description, setDescription] = useState('');
  const [coordinate, setCoordinate] = useState<LocationCoordinate | undefined>();
  const [locationLabel, setLocationLabel] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [picker, setPicker] = useState<'type' | null>(null);
  const [isConfirmationVisible, setIsConfirmationVisible] = useState(false);
  const [isSuccessVisible, setIsSuccessVisible] = useState(false);
  const [successTitle, setSuccessTitle] = useState('Incident reported successfully');
  const [successMessage, setSuccessMessage] = useState('Your incident report has been sent. Please stay safe and wait for responders to arrive.');
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
        const streetAddress = [place?.streetNumber, place?.street].filter(Boolean).join(' ');
        const barangay = place?.district ? `Brgy. ${place.district}` : place?.subregion;
        const locationParts = [streetAddress, barangay, place?.city, place?.region].filter((part): part is string => !!part);
        setLocationLabel([...new Set(locationParts)].join(', ') || `Biñan City · ${nextCoordinate.latitude.toFixed(6)}, ${nextCoordinate.longitude.toFixed(6)}`);
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
    setError('');
    try {
      if (source === 'camera' && Platform.OS !== 'web') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError(permission.canAskAgain
            ? 'Camera access is needed to take an incident photo. Allow camera access and try again.'
            : 'Camera access is turned off for HANDA. Enable it in your device settings to take a photo.');
          return;
        }
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.55, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 4 - photos.length, quality: 0.55, base64: true });
      if (result.canceled) return;
      if (result.assets.some((asset) => !asset.base64)) {
        setError('A photo could not be prepared for upload. Please try taking or selecting it again.');
        return;
      }
      const selected = result.assets.map((asset, index) => ({
        uri: `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`,
        name: asset.fileName || `incident-photo-${Date.now()}-${index}.jpg`,
      }));
      setPhotos((current) => [...current, ...selected].slice(0, 4));
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : 'The camera or photo library could not be opened. Please try again.');
    }
  };

  const requestSubmit = () => {
    if (!incidentType || !description.trim() || !coordinate) {
      setError('Choose an incident type, describe what happened, and allow location access.');
      return;
    }
    setError('');
    setIsConfirmationVisible(true);
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
    const payload = { id, type: incidentType, description: description.trim(), location: locationLabel || `Biñan City · ${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`, latitude: coordinate.latitude, longitude: coordinate.longitude, photoUris: photos.map((photo) => photo.uri), createdAt };
    const abortController = new AbortController();
    const requestTimeout = setTimeout(() => abortController.abort(), 30000);
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
      setSuccessTitle('Incident reported successfully');
      setSuccessMessage('Your report has been sent to responders. Please stay safe and wait for responders to arrive.');
      setIsSuccessVisible(true);
      setIncidentType('');
      setDescription('');
      setPhotos([]);
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
        setSuccessTitle('Report saved on this device');
        setSuccessMessage(`${message} The report and attached photos will upload when a connection returns. Responders have not been notified yet.`);
        setIsSuccessVisible(true);
        setIncidentType('');
        setDescription('');
        setPhotos([]);
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
        <LinearGradient colors={['#218B25', '#176B1D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <AppBackArrow />
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>COMMUNITY SAFETY</Text>
            <Text style={styles.title}>Report incident</Text>
            <Text style={styles.headerSubtitle}>Share details so responders can act quickly.</Text>
          </View>
          <View style={styles.headerIcon}><MaterialCommunityIcons name="alert-decagram-outline" size={23} color="#FFFFFF" /></View>
        </LinearGradient>
        <View style={styles.form}>
          <Reveal index={0}>
            <View style={styles.formCard}>
              <SectionHeading icon="alert-circle-outline" title="What is happening?" description="Tell responders what they need to know." />
              <FieldLabel label="Incident type" required />
              <AnimatedPressable style={styles.select} onPress={() => setPicker('type')} accessibilityRole="button" accessibilityLabel={incidentType ? `Incident type: ${incidentType}` : 'Choose incident type'}>
                <View style={styles.selectCopy}>
                  {incidentType ? <MaterialCommunityIcons name={incidentTypeIcon(incidentType)} size={19} color={GREEN} /> : null}
                  <Text style={incidentType ? styles.selectValue : styles.selectPlaceholder}>{incidentType || 'Select an incident or disaster'}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-down" size={21} color="#5B735F" />
              </AnimatedPressable>
              <FieldLabel label="Description" required />
              <TextInput
                style={styles.descriptionInput}
                placeholder="Describe what happened and any immediate danger."
                placeholderTextColor="#8E9891"
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
                maxLength={1000}
                accessibilityLabel="Incident description"
              />
              <View style={styles.descriptionFooter}>
                <Text style={styles.inputHint}>Include helpful details such as hazards or people affected.</Text>
                <Text style={styles.characterCount}>{description.length}/1000</Text>
              </View>
            </View>
          </Reveal>

          <Reveal index={1}>
            <View style={styles.formCard}>
              <View style={styles.locationHeading}>
                <SectionHeading icon="map-marker-radius-outline" title="Where is it?" description="Your current location will be pinned on the map." />
                <AnimatedPressable onPress={() => void loadLocation()} style={styles.refreshButton} accessibilityRole="button" accessibilityLabel="Refresh current location">
                  <MaterialCommunityIcons name="crosshairs-gps" size={19} color={GREEN} />
                </AnimatedPressable>
              </View>
              <View style={styles.mapFrame}><CurrentLocationMap coordinate={coordinate} /></View>
              <View style={styles.locationReadout}>
                <MaterialCommunityIcons name={isGettingLocation ? 'crosshairs-gps' : 'map-marker'} size={18} color={GREEN} />
                <Text style={styles.locationText}>{isGettingLocation ? 'Getting your current location...' : locationLabel || 'Location unavailable'}</Text>
                {!isGettingLocation && coordinate ? <MaterialCommunityIcons name="check-circle" size={17} color={GREEN} /> : null}
              </View>
            </View>
          </Reveal>

          <Reveal index={2}>
            <View style={styles.formCard}>
              <View style={styles.photoHeading}>
                <SectionHeading icon="camera-outline" title="Add photos" description="Photos can help responders assess the situation." />
                <View style={styles.photoCountBadge}><Text style={styles.photoCount}>{photos.length}/4</Text></View>
              </View>
              <View style={styles.photoGrid}>
                {photos.map((photo, index) => (
                  <View key={`${photo.name}-${index}`} style={styles.photoItem}>
                    <AnimatedPressable onPress={() => setViewerIndex(index)} accessibilityRole="imagebutton" accessibilityLabel={`View photo ${index + 1}`}>
                      <Image source={{ uri: photo.uri }} style={styles.photo} />
                    </AnimatedPressable>
                    <AnimatedPressable style={styles.removePhoto} onPress={() => setPhotos((current) => current.filter((_item, photoIndex) => photoIndex !== index))} accessibilityRole="button" accessibilityLabel="Remove photo">
                      <MaterialCommunityIcons name="close" size={15} color="#FFFFFF" />
                    </AnimatedPressable>
                  </View>
                ))}
                {photos.length < 4 && (
                  <View style={styles.photoActions}>
                    <AnimatedPressable style={styles.photoButton} onPress={() => void addPhotos('camera')} accessibilityRole="button">
                      <MaterialCommunityIcons name="camera-outline" size={22} color={GREEN} />
                      <Text style={styles.photoButtonText}>Take photo</Text>
                    </AnimatedPressable>
                    <AnimatedPressable style={styles.photoButton} onPress={() => void addPhotos('library')} accessibilityRole="button">
                      <MaterialCommunityIcons name="image-multiple-outline" size={22} color={GREEN} />
                      <Text style={styles.photoButtonText}>Upload</Text>
                    </AnimatedPressable>
                  </View>
                )}
              </View>
              <Text style={styles.photoFootnote}>Up to 4 photos · JPG, PNG or HEIC</Text>
            </View>
          </Reveal>
          {!!error && (
            <View style={styles.errorBanner} accessibilityRole="alert">
              <MaterialCommunityIcons name="alert-circle-outline" size={19} color="#B42318" />
              <Text style={styles.error}>{error}</Text>
            </View>
          )}
          <AnimatedPressable style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} onPress={requestSubmit} disabled={isSubmitting} accessibilityRole="button">
            {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <><MaterialCommunityIcons name="send-check-outline" size={20} color="#FFFFFF" /><Text style={styles.submitText}>Review and submit report</Text></>}
          </AnimatedPressable>
        </View>
      </ScrollView>
      <Modal transparent visible={picker !== null} animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPicker(null)}>
          <Pressable style={styles.optionsCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.optionsHeading}>
              <View style={styles.optionsIcon}><MaterialCommunityIcons name="alert-circle-outline" size={22} color={GREEN} /></View>
              <View style={styles.optionsTitleCopy}>
                <Text style={styles.optionsTitle}>Choose incident type</Text>
                <Text style={styles.optionsSubtitle}>Select the closest match.</Text>
              </View>
              <AnimatedPressable onPress={() => setPicker(null)} style={styles.optionsClose} accessibilityRole="button" accessibilityLabel="Close incident type picker">
                <MaterialCommunityIcons name="close" size={19} color={Colors.textMuted} />
              </AnimatedPressable>
            </View>
            <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
              {INCIDENT_TYPES.map((option) => (
                <AnimatedPressable key={option} style={[styles.option, incidentType === option && styles.optionSelected]} onPress={() => { setIncidentType(option); setPicker(null); }}>
                  <View style={styles.optionIcon}><MaterialCommunityIcons name={incidentTypeIcon(option)} size={18} color={incidentType === option ? GREEN : Colors.textMuted} /></View>
                  <Text style={[styles.optionText, incidentType === option && styles.optionTextSelected]}>{option}</Text>
                  {incidentType === option ? <MaterialCommunityIcons name="check-circle" size={19} color={GREEN} /> : <MaterialCommunityIcons name="chevron-right" size={19} color="#AAB6AC" />}
                </AnimatedPressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal transparent visible={isConfirmationVisible} animationType="fade" onRequestClose={() => setIsConfirmationVisible(false)}>
        <Pressable style={confirmationStyles.backdrop} onPress={() => setIsConfirmationVisible(false)}>
          <Pressable style={confirmationStyles.card} onPress={(event) => event.stopPropagation()}>
            <Text style={confirmationStyles.title}>Submit incident report?</Text>
            <Text style={confirmationStyles.message}>Your {incidentType.toLowerCase()} report and location will be shared with responders.</Text>
            <View style={confirmationStyles.actions}>
              <AnimatedPressable style={confirmationStyles.cancelButton} onPress={() => setIsConfirmationVisible(false)} accessibilityRole="button">
                <Text style={confirmationStyles.cancelText}>Review report</Text>
              </AnimatedPressable>
              <AnimatedPressable style={confirmationStyles.confirmButton} onPress={() => { setIsConfirmationVisible(false); void submitReport(); }} disabled={isSubmitting} accessibilityRole="button">
                <Text style={confirmationStyles.confirmText}>Confirm and submit</Text>
              </AnimatedPressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal transparent visible={isSuccessVisible} animationType="fade" onRequestClose={() => setIsSuccessVisible(false)}>
        <Pressable style={successStyles.backdrop} onPress={() => setIsSuccessVisible(false)}>
          <Pressable style={successStyles.card} onPress={(event) => event.stopPropagation()}>
            <View style={successStyles.icon}><MaterialCommunityIcons name="check" size={27} color="#FFFFFF" /></View>
            <Text style={successStyles.title}>{successTitle}</Text>
            <Text style={successStyles.message}>{successMessage}</Text>
            <AnimatedPressable style={successStyles.primaryButton} onPress={() => { setIsSuccessVisible(false); router.replace('/(resident)/incidents'); }} accessibilityRole="button">
              <Text style={successStyles.primaryButtonText}>View incidents</Text>
            </AnimatedPressable>
            <AnimatedPressable style={successStyles.closeButton} onPress={() => setIsSuccessVisible(false)} accessibilityRole="button">
              <Text style={successStyles.closeButtonText}>Done</Text>
            </AnimatedPressable>
          </Pressable>
        </Pressable>
      </Modal>
      <PhotoViewer uris={photos.map((photo) => photo.uri)} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
    </SafeAreaView>
  );
}

function SectionHeading({ icon, title, description }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; title: string; description: string }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionIcon}><MaterialCommunityIcons name={icon} size={19} color={GREEN} /></View>
      <View style={styles.sectionCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.helper}>{description}</Text>
      </View>
    </View>
  );
}

function FieldLabel({ label, required = false }: { label: string; required?: boolean }) {
  return <Text style={styles.label}>{label}{required && <Text style={styles.required}> *</Text>}</Text>;
}

const styles = StyleSheet.create({
  headerCopy: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.surfaceMuted },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 150 },
  header: { minHeight: 128, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 20, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 },
  eyebrow: { color: '#DFF1DF', fontFamily: kitFonts.bold, fontSize: 9, letterSpacing: 1.3 },
  title: { color: '#FFFFFF', fontFamily: kitFonts.heading, fontSize: 25, lineHeight: 31, marginTop: 3 },
  headerSubtitle: { color: 'rgba(255,255,255,0.86)', fontFamily: kitFonts.medium, fontSize: 12, lineHeight: 17, marginTop: 3 },
  headerIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.16)' },
  form: { gap: 14, paddingHorizontal: 14, paddingTop: 17 },
  formCard: { padding: 15, borderWidth: 1, borderColor: '#E2EAE2', borderRadius: 21, backgroundColor: Colors.surface, shadowColor: '#173A20', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 3 },
  sectionIcon: { width: 39, height: 39, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#EAF5EA' },
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionTitle: { color: Colors.text, fontFamily: kitFonts.heading, fontSize: 16, lineHeight: 21 },
  helper: { color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 11, lineHeight: 16, marginTop: 2 },
  label: { color: Colors.text, fontFamily: kitFonts.bold, fontSize: 11, letterSpacing: 0.15, marginTop: 14, marginBottom: 7 },
  required: { color: '#D33A3A', fontFamily: kitFonts.bold },
  select: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 13, borderWidth: 1, borderColor: '#D6E3D6', borderRadius: 14, backgroundColor: '#FBFDFC' },
  selectCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectValue: { flexShrink: 1, color: Colors.text, fontFamily: kitFonts.semibold, fontSize: 13 },
  selectPlaceholder: { flex: 1, color: '#7A8B7D', fontFamily: kitFonts.medium, fontSize: 13 },
  descriptionInput: { minHeight: 124, paddingHorizontal: 13, paddingTop: 12, paddingBottom: 10, borderWidth: 1, borderColor: '#D6E3D6', borderRadius: 14, backgroundColor: '#FBFDFC', color: Colors.text, fontFamily: kitFonts.medium, fontSize: 13, lineHeight: 20 },
  descriptionFooter: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginTop: 5 },
  inputHint: { flex: 1, color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 10, lineHeight: 14 },
  characterCount: { color: Colors.textMuted, fontFamily: kitFonts.semibold, fontSize: 10, textAlign: 'right' },
  locationHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  refreshButton: { width: 42, height: 42, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D6E3D6', borderRadius: 14, backgroundColor: '#F6FAF6' },
  mapFrame: { height: 240, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border, borderRadius: 17, backgroundColor: Colors.surfaceMuted },
  locationReadout: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 13, backgroundColor: '#F1F8F1' },
  locationText: { flex: 1, color: Colors.text, fontFamily: kitFonts.medium, fontSize: 11, lineHeight: 16 },
  photoHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 13 },
  photoCountBadge: { minWidth: 43, alignItems: 'center', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: '#EEF5EE' },
  photoCount: { color: GREEN, fontFamily: kitFonts.bold, fontSize: 11 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoItem: { width: 82, height: 82, position: 'relative', overflow: 'hidden', borderRadius: 14, backgroundColor: Colors.surfaceMuted },
  photo: { width: '100%', height: '100%' },
  removePhoto: { position: 'absolute', top: 5, right: 5, width: 25, height: 25, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: 'rgba(23,33,43,0.76)' },
  photoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoButton: { width: 104, height: 82, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#D6E3D6', borderRadius: 15, backgroundColor: '#F8FBF8' },
  photoButtonText: { color: GREEN, fontFamily: kitFonts.bold, fontSize: 11 },
  photoFootnote: { color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 10, marginTop: 10 },
  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderWidth: 1, borderColor: '#F3C9C5', borderRadius: 14, backgroundColor: '#FFF5F4' },
  error: { flex: 1, color: '#B42318', fontFamily: kitFonts.medium, fontSize: 12, lineHeight: 17 },
  submitButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 2, borderRadius: 16, backgroundColor: GREEN, shadowColor: '#1D6E22', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 5 },
  submitButtonDisabled: { opacity: 0.65 },
  submitText: { color: '#FFFFFF', fontFamily: kitFonts.bold, fontSize: 14, letterSpacing: 0.15 },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(12,26,16,0.48)' },
  optionsCard: { width: '100%', maxWidth: 430, maxHeight: '82%', padding: 17, borderRadius: 23, backgroundColor: Colors.surface, shadowColor: '#0B2411', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 22, elevation: 10 },
  optionsHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 11 },
  optionsIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#EAF5EA' },
  optionsTitleCopy: { flex: 1 },
  optionsTitle: { color: Colors.text, fontFamily: kitFonts.heading, fontSize: 16 },
  optionsSubtitle: { color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 11, marginTop: 2 },
  optionsClose: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#F1F4F1' },
  optionsScroll: { maxHeight: 430 },
  option: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4, paddingHorizontal: 9, borderRadius: 13, backgroundColor: Colors.surface },
  optionSelected: { backgroundColor: '#EEF7EE' },
  optionIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#F1F5F1' },
  optionText: { flex: 1, color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 13 },
  optionTextSelected: { color: GREEN, fontFamily: kitFonts.bold },
});

const confirmationStyles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.52)' },
  card: { width: '100%', maxWidth: 420, padding: 22, borderWidth: 1, borderColor: '#E2EAE2', borderRadius: 22, backgroundColor: Colors.surface, shadowColor: '#0B2411', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 22, elevation: 10 },
  title: { color: Colors.text, fontFamily: kitFonts.heading, fontSize: 18, lineHeight: 24 },
  message: { color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 13, lineHeight: 20, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  cancelButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#C9DCC9', borderRadius: 13, backgroundColor: Colors.surface },
  cancelText: { color: Colors.text, fontFamily: kitFonts.bold, fontSize: 12 },
  confirmButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderRadius: 13, backgroundColor: GREEN },
  confirmText: { color: '#FFFFFF', fontFamily: kitFonts.bold, fontSize: 12, textAlign: 'center' },
});

const successStyles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.52)' },
  card: { width: '100%', maxWidth: 420, alignItems: 'center', padding: 24, borderWidth: 1, borderColor: '#E2EAE2', borderRadius: 23, backgroundColor: Colors.surface, shadowColor: '#0B2411', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 22, elevation: 10 },
  icon: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: GREEN },
  title: { marginTop: 16, color: Colors.text, fontFamily: kitFonts.heading, fontSize: 18, lineHeight: 24, textAlign: 'center' },
  message: { marginTop: 8, color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  primaryButton: { alignSelf: 'stretch', minHeight: 48, marginTop: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: GREEN },
  primaryButtonText: { color: '#FFFFFF', fontFamily: kitFonts.bold, fontSize: 13 },
  closeButton: { minHeight: 42, marginTop: 5, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { color: GREEN, fontFamily: kitFonts.bold, fontSize: 12 },
});
