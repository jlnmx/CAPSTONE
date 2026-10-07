import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@constants/colors';
import ResponderLiveMap from '@components/ResponderLiveMap';

const GREEN = '#218B25';

export default function MapScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>MAP</Text>
          <Text style={styles.headerSubtitle}>Biñan City, Laguna</Text>
        </View>
        <View style={styles.webMap}>
          <ResponderLiveMap />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7FAF7' },
  content: { flex: 1, width: '100%', maxWidth: 900, alignSelf: 'center' },
  header: { backgroundColor: GREEN, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12 },
  headerTitle: { color: Colors.white, fontSize: 28, fontWeight: '800' },
  headerSubtitle: { color: '#DFF1DF', fontSize: 12, marginTop: 2 },
  webMap: { flex: 1, margin: 14, borderWidth: 1, borderColor: GREEN, borderRadius: 8, overflow: 'hidden', backgroundColor: '#EAF2EF' },
});
