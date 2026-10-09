import React from 'react';
import { Colors } from '@constants/colors';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import ResponderIncidentQueue from '@components/ResponderIncidentQueue';

const GREEN = '#218B25';

export default function IncidentsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBand}>
          <Text style={styles.title}>ACTIVE</Text>
          <Text style={styles.title}>INCIDENTS</Text>
        </View>
        <ResponderIncidentQueue />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: 10 },
  titleBand: { backgroundColor: GREEN, paddingHorizontal: 14, paddingTop: 18, paddingBottom: 9 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', lineHeight: 22 },
});
