import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';

const GREEN = '#218B25';
export default function MapScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MAP</Text>
        <Text style={styles.headerSubtitle}>Biñan City, Laguna</Text>
      </View>

      <View style={styles.webMap}>
        <MaterialCommunityIcons name="map-outline" size={48} color={GREEN} />
        <Text style={styles.webMapTitle}>Biñan City operational map</Text>
        <Text style={styles.webMapCopy}>MapLibre is available in the Android and iOS development build.</Text>
        <Text style={styles.webMapCoordinates}>14.3036° N, 121.0781° E</Text>
      </View>
      <View style={styles.controls}>
        <MapControl label="Barangay Centers" icon="home-city-outline" onPress={() => {}} />
        <MapControl label="Incidents" icon="alert-outline" onPress={() => {}} />
        <MapControl label="Your location" icon="crosshairs-gps" onPress={() => {}} />
      </View>
    </SafeAreaView>
  );
}

function MapControl({ label, icon, onPress }: { label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.control} onPress={onPress} activeOpacity={0.75}>
      <MaterialCommunityIcons name={icon} size={17} color={GREEN} />
      <Text style={styles.controlText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.white },
  header: { backgroundColor: GREEN, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12 },
  headerTitle: { color: Colors.white, fontSize: 28, fontWeight: '800' },
  headerSubtitle: { color: '#DFF1DF', fontSize: 12, marginTop: 2 },
  controls: { gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  control: { height: 34, borderWidth: 1, borderColor: GREEN, borderRadius: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  controlText: { color: GREEN, fontSize: 12 },
  webMap: { flex: 1, margin: 14, borderWidth: 1, borderColor: GREEN, borderRadius: 8, backgroundColor: '#EAF2EF', alignItems: 'center', justifyContent: 'center', padding: 24 },
  webMapTitle: { color: GREEN, fontSize: 18, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  webMapCopy: { color: '#548B56', fontSize: 12, textAlign: 'center', marginTop: 8 },
  webMapCoordinates: { color: '#1E5987', fontSize: 11, marginTop: 12 },
});
