import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Colors } from '@constants/colors';
import { AnimatedPressable } from '@components/Buttons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { authenticatedFetch } from '@services/apiClient';
import { useAuth } from '@hooks/useAuth';
import { ResidentHouseholdMember } from '@/types/index';
import AppBackArrow from '@components/AppBackArrow';
import { HouseholdMemberFields, EMPTY_MEMBER_DRAFT, HouseholdMemberDraft, draftToMember, memberToDraft, memberSummary, validateMemberDraft } from '@components/HouseholdMemberFields';
import { AppBoldFontFamily, AppFontFamily, AppHeadingFontFamily, AppMediumFontFamily, AppSemiboldFontFamily } from '@constants/typography';

const GREEN = '#218B25';
const MAX_MEMBERS = 20;

type MemberDraft = ResidentHouseholdMember;

type ProfileResponse = { householdMembers?: ResidentHouseholdMember[] };
type MembersResponse = { members?: ResidentHouseholdMember[] };
type EvacuationStatusResponse = {
  status?: string;
  members?: Array<ResidentHouseholdMember & { status?: string }>;
};

export default function HouseholdScreen() {
  const { user, setAuthenticatedUser } = useAuth();
  const [members, setMembers] = useState<ResidentHouseholdMember[]>([]);
  const [registeredMembers, setRegisteredMembers] = useState<EvacuationStatusResponse['members']>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [memberDraft, setMemberDraft] = useState<HouseholdMemberDraft>(EMPTY_MEMBER_DRAFT);
  const [memberError, setMemberError] = useState('');

  const loadMembers = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/v1/auth/me');
      if (!response.ok) throw new Error('Household members could not be loaded.');
      const result = await response.json() as ProfileResponse;
      setMembers(result.householdMembers ?? []);
      const evacuationResponse = await authenticatedFetch('/api/v1/resident/evacuation-status').catch(() => null);
      if (evacuationResponse?.ok) {
        const evacuation = await evacuationResponse.json() as EvacuationStatusResponse;
        setRegisteredMembers(evacuation.status && evacuation.status !== 'released' && evacuation.status !== 'not_registered'
          ? evacuation.members ?? []
          : []);
      } else {
        setRegisteredMembers([]);
      }
      setError('');
    } catch {
      setError('Household members could not be loaded. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadMembers(); }, [loadMembers]));

  const persistMembers = async (nextMembers: MemberDraft[]) => {
    setIsSaving(true);
    setError('');
    try {
      const response = await authenticatedFetch('/api/v1/resident/household-members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members: nextMembers }),
      });
      const result = await response.json() as MembersResponse & { detail?: unknown };
      if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Household members could not be saved.');
      const savedMembers = result.members ?? [];
      setMembers(savedMembers);
      if (user) await setAuthenticatedUser({ ...user, householdMembers: savedMembers });
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Household members could not be saved.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const openEditor = (index: number | null = null) => {
    setEditingIndex(index);
    setMemberDraft(memberToDraft(index == null ? undefined : members[index]));
    setMemberError('');
    setEditorOpen(true);
  };

  const saveMember = async () => {
    const validationMessage = validateMemberDraft(memberDraft);
    if (validationMessage) {
      setMemberError(validationMessage);
      return;
    }
    const draft = draftToMember(memberDraft);
    if (editingIndex == null && members.length >= MAX_MEMBERS) {
      setMemberError(`A household can include up to ${MAX_MEMBERS} additional members.`);
      return;
    }
    const nextMembers = editingIndex == null
      ? [...members, draft]
      : members.map((member, index) => index === editingIndex ? { ...member, ...draft } : member);
    if (await persistMembers(nextMembers)) setEditorOpen(false);
  };

  const removeMember = (index: number) => {
    Alert.alert('Remove household member', `Remove ${members[index].name} from your household?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void persistMembers(members.filter((_member, memberIndex) => memberIndex !== index)) },
    ]);
  };

  const savedMemberNames = new Set(members.map((member) => member.name.trim().toLocaleLowerCase()));
  const registrationOnlyMembers = (registeredMembers ?? []).filter((member) => !savedMemberNames.has(member.name.trim().toLocaleLowerCase()));
  const householdCount = members.length + registrationOnlyMembers.length + 1;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#20862B', '#176B28']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <AppBackArrow style={styles.backButton} />
          <View style={styles.headerCopy}><Text style={styles.eyebrow}>RESIDENT PROFILE</Text><Text style={styles.title}>Household</Text><Text style={styles.headerSubtitle}>People connected to your household</Text></View>
          <View style={styles.headerIcon}><MaterialCommunityIcons name="account-group-outline" size={25} color="#FFFFFF" /></View>
        </LinearGradient>
        <Animated.View entering={FadeInDown.duration(320)} style={styles.introCard}>
          <View style={styles.introIcon}><MaterialCommunityIcons name="home-heart" size={23} color={GREEN} /></View>
          <View style={styles.introCopy}><Text style={styles.introTitle}>Your household</Text><Text style={styles.introText}>Keep your household details up to date for evacuation registration and emergency coordination.</Text></View>
        </Animated.View>
        <View style={styles.toolbar}>
          <View style={styles.peopleCount}><MaterialCommunityIcons name="account-multiple-outline" size={16} color={GREEN} /><Text style={styles.count}>{householdCount} of {MAX_MEMBERS + 1} people</Text></View>
          <AnimatedPressable style={[styles.addButton, (isSaving || householdCount >= MAX_MEMBERS + 1) && styles.disabled]} onPress={() => openEditor()} disabled={isSaving || householdCount >= MAX_MEMBERS + 1} accessibilityRole="button" accessibilityLabel="Add household member"><MaterialCommunityIcons name="plus" size={17} color={Colors.white} /><Text style={styles.addText}>Add member</Text></AnimatedPressable>
        </View>
        {isLoading && <View style={styles.state}><ActivityIndicator color={GREEN} /><Text style={styles.stateText}>Loading household members...</Text></View>}
        {!!error && <View style={styles.errorBox}><Text style={styles.error}>{error}</Text><AnimatedPressable onPress={() => { setIsLoading(true); void loadMembers(); }}><Text style={styles.retry}>Try again</Text></AnimatedPressable></View>}
        <Text style={styles.sectionEyebrow}>HOUSEHOLD ROSTER</Text>
        <Animated.View entering={FadeInDown.delay(40).duration(360)} style={[styles.memberCard, styles.accountCard]}><View style={[styles.avatar, styles.accountAvatar]}><MaterialCommunityIcons name="account-check-outline" size={21} color={GREEN} /></View><View style={styles.memberCopy}><Text style={styles.memberName}>{user?.name || 'You'}</Text><Text style={styles.relationship}>You · HANDA account holder</Text></View><View style={styles.accountBadge}><Text style={styles.accountBadgeText}>YOU</Text></View></Animated.View>
        {!isLoading && !error && householdCount === 1 && <Animated.View entering={FadeInDown.delay(100).duration(380)} style={styles.empty}><View style={styles.emptyIcon}><MaterialCommunityIcons name="account-multiple-plus-outline" size={30} color={GREEN} /></View><Text style={styles.emptyTitle}>Add your household members</Text><Text style={styles.emptyText}>They’ll be ready to include when your household is registered at an evacuation center.</Text><AnimatedPressable style={styles.emptyButton} onPress={() => openEditor()}><MaterialCommunityIcons name="plus" size={17} color={Colors.white} /><Text style={styles.emptyButtonText}>Add first member</Text></AnimatedPressable></Animated.View>}
        {!isLoading && members.map((member, index) => <Animated.View entering={FadeInDown.delay(70 + index * 45).duration(320)} key={member.id ?? `${index}-${member.name}`} style={styles.memberCard}><View style={styles.avatar}><Text style={styles.avatarText}>{member.name.trim().charAt(0).toUpperCase()}</Text></View><View style={styles.memberCopy}><Text style={styles.memberName}>{member.name}</Text><Text style={styles.relationship}>{memberSummary(member)}</Text></View><AnimatedPressable style={styles.iconButton} onPress={() => openEditor(index)} disabled={isSaving} accessibilityRole="button" accessibilityLabel={`Edit ${member.name}`}><MaterialCommunityIcons name="pencil-outline" size={19} color="#1769AA" /></AnimatedPressable><AnimatedPressable style={[styles.iconButton, styles.deleteButton]} onPress={() => removeMember(index)} disabled={isSaving} accessibilityRole="button" accessibilityLabel={`Delete ${member.name}`}><MaterialCommunityIcons name="trash-can-outline" size={19} color={Colors.emergency} /></AnimatedPressable></Animated.View>)}
        {!isLoading && registrationOnlyMembers.map((member, index) => <Animated.View entering={FadeInDown.delay(90 + index * 45).duration(320)} key={member.id ?? `registered-${index}-${member.name}`} style={[styles.memberCard, styles.registeredCard]}><View style={[styles.avatar, styles.registeredAvatar]}><MaterialCommunityIcons name="account-check-outline" size={21} color={GREEN} /></View><View style={styles.memberCopy}><Text style={styles.memberName}>{member.name}</Text><Text style={styles.relationship}>{member.relationship} · In evacuation registration</Text></View><View style={styles.registeredBadge}><Text style={styles.registeredBadgeText}>REGISTERED</Text></View></Animated.View>)}
      </ScrollView>
      <Modal transparent visible={editorOpen} animationType="fade" onRequestClose={() => setEditorOpen(false)}><Pressable style={styles.backdrop} onPress={() => setEditorOpen(false)}><Pressable style={styles.dialog} onPress={(event) => event.stopPropagation()}><Text style={styles.dialogTitle}>{editingIndex == null ? 'Add household member' : 'Edit household member'}</Text><ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled"><HouseholdMemberFields draft={memberDraft} onChange={setMemberDraft} relationshipPlaceholder="Relationship to registrant" /></ScrollView>{!!memberError && <Text style={styles.error}>{memberError}</Text>}<View style={styles.dialogActions}><AnimatedPressable style={styles.cancelButton} onPress={() => setEditorOpen(false)} disabled={isSaving}><Text style={styles.cancelText}>Cancel</Text></AnimatedPressable><AnimatedPressable style={[styles.saveButton, isSaving && styles.disabled]} onPress={() => void saveMember()} disabled={isSaving}>{isSaving ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveText}>Save member</Text>}</AnimatedPressable></View></Pressable></Pressable></Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F7F4' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 36 },
  header: { minHeight: 108, paddingHorizontal: 16, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  backButton: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#DFF1DF', fontFamily: AppBoldFontFamily, fontSize: 9, letterSpacing: 1.1 },
  title: { color: Colors.white, fontFamily: AppHeadingFontFamily, fontSize: 23, marginTop: 3 },
  headerSubtitle: { color: '#E4F2E5', fontFamily: AppMediumFontFamily, fontSize: 11, marginTop: 3 },
  headerIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.12)' },
  introCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 17, padding: 14, borderWidth: 1, borderColor: '#E0EAE1', borderRadius: 17, backgroundColor: Colors.surface, shadowColor: '#15391D', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  introIcon: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#EAF5EB' },
  introCopy: { flex: 1 },
  introTitle: { color: Colors.text, fontFamily: AppBoldFontFamily, fontSize: 15 },
  introText: { color: Colors.textMuted, fontFamily: AppFontFamily, fontSize: 11, lineHeight: 16, marginTop: 3 },
  toolbar: { minHeight: 60, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row', gap: 10 },
  peopleCount: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#EAF4EB' },
  count: { color: '#315B36', fontFamily: AppSemiboldFontFamily, fontSize: 11 },
  addButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 12, backgroundColor: GREEN, flexDirection: 'row', alignItems: 'center', gap: 6, shadowColor: GREEN, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.19, shadowRadius: 6, elevation: 2 },
  addText: { color: Colors.white, fontFamily: AppBoldFontFamily, fontSize: 11 },
  disabled: { opacity: 0.55 },
  state: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 10 },
  stateText: { color: Colors.textMuted, fontFamily: AppFontFamily, fontSize: 12 },
  errorBox: { margin: 16, padding: 14, borderWidth: 1, borderColor: '#F0CBC8', borderRadius: 13, backgroundColor: '#FFF7F6' },
  error: { color: '#A34545', fontFamily: AppMediumFontFamily, fontSize: 12, lineHeight: 17 },
  retry: { color: GREEN, fontFamily: AppBoldFontFamily, fontSize: 12, marginTop: 8 },
  sectionEyebrow: { marginHorizontal: 17, marginBottom: 9, color: '#76867A', fontFamily: AppBoldFontFamily, fontSize: 9, letterSpacing: 1 },
  empty: { marginHorizontal: 16, marginTop: 10, paddingHorizontal: 22, paddingVertical: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E1EAE2', borderRadius: 18, backgroundColor: Colors.surface },
  emptyIcon: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#EAF5EB' },
  emptyTitle: { color: Colors.text, fontFamily: AppBoldFontFamily, fontSize: 15, marginTop: 12 },
  emptyText: { maxWidth: 320, color: Colors.textMuted, fontFamily: AppFontFamily, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 6 },
  emptyButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 16, paddingHorizontal: 15, borderRadius: 12, backgroundColor: GREEN },
  emptyButtonText: { color: Colors.white, fontFamily: AppBoldFontFamily, fontSize: 11 },
  memberCard: { minHeight: 72, marginHorizontal: 16, marginBottom: 9, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center', flexDirection: 'row', borderWidth: 1, borderColor: '#E2EAE3', borderRadius: 15, backgroundColor: Colors.surface, shadowColor: '#18391E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.045, shadowRadius: 9, elevation: 1 },
  accountCard: { borderColor: '#D5E8D6' },
  registeredCard: { backgroundColor: '#FBFDFB' },
  avatar: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF3EF' },
  accountAvatar: { backgroundColor: '#EAF5EB' },
  registeredAvatar: { backgroundColor: '#EAF5EB' },
  avatarText: { color: GREEN, fontFamily: AppBoldFontFamily, fontSize: 15 },
  memberCopy: { flex: 1, marginLeft: 10 },
  memberName: { color: Colors.text, fontFamily: AppBoldFontFamily, fontSize: 13 },
  relationship: { color: Colors.textMuted, fontFamily: AppFontFamily, fontSize: 11, marginTop: 3 },
  accountBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, backgroundColor: '#E5F3ED' },
  accountBadgeText: { color: '#167A5B', fontFamily: AppBoldFontFamily, fontSize: 9, letterSpacing: 0.5 },
  registeredBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, backgroundColor: '#EAF5EB' },
  registeredBadgeText: { color: '#236F2E', fontFamily: AppBoldFontFamily, fontSize: 8, letterSpacing: 0.4 },
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#EEF5EF' },
  deleteButton: { marginLeft: 5, backgroundColor: '#FFF0EF' },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(13,28,17,0.48)' },
  dialog: { width: '100%', maxWidth: 420, padding: 20, borderRadius: 20, backgroundColor: Colors.surface },
  dialogTitle: { color: Colors.text, fontFamily: AppHeadingFontFamily, fontSize: 18 },
  input: { minHeight: 46, marginTop: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border, borderRadius: 11, color: Colors.text, fontFamily: AppFontFamily, fontSize: 14 },
  dialogActions: { marginTop: 15, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  cancelButton: { minHeight: 44, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 12 },
  cancelText: { color: Colors.textMuted, fontFamily: AppSemiboldFontFamily, fontSize: 12 },
  saveButton: { minHeight: 44, minWidth: 122, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: GREEN },
  saveText: { color: Colors.white, fontFamily: AppBoldFontFamily, fontSize: 12 },
});
