import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@constants/colors';
import ResponderLiveMap from '@components/ResponderLiveMap';

export default function MapScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>LIVE RESPONSE MAP</Text>
        <Text style={styles.headerSubtitle}>Biñan City · incidents and evacuation centers</Text>
      </View>
      <ResponderLiveMap />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.white },
  header: { backgroundColor: '#218B25', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12 },
  headerTitle: { color: Colors.white, fontSize: 23, fontWeight: '800' },
  headerSubtitle: { color: '#DFF1DF', fontSize: 12, marginTop: 3 },
});