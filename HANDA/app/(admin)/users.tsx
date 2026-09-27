import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, Shadows, Spacing } from '@constants/colors';
import { AdminUserRecord, getAdminUsers } from '@services/adminData';

export default function AdminUsers() {
  const [accounts, setAccounts] = useState<AdminUserRecord[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void getAdminUsers().then(setAccounts);
  }, []);

  const visibleAccounts = useMemo(() => accounts.filter((account) => `${account.name} ${account.email} ${account.role}`.toLowerCase().includes(query.toLowerCase())), [accounts, query]);
  const responders = accounts.filter((account) => account.role === 'Responder').length;
  const pending = accounts.filter((account) => account.status === 'Pending').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}><View><Text style={styles.eyebrow}>ACCESS CONTROL</Text><Text style={styles.title}>User accounts</Text><Text style={styles.subtitle}>Accounts fetched from the PostgreSQL users table.</Text></View></View>
        <View style={styles.summary}><Summary label="All accounts" value={accounts.length} /><Summary label="Responders" value={responders} /><Summary label="Pending approval" value={pending} /></View>
        <View style={styles.panel}>
          <View style={styles.toolbar}><View style={styles.search}><MaterialCommunityIcons name="magnify" size={19} color={Colors.textMuted} /><TextInput value={query} onChangeText={setQuery} placeholder="Search users" placeholderTextColor={Colors.textMuted} style={styles.searchInput} /></View><Text style={styles.resultCount}>{visibleAccounts.length} accounts</Text></View>
          {visibleAccounts.map((account) => <UserRow key={account.id} account={account} />)}
          {visibleAccounts.length === 0 && <View style={styles.empty}><MaterialCommunityIcons name="account-search-outline" size={30} color={Colors.textMuted} /><Text style={styles.emptyTitle}>No user accounts found</Text><Text style={styles.emptyDetail}>Create users in the PostgreSQL users table to display them here.</Text></View>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Summary({ label, value }: { label: string; value: number }) { return <View style={styles.summaryItem}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>; }
function UserRow({ account }: { account: AdminUserRecord }) { return <View style={styles.row}><View style={styles.userAvatar}><Text style={styles.avatarText}>{account.name.split(' ').map((word) => word[0]).join('').slice(0, 2)}</Text></View><View style={styles.userInfo}><Text style={styles.userName}>{account.name}</Text><Text style={styles.userEmail}>{account.email}</Text></View><View style={styles.roleWrap}><Text style={styles.role}>{account.role}</Text><Text style={[styles.status, { color: account.status === 'Active' ? '#167A5B' : account.status === 'Inactive' ? Colors.emergency : '#8B5E00' }]}>{account.status}</Text></View></View>; }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7F9' },
  content: { padding: Spacing.xl, paddingBottom: 48, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22 },
  eyebrow: { color: Colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: Colors.text, fontSize: 30, fontWeight: '800', marginTop: 5 },
  subtitle: { color: Colors.textMuted, fontSize: 14, marginTop: 6 },
  summary: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryItem: { flex: 1, backgroundColor: Colors.white, padding: 16, borderRadius: BorderRadius.md, ...Shadows.sm },
  summaryValue: { fontSize: 25, fontWeight: '800', color: Colors.text },
  summaryLabel: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  panel: { backgroundColor: Colors.white, borderRadius: BorderRadius.md, padding: 18, ...Shadows.sm },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  search: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D7E2EA', borderRadius: BorderRadius.sm, paddingHorizontal: 10, width: 260 },
  searchInput: { flex: 1, paddingVertical: 9, paddingHorizontal: 8, color: Colors.text, fontSize: 13 },
  resultCount: { color: Colors.textMuted, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#EDF1F4', gap: 12 },
  userAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E4EEF4', justifyContent: 'center', alignItems: 'center' },
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
});
