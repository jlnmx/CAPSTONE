import React from 'react';
import { Image, Linking, Platform, SafeAreaView, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable as Pressable } from '@components/Buttons';
import { Colors } from '@constants/colors';
import { AppBoldFontFamily, AppHeadingFontFamily, AppMediumFontFamily, AppSemiboldFontFamily } from '@constants/typography';
import { getEmergencyContact, toDialNumber } from '@data/emergencyContacts';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function ActionButton({ icon, label, color, onPress }: { icon: IconName; label: string; color: string; onPress: () => void }) {
  return (
    <Pressable style={styles.action} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.actionCircle, { backgroundColor: color }]}><MaterialCommunityIcons name={icon} size={24} color={Colors.white} /></View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

export default function EmergencyContactDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { width } = useWindowDimensions();
  const contact = getEmergencyContact(Array.isArray(id) ? id[0] : id);

  if (!contact) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.missing}>
          <MaterialCommunityIcons name="alert-circle-outline" size={40} color={Colors.textMuted} />
          <Text style={styles.missingText}>This contact could not be found.</Text>
          <Pressable style={styles.missingButton} onPress={() => router.replace('/(resident)/emergency-contacts')}><Text darkText style={styles.missingButtonText}>Back to contacts</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const primaryNumber = contact.numbers[0];
  const call = (number: string) => void Linking.openURL(`tel:${toDialNumber(number)}`);
  const openLocation = () => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${contact.name} ${contact.address}`)}`);
  const openWebsite = () => { if (contact.website) void Linking.openURL(contact.website); };
  const share = async () => {
    const lines = [
      `${contact.name} — ${contact.title}`,
      ...contact.numbers.map((item) => `${item.label}: ${item.number}`),
      contact.address,
      contact.website,
    ].filter(Boolean).join('\n');
    try {
      await Share.share(Platform.OS === 'ios' ? { message: lines } : { title: contact.name, message: lines });
    } catch {
      // Sharing is unavailable or was dismissed; nothing to recover.
    }
  };

  const compact = width < 380;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[`${contact.color}33`, `${contact.color}0D`, Colors.surface]} style={styles.banner}>
          <Pressable style={styles.backButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
            <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.primary} />
          </Pressable>
          <View style={[styles.logoFrame, { borderColor: contact.color }]}>
            <Image source={contact.logo} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors accessibilityLabel={`${contact.name} logo`} />
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <Text style={[styles.title, compact && styles.titleCompact]}>{contact.title}</Text>
          <View style={styles.addressRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={15} color={Colors.textMuted} />
            <Text style={styles.addressText}>{contact.address}</Text>
          </View>

          <View style={styles.actions}>
            <ActionButton icon="phone" label="Call" color="#1D6FD1" onPress={() => call(primaryNumber.number)} />
            <ActionButton icon="map-marker" label="Location" color="#F08A1C" onPress={openLocation} />
            {contact.website && <ActionButton icon="web" label="Page" color="#14A38B" onPress={openWebsite} />}
            <ActionButton icon="share-variant" label="Share" color="#7B3FD0" onPress={() => void share()} />
          </View>

          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.description}>{contact.description}</Text>

          <Text style={styles.sectionTitle}>Contact numbers</Text>
          <View style={styles.numbers}>
            {contact.numbers.map((item, index) => (
              <Pressable key={`${item.label}-${item.number}`} style={[styles.numberRow, index > 0 && styles.numberRowBorder]} onPress={() => call(item.number)} accessibilityRole="button" accessibilityLabel={`Call ${item.label} ${item.number}`}>
                <View style={styles.numberIcon}><MaterialCommunityIcons name="phone-outline" size={18} color={Colors.secondary} /></View>
                <View style={styles.numberCopy}>
                  <Text style={styles.numberLabel}>{item.label}</Text>
                  <Text style={styles.numberValue}>{item.number}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingBottom: 32 },
  banner: { height: 200, alignItems: 'center', justifyContent: 'center' },
  backButton: { position: 'absolute', top: 14, left: 14, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.9)' },
  logoFrame: { width: 132, height: 132, borderRadius: 66, borderWidth: 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#FFFFFF', shadowColor: '#0B3A63', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 14, elevation: 6 },
  logo: { width: 116, height: 116 },
  body: { paddingHorizontal: 20 },
  title: { color: Colors.primary, fontFamily: AppHeadingFontFamily, fontSize: 21, lineHeight: 28, textAlign: 'center' },
  titleCompact: { fontSize: 18, lineHeight: 24 },
  addressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 8 },
  addressText: { flexShrink: 1, color: Colors.textMuted, fontFamily: AppMediumFontFamily, fontSize: 12, textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 20, marginTop: 22 },
  action: { width: 64, alignItems: 'center', gap: 7 },
  actionCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: Colors.text, fontFamily: AppSemiboldFontFamily, fontSize: 12 },
  sectionTitle: { color: Colors.primary, fontFamily: AppBoldFontFamily, fontSize: 15, marginTop: 26, marginBottom: 8 },
  description: { color: Colors.text, fontFamily: AppMediumFontFamily, fontSize: 14, lineHeight: 22 },
  numbers: { borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, overflow: 'hidden' },
  numberRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  numberRowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  numberIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F1FA' },
  numberCopy: { flex: 1, minWidth: 0 },
  numberLabel: { color: Colors.textMuted, fontFamily: AppMediumFontFamily, fontSize: 11 },
  numberValue: { color: Colors.text, fontFamily: AppSemiboldFontFamily, fontSize: 14, marginTop: 2 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  missingText: { color: Colors.textMuted, fontFamily: AppMediumFontFamily, fontSize: 14 },
  missingButton: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.primary },
  missingButtonText: { color: Colors.white, fontFamily: AppBoldFontFamily, fontSize: 13 },
});
