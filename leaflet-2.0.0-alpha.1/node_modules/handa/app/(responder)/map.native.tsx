import React from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';
import ResponderLiveMap from '@components/ResponderLiveMap';
import AppBackArrow from '@components/AppBackArrow';

export default function MapScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.header}>
          <AppBackArrow />
          <View style={styles.headerCopy}><Text style={styles.headerTitle}>LIVE RESPONSE MAP</Text><Text style={styles.headerSubtitle}>Biñan City · incidents and evacuation centers</Text></View>
        </View>
        <ResponderLiveMap />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, width: '100%', maxWidth: 900, alignSelf: 'center' },
  header: { backgroundColor: '#218B25', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  headerCopy: { flex: 1 },
  headerTitle: { color: Colors.white, fontSize: 23, fontWeight: '800' },
  headerSubtitle: { color: '#DFF1DF', fontSize: 12, marginTop: 3 },
});