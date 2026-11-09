import React from 'react';
import { Image, Linking, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable as Pressable } from '@components/Buttons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@constants/colors';
import AppBackArrow from '@components/AppBackArrow';
import { emergencyContacts, toDialNumber } from '@data/emergencyContacts';

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
        <View style={styles.list}>{emergencyContacts.map((contact) => <Pressable key={contact.id} style={styles.contactCard} onPress={() => router.push({ pathname: '/(resident)/emergency-contact-details', params: { id: contact.id } })} accessibilityRole="button" accessibilityLabel={`View details for ${contact.name}`}>
          <View style={[styles.contactIcon, { borderColor: contact.color }]}><Image source={contact.logo} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors /></View>
          <View style={styles.contactCopy}><Text style={styles.contactName}>{contact.name}</Text><Text style={styles.contactDetail}>{contact.summary}</Text><Text style={styles.contactNumber}>{contact.numbers[0].number}</Text></View>
          <Pressable style={styles.callButton} onPress={() => void Linking.openURL(`tel:${toDialNumber(contact.numbers[0].number)}`)} accessibilityRole="button" accessibilityLabel={`Call ${contact.name}`}>
            <MaterialCommunityIcons name="phone" size={20} color={Colors.white} />
          </Pressable>
          <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.textMuted} />
        </Pressable>)}</View>
        <Text style={styles.note}>Tap a contact for details, or tap the green button to call right away. Emergency calls may require mobile service.</Text>
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
  contactCard: { minHeight: 68, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#8BC58B', borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface },
  contactIcon: { width: 46, height: 46, borderWidth: 1, borderRadius: 23, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#FFFFFF' },
  logo: { width: 40, height: 40 },
  contactCopy: { flex: 1, marginLeft: 3 },
  contactName: { color: Colors.text, fontSize: 18, fontWeight: '900' },
  contactDetail: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  contactNumber: { color: Colors.text, fontSize: 12, marginTop: 3 },
  callButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E9446' },
  note: { color: Colors.textMuted, fontSize: 9, textAlign: 'center', marginHorizontal: 24, marginTop: 16 },
});
