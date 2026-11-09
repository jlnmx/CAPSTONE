import React from 'react';
import { Colors } from '@constants/colors';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { LinearGradient } from 'expo-linear-gradient';
import ResponderIncidentQueue from '@components/ResponderIncidentQueue';
import AppBackArrow from '@components/AppBackArrow';
import { kitFonts } from '@components/IncidentCardKit';

export default function IncidentsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#1F9A2E', '#176B1D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.titleBand}>
          <AppBackArrow />
          <View>
            <Text style={styles.title}>Active</Text>
            <Text style={styles.subtitle}>INCIDENTS</Text>
          </View>
        </LinearGradient>
        <ResponderIncidentQueue />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: 14 },
  titleBand: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  title: { color: '#FFFFFF', fontFamily: kitFonts.heading, fontSize: 22, lineHeight: 26 },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontFamily: kitFonts.semibold, fontSize: 11, letterSpacing: 2.2, marginTop: 1 },
});
