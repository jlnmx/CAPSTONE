import React from 'react';
import { Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';

const contacts = [
  { name: 'BCDRRMO', number: '(049) 513-9111', detail: 'Smart 0908-891-9711  |  Globe 0917-120-8911', icon: 'shield-check-outline' as const, color: '#D07B19' },
  { name: 'PNP', number: '(049) 513-5111', detail: 'Police assistance', icon: 'account-outline' as const, color: '#2A5793' },
  { name: 'BFP', number: '(049) 511-9111', detail: 'Fire and rescue', icon: 'alert-circle-outline' as const, color: '#D59A1E' },
  { name: 'Ospital ng Biñan', number: '(049) 511-4119', detail: 'Medical emergency', icon: 'home-city-outline' as const, color: '#1BAA8B' },
  { name: 'POSO', number: '(049) 513-8888', detail: 'Traffic and road assistance', icon: 'map-marker' as const, color: '#2A5793' },
  { name: 'BJMP', number: '(049) 511-6324', detail: 'Jail management assistance', icon: 'account-multiple-outline' as const, color: '#4D8540' },
];

export default function EmergencyContactsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View><Text style={styles.headerTitle}>EMERGENCY</Text><Text style={styles.headerSubtitle}>CONTACT LIST</Text></View>
          <MaterialCommunityIcons name="phone-in-talk-outline" size={40} color={Colors.white} />
        </View>
        <Text style={styles.intro}>Keep these numbers accessible during an emergency.</Text>
        <View style={styles.list}>{contacts.map((contact) => <Pressable key={contact.name} style={styles.contactCard} onPress={() => Linking.openURL(`tel:${contact.number.replace(/[^0-9+]/g, '')}`)} accessibilityLabel={`Call ${contact.name}`}>
          <View style={[styles.contactIcon, { borderColor: contact.color }]}><MaterialCommunityIcons name={contact.icon} size={30} color={contact.color} /></View>
          <View style={styles.contactCopy}><Text style={styles.contactName}>{contact.name}</Text><Text style={styles.contactDetail}>{contact.detail}</Text></View>
          <Text style={styles.contactNumber}>{contact.number}</Text>
        </Pressable>)}</View>
        <Text style={styles.note}>Tap a contact to place a call. Emergency calls may require mobile service.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.white },
  container: { flex: 1, backgroundColor: Colors.white },
  content: { paddingBottom: 24 },
  header: { minHeight: 87, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#218B25', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: Colors.white, fontSize: 23, fontWeight: '900', lineHeight: 24 },
  headerSubtitle: { color: Colors.white, fontSize: 15, fontWeight: '800', lineHeight: 17 },
  intro: { color: '#4C7750', fontSize: 11, marginHorizontal: 16, marginVertical: 14 },
  list: { gap: 8, marginHorizontal: 9 },
  contactCard: { minHeight: 58, paddingHorizontal: 8, borderWidth: 1, borderColor: '#8BC58B', borderRadius: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white },
  contactIcon: { width: 43, height: 43, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F8F5' },
  contactCopy: { flex: 1, marginLeft: 7 },
  contactName: { color: '#155B19', fontSize: 18, fontWeight: '900' },
  contactDetail: { color: '#4C7750', fontSize: 8, marginTop: 2 },
  contactNumber: { color: '#155B19', fontSize: 12, marginLeft: 5 },
  note: { color: Colors.textMuted, fontSize: 9, textAlign: 'center', marginHorizontal: 24, marginTop: 16 },
});
