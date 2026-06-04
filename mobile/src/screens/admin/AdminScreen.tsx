// src/screens/admin/AdminScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert, Switch, Modal, Pressable,
} from 'react-native';
import { usersAPI, callsAPI } from '../../services/api';
import { Avatar, Button, Input, EmptyState } from '../../components/common';
import { COLORS, SIZES, DEPARTMENTS } from '../../utils/constants';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface User {
  id: string;
  username: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  department: string | null;
  phone_extension: string | null;
  presence_status: string;
  is_active: boolean;
  last_seen_at: string | null;
}

interface Props {
  navigation: NativeStackNavigationProp<any>;
}

const AdminScreen: React.FC<Props> = ({ navigation }) => {
  const [tab, setTab] = useState<'users' | 'stats'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ display_name: '', role: 'user', department: '', phone_extension: '', is_active: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tab === 'users') loadUsers();
    else loadStats();
  }, [tab]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await usersAPI.adminGetAll({ limit: 200 });
      setUsers(resp.data.data.users);
    } catch {}
    setLoading(false);
  }, []);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await callsAPI.getStats();
      setStats(resp.data.data);
    } catch {}
    setLoading(false);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    if (tab === 'users') await loadUsers();
    else await loadStats();
    setRefreshing(false);
  };

  const openEdit = (u: User) => {
    setEditUser(u);
    setEditForm({
      display_name: u.display_name,
      role: u.role,
      department: u.department || '',
      phone_extension: u.phone_extension || '',
      is_active: u.is_active,
    });
  };

  const saveUser = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      await usersAPI.adminUpdate(editUser.id, editForm);
      setEditUser(null);
      loadUsers();
      Alert.alert('Succès', 'Utilisateur mis à jour');
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || '');
    }
    setSaving(false);
  };

  const deactivateUser = (u: User) => {
    Alert.alert(
      u.is_active ? 'Désactiver' : 'Réactiver',
      `${u.is_active ? 'Désactiver' : 'Réactiver'} ${u.display_name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: u.is_active ? 'Désactiver' : 'Réactiver',
          style: u.is_active ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await usersAPI.adminUpdate(u.id, { is_active: !u.is_active });
              loadUsers();
            } catch {}
          },
        },
      ]
    );
  };

  const renderUser = ({ item: u }: { item: User }) => (
    <TouchableOpacity style={styles.userItem} onPress={() => openEdit(u)} activeOpacity={0.7}>
      <Avatar url={u.avatar_url} name={u.display_name} size={42} presenceStatus={u.presence_status} />
      <View style={styles.userInfo}>
        <View style={styles.userNameRow}>
          <Text style={[styles.userName, !u.is_active && styles.userNameInactive]}>
            {u.display_name}
          </Text>
          {u.role === 'admin' && (
            <View style={styles.adminTag}><Text style={styles.adminTagText}>Admin</Text></View>
          )}
        </View>
        <Text style={styles.userMeta}>@{u.username} · {u.department || '-'}</Text>
      </View>
      <View style={styles.userStatus}>
        <View style={[styles.statusDot, { backgroundColor: u.is_active ? COLORS.primary : COLORS.gray300 }]} />
        <TouchableOpacity onPress={() => deactivateUser(u)} style={styles.deactivateBtn}>
          <Icon
            name={u.is_active ? 'account-cancel' : 'account-check'}
            size={20}
            color={u.is_active ? COLORS.danger : COLORS.primary}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const setF = (k: string, v: unknown) => setEditForm((f) => ({ ...f, [k]: v }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Administration</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Onglets */}
      <View style={styles.tabRow}>
        {(['users', 'stats'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
              {t === 'users' ? '👥 Utilisateurs' : '📊 Statistiques'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'users' ? (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          renderItem={renderUser}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          ListEmptyComponent={!loading ? <EmptyState title="Aucun utilisateur" /> : null}
          contentContainerStyle={users.length === 0 ? { flex: 1 } : undefined}
        />
      ) : (
        <View style={styles.statsContainer}>
          {stats ? (
            <>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>Total appels</Text>
              </View>
              <Text style={styles.statsSubtitle}>Par statut</Text>
              {stats.byStatus?.map((s: any) => (
                <View key={s.status} style={styles.statRow}>
                  <Text style={styles.statRowLabel}>{s.status}</Text>
                  <Text style={styles.statRowValue}>{s.count}</Text>
                </View>
              ))}
              <Text style={styles.statsSubtitle}>Par type</Text>
              {stats.byType?.map((s: any) => (
                <View key={s.type} style={styles.statRow}>
                  <Text style={styles.statRowLabel}>{s.type}</Text>
                  <Text style={styles.statRowValue}>{s.count}</Text>
                </View>
              ))}
            </>
          ) : (
            <EmptyState title="Chargement..." />
          )}
        </View>
      )}

      {/* Modal édition utilisateur */}
      <Modal transparent visible={!!editUser} animationType="slide" onRequestClose={() => setEditUser(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditUser(null)}>
          <View style={styles.bottomSheet}>
            <Text style={styles.sheetTitle}>Modifier {editUser?.display_name}</Text>
            <Input label="Nom d'affichage" value={editForm.display_name} onChangeText={(v) => setF('display_name', v)} />

            <Text style={styles.fieldLabel}>Rôle</Text>
            <View style={styles.roleRow}>
              {(['user', 'admin'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, editForm.role === r && styles.roleChipActive]}
                  onPress={() => setF('role', r)}
                >
                  <Text style={[styles.roleChipText, editForm.role === r && styles.roleChipTextActive]}>
                    {r === 'admin' ? '🛡 Admin' : '👤 Utilisateur'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input label="Extension" value={editForm.phone_extension} onChangeText={(v) => setF('phone_extension', v)} keyboardType="phone-pad" />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Compte actif</Text>
              <Switch
                value={editForm.is_active}
                onValueChange={(v) => setF('is_active', v)}
                trackColor={{ true: COLORS.primary }}
              />
            </View>

            <Button title="Enregistrer" onPress={saveUser} loading={saving} />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  backBtn: { padding: 4 },
  backText: { color: COLORS.white, fontSize: 22 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: SIZES.lg, fontWeight: '700', color: COLORS.white },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: COLORS.primary },
  tabBtnText: { fontSize: SIZES.sm, color: COLORS.gray500 },
  tabBtnTextActive: { color: COLORS.primary, fontWeight: '700' },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userInfo: { flex: 1, marginLeft: 12 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { fontSize: SIZES.md, fontWeight: '500', color: COLORS.gray900 },
  userNameInactive: { color: COLORS.gray400, textDecorationLine: 'line-through' },
  adminTag: {
    backgroundColor: COLORS.primaryXLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: SIZES.radiusFull,
  },
  adminTagText: { fontSize: 10, color: COLORS.primaryDark, fontWeight: '600' },
  userMeta: { fontSize: SIZES.xs, color: COLORS.gray400, marginTop: 2 },
  userStatus: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  deactivateBtn: { padding: 4 },
  deactivateBtnText: { fontSize: 18 },
  separator: { height: 1, backgroundColor: COLORS.gray100, marginLeft: 70 },
  statsContainer: { flex: 1, padding: 16, gap: 12 },
  statCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radiusLg,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statValue: { fontSize: 48, fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: SIZES.sm, color: COLORS.gray500, marginTop: 4 },
  statsSubtitle: { fontSize: SIZES.sm, fontWeight: '600', color: COLORS.gray600, marginTop: 8 },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    padding: 14,
    borderRadius: SIZES.radiusMd,
  },
  statRowLabel: { fontSize: SIZES.sm, color: COLORS.gray700 },
  statRowValue: { fontSize: SIZES.sm, fontWeight: '700', color: COLORS.primary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  bottomSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 48,
    gap: 4,
  },
  sheetTitle: { fontSize: SIZES.xl, fontWeight: '700', color: COLORS.gray900, marginBottom: 16, textAlign: 'center' },
  fieldLabel: { fontSize: SIZES.sm, fontWeight: '500', color: COLORS.gray700, marginBottom: 8 },
  roleRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  roleChip: {
    flex: 1, paddingVertical: 10, borderRadius: SIZES.radiusMd,
    borderWidth: 1.5, borderColor: COLORS.gray200, alignItems: 'center',
  },
  roleChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryXLight },
  roleChipText: { fontSize: SIZES.sm, color: COLORS.gray600 },
  roleChipTextActive: { color: COLORS.primaryDark, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, marginBottom: 8 },
  switchLabel: { fontSize: SIZES.md, color: COLORS.gray800 },
});

export default AdminScreen;
