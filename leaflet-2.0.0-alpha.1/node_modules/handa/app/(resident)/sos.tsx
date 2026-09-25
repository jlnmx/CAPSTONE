import React from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';

export default function ResidentSosScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.title}>Emergency SOS</Text>
        <Text style={styles.description}>Send an emergency signal to the response team.</Text>
        <TouchableOpacity style={styles.sosButton} onPress={() => Alert.alert('SOS activated', 'Emergency responders have been notified.')} accessibilityLabel="Activate emergency SOS">
          <MaterialCommunityIcons name="alarm-light-outline" size={46} color={Colors.white} />
          <Text style={styles.sosLabel}>SOS</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.white },
  content: { flex: 1, alignItems: 'center', paddingTop: 46, paddingHorizontal: 24 },
  title: { color: '#187821', fontSize: 25, fontWeight: '800' },
  description: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 8 },
  sosButton: { width: 150, height: 150, marginTop: 44, borderRadius: 75, backgroundColor: '#D63F43', borderWidth: 5, borderColor: '#F4B8B8', alignItems: 'center', justifyContent: 'center' },
  sosLabel: { color: Colors.white, fontSize: 30, fontWeight: '900', marginTop: 4 },
});