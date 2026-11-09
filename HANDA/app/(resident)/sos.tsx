import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, SafeAreaView, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable as Pressable } from '@components/Buttons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import AppBackArrow from '@components/AppBackArrow';
import * as Location from 'expo-location';
import { authenticatedFetch } from '@services/apiClient';

const emergencyTypes = [
  { label: 'Flood / landslide', icon: 'waves' as const },
  { label: 'Fire', icon: 'fire' as const },
  { label: 'Medical', icon: 'medical-bag' as const },
  { label: 'Rescue / trapped', icon: 'lifebuoy' as const },
  { label: 'Other / unsure', icon: 'help-circle-outline' as const },
];

type IncidentStatus = 'reported' | 'acknowledged' | 'in_progress' | 'resolved';

export default function ResidentSosScreen() {
  const { width } = useWindowDimensions();
  const sosDiameter = Math.min(218, Math.max(176, width - 72));
  const sosButtonDiameter = sosDiameter - 34;
  const [selectedType, setSelectedType] = useState('Other / unsure');
  const [isHolding, setIsHolding] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [incidentStatus, setIncidentStatus] = useState<IncidentStatus>('reported');
  const [feedback, setFeedback] = useState('');
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
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
      setIncidentId(result.id);
      setIncidentStatus(nextStatus);
      setIsActivated(true);
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
    if (!incidentId || incidentStatus === 'resolved') return undefined;
    let mounted = true;
    const refreshStatus = async () => {
      try {
        const response = await authenticatedFetch('/api/v1/incidents');
        if (!response.ok) throw new Error(`Incident status request failed (${response.status}).`);
        const incidents = await response.json() as Array<{ id?: unknown; status?: unknown }>;
        const incident = incidents.find((item) => item.id === incidentId);
        if (!mounted || !incident) return;
        if (incident.status === 'resolved' || incident.status === 'acknowledged' || incident.status === 'in_progress' || incident.status === 'reported') {
          setIncidentStatus(incident.status);
        }
      } catch {
        // Keep the last confirmed status visible while the next refresh retries.
      }
    };
    void refreshStatus();
    const refresh = setInterval(() => void refreshStatus(), 10_000);
    return () => {
      mounted = false;
      clearInterval(refresh);
    };
  }, [incidentId, incidentStatus]);

  const startHolding = () => {
    if (isActivated || isSubmitting) return;
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
      <Text style={styles.sosLabel}>{isActivated ? 'SENT' : isSubmitting ? 'SENDING' : 'SOS'}</Text>
      <Text style={styles.sosState}>{isActivated ? 'HELP IS ON THE WAY' : isSubmitting ? 'CONTACTING RESPONDERS...' : isHolding ? 'KEEP HOLDING...' : 'PRESS & HOLD 2 SEC'}</Text>
      <View style={styles.progressTrack}><Animated.View style={[styles.progressFill, { width: progressWidth }]} /></View>
    </>
  );

  const renderSosButton = () => Platform.OS === 'web'
    ? React.createElement('button', {
      type: 'button',
      disabled: isActivated || isSubmitting,
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
        backgroundColor: isHolding ? '#246E45' : Colors.success,
        border: `4px solid ${isHolding ? '#246E45' : '#8FC5A0'}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        touchAction: 'none',
        userSelect: 'none',
        cursor: isActivated || isSubmitting ? 'default' : 'pointer',
      },
    }, sosButtonContents)
    : (
      <Pressable
        style={({ pressed }) => [styles.sosButton, { width: sosButtonDiameter, height: sosButtonDiameter, borderRadius: sosButtonDiameter / 2 }, isHolding && styles.sosButtonHolding, isActivated && styles.sosButtonActivated, pressed && styles.sosButtonPressed]}
        onPressIn={startHolding}
        onPressOut={stopHolding}
        disabled={isActivated || isSubmitting}
        accessibilityRole="button"
        accessibilityLabel="Touch and hold for two seconds to send an emergency SOS"
      >
        {sosButtonContents}
      </Pressable>
    );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}><AppBackArrow /><Text style={styles.headerTitle}>EMERGENCY SOS</Text></View>
        <View style={styles.contentBody}>
        <Text style={styles.eyebrow}>HANDA EMERGENCY ASSISTANCE</Text>
        <Text style={styles.title}>Need immediate help?</Text>
        <Text style={styles.description}>Touch and hold the SOS button for 2 seconds to alert the response team.</Text>

        <View style={styles.readiness}><View style={styles.readinessDot} /><Text style={styles.readinessText}>RESPONSE NETWORK READY</Text><Text style={styles.readinessDetail}>Location sharing available</Text></View>

        <Text style={styles.sectionTitle}>WHAT KIND OF SITUATION?</Text>
        <Text style={styles.sectionHint}>Optional, but it helps responders prepare.</Text>
        <View style={styles.typeGrid}>{emergencyTypes.map((type) => <Pressable key={type.label} style={[styles.typeChip, selectedType === type.label && styles.typeChipSelected]} onPress={() => setSelectedType(type.label)}><MaterialCommunityIcons name={type.icon} size={17} color={selectedType === type.label ? Colors.white : Colors.primary} /><Text style={[styles.typeLabel, selectedType === type.label && styles.typeLabelSelected]}>{type.label}</Text></Pressable>)}</View>

        {isActivated ? <SosStatusCard status={incidentStatus} /> : (
          <Animated.View style={[styles.sosShell, { transform: [{ scale: pulse }] }]}>
            <View style={[styles.sosRing, { width: sosDiameter, height: sosDiameter, borderRadius: sosDiameter / 2 }]}>
              {renderSosButton()}
            </View>
          </Animated.View>
        )}

        {!!feedback && <Text style={[styles.feedback, isActivated && styles.feedbackSuccess]} accessibilityRole={isActivated ? 'text' : 'alert'}>{feedback}</Text>}
        <View style={styles.expectCard}><MaterialCommunityIcons name="shield-check-outline" size={22} color={Colors.primary} /><View style={styles.expectCopy}><Text style={styles.expectTitle}>WHAT TO EXPECT</Text><Text style={styles.expectText}>{isActivated ? 'Your request is being monitored by emergency responders.' : 'Your location and situation type will be shared with the response team after activation.'}</Text></View></View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { flexGrow: 1, paddingBottom: 28 },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, backgroundColor: '#218B25' },
  headerTitle: { color: Colors.white, fontSize: 14, fontWeight: '800' },
  contentBody: { alignItems: 'center', paddingTop: 24, paddingHorizontal: 20 },
  eyebrow: { color: Colors.success, fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  title: { color: Colors.primary, fontSize: 25, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  description: { maxWidth: 330, color: Colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 7 },
  readiness: { width: '100%', maxWidth: 430, minHeight: 42, marginTop: 20, paddingHorizontal: 12, borderRadius: 8, backgroundColor: Colors.surfaceMuted, flexDirection: 'row', alignItems: 'center' },
  readinessDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success, marginRight: 8 },
  readinessText: { color: Colors.text, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  readinessDetail: { flex: 1, color: Colors.textMuted, fontSize: 10, textAlign: 'right' },
  sectionTitle: { color: Colors.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1, marginTop: 21 },
  sectionHint: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
  typeGrid: { maxWidth: 440, marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7 },
  typeChip: { minHeight: 36, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeChipSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  typeLabel: { color: Colors.primary, fontSize: 10, fontWeight: '700' },
  typeLabelSelected: { color: Colors.white },
  sosShell: { marginTop: 20 },
  sosRing: { borderWidth: 10, borderColor: '#A8D3B5', backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.success, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 8 },
  sosButton: { backgroundColor: Colors.success, borderWidth: 4, borderColor: '#8FC5A0', alignItems: 'center', justifyContent: 'center' },
  sosButtonHolding: { backgroundColor: '#246E45' },
  sosButtonActivated: { backgroundColor: Colors.success, borderColor: '#8FC5A0' },
  sosButtonPressed: { transform: [{ scale: 0.97 }] },
  sosLabel: { color: Colors.white, fontSize: 31, fontWeight: '900', marginTop: 2 },
  sosState: { color: Colors.white, fontSize: 9, fontWeight: '900', marginTop: 4, letterSpacing: 0.4 },
  progressTrack: { width: 82, height: 7, marginTop: 9, overflow: 'hidden', borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: Colors.white },
  feedback: { maxWidth: 340, marginTop: 12, color: Colors.emergency, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  feedbackSuccess: { color: Colors.success },
  expectCard: { width: '100%', maxWidth: 430, marginTop: 20, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 8, backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'flex-start', shadowColor: Colors.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 5, elevation: 2 },
  expectCopy: { flex: 1, marginLeft: 10 },
  expectTitle: { color: Colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: 0.7 },
  expectText: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  statusCard: { width: '100%', maxWidth: 430, marginTop: 20, padding: 18, borderRadius: 14, backgroundColor: '#FFF4DF', shadowColor: Colors.shadowColor, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.14, shadowRadius: 7, elevation: 3 },
  statusCardResolved: { backgroundColor: '#E8F7EA' },
  statusHeading: { minHeight: 142, flexDirection: 'row', alignItems: 'center' },
  statusHeadingCopy: { flex: 1, paddingRight: 10 },
  statusEyebrow: { color: Colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  statusTitle: { color: Colors.primary, fontSize: 22, fontWeight: '900', marginTop: 12 },
  statusDetail: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 7 },
  statusProgress: { minHeight: 46, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 8 },
  statusStep: { alignItems: 'center', gap: 4 },
  statusStepActive: { opacity: 1 },
  statusStepLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '700' },
  statusStepLabelActive: { color: Colors.text, fontWeight: '900' },
  statusConnector: { flex: 1, height: 3, marginTop: 8, marginHorizontal: 4, borderRadius: 2, backgroundColor: Colors.border },
  statusConnectorActive: { backgroundColor: Colors.success },
  statusBarTrack: { height: 6, marginTop: 6, overflow: 'hidden', borderRadius: 3, backgroundColor: '#D7E2EA' },
  statusBarFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.success },
});

function SosStatusCard({ status }: { status: IncidentStatus }) {
  const stage = status === 'resolved' ? 2 : status === 'acknowledged' || status === 'in_progress' ? 1 : 0;
  const isResolved = status === 'resolved';
  const title = isResolved ? 'Resolved' : stage === 1 ? 'Help is on the way!' : 'SOS sent';
  const detail = isResolved
    ? 'Your emergency request has been completed.'
    : stage === 1
      ? 'Responders are responding to your emergency.'
      : 'Your emergency request was sent to the response team.';
  const stages = ['Sent', 'Responding', 'Resolved'];

  return (
    <View style={[styles.statusCard, isResolved && styles.statusCardResolved]}>
      <View style={styles.statusHeading}>
        <View style={styles.statusHeadingCopy}>
          <Text style={styles.statusEyebrow}>EMERGENCY STATUS</Text>
          <Text style={styles.statusTitle}>{title}</Text>
          <Text style={styles.statusDetail}>{detail}</Text>
        </View>
        <MaterialCommunityIcons name={isResolved ? 'check-circle' : stage === 1 ? 'ambulance' : 'clock-alert-outline'} size={46} color={isResolved ? Colors.success : Colors.secondary} />
      </View>
      <View style={styles.statusProgress}>
        {stages.map((label, index) => (
          <React.Fragment key={label}>
            <View style={[styles.statusStep, index <= stage && styles.statusStepActive]}>
              <MaterialCommunityIcons name={index <= stage ? 'check-circle' : 'circle-outline'} size={18} color={index <= stage ? Colors.success : Colors.border} />
              <Text style={[styles.statusStepLabel, index <= stage && styles.statusStepLabelActive]}>{label}</Text>
            </View>
            {index < stages.length - 1 && <View style={[styles.statusConnector, index < stage && styles.statusConnectorActive]} />}
          </React.Fragment>
        ))}
      </View>
      <View style={styles.statusBarTrack}><View style={[styles.statusBarFill, { width: `${stage === 0 ? 33 : stage === 1 ? 66 : 100}%` }]} /></View>
    </View>
  );
}