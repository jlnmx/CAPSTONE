import { ThemeAwareView, ThemeAwareSafeAreaView, ThemeAwareScrollView, ThemeAwarePressable } from '@components/ThemeAware';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Linking, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable as Pressable } from '@components/Buttons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Colors } from '@constants/colors';
import { AppBoldFontFamily, AppHeadingFontFamily, AppMediumFontFamily, AppSemiboldFontFamily } from '@constants/typography';
import AppBackArrow from '@components/AppBackArrow';
import { emergencyContacts, toDialNumber, type EmergencyContact } from '@data/emergencyContacts';

const CALL_PINK = '#D45B92';

function useEntrance(index: number) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 420, delay: 120 + index * 70, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [index, progress]);
  return {
    opacity: progress,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }, { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
  };
}

function CallButton({ contact }: { contact: EmergencyContact }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <ThemeAwareView style={styles.callWrap}>
      <Animated.View pointerEvents="none" style={[styles.callPulse, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }] }]} />
      <ThemeAwarePressable style={styles.callButton} onPress={() => void Linking.openURL(`tel:${toDialNumber(contact.numbers[0].number)}`)} accessibilityRole="button" accessibilityLabel={`Call ${contact.name}`}>
        <MaterialCommunityIcons name="phone" size={20} color={Colors.white} />
      </ThemeAwarePressable>
    </ThemeAwareView>
  );
}

function ContactCard({ contact, index }: { contact: EmergencyContact; index: number }) {
  const entrance = useEntrance(index);
  const lift = useRef(new Animated.Value(0)).current;
  const [hovered, setHovered] = useState(false);
  const liftTo = (value: number) => Animated.spring(lift, { toValue: value, useNativeDriver: true, speed: 30, bounciness: 6 }).start();

  return (
    <Animated.View style={[entrance, { transform: [...entrance.transform, { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] }]}>
      <ThemeAwarePressable
        style={[styles.contactCard, hovered && styles.contactCardHover]}
        onHoverIn={() => { setHovered(true); liftTo(1); }}
        onHoverOut={() => { setHovered(false); liftTo(0); }}
        onPress={() => router.push({ pathname: '/(resident)/emergency-contact-details', params: { id: contact.id } })}
        accessibilityRole="button"
        accessibilityLabel={`View details for ${contact.name}`}
      >
        <ThemeAwareView style={[styles.accentBar, { backgroundColor: contact.color }]} />
        <ThemeAwareView style={[styles.contactIcon, { borderColor: `${contact.color}55`, backgroundColor: `${contact.color}14` }]}>
          <Image source={contact.logo} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors />
        </ThemeAwareView>
        <ThemeAwareView style={styles.contactCopy}>
          <Text style={styles.contactName} numberOfLines={1}>{contact.name}</Text>
          <Text style={styles.contactDetail} numberOfLines={1}>{contact.summary}</Text>
          <ThemeAwareView style={[styles.numberPill, { backgroundColor: `${contact.color}14` }]}>
            <MaterialCommunityIcons name="phone-outline" size={12} color={contact.color} />
            <Text style={styles.contactNumber}>{contact.numbers[0].number}</Text>
          </ThemeAwareView>
        </ThemeAwareView>
        <CallButton contact={contact} />
        <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.textMuted} />
      </ThemeAwarePressable>
    </Animated.View>
  );
}

export default function EmergencyContactsScreen() {
  const headerIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(headerIn, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [headerIn]);

  return (
    <ThemeAwareSafeAreaView style={styles.safeArea}>
      <ThemeAwareScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[Colors.primary, Colors.brandBlueDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <MaterialCommunityIcons name="phone-in-talk" size={150} color="rgba(255,255,255,0.08)" style={styles.headerGlyph} />
          <AppBackArrow />
          <Animated.View style={[styles.headerCopy, { opacity: headerIn, transform: [{ translateX: headerIn.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }] }]}>
            <Text style={styles.headerTitle}>Emergency</Text>
            <Text style={styles.headerSubtitle}>CONTACT LIST</Text>
          </Animated.View>
          <ThemeAwareView style={styles.headerBadge}><MaterialCommunityIcons name="phone-in-talk-outline" size={26} color={Colors.white} /></ThemeAwareView>
        </LinearGradient>
        <Animated.View style={[styles.introRow, { opacity: headerIn }]}>
          <MaterialCommunityIcons name="shield-check-outline" size={16} color="#D45B92" />
          <Text style={styles.intro}>Keep these numbers accessible during an emergency.</Text>
        </Animated.View>
        <ThemeAwareView style={styles.list}>{emergencyContacts.map((contact, index) => <ContactCard key={contact.id} contact={contact} index={index} />)}</ThemeAwareView>
        <Text style={styles.note}>Tap a contact for details, or use the call button to connect right away. Emergency calls may require mobile service.</Text>
      </ThemeAwareScrollView>
    </ThemeAwareSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { width: '100%', maxWidth: 850, alignSelf: 'center', paddingBottom: 28 },
  header: { minHeight: 104, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 22, borderBottomLeftRadius: 26, borderBottomRightRadius: 26, flexDirection: 'row', alignItems: 'center', gap: 6, overflow: 'hidden' },
  headerGlyph: { position: 'absolute', right: -18, bottom: -34 },
  headerCopy: { flex: 1 },
  headerTitle: { color: Colors.white, fontFamily: AppHeadingFontFamily, fontSize: 24, lineHeight: 28 },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontFamily: AppSemiboldFontFamily, fontSize: 11, letterSpacing: 2.2, marginTop: 1 },
  headerBadge: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  introRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: 18, marginTop: 16, marginBottom: 12 },
  intro: { flex: 1, color: Colors.textMuted, fontFamily: AppMediumFontFamily, fontSize: 12 },
  list: { gap: 12, marginHorizontal: 14 },
  contactCard: { minHeight: 82, paddingLeft: 16, paddingRight: 10, paddingVertical: 10, borderWidth: 1, borderColor: '#DCE9DC', borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden', backgroundColor: Colors.surface, shadowColor: '#103A18', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  contactCardHover: { borderColor: '#F1C7D9', shadowOpacity: 0.16 },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  contactIcon: { width: 54, height: 54, borderWidth: 1.5, borderRadius: 27, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logo: { width: 44, height: 44 },
  contactCopy: { flex: 1 },
  contactName: { color: Colors.text, fontFamily: AppHeadingFontFamily, fontSize: 17, lineHeight: 22 },
  contactDetail: { color: Colors.textMuted, fontFamily: AppMediumFontFamily, fontSize: 11, marginTop: 1 },
  numberPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  contactNumber: { color: Colors.text, fontFamily: AppBoldFontFamily, fontSize: 12, letterSpacing: 0.3 },
  callWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  callPulse: { position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: CALL_PINK },
  callButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: CALL_PINK, shadowColor: CALL_PINK, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  note: { color: Colors.textMuted, fontFamily: AppMediumFontFamily, fontSize: 10, lineHeight: 15, textAlign: 'center', marginHorizontal: 28, marginTop: 20 },
});
