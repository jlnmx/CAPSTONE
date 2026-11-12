import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, SafeAreaView, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable as Pressable } from '@components/Buttons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@constants/colors';
import { AppBoldFontFamily, AppHeadingFontFamily, AppMediumFontFamily, AppSemiboldFontFamily } from '@constants/typography';
import * as Location from 'expo-location';
import { authenticatedFetch } from '@services/apiClient';
import { router } from 'expo-router';
import { SosIncidentStatus, SosStatusView } from '@components/SosStatusView';
import AppBackArrow from '@components/AppBackArrow';

const emergencyTypes = [
  { label: 'Flood / landslide', icon: 'waves' as const },
  { label: 'Fire', icon: 'fire' as const },
  { label: 'Medical', icon: 'medical-bag' as const },
  { label: 'Rescue / trapped', icon: 'lifebuoy' as const },
  { label: 'Other / unsure', icon: 'help-circle-outline' as const },
];

type IncidentStatus = SosIncidentStatus;

export default function ResidentSosScreen() {
  const { width, height } = useWindowDimensions();
  const sosDiameter = Math.min(236, Math.max(176, Math.min(width - 72, height * 0.32)));
  const sosButtonDiameter = sosDiameter - 34;
  const [selectedType, setSelectedType] = useState('Other / unsure');
  const [isHolding, setIsHolding] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isStatusUnavailable, setIsStatusUnavailable] = useState(false);
  const [incidentStatus, setIncidentStatus] = useState<IncidentStatus>('reported');
  const [sentAt, setSentAt] = useState<Date | null>(null);
  const [locationLabel, setLocationLabel] = useState('Location unavailable');
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const hasActiveSos = useRef(false);
  const sosRequestVersion = useRef(0);
  const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.035, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const activateSos = async () => {
    setIsHolding(false);
    setIsSubmitting(true);
    setFeedback('');
    let coordinate: Location.LocationObjectCoords | null = null;
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted') permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === 'granted') {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        coordinate = position.coords;
      }
    } catch {
      setFeedback('Location is unavailable. Sending the SOS without a map pin.');
    }

    const location = coordinate
      ? `Biñan City · ${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`
      : 'Location unavailable';
    const payload = {
      id: `sos-${Date.now()}`,
      type: `SOS - ${selectedType}`,
      description: `Resident activated SOS. Situation: ${selectedType}.`,
      severity: 'critical',
      location,
      latitude: coordinate?.latitude ?? null,
      longitude: coordinate?.longitude ?? null,
      photoUris: [],
      createdAt: new Date().toISOString(),
    };

    try {
      const response = await authenticatedFetch('/api/v1/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let detail = '';
        try {
          const result = await response.json() as { detail?: unknown };
          detail = typeof result.detail === 'string' ? result.detail : '';
        } catch {
        }
        throw new Error(detail || `The emergency service returned ${response.status}.`);
      }
      const result = await response.json() as { id?: unknown; status?: unknown };
      if (typeof result.id !== 'string' || !result.id) throw new Error('The emergency service did not return an incident reference.');
      const nextStatus: IncidentStatus = result.status === 'resolved' || result.status === 'acknowledged' || result.status === 'in_progress' ? result.status : 'reported';
      setIncidentStatus(nextStatus);
      setSentAt(new Date());
      setLocationLabel(coordinate ? `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}` : 'Location unavailable');
      hasActiveSos.current = true;
      sosRequestVersion.current += 1;
      setIsActivated(true);
      setIsStatusUnavailable(false);
      setIsRestoring(false);
      progress.setValue(1);
      setFeedback(coordinate
        ? 'SOS sent. Responders have been notified and your location was shared.'
        : 'SOS sent. Responders have been notified, but no location was available.');
    } catch (sendError) {
      progress.setValue(0);
      setFeedback(sendError instanceof Error ? `SOS was not sent: ${sendError.message}` : 'SOS was not sent. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const refreshStatus = async () => {
      const requestVersion = sosRequestVersion.current;
      try {
        const response = await authenticatedFetch('/api/v1/resident/sos');
        if (!response.ok) throw new Error(`SOS status request failed (${response.status}).`);
        const incident = await response.json() as {
          id?: unknown;
          type?: unknown;
          status?: unknown;
          location?: unknown;
          latitude?: unknown;
          longitude?: unknown;
          responseEtaMinutes?: unknown;
          createdAt?: unknown;
        } | null;
        if (!mounted || requestVersion !== sosRequestVersion.current) return;
        if (incident === null) {
          setIsStatusUnavailable(false);
          setIsRestoring(false);
          setFeedback('');
          if (hasActiveSos.current) {
            hasActiveSos.current = false;
            setIncidentStatus('resolved');
          }
          return;
        }
        if (
          typeof incident.id !== 'string'
          || typeof incident.type !== 'string'
          || (incident.status !== 'reported' && incident.status !== 'acknowledged' && incident.status !== 'in_progress')
        ) throw new Error('The emergency service returned an invalid SOS status.');

        const nextStatus: IncidentStatus = incident.status;
        const latitude = typeof incident.latitude === 'number' ? incident.latitude : null;
        const longitude = typeof incident.longitude === 'number' ? incident.longitude : null;
        const hasCoordinates = latitude !== null && longitude !== null;
        const createdAt = typeof incident.createdAt === 'string' ? new Date(incident.createdAt) : null;
        setSelectedType(incident.type.startsWith('SOS - ') ? incident.type.slice(6) : incident.type);
        setIncidentStatus(nextStatus);
        setLocationLabel(hasCoordinates ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : typeof incident.location === 'string' ? incident.location : 'Location unavailable');
        setEtaMinutes(typeof incident.responseEtaMinutes === 'number' ? incident.responseEtaMinutes : null);
        setSentAt(createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : null);
        hasActiveSos.current = true;
        setIsActivated(true);
        setIsStatusUnavailable(false);
        setIsRestoring(false);
        setFeedback('');
        progress.setValue(1);
      } catch {
        if (!mounted || requestVersion !== sosRequestVersion.current) return;
        setIsStatusUnavailable(true);
        setIsRestoring(false);
        if (!hasActiveSos.current) {
          setFeedback('Unable to verify your SOS status. Reconnect before sending another alert.');
        }
      }
    };
    void refreshStatus();
    const refresh = setInterval(() => void refreshStatus(), 10_000);
    return () => {
      mounted = false;
      clearInterval(refresh);
    };
  }, [progress]);

  const startHolding = () => {
    if (isActivated || isSubmitting || isRestoring || isStatusUnavailable) return;
    setFeedback('');
    setIsHolding(true);
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 2000, useNativeDriver: false }).start(({ finished }) => {
      if (finished) void activateSos();
    });
  };

  const stopHolding = () => {
    if (!isActivated && !isSubmitting) {
      setIsHolding(false);
      progress.stopAnimation();
      Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: false }).start();
    }
  };

  const sosButtonContents = (
    <>
      <MaterialCommunityIcons name={isActivated ? 'check-circle-outline' : isSubmitting ? 'upload' : 'alarm-light-outline'} size={43} color={Colors.white} />
      <Text style={styles.sosLabel}>{isActivated ? 'SENT' : isSubmitting ? 'SENDING' : isRestoring || isStatusUnavailable ? 'CHECKING' : 'SOS'}</Text>
      <Text style={styles.sosState}>{isActivated ? 'HELP IS ON THE WAY' : isSubmitting ? 'CONTACTING RESPONDERS...' : isRestoring || isStatusUnavailable ? 'VERIFYING ALERT STATUS...' : isHolding ? 'KEEP HOLDING...' : 'PRESS & HOLD 2 SEC'}</Text>
      <View style={styles.progressTrack}><Animated.View style={[styles.progressFill, { width: progressWidth }]} /></View>
    </>
  );

  const renderSosButton = () => Platform.OS === 'web'
    ? React.createElement('button', {
      type: 'button',
      disabled: isActivated || isSubmitting || isRestoring || isStatusUnavailable,
      'aria-label': 'Touch and hold for two seconds to send an emergency SOS',
      onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        startHolding();
      },
      onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        stopHolding();
      },
      onPointerCancel: stopHolding,
      onLostPointerCapture: stopHolding,
      style: {
        width: sosButtonDiameter,
        height: sosButtonDiameter,
        borderRadius: sosButtonDiameter / 2,
        backgroundColor: isHolding ? '#B42318' : Colors.emergency,
        border: `4px solid ${isHolding ? '#B42318' : '#F6B1AB'}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        touchAction: 'none',
        userSelect: 'none',
        cursor: isActivated || isSubmitting || isRestoring || isStatusUnavailable ? 'default' : 'pointer',
      },
    }, sosButtonContents)
    : (
      <Pressable
        style={({ pressed }) => [styles.sosButton, { width: sosButtonDiameter, height: sosButtonDiameter, borderRadius: sosButtonDiameter / 2 }, isHolding && styles.sosButtonHolding, isActivated && styles.sosButtonActivated, pressed && styles.sosButtonPressed]}
        onPressIn={startHolding}
        onPressOut={stopHolding}
        disabled={isActivated || isSubmitting || isRestoring || isStatusUnavailable}
        accessibilityRole="button"
        accessibilityLabel="Touch and hold for two seconds to send an emergency SOS"
      >
        {sosButtonContents}
      </Pressable>
    );

  const handleReturnHome = () => router.replace('/(resident)');
  const handleOpenContacts = () => router.push('/(resident)/emergency-contacts');

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#176B2D', '#25A04A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <AppBackArrow />
        <View style={styles.headerIcon}><MaterialCommunityIcons name={isActivated ? 'radar' : 'alarm-light-outline'} size={22} color={Colors.white} /></View>
        <View style={styles.headerCopy}>
          <Text darkText style={styles.headerTitle}>{isActivated ? 'Emergency Status' : 'Emergency SOS'}</Text>
          <Text darkText style={styles.headerSubtitle}>{isActivated ? 'Live updates from the response team' : 'Biñan City response network'}</Text>
        </View>
      </LinearGradient>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.contentBody}>
          {isActivated ? (
            <SosStatusView
              status={incidentStatus}
              emergencyType={selectedType}
              locationLabel={locationLabel}
              sentAt={sentAt}
              etaMinutes={etaMinutes}
              onReturnHome={handleReturnHome}
              onOpenContacts={handleOpenContacts}
            />
          ) : (
            <View style={styles.sendColumn}>
              <Text style={styles.title}>Need immediate help?</Text>
              <Text style={styles.description}>Press and hold the SOS button for 2 seconds to alert the response team and share your location.</Text>

              <View style={styles.readiness}>
                <View style={styles.readinessDot} />
                <Text style={styles.readinessText}>Network ready</Text>
                <MaterialCommunityIcons name="crosshairs-gps" size={14} color={Colors.textMuted} />
                <Text style={styles.readinessDetail}>Location sharing on</Text>
              </View>

              <Animated.View style={[styles.sosShell, { transform: [{ scale: pulse }] }]}>
                <View style={[styles.sosHalo, { width: sosDiameter + 28, height: sosDiameter + 28, borderRadius: (sosDiameter + 28) / 2 }]}>
                  <View style={[styles.sosRing, { width: sosDiameter, height: sosDiameter, borderRadius: sosDiameter / 2 }]}>
                    {renderSosButton()}
                  </View>
                </View>
              </Animated.View>

              {!!feedback && <Text style={styles.feedback} accessibilityRole="alert">{feedback}</Text>}

              <Text style={styles.sectionTitle}>What kind of situation?</Text>
              <Text style={styles.sectionHint}>Optional, but it helps responders prepare.</Text>
              <View style={styles.typeGrid}>
                {emergencyTypes.map((type) => {
                  const selected = selectedType === type.label;
                  return (
                    <Pressable key={type.label} style={[styles.typeChip, selected && styles.typeChipSelected]} onPress={() => setSelectedType(type.label)} accessibilityRole="button" accessibilityState={{ selected }}>
                      <MaterialCommunityIcons name={type.icon} size={18} color={selected ? Colors.white : Colors.primary} />
                      <Text style={[styles.typeLabel, selected && styles.typeLabelSelected]}>{type.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.expectCard}>
                <View style={styles.expectIcon}><MaterialCommunityIcons name="shield-check-outline" size={22} color={Colors.secondary} /></View>
                <View style={styles.expectCopy}>
                  <Text style={styles.expectTitle}>What happens next</Text>
                  <Text style={styles.expectText}>Your location and situation type are shared with CDRRMO responders. You can follow progress live on the next screen.</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { flexGrow: 1, paddingBottom: 32 },
  header: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
  headerCopy: { flex: 1 },
  headerTitle: { color: Colors.white, fontFamily: AppHeadingFontFamily, fontSize: 18 },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontFamily: AppMediumFontFamily, fontSize: 12, marginTop: 2 },
  contentBody: { paddingTop: 20, paddingHorizontal: 16 },
  sendColumn: { width: '100%', maxWidth: 520, alignSelf: 'center', alignItems: 'center' },
  title: { color: Colors.primary, fontFamily: AppHeadingFontFamily, fontSize: 26, lineHeight: 32, textAlign: 'center' },
  description: { maxWidth: 360, color: Colors.textMuted, fontFamily: AppMediumFontFamily, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  readiness: { marginTop: 18, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: '#E7F5EB', flexDirection: 'row', alignItems: 'center', gap: 8 },
  readinessDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  readinessText: { color: '#1F5F32', fontFamily: AppBoldFontFamily, fontSize: 12 },
  readinessDetail: { color: Colors.textMuted, fontFamily: AppMediumFontFamily, fontSize: 12 },
  sectionTitle: { color: Colors.primary, fontFamily: AppBoldFontFamily, fontSize: 15, marginTop: 26 },
  sectionHint: { color: Colors.textMuted, fontFamily: AppMediumFontFamily, fontSize: 12, marginTop: 4 },
  typeGrid: { width: '100%', marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  typeChip: { minHeight: 44, paddingHorizontal: 14, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14, backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeChipSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  typeLabel: { color: Colors.primary, fontFamily: AppSemiboldFontFamily, fontSize: 12 },
  typeLabelSelected: { color: Colors.white },
  sosShell: { marginTop: 26 },
  sosHalo: { backgroundColor: '#FDECEA', alignItems: 'center', justifyContent: 'center' },
  sosRing: { borderWidth: 10, borderColor: '#F8C7C2', backgroundColor: '#FFF6F5', alignItems: 'center', justifyContent: 'center', shadowColor: Colors.emergency, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.28, shadowRadius: 16, elevation: 10 },
  sosButton: { backgroundColor: Colors.emergency, borderWidth: 4, borderColor: '#F6B1AB', alignItems: 'center', justifyContent: 'center' },
  sosButtonHolding: { backgroundColor: '#B42318' },
  sosButtonActivated: { backgroundColor: Colors.emergency, borderColor: '#F6B1AB' },
  sosButtonPressed: { transform: [{ scale: 0.97 }] },
  sosLabel: { color: Colors.white, fontFamily: AppHeadingFontFamily, fontSize: 32, marginTop: 2 },
  sosState: { color: Colors.white, fontFamily: AppBoldFontFamily, fontSize: 10, marginTop: 4, letterSpacing: 0.6 },
  progressTrack: { width: 88, height: 7, marginTop: 10, overflow: 'hidden', borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: Colors.white },
  feedback: { maxWidth: 360, marginTop: 14, color: Colors.emergency, fontFamily: AppSemiboldFontFamily, fontSize: 13, textAlign: 'center' },
  expectCard: { width: '100%', marginTop: 24, padding: 16, borderRadius: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  expectIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F1FA' },
  expectCopy: { flex: 1 },
  expectTitle: { color: Colors.primary, fontFamily: AppBoldFontFamily, fontSize: 13 },
  expectText: { color: Colors.textMuted, fontFamily: AppMediumFontFamily, fontSize: 12, lineHeight: 18, marginTop: 4 },
});
