import { ThemeAwareView, ThemeAwareSafeAreaView } from '@components/ThemeAware';
import React from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';
import AppBackArrow from '@components/AppBackArrow';
import ResponderLiveMap from '@components/ResponderLiveMap';

const GREEN = '#D45B92';

export default function MapScreen() {
  return (
    <ThemeAwareSafeAreaView style={styles.safeArea}>
      <ThemeAwareView style={styles.content}>
        <ThemeAwareView style={styles.header}>
          <AppBackArrow />
          <ThemeAwareView style={styles.headerCopy}><Text style={styles.headerTitle}>MAP</Text><Text style={styles.headerSubtitle}>Biñan City, Laguna</Text></ThemeAwareView>
        </ThemeAwareView>
        <ThemeAwareView style={styles.webMap}>
          <ResponderLiveMap />
        </ThemeAwareView>
      </ThemeAwareView>
    </ThemeAwareSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, width: '100%', maxWidth: 900, alignSelf: 'center' },
  header: { backgroundColor: GREEN, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  headerCopy: { flex: 1 },
  headerTitle: { color: Colors.white, fontSize: 28, fontWeight: '800' },
  headerSubtitle: { color: '#DFF1DF', fontSize: 12, marginTop: 2 },
  webMap: { flex: 1, margin: 14, borderWidth: 1, borderColor: GREEN, borderRadius: 8, overflow: 'hidden', backgroundColor: Colors.surfaceMuted },
});
