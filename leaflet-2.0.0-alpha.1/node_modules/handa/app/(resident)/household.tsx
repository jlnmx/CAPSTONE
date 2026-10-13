import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@constants/colors';
import { AnimatedPressable } from '@components/Buttons';
import { authenticatedFetch } from '@services/apiClient';
import { useAuth } from '@hooks/useAuth';
import { ResidentHouseholdMember } from '@types/index';

const GREEN = '#218B25';
const MAX_MEMBERS = 20;

type MemberDraft = { name: string; relationship: string };

type ProfileResponse = { householdMembers?: ResidentHouseholdMember[] };
type MembersResponse = { members?: ResidentHouseholdMember[] };

export default function HouseholdScreen() {
  const router = useRouter();
  const { user, setAuthenticatedUser } = useAuth();
  const [members, setMembers] = useState<ResidentHouseholdMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [memberName, setMemberName] = useState('');
  const [memberRelationship, setMemberRelationship] = useState('');
  const [memberError, setMemberError] = useState('');

  const loadMembers = async () => {
    try {
      const response = await authenticatedFetch('/api/v1/auth/me');
      if (!response.ok) throw new Error('Household members could not be loaded.');
      const result = await response.json() as ProfileResponse;
      setMembers(result.householdMembers ?? []);
      setError('');
    } catch {
      setError('Household members could not be loaded. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadMembers();
  }, []);

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
    setMemberName(index == null ? '' : members[index].name);
    setMemberRelationship(index == null ? '' : members[index].relationship);
    setMemberError('');
    setEditorOpen(true);
  };

  const saveMember = async () => {
    const draft = { name: memberName.trim(), relationship: memberRelationship.trim() };
    if (!draft.name || !draft.relationship) {
      setMemberError('Enter the member name and relationship.');
      return;
    }
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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={22} color={Colors.white} /></Pressable>
          <View style={styles.headerCopy}><Text style={styles.eyebrow}>RESIDENT PROFILE</Text><Text style={styles.title}>HOUSEHOLD</Text></View>
          <MaterialCommunityIcons name="account-group-outline" size={30} color="#DFF1DF" />
        </View>
        <View style={styles.intro}><Text style={styles.introTitle}>Household members</Text><Text style={styles.introText}>Keep the people in your household updated for evacuation registration and emergency coordination.</Text></View>
        <View style={styles.toolbar}><Text style={styles.count}>{members.length} of {MAX_MEMBERS} members</Text><AnimatedPressable style={[styles.addButton, (isSaving || members.length >= MAX_MEMBERS) && styles.disabled]} onPress={() => openEditor()} disabled={isSaving || members.length >= MAX_MEMBERS} accessibilityRole="button" accessibilityLabel="Add household member"><MaterialCommunityIcons name="plus" size={17} color={Colors.white} /><Text style={styles.addText}>Add member</Text></AnimatedPressable></View>
        {isLoading && <View style={styles.state}><ActivityIndicator color={GREEN} /><Text style={styles.stateText}>Loading household members...</Text></View>}
        {!!error && <View style={styles.errorBox}><Text style={styles.error}>{error}</Text><AnimatedPressable onPress={() => { setIsLoading(true); void loadMembers(); }}><Text style={styles.retry}>Try again</Text></AnimatedPressable></View>}
        {!isLoading && !error && members.length === 0 && <View style={styles.empty}><MaterialCommunityIcons name="account-multiple-outline" size={34} color={GREEN} /><Text style={styles.emptyTitle}>No household members added</Text><Text style={styles.emptyText}>Add household members here and they will be available during evacuation registration.</Text><AnimatedPressable style={styles.emptyButton} onPress={() => openEditor()}><Text style={styles.emptyButtonText}>Add first member</Text></AnimatedPressable></View>}
        {!isLoading && members.map((member, index) => <View key={member.id ?? `${index}-${member.name}`} style={styles.memberCard}><View style={styles.avatar}><Text style={styles.avatarText}>{member.name.trim().charAt(0).toUpperCase()}</Text></View><View style={styles.memberCopy}><Text style={styles.memberName}>{member.name}</Text><Text style={styles.relationship}>{member.relationship}</Text></View><AnimatedPressable style={styles.iconButton} onPress={() => openEditor(index)} disabled={isSaving} accessibilityRole="button" accessibilityLabel={`Edit ${member.name}`}><MaterialCommunityIcons name="pencil-outline" size={19} color="#1769AA" /></AnimatedPressable><AnimatedPressable style={styles.iconButton} onPress={() => removeMember(index)} disabled={isSaving} accessibilityRole="button" accessibilityLabel={`Delete ${member.name}`}><MaterialCommunityIcons name="trash-can-outline" size={19} color={Colors.emergency} /></AnimatedPressable></View>)}
      </ScrollView>
      <Modal transparent visible={editorOpen} animationType="fade" onRequestClose={() => setEditorOpen(false)}><Pressable style={styles.backdrop} onPress={() => setEditorOpen(false)}><Pressable style={styles.dialog} onPress={(event) => event.stopPropagation()}><Text style={styles.dialogTitle}>{editingIndex == null ? 'Add household member' : 'Edit household member'}</Text><TextInput style={styles.input} value={memberName} onChangeText={setMemberName} placeholder="Full name" placeholderTextColor="#79967A" autoCapitalize="words" /><TextInput style={styles.input} value={memberRelationship} onChangeText={setMemberRelationship} placeholder="Relationship to registrant" placeholderTextColor="#79967A" autoCapitalize="words" />{!!memberError && <Text style={styles.error}>{memberError}</Text>}<View style={styles.dialogActions}><AnimatedPressable style={styles.cancelButton} onPress={() => setEditorOpen(false)} disabled={isSaving}><Text style={styles.cancelText}>Cancel</Text></AnimatedPressable><AnimatedPressable style={[styles.saveButton, isSaving && styles.disabled]} onPress={() => void saveMember()} disabled={isSaving}>{isSaving ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveText}>Save member</Text>}</AnimatedPressable></View></Pressable></Pressable></Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 28 },
  header: { minHeight: 78, paddingHorizontal: 16, backgroundColor: GREEN, flexDirection: 'row', alignItems: 'center', gap: 11 },
  backButton: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#DFF1DF', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  title: { color: Colors.white, fontSize: 24, fontWeight: '800', marginTop: 2 },
  intro: { paddingHorizontal: 16, paddingTop: 18 },
  introTitle: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  introText: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  toolbar: { minHeight: 58, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row' },
  count: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  addButton: { minHeight: 38, paddingHorizontal: 12, borderRadius: 6, backgroundColor: GREEN, flexDirection: 'row', alignItems: 'center', gap: 5 },
  addText: { color: Colors.white, fontSize: 11, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  state: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 10 },
  stateText: { color: Colors.textMuted, fontSize: 12 },
  errorBox: { margin: 16, padding: 12, borderWidth: 1, borderColor: '#E2BABA', borderRadius: 7, backgroundColor: Colors.surfaceMuted },
  error: { color: '#A34545', fontSize: 12, lineHeight: 17 },
  retry: { color: GREEN, fontSize: 12, fontWeight: '800', marginTop: 8 },
  empty: { margin: 16, padding: 26, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 8, backgroundColor: Colors.surface },
  emptyTitle: { color: Colors.text, fontSize: 15, fontWeight: '800', marginTop: 9 },
  emptyText: { color: Colors.textMuted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 5 },
  emptyButton: { marginTop: 16, paddingHorizontal: 15, paddingVertical: 9, borderRadius: 5, backgroundColor: Colors.surfaceMuted },
  emptyButtonText: { color: GREEN, fontSize: 11, fontWeight: '800' },
  memberCard: { minHeight: 66, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 10, alignItems: 'center', flexDirection: 'row', borderWidth: 1, borderColor: Colors.border, borderRadius: 7, backgroundColor: Colors.surface },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceMuted },
  avatarText: { color: GREEN, fontSize: 14, fontWeight: '800' },
  memberCopy: { flex: 1, marginLeft: 10 },
  memberName: { color: Colors.textMuted, fontSize: 13, fontWeight: '800' },
  relationship: { color: Colors.textMuted, fontSize: 11, marginTop: 3 },
  iconButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.4)' },
  dialog: { width: '100%', maxWidth: 420, padding: 18, borderRadius: 8, backgroundColor: Colors.surface },
  dialogTitle: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  input: { minHeight: 44, marginTop: 12, paddingHorizontal: 10, borderWidth: 1, borderColor: Colors.border, borderRadius: 5, color: Colors.textMuted, fontSize: 14 },
  dialogActions: { marginTop: 15, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  cancelButton: { minHeight: 42, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 5 },
  cancelText: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
  saveButton: { minHeight: 42, minWidth: 122, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 5, backgroundColor: GREEN },
  saveText: { color: Colors.white, fontSize: 12, fontWeight: '800' },
});
