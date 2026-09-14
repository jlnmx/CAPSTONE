import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import { Colors } from '@constants/colors';

const GREEN = '#218B25';
const BORDER_GREEN = '#79B879';
const FIELD_GREEN = '#548B56';
const SEVERITIES = ['Low', 'Moderity', 'High', 'Critical'];

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export default function IncidentsScreen() {
  const navigation = useNavigation();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [incidentType, setIncidentType] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('Low');
  const [location, setLocation] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  useEffect(() => {
    navigation.setOptions({ tabBarStyle: isCameraOpen ? { display: 'none' } : undefined });
  }, [isCameraOpen, navigation]);

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Camera permission needed', 'Allow camera access to take incident photos.');
        return;
      }
    }
    setIsCameraOpen(true);
  };

  const capturePhoto = async () => {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.75 });
    if (photo?.uri) {
      setPhotos((current) => [...current, photo.uri].slice(0, 3));
      setIsCameraOpen(false);
    }
  };

  const submitIncident = () => {
    if (!incidentType || !description || !location) {
      Alert.alert('Missing information', 'Complete the incident type, description, and location.');
      return;
    }
    Alert.alert('Incident submitted', 'The incident has been saved for response coordination.');
  };

  if (isCameraOpen) {
    return (
      <SafeAreaView style={styles.cameraScreen}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.cameraClose} onPress={() => setIsCameraOpen(false)}>
              <MaterialCommunityIcons name="close" size={28} color={Colors.white} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.captureButton} onPress={capturePhoto}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
            <View style={styles.cameraSpacer} />
          </View>
        </CameraView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBand}>
          <Text style={styles.title}>REPORT</Text>
          <Text style={styles.title}>INCIDENTS</Text>
        </View>

        <View style={styles.form}>
          <FieldLabel label="Incident Type" required />
          <TouchableOpacity style={styles.selectField} onPress={() => setIncidentType(incidentType ? '' : 'Flooding')}>
            <Text style={[styles.fieldText, !incidentType && styles.placeholder]}>{incidentType || 'Enter Name'}</Text>
            <MaterialCommunityIcons name="chevron-down" size={18} color={GREEN} />
          </TouchableOpacity>

          <FieldLabel label="Description" />
          <TextInput
            style={[styles.input, styles.descriptionInput]}
            placeholder="Write what you see"
            placeholderTextColor="#A6C1A7"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <FieldLabel label="Severity" required />
          <View style={styles.severityRow}>
            {SEVERITIES.map((item) => (
              <TouchableOpacity key={item} style={[styles.severityPill, severity === item && styles.selectedSeverity]} onPress={() => setSeverity(item)}>
                <Text style={styles.severityText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <FieldLabel label="Location" />
          <TouchableOpacity style={styles.locationBox} onPress={() => setLocation('Current Location')}>
            <MaterialCommunityIcons name="map-marker" size={34} color="#D6A91D" />
            <View>
              <Text style={styles.locationLink}>{location || 'Get Current Location'}</Text>
              <Text style={styles.locationDetail}>Coordinates</Text>
              <Text style={styles.locationDetail}>Coordinates</Text>
            </View>
          </TouchableOpacity>

          <FieldLabel label="Photos (optional)" />
          <View style={styles.photoRow}>
            {[0, 1, 2].map((index) => (
              <TouchableOpacity key={index} style={styles.photoSlot} onPress={openCamera}>
                {photos[index] ? <Image source={{ uri: photos[index] }} style={styles.photoPreview} /> : <MaterialCommunityIcons name="plus" size={38} color={GREEN} />}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.submitButton} onPress={submitIncident}>
            <Text style={styles.submitText}>Submit Incident</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FieldLabel({ label, required = false }: { label: string; required?: boolean }) {
  return <Text style={styles.label}>{label}{required && <Text style={styles.required}> *</Text>}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  content: { paddingBottom: 10 },
  titleBand: { backgroundColor: GREEN, paddingHorizontal: 14, paddingTop: 18, paddingBottom: 9 },
  title: { color: Colors.white, fontSize: 20, fontWeight: '800', lineHeight: 22 },
  form: { paddingHorizontal: 14, paddingBottom: 12, backgroundColor: Colors.white },
  label: { color: FIELD_GREEN, fontSize: 9, marginTop: 8, marginBottom: 4 },
  required: { color: '#D33D3D' },
  fieldText: { color: FIELD_GREEN, fontSize: 10 },
  placeholder: { color: '#A6C1A7' },
  input: { height: 31, borderWidth: 1, borderColor: '#D9D9D9', borderRadius: 6, paddingHorizontal: 12, color: FIELD_GREEN, fontSize: 10, backgroundColor: Colors.white },
  descriptionInput: { height: 52, paddingTop: 10, textAlignVertical: 'top' },
  selectField: { height: 31, borderWidth: 1, borderColor: '#D9D9D9', borderRadius: 6, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  severityRow: { flexDirection: 'row', justifyContent: 'space-between' },
  severityPill: { borderWidth: 1, borderColor: BORDER_GREEN, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 2 },
  selectedSeverity: { backgroundColor: '#E6F2E6' },
  severityText: { color: FIELD_GREEN, fontSize: 8 },
  locationBox: { height: 65, borderWidth: 1, borderColor: GREEN, borderRadius: 7, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  locationLink: { color: FIELD_GREEN, textDecorationLine: 'underline', fontSize: 9 },
  locationDetail: { color: FIELD_GREEN, fontSize: 8 },
  photoRow: { flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: GREEN, borderRadius: 7, padding: 8 },
  photoSlot: { width: '30%', height: 45, borderWidth: 2, borderColor: GREEN, borderRadius: 5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoPreview: { width: '100%', height: '100%' },
  submitButton: { height: 31, backgroundColor: GREEN, borderRadius: 5, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  submitText: { color: Colors.white, fontSize: 11 },
  cameraScreen: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraControls: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', padding: 24 },
  cameraClose: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  cameraSpacer: { width: 48 },
  captureButton: { width: 76, height: 76, borderRadius: 38, borderWidth: 5, borderColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  captureButtonInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: Colors.white },
});
