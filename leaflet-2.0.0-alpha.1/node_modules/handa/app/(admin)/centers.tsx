import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable as TouchableOpacity } from '@components/Buttons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Colors, BorderRadius, Shadows, Spacing } from '@constants/colors';
import { AdminCenterRecord, getAdminCenters, updateAdminCenterCapacity } from '@services/adminData';

const centerDialogStyles = StyleSheet.create({
  loadError: { color: Colors.emergency, fontSize: 12, marginBottom: 12 },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0, 0, 0, 0.42)' },
  modalCard: { width: '100%', maxWidth: 420, padding: 20, borderRadius: BorderRadius.md, backgroundColor: Colors.surface },
  modalTitle: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  modalSubtitle: { color: Colors.textMuted, fontSize: 12, marginTop: 5 },
  capacityInput: { height: 48, marginTop: 18, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm, backgroundColor: Colors.surface, color: Colors.text, fontSize: 18 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  cancelButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm },
  cancelText: { color: Colors.textMuted, fontWeight: '700' },
});

export default function AdminCenters() {
  const [centers, setCenters] = useState<AdminCenterRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedCenter, setSelectedCenter] = useState<AdminCenterRecord | null>(null);
  const [capacity, setCapacity] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    let isActive = true;
    setIsLoading(true);
    setLoadError('');
    void getAdminCenters()
      .then((records) => { if (isActive) setCenters(records); })
      .catch(() => { if (isActive) setLoadError('Unable to load evacuation centers right now.'); })
      .finally(() => { if (isActive) setIsLoading(false); });
    return () => { isActive = false; };
  }, []));

  const addCenter = () => router.push('/(admin)/add-center');
  const updateCapacity = (center: AdminCenterRecord) => {
    setSelectedCenter(center);
    setCapacity(String(center.capacity));
    setSaveError('');
  };

  const saveCapacity = async () => {
    const nextCapacity = Number(capacity);
    if (!Number.isInteger(nextCapacity) || nextCapacity < 1) {
      setSaveError('Enter a whole-number capacity greater than zero.');
      return;
    }
    if (!selectedCenter) return;

    setIsSaving(true);
    setSaveError('');
    try {
      const updated = await updateAdminCenterCapacity(selectedCenter.id, nextCapacity);
      setCenters((current) => current.map((center) => center.id === updated.id ? updated : center));
      setSelectedCenter(null);
    } catch {
      setSaveError('Capacity could not be saved. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <View><Text style={styles.eyebrow}>FIELD RESOURCES</Text><Text style={styles.title}>Evacuation centers</Text><Text style={styles.subtitle}>Review capacity, availability, and center information.</Text></View>
          <TouchableOpacity style={styles.primaryButton} onPress={addCenter}><MaterialCommunityIcons name="plus" color={Colors.white} size={18} /><Text style={styles.primaryText}>Add center</Text></TouchableOpacity>
        </View>
        {isLoading && <ActivityIndicator color={Colors.secondary} />}
        {!!loadError && <Text style={centerDialogStyles.loadError}>{loadError}</Text>}
        {!isLoading && !loadError && centers.length === 0 && <Text style={styles.subtitle}>No evacuation centers have been added.</Text>}
        <View style={styles.grid}>
          {centers.map((center) => {
            const fill = center.capacity > 0 ? Math.min(center.currentOccupancy / center.capacity, 1) : 0;
            return (
              <View style={styles.card} key={center.id}>
                <View style={styles.cardTop}>
                  <View style={styles.centerIcon}><MaterialCommunityIcons name="home-city-outline" size={22} color={Colors.secondary} /></View>
                  <View style={[styles.badge, { backgroundColor: center.status === 'full' ? '#FCE8E8' : '#E5F3ED' }]}><Text style={{ color: center.status === 'full' ? Colors.emergency : '#167A5B', fontSize: 10, fontWeight: '800' }}>{center.status.toUpperCase()}</Text></View>
                </View>
                <Text style={styles.centerName}>{center.name}</Text>
                <Text style={styles.location}><MaterialCommunityIcons name="map-marker-outline" size={14} color={Colors.textMuted} /> {center.location}</Text>
                {!!center.notes && <Text style={styles.location}>{center.notes}</Text>}
                <View style={styles.capacityLine}><Text style={styles.capacityLabel}>Occupancy</Text><Text style={styles.capacityValue}>{center.currentOccupancy} / {center.capacity}</Text></View>
                <View style={styles.track}><View style={[styles.fill, { width: `${fill * 100}%`, backgroundColor: fill > .9 ? Colors.emergency : Colors.secondary }]} /></View>
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => updateCapacity(center)}><Text style={styles.action}>Edit capacity</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => Alert.alert('Center contact', [center.coordinatorName, center.contactNumber].filter(Boolean).join('\n') || 'No coordinator contact is available.')}><Text style={styles.action}>View contact</Text></TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <Modal visible={!!selectedCenter} transparent animationType="fade" onRequestClose={() => setSelectedCenter(null)}>
        <View style={centerDialogStyles.modalBackdrop}>
          <View style={centerDialogStyles.modalCard}>
            <Text style={centerDialogStyles.modalTitle}>Update center capacity</Text>
            <Text style={centerDialogStyles.modalSubtitle}>{selectedCenter?.name}</Text>
            <TextInput value={capacity} onChangeText={setCapacity} keyboardType="number-pad" selectTextOnFocus style={centerDialogStyles.capacityInput} accessibilityLabel="Center capacity" />
            {!!saveError && <Text style={centerDialogStyles.loadError}>{saveError}</Text>}
            <View style={centerDialogStyles.modalActions}>
              <TouchableOpacity style={centerDialogStyles.cancelButton} onPress={() => setSelectedCenter(null)}><Text style={centerDialogStyles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={saveCapacity} disabled={isSaving}>{isSaving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryText}>Save</Text>}</TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safeArea: { flex: 1, backgroundColor: Colors.surfaceMuted }, content: { padding: Spacing.xl, paddingBottom: 48, maxWidth: 1100, width: '100%', alignSelf: 'center' }, heading: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, marginBottom: 22 }, eyebrow: { color: Colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }, title: { color: Colors.text, fontSize: 30, fontWeight: '800', marginTop: 5 }, subtitle: { color: Colors.textMuted, fontSize: 14, marginTop: 6 }, primaryButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, paddingHorizontal: 15, paddingVertical: 12, borderRadius: BorderRadius.md }, primaryText: { color: Colors.white, fontWeight: '700', fontSize: 12 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 }, card: { width: '31%', minWidth: 270, backgroundColor: Colors.surface, padding: 17, borderRadius: BorderRadius.md, ...Shadows.sm }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, centerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceMuted, justifyContent: 'center', alignItems: 'center' }, badge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12 }, centerName: { color: Colors.text, fontSize: 14, fontWeight: '800', marginTop: 15 }, location: { color: Colors.textMuted, fontSize: 11, marginTop: 7 }, capacityLine: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }, capacityLabel: { color: Colors.textMuted, fontSize: 11 }, capacityValue: { color: Colors.text, fontSize: 11, fontWeight: '700' }, track: { height: 7, backgroundColor: Colors.surfaceMuted, borderRadius: 4, marginTop: 7, overflow: 'hidden' }, fill: { height: '100%', borderRadius: 4 }, cardActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EDF1F4' }, action: { color: Colors.secondary, fontSize: 11, fontWeight: '700' } });