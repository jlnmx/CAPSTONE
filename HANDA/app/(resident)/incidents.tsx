import React from 'react';
import { Colors } from '@constants/colors';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ResidentIncidentFeed from '@components/ResidentIncidentFeed';
import AppBackArrow from '@components/AppBackArrow';
import { kitFonts } from '@components/IncidentCardKit';

export default function ResidentIncidentsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <LinearGradient colors={['#1F9A2E', '#176B1D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <AppBackArrow />
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Incidents</Text>
            <Text style={styles.headerSubtitle}>Live community reports · Biñan City</Text>
          </View>
          <View style={styles.headerBadge}><MaterialCommunityIcons name="map-marker-radius-outline" size={24} color="#FFFFFF" /></View>
        </LinearGradient>
        <ResidentIncidentFeed />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, width: '100%', maxWidth: 900, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerCopy: { flex: 1 },
  headerTitle: { color: '#FFFFFF', fontFamily: kitFonts.heading, fontSize: 22, lineHeight: 26 },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontFamily: kitFonts.medium, fontSize: 11, marginTop: 2 },
  headerBadge: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
});
