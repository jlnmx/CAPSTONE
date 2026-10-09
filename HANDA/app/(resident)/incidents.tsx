import React from 'react';
import { Colors } from '@constants/colors';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ResidentIncidentFeed from '@components/ResidentIncidentFeed';

const GREEN = '#218B25';

export default function ResidentIncidentsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>INCIDENTS</Text>
            <Text style={styles.headerSubtitle}>Live community reports · Biñan City</Text>
          </View>
          <MaterialCommunityIcons name="map-marker-radius-outline" size={27} color="#DFF1DF" />
        </View>
        <ResidentIncidentFeed />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, width: '100%', maxWidth: 900, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 18, paddingBottom: 9, backgroundColor: GREEN },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', lineHeight: 22 },
  headerSubtitle: { color: '#DFF1DF', fontSize: 10, marginTop: 3 },
});
