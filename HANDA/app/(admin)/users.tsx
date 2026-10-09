import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable as Pressable } from '@components/Buttons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, Shadows, Spacing } from '@constants/colors';
import { useAuth } from '@hooks/useAuth';
import { useResponsiveLayout } from '@hooks/useResponsiveLayout';
import { AdminUserInput, AdminUserRecord, createAdminUser, deleteAdminUser, getAdminUsers, updateAdminUser } from '@services/adminData';

type AccountForm = AdminUserInput;

const EMPTY_FORM: AccountForm = {
  name: '',
  email: '',
  role: 'Responder',
  status: 'Active',
  birthday: '',
  mobileNumber: '',
  currentAddress: '',
  password: '',
};

const ROLES: AdminUserRecord['role'][] = ['Responder', 'Resident', 'Administrator'];
const STATUSES: AdminUserRecord['status'][] = ['Active', 'Inactive', 'Pending'];

function normalizeBirthday(value: string): string | null {
  const input = value.trim();
  let year: number;
  let month: number;
  let day: number;
  const isoDate = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input);
  const usDate = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(input);
  if (isoDate) {
    [, year, month, day] = isoDate.map(Number) as [number, number, number, number];
  } else if (usDate) {
    [, month, day, year] = usDate.map(Number) as [number, number, number, number];
  } else {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeMobileNumber(value: string): string {
  return value.trim().replace(/[\s()-]/g, '');
}

function isStrongPassword(value: string): boolean {
  return value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

export default function AdminUsers() {
  const { isMobile, isCompact } = useResponsiveLayout();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AdminUserRecord[]>([]);
  const [query, setQuery] = useState('');
  const [editingAccount, setEditingAccount] = useState<AdminUserRecord | null>(null);
  const [form, setForm] = useState<AccountForm>(EMPTY_FORM);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [pageError, setPageError] = useState('');

  const loadAccounts = async () => {
    setAccounts(await getAdminUsers());
  };

  useEffect(() => { void loadAccounts(); }, []);

  const openCreate = () => {
    setEditingAccount(null);
    setForm(EMPTY_FORM);
    setShowPassword(false);
    setFormError('');
    setIsEditorOpen(true);
  };

  const openEdit = (account: AdminUserRecord) => {
    setEditingAccount(account);
    setForm({
      name: account.name,
      email: account.email,
      role: account.role,
      status: account.status,
      birthday: account.birthday?.slice(0, 10) ?? '',
      mobileNumber: account.mobileNumber ?? '',
      currentAddress: account.currentAddress ?? '',
      password: '',
    });
    setShowPassword(false);
    setFormError('');
    setIsEditorOpen(true);
  };

  const saveAccount = async () => {
    setFormError('');
    if (!form.name.trim() || !form.email.trim() || !form.birthday.trim() || !form.mobileNumber.trim() || !form.currentAddress.trim()) {
      setFormError('Complete all required account details.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setFormError('Enter a valid email address.');
      return;
    }
    const birthday = normalizeBirthday(form.birthday);
    if (!birthday) {
      setFormError('Enter a valid birthday as YYYY-MM-DD or MM/DD/YYYY.');
      return;
    }
    const mobileNumber = normalizeMobileNumber(form.mobileNumber);
    if (!/^(09\d{9}|\+639\d{9}|639\d{9})$/.test(mobileNumber)) {
      setFormError('Enter a valid Philippine mobile number, such as 09171234567.');
      return;
    }
    if ((!editingAccount || form.password) && !isStrongPassword(form.password ?? '')) {
      setFormError('Password needs 8+ characters with uppercase, lowercase, number, and symbol.');
      return;
    }

    setIsSaving(true);
    try {
      const profile = { ...form, name: form.name.trim(), email: form.email.trim().toLowerCase(), birthday, mobileNumber, currentAddress: form.currentAddress.trim() };
      if (editingAccount) {
        const changes: Partial<AccountForm> = {};
        if (profile.name !== editingAccount.name) changes.name = profile.name;
        if (profile.email !== editingAccount.email) changes.email = profile.email;
        if (profile.birthday !== editingAccount.birthday?.slice(0, 10)) changes.birthday = profile.birthday;
        if (profile.mobileNumber !== editingAccount.mobileNumber) changes.mobileNumber = profile.mobileNumber;
        if (profile.currentAddress !== editingAccount.currentAddress) changes.currentAddress = profile.currentAddress;
        if (profile.role !== editingAccount.role) changes.role = profile.role;
        if (profile.status !== editingAccount.status) changes.status = profile.status;
        if (profile.password) changes.password = profile.password;
        if (Object.keys(changes).length === 0) {
          setFormError('No account details have changed.');
          return;
        }
        await updateAdminUser(editingAccount.id, changes);
      } else {
        await createAdminUser(profile);
      }
      await loadAccounts();
      setIsEditorOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save this account.');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setPageError('');
    try {
      await deleteAdminUser(deleteTarget.id);
      await loadAccounts();
      setDeleteTarget(null);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Could not delete this account.');
    } finally {
      setIsDeleting(false);
    }
  };

  const visibleAccounts = useMemo(() => accounts.filter((account) => `${account.name} ${account.email} ${account.role}`.toLowerCase().includes(query.toLowerCase())), [accounts, query]);
  const responders = accounts.filter((account) => account.role === 'Responder').length;
  const pending = accounts.filter((account) => account.status === 'Pending').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.heading, isMobile && styles.headingMobile]}><View style={styles.headingCopy}><Text style={styles.eyebrow}>ACCESS CONTROL</Text><Text style={styles.title}>User accounts</Text><Text style={styles.subtitle}>Create accounts and manage role access.</Text></View><Pressable style={styles.createButton} onPress={openCreate}><MaterialCommunityIcons name="account-plus-outline" size={18} color={Colors.white} /><Text style={styles.createButtonText}>Add account</Text></Pressable></View>
        <View style={[styles.summary, isMobile && styles.summaryMobile]}><Summary label="All accounts" value={accounts.length} /><Summary label="Responders" value={responders} /><Summary label="Pending approval" value={pending} /></View>
        <View style={styles.panel}>
          <View style={[styles.toolbar, isMobile && styles.toolbarMobile]}><View style={styles.search}><MaterialCommunityIcons name="magnify" size={19} color={Colors.textMuted} /><TextInput value={query} onChangeText={setQuery} placeholder="Search users" placeholderTextColor={Colors.textMuted} style={styles.searchInput} /></View><Text style={styles.resultCount}>{visibleAccounts.length} accounts</Text></View>
          {pageError ? <Text style={styles.errorText}>{pageError}</Text> : null}
          {visibleAccounts.map((account) => <UserRow key={account.id} account={account} isCurrentUser={account.id === user?.id} onEdit={() => openEdit(account)} onDelete={() => setDeleteTarget(account)} />)}
          {visibleAccounts.length === 0 && <View style={styles.empty}><MaterialCommunityIcons name="account-search-outline" size={30} color={Colors.textMuted} /><Text style={styles.emptyTitle}>No user accounts found</Text><Text style={styles.emptyDetail}>Try another search or create an account.</Text></View>}
        </View>
      </ScrollView>

      <Modal visible={isEditorOpen} transparent animationType="fade" onRequestClose={() => setIsEditorOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.editor}>
            <View style={styles.modalHeader}><View><Text style={styles.modalTitle}>{editingAccount ? 'Edit account' : 'Create account'}</Text><Text style={styles.modalSubtitle}>{editingAccount ? 'Update profile and access settings.' : 'Set up a responder or resident account.'}</Text></View><Pressable onPress={() => setIsEditorOpen(false)} accessibilityLabel="Close editor"><MaterialCommunityIcons name="close" size={23} color={Colors.textMuted} /></Pressable></View>
            <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
              <FormField label="Full name" value={form.name} onChangeText={(name) => setForm((current) => ({ ...current, name }))} />
              <FormField label="Email" value={form.email} onChangeText={(email) => setForm((current) => ({ ...current, email }))} keyboardType="email-address" autoCapitalize="none" />
              <View style={[styles.formRow, isCompact && styles.formRowStacked]}><View style={styles.halfField}><FormField label="Birthday" value={form.birthday} onChangeText={(birthday) => setForm((current) => ({ ...current, birthday }))} placeholder="YYYY-MM-DD" inputType={Platform.OS === 'web' ? 'date' : undefined} /></View><View style={styles.halfField}><FormField label="Mobile number" value={form.mobileNumber} onChangeText={(mobileNumber) => setForm((current) => ({ ...current, mobileNumber }))} keyboardType="phone-pad" placeholder="09XXXXXXXXX" /></View></View>
              <FormField label="Current address" value={form.currentAddress} onChangeText={(currentAddress) => setForm((current) => ({ ...current, currentAddress }))} />
              {!(editingAccount?.id === user?.id) && <>
                <ChoiceGroup label="Role" values={ROLES} selected={form.role} onSelect={(role) => setForm((current) => ({ ...current, role }))} />
                <ChoiceGroup label="Account status" values={STATUSES} selected={form.status} onSelect={(status) => setForm((current) => ({ ...current, status }))} />
                <PasswordField label={editingAccount ? 'New password (optional)' : 'Initial password'} value={form.password ?? ''} onChangeText={(password) => setForm((current) => ({ ...current, password }))} visible={showPassword} onToggleVisibility={() => setShowPassword((visible) => !visible)} />
                <Text style={styles.passwordHint}>Use at least 8 characters with uppercase, lowercase, number, and symbol.</Text>
              </>}
              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
              <View style={styles.modalActions}><Pressable style={styles.cancelButton} onPress={() => setIsEditorOpen(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable style={[styles.saveButton, isSaving && styles.disabledButton]} onPress={() => void saveAccount()} disabled={isSaving}>{isSaving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveText}>{editingAccount ? 'Save changes' : 'Create account'}</Text>}</Pressable></View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.modalBackdrop}><View style={styles.confirmDialog}><Text style={styles.modalTitle}>Delete account?</Text><Text style={styles.confirmText}>Delete {deleteTarget?.name}? They will immediately lose access. This cannot be undone.</Text>{pageError ? <Text style={styles.errorText}>{pageError}</Text> : null}<View style={styles.modalActions}><Pressable style={styles.cancelButton} onPress={() => setDeleteTarget(null)}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable style={[styles.deleteButton, isDeleting && styles.disabledButton]} onPress={() => void confirmDelete()} disabled={isDeleting}>{isDeleting ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveText}>Delete account</Text>}</Pressable></View></View></View>
      </Modal>
    </SafeAreaView>
  );
}

function Summary({ label, value }: { label: string; value: number }) { return <View style={styles.summaryItem}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>; }
function UserRow({ account, isCurrentUser, onEdit, onDelete }: { account: AdminUserRecord; isCurrentUser: boolean; onEdit: () => void; onDelete: () => void }) { return <View style={styles.row}><View style={styles.userAvatar}><Text style={styles.avatarText}>{account.name.split(' ').map((word) => word[0]).join('').slice(0, 2)}</Text></View><View style={styles.userInfo}><Text style={styles.userName}>{account.name}{isCurrentUser ? ' (You)' : ''}</Text><Text style={styles.userEmail}>{account.email}</Text></View><View style={styles.roleWrap}><Text style={styles.role}>{account.role}</Text><Text style={[styles.status, { color: account.status === 'Active' ? '#167A5B' : account.status === 'Inactive' ? Colors.emergency : '#8B5E00' }]}>{account.status}</Text></View><View style={styles.rowActions}><Pressable onPress={onEdit} accessibilityLabel={`Edit ${account.name}`} style={styles.iconButton}><MaterialCommunityIcons name="pencil-outline" size={19} color={Colors.secondary} /></Pressable>{!isCurrentUser && <Pressable onPress={onDelete} accessibilityLabel={`Delete ${account.name}`} style={styles.iconButton}><MaterialCommunityIcons name="trash-can-outline" size={19} color={Colors.emergency} /></Pressable>}</View></View>; }

function FormField({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, inputType }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; keyboardType?: 'default' | 'email-address' | 'phone-pad'; autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'; inputType?: 'date' }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={Colors.textMuted} keyboardType={keyboardType} autoCapitalize={autoCapitalize} style={styles.fieldInput} {...(inputType ? { type: inputType } as object : {})} /></View>; }

function PasswordField({ label, value, onChangeText, visible, onToggleVisibility }: { label: string; value: string; onChangeText: (value: string) => void; visible: boolean; onToggleVisibility: () => void }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.passwordInputWrap}><TextInput value={value} onChangeText={onChangeText} placeholder="Set a strong password" placeholderTextColor={Colors.textMuted} secureTextEntry={!visible} autoCapitalize="none" style={[styles.fieldInput, styles.passwordInput]} /><Pressable onPress={onToggleVisibility} accessibilityLabel={visible ? 'Hide password' : 'Show password'} style={styles.passwordToggle}><MaterialCommunityIcons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} /></Pressable></View></View>; }

function ChoiceGroup<T extends string>({ label, values, selected, onSelect }: { label: string; values: T[]; selected: T; onSelect: (value: T) => void }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.choiceRow}>{values.map((value) => <Pressable key={value} style={[styles.choice, selected === value && styles.choiceActive]} onPress={() => onSelect(value)}><Text style={[styles.choiceText, selected === value && styles.choiceTextActive]}>{value}</Text></Pressable>)}</View></View>; }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surfaceMuted },
  content: { padding: Spacing.xl, paddingBottom: 48, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22 },
  headingMobile: { flexDirection: 'column' },
  headingCopy: { flex: 1 },
  eyebrow: { color: Colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: Colors.text, fontSize: 30, fontWeight: '800', marginTop: 5 },
  subtitle: { color: Colors.textMuted, fontSize: 14, marginTop: 6 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  summaryMobile: { justifyContent: 'space-between' },
  summaryItem: { flex: 1, minWidth: 112, backgroundColor: Colors.surface, padding: 16, borderRadius: BorderRadius.md, ...Shadows.sm },
  summaryValue: { fontSize: 25, fontWeight: '800', color: Colors.text },
  summaryLabel: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  panel: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: 18, ...Shadows.sm },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10 },
  toolbarMobile: { flexDirection: 'column', alignItems: 'stretch' },
  search: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm, paddingHorizontal: 10, width: '100%', maxWidth: 260, minWidth: 0 },
  searchInput: { flex: 1, paddingVertical: 9, paddingHorizontal: 8, color: Colors.text, fontSize: 13 },
  resultCount: { color: Colors.textMuted, fontSize: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#EDF1F4', gap: 12 },
  userAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surfaceMuted, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: Colors.primary, fontSize: 12, fontWeight: '800' },
  userInfo: { flex: 1 },
  userName: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  userEmail: { color: Colors.textMuted, fontSize: 11, marginTop: 3 },
  roleWrap: { width: 105 },
  role: { color: Colors.text, fontSize: 11, fontWeight: '700' },
  status: { fontSize: 11, marginTop: 4, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 38 },
  emptyTitle: { color: Colors.text, fontSize: 14, fontWeight: '800', marginTop: 10 },
  emptyDetail: { color: Colors.textMuted, fontSize: 12, marginTop: 5, textAlign: 'center' },
  createButton: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 11, borderRadius: BorderRadius.sm },
  createButtonText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  rowActions: { flexDirection: 'row', gap: 2 },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 18, backgroundColor: 'rgba(17, 31, 43, 0.48)' },
  editor: { width: '100%', maxWidth: 560, maxHeight: '92%', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, borderBottomWidth: 1, borderBottomColor: '#EDF1F4' },
  modalTitle: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  modalSubtitle: { color: Colors.textMuted, fontSize: 12, marginTop: 5 },
  formScroll: { flexGrow: 0 },
  formContent: { padding: 20, paddingTop: 8 },
  formRow: { flexDirection: 'row', gap: 12 },
  formRowStacked: { flexDirection: 'column', gap: 0 },
  halfField: { flex: 1 },
  field: { marginTop: 13 },
  fieldLabel: { color: Colors.text, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  fieldInput: { minHeight: 43, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm, paddingHorizontal: 11, color: Colors.text, fontSize: 13, backgroundColor: Colors.surface },
  passwordInputWrap: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 46 },
  passwordToggle: { position: 'absolute', right: 5, top: 3, width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choice: { borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm, paddingVertical: 8, paddingHorizontal: 11 },
  choiceActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  choiceText: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },
  choiceTextActive: { color: Colors.white },
  passwordHint: { color: Colors.textMuted, fontSize: 10, marginTop: 6 },
  errorText: { color: Colors.emergency, fontSize: 12, marginTop: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 20 },
  cancelButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 15, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm },
  cancelText: { color: Colors.text, fontSize: 12, fontWeight: '700' },
  saveButton: { minWidth: 125, minHeight: 42, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 15, backgroundColor: Colors.primary, borderRadius: BorderRadius.sm },
  deleteButton: { minWidth: 125, minHeight: 42, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 15, backgroundColor: Colors.emergency, borderRadius: BorderRadius.sm },
  disabledButton: { opacity: 0.65 },
  saveText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  confirmDialog: { width: '100%', maxWidth: 420, padding: 22, backgroundColor: Colors.surface, borderRadius: BorderRadius.md },
  confirmText: { color: Colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 10 },
});
