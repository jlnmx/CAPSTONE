import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ResidentIncidentFeed from '@components/ResidentIncidentFeed';

const GREEN = '#218B25';

export default function ResidentIncidentsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}><Text style={styles.headerTitle}>INCIDENTS</Text><Text style={styles.headerSubtitle}>Live community reports · Biñan City</Text><MaterialCommunityIcons name="map-marker-radius-outline" size={27} color="#DFF1DF" /></View>
      <ResidentIncidentFeed />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FAF7' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 13, backgroundColor: GREEN },
  headerTitle: { color: '#FFFFFF', fontSize: 25, fontWeight: '800' },
  headerSubtitle: { position: 'absolute', left: 16, bottom: 2, color: '#DFF1DF', fontSize: 10 },
});
