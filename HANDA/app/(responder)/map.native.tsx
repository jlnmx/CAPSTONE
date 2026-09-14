import React, { useRef, useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Camera, MapView, PointAnnotation, UserLocation } from '@maplibre/maplibre-react-native';
import { Colors } from '@constants/colors';
import { MOCK_EVACUATION_CENTERS, MOCK_INCIDENTS } from '@data/mockData';

const GREEN = '#218B25';
const BINAN_CENTER: [number, number] = [121.0781, 14.3036];
const BINAN_BOUNDS = { ne: [121.16, 14.38], sw: [120.99, 14.23] };
const OSM_STYLE = {
  version: 8,
  sources: { openstreetmap: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' } },
  layers: [{ id: 'openstreetmap', type: 'raster', source: 'openstreetmap' }],
};

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export default function MapScreen() {
  const cameraRef = useRef<React.ElementRef<typeof Camera>>(null);
  const [showCenters, setShowCenters] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);

  const goToUserLocation = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Location permission needed', 'Allow location access to center the map on your position.');
      return;
    }
    const position = await Location.getCurrentPositionAsync({});
    cameraRef.current?.flyTo([position.coords.longitude, position.coords.latitude], 900);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MAP</Text>
        <Text style={styles.headerSubtitle}>Biñan City, Laguna</Text>
      </View>
      <View style={styles.mapFrame}>
        <MapView style={styles.map} mapStyle={OSM_STYLE} logoEnabled={false} attributionEnabled scrollEnabled zoomEnabled rotateEnabled={false}>
          <Camera ref={cameraRef} defaultSettings={{ centerCoordinate: BINAN_CENTER, zoomLevel: 12.5 }} maxBounds={BINAN_BOUNDS} />
          <UserLocation visible />
          {showCenters && MOCK_EVACUATION_CENTERS.map((center, index) => (
            <PointAnnotation key={center.id} id={center.id} coordinate={[BINAN_CENTER[0] + (index - 1) * 0.015, BINAN_CENTER[1] + (index % 2) * 0.012]}>
              <View style={[styles.marker, styles.centerMarker]}><MaterialCommunityIcons name="home-city" size={16} color={Colors.white} /></View>
            </PointAnnotation>
          ))}
          {showIncidents && MOCK_INCIDENTS.slice(0, 5).map((incident, index) => (
            <PointAnnotation key={incident.id} id={incident.id} coordinate={[BINAN_CENTER[0] + (index - 2) * 0.012, BINAN_CENTER[1] - 0.012 - (index % 2) * 0.013]}>
              <View style={[styles.marker, styles.incidentMarker]}><MaterialCommunityIcons name="alert" size={16} color={Colors.white} /></View>
            </PointAnnotation>
          ))}
        </MapView>
      </View>
      <View style={styles.controls}>
        <MapControl label="Barangay Centers" icon="home-city-outline" active={showCenters} onPress={() => setShowCenters((visible) => !visible)} />
        <MapControl label="Incidents" icon="alert-outline" active={showIncidents} onPress={() => setShowIncidents((visible) => !visible)} />
        <MapControl label="Your location" icon="crosshairs-gps" onPress={goToUserLocation} />
      </View>
    </SafeAreaView>
  );
}

function MapControl({ label, icon, active = true, onPress }: { label: string; icon: IconName; active?: boolean; onPress: () => void }) {
  return <TouchableOpacity style={[styles.control, !active && styles.controlInactive]} onPress={onPress} activeOpacity={0.75}>
    <MaterialCommunityIcons name={icon} size={17} color={active ? GREEN : '#8EA08E'} />
    <Text style={[styles.controlText, !active && styles.controlTextInactive]}>{label}</Text>
  </TouchableOpacity>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.white },
  header: { backgroundColor: GREEN, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12 },
  headerTitle: { color: Colors.white, fontSize: 28, fontWeight: '800' },
  headerSubtitle: { color: '#DFF1DF', fontSize: 12, marginTop: 2 },
  mapFrame: { flex: 1, marginHorizontal: 14, marginTop: 14, borderWidth: 1, borderColor: GREEN, borderRadius: 8, overflow: 'hidden' },
  map: { flex: 1 },
  marker: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.white },
  centerMarker: { backgroundColor: '#1E5987' },
  incidentMarker: { backgroundColor: '#D63F43' },
  controls: { gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  control: { height: 34, borderWidth: 1, borderColor: GREEN, borderRadius: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  controlInactive: { borderColor: '#B8C4B8' },
  controlText: { color: GREEN, fontSize: 12 },
  controlTextInactive: { color: '#8EA08E' },
});
