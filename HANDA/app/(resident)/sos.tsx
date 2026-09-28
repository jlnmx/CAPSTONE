import React, { useRef } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';

export default function ResidentSosScreen() {
  const sosTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startSos = () => {
    sosTimer.current = setTimeout(() => {
      Alert.alert('SOS activated', 'Emergency responders have been notified.');
    }, 3000);
  };

  const cancelSos = () => {
    if (sosTimer.current) {
      clearTimeout(sosTimer.current);
      sosTimer.current = null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>S.O.S</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>HANDA SOS</Text>
        <Text style={styles.title}>EMERGENCY RESPONSE</Text>
        <Text style={styles.description}>SOS IS USED FOR EMERGENCY PURPOSES ONLY.</Text>
        <TouchableOpacity
          style={styles.sosButton}
          onPressIn={startSos}
          onPressOut={cancelSos}
          accessibilityLabel="Press and hold for three seconds to activate emergency SOS"
          accessibilityHint="Emergency responders will be notified after holding the button for three seconds"
        >
          <Text style={styles.sosLabel}>SOS</Text>
          <Text style={styles.sosInstruction}>Press for 3 secs{`\n`}and Hold</Text>
        </TouchableOpacity>
        <View style={styles.expectation}>
          <View style={styles.expectationTitleRow}>
            <MaterialCommunityIcons name="alert" size={18} color="#E5A13A" />
            <Text style={styles.expectationTitle}>WHAT TO EXPECT</Text>
          </View>
          <Text style={styles.expectationText}>RESPONDERS WILL BE NOTIFIED AS SOON AS{`\n`}POSSIBLE.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.white },
  header: { height: 52, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: '#218B25' },
  headerTitle: { color: Colors.white, fontSize: 24, fontWeight: '800', letterSpacing: 1 },
  content: { flex: 1, alignItems: 'center', paddingTop: 22, paddingHorizontal: 18 },
  eyebrow: { color: '#187821', fontSize: 10, fontWeight: '700' },
  title: { color: '#187821', fontSize: 15, fontWeight: '900', marginTop: 4 },
  description: { color: '#187821', fontSize: 8, textAlign: 'center', marginTop: 2 },
  sosButton: { width: 145, height: 145, marginTop: 21, borderRadius: 73, backgroundColor: '#D63F43', alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4 },
  sosLabel: { color: Colors.white, fontSize: 44, fontWeight: '900', lineHeight: 48 },
  sosInstruction: { color: Colors.white, fontSize: 9, lineHeight: 16, textAlign: 'center' },
  expectation: { marginTop: 21, alignItems: 'center' },
  expectationTitleRow: { flexDirection: 'row', alignItems: 'center' },
  expectationTitle: { color: '#187821', fontSize: 15, fontWeight: '900', marginLeft: 3 },
  expectationText: { color: '#187821', fontSize: 8, lineHeight: 12, textAlign: 'center', marginTop: 2 },
});