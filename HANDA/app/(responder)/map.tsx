import React from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';
import AppBackArrow from '@components/AppBackArrow';
import ResponderLiveMap from '@components/ResponderLiveMap';

export default function MapScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.header}>
          <AppBackArrow />
          <View style={styles.headerCopy}>
            <Text style={styles.headerEyebrow}>RESPONDER COMMAND</Text>
            <Text style={styles.headerTitle}>Live response map</Text>
            <Text style={styles.headerSubtitle}>Biñan City · incidents and evacuation centers</Text>
          </View>
          <View style={styles.headerIcon}><MaterialCommunityIcons name="radar" size={23} color={Colors.white} /></View>
        </View>

        <View style={styles.webMap}><ResponderLiveMap /></View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, width: '100%', maxWidth: 900, alignSelf: 'center' },
  header: { backgroundColor: '#218B25', paddingHorizontal: 14, paddingTop: 13, paddingBottom: 15, flexDirection: 'row', alignItems: 'center', gap: 11 },
  headerCopy: { flex: 1 },
  headerEyebrow: { color: '#DFF1DF', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  headerTitle: { color: Colors.white, fontSize: 21, lineHeight: 26, fontWeight: '800', textTransform: 'uppercase' },
  headerSubtitle: { color: '#E7F5E7', fontSize: 11, marginTop: 2 },
  headerIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  webMap: { flex: 1, margin: 14, borderWidth: 1, borderColor: '#218B25', borderRadius: 8, overflow: 'hidden', backgroundColor: Colors.surfaceMuted },
});
