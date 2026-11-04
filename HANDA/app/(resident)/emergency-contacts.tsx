import React from 'react';
import { Image, Linking, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable as Pressable } from '@components/Buttons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import AppBackArrow from '@components/AppBackArrow';

const contacts = [
  { name: 'BCDRRMO', number: '(049) 513-9111', detail: 'Smart 0908-891-9711  |  Globe 0917-120-8911', logo: require('../../assets/logos/bcdrrmo.jpg'), color: '#D07B19' },
  { name: 'PNP', number: '(049) 513-5111', detail: 'Police assistance', logo: require('../../assets/logos/pnp.jpg'), color: '#2A5793' },
  { name: 'BFP', number: '(049) 511-9111', detail: 'Fire and rescue', logo: require('../../assets/logos/bfp.png'), color: '#D59A1E' },
  { name: 'Ospital ng Biñan', number: '(049) 511-4119', detail: 'Medical emergency', logo: require('../../assets/logos/ospital.jpg'), color: '#1BAA8B' },
  { name: 'POSO', number: '(049) 513-8888', detail: 'Traffic and road assistance', logo: require('../../assets/logos/poso.jpg'), color: '#2A5793' },
  { name: 'BJMP', number: '(049) 511-6324', detail: 'Jail management assistance', logo: require('../../assets/logos/bjmp.jpg'), color: '#4D8540' },
];

export default function EmergencyContactsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <AppBackArrow />
          <View style={styles.headerCopy}><Text style={styles.headerTitle}>EMERGENCY</Text><Text style={styles.headerSubtitle}>CONTACT LIST</Text></View>
          <MaterialCommunityIcons name="phone-in-talk-outline" size={40} color={Colors.white} />
        </View>
        <Text style={styles.intro}>Keep these numbers accessible during an emergency.</Text>
        <View style={styles.list}>{contacts.map((contact) => <Pressable key={contact.name} style={styles.contactCard} onPress={() => Linking.openURL(`tel:${contact.number.replace(/[^0-9+]/g, '')}`)} accessibilityLabel={`Call ${contact.name}`}>
          <View style={[styles.contactIcon, { borderColor: contact.color }]}><Image source={contact.logo} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors /></View>
          <View style={styles.contactCopy}><Text style={styles.contactName}>{contact.name}</Text><Text style={styles.contactDetail}>{contact.detail}</Text></View>
          <Text style={styles.contactNumber}>{contact.number}</Text>
        </Pressable>)}</View>
        <Text style={styles.note}>Tap a contact to place a call. Emergency calls may require mobile service.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { width: '100%', maxWidth: 850, alignSelf: 'center', paddingBottom: 24 },
  header: { minHeight: 87, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#218B25', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerCopy: { flex: 1 },
  headerTitle: { color: Colors.white, fontSize: 23, fontWeight: '900', lineHeight: 24 },
  headerSubtitle: { color: Colors.white, fontSize: 15, fontWeight: '800', lineHeight: 17 },
  intro: { color: Colors.textMuted, fontSize: 11, marginHorizontal: 16, marginVertical: 14 },
  list: { gap: 8, marginHorizontal: 9 },
  contactCard: { minHeight: 58, paddingHorizontal: 8, borderWidth: 1, borderColor: '#8BC58B', borderRadius: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface },
  contactIcon: { width: 46, height: 46, borderWidth: 1, borderRadius: 23, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#FFFFFF' },
  logo: { width: 40, height: 40 },
  contactCopy: { flex: 1, marginLeft: 7 },
  contactName: { color: Colors.text, fontSize: 18, fontWeight: '900' },
  contactDetail: { color: Colors.textMuted, fontSize: 8, marginTop: 2 },
  contactNumber: { color: Colors.text, fontSize: 12, marginLeft: 5 },
  note: { color: Colors.textMuted, fontSize: 9, textAlign: 'center', marginHorizontal: 24, marginTop: 16 },
});
