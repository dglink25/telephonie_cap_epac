// src/screens/main/ProfileScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Switch, Modal, Pressable,
} from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { usersAPI } from '../../services/api';
import { socketService } from '../../services/socket';
import { Avatar, Button, Input } from '../../components/common';
import { COLORS, SIZES, PRESENCE_COLORS, PRESENCE_LABELS, DEPARTMENTS } from '../../utils/constants';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface Props {
  navigation: NativeStackNavigationProp<any>;
}

const PRESENCE_OPTIONS: Array<{ 
  key: 'online' | 'away' | 'dnd' | 'offline'; 
  iconName: string;
  iconColor: string;
}> = [
  { key: 'online', iconName: 'checkbox-blank-circle', iconColor: COLORS.online },
  { key: 'away', iconName: 'checkbox-blank-circle', iconColor: COLORS.away },
  { key: 'dnd', iconName: 'minus-circle', iconColor: COLORS.danger },
  { key: 'offline', iconName: 'checkbox-blank-circle-outline', iconColor: COLORS.offline },
];

const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, logout, updateUser } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [presenceModal, setPresenceModal] = useState(false);
  const [pwdModal, setPwdModal] = useState(false);
  const [form, setForm] = useState({
    display_name: user?.display_name || '',
    department: user?.department || '',
    phone_extension: user?.phone_extension || '',
  });
  const [pwdForm, setPwdForm] = useState({ current: '', newPwd: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setPwdF = (k: string, v: string) => setPwdForm((f) => ({ ...f, [k]: v }));

  const saveProfile = async () => {
    setSaving(true);
    try {
      const resp = await usersAPI.updateProfile({
        display_name: form.display_name,
        department: form.department,
        phone_extension: form.phone_extension,
      });
      updateUser(resp.data.data.user);
      setEditing(false);
      Alert.alert('Succès', 'Profil mis à jour');
    } catch {
      Alert.alert('Erreur', 'Mise à jour impossible');
    }
    setSaving(false);
  };

  const changePresence = async (status: 'online' | 'away' | 'dnd' | 'offline') => {
    setPresenceModal(false);
    try {
      await usersAPI.updatePresence(status);
      socketService.setPresence(status);
      updateUser({ presence_status: status });
    } catch {
      Alert.alert('Erreur', 'Statut non mis à jour');
    }
  };

  const changePassword = async () => {
    if (pwdForm.newPwd !== pwdForm.confirm) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }
    setSaving(true);
    try {
      const { authAPI } = await import('../../services/api');
      await authAPI.changePassword(pwdForm.current, pwdForm.newPwd);
      setPwdModal(false);
      setPwdForm({ current: '', newPwd: '', confirm: '' });
      Alert.alert('Succès', 'Mot de passe modifié. Reconnectez-vous.');
      await logout();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Erreur');
    }
    setSaving(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Confirmer la déconnexion ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnexion', style: 'destructive', onPress: logout },
      ]
    );
  };

  if (!user) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mon profil</Text>
        {user.role === 'admin' && (
          <TouchableOpacity
            onPress={() => navigation.navigate('Admin')}
            style={styles.adminBtn}
          >
            <Icon name="cog" size={18} color={COLORS.white} style={{ marginRight: 4 }} />
            <Text style={styles.adminBtnText}>Admin</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Card profil */}
        <View style={styles.profileCard}>
          <View style={styles.avatarSection}>
            <Avatar
              url={user.avatar_url}
              name={user.display_name}
              size={80}
              presenceStatus={user.presence_status}
            />
            <TouchableOpacity style={styles.changeAvatarBtn}>
              <Text style={styles.changeAvatarText}>Changer la photo</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.displayName}>{user.display_name}</Text>
          <Text style={styles.username}>@{user.username}</Text>
          <Text style={styles.email}>{user.email}</Text>

          {/* Badge rôle */}
          <View style={[styles.roleBadge, user.role === 'admin' && styles.roleBadgeAdmin]}>
            <Icon 
              name={user.role === 'admin' ? 'shield-account' : 'account'} 
              size={16} 
              color={user.role === 'admin' ? COLORS.primaryDark : COLORS.gray600}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.roleText, user.role === 'admin' && styles.roleTextAdmin]}>
              {user.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
            </Text>
          </View>

          {/* Statut présence */}
          <TouchableOpacity
            style={styles.presenceBtn}
            onPress={() => setPresenceModal(true)}
          >
            <View
              style={[
                styles.presenceDot,
                { backgroundColor: PRESENCE_COLORS[user.presence_status] || COLORS.offline },
              ]}
            />
            <Text style={styles.presenceBtnText}>
              {PRESENCE_LABELS[user.presence_status] || 'Hors ligne'}
            </Text>
            <Icon name="chevron-right" size={18} color={COLORS.gray400} />
          </TouchableOpacity>
        </View>

        {/* Infos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Informations</Text>
            <TouchableOpacity onPress={() => setEditing(!editing)}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name={editing ? 'close' : 'pencil'} size={16} color={COLORS.primary} style={{ marginRight: 4 }} />
                <Text style={styles.editBtn}>{editing ? 'Annuler' : 'Modifier'}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {editing ? (
            <View style={styles.editForm}>
              <Input
                label="Nom d'affichage"
                value={form.display_name}
                onChangeText={(v) => setF('display_name', v)}
              />
              <Text style={styles.fieldLabel}>Service</Text>
              <View style={styles.deptGrid}>
                {DEPARTMENTS.map((d) => (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setF('department', d)}
                    style={[styles.deptChip, form.department === d && styles.deptChipActive]}
                  >
                    <Text style={[styles.deptText, form.department === d && styles.deptTextActive]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Input
                label="Extension téléphonique"
                value={form.phone_extension}
                onChangeText={(v) => setF('phone_extension', v)}
                keyboardType="phone-pad"
                placeholder="Ex: 101"
              />
              <Button title="Enregistrer" onPress={saveProfile} loading={saving} />
            </View>
          ) : (
            <View>
              {[
                { label: 'Service', value: user.department || '-' },
                { label: 'Extension', value: user.phone_extension || '-' },
                { label: 'Email', value: user.email },
              ].map(({ label, value }) => (
                <View key={label} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{label}</Text>
                  <Text style={styles.infoValue}>{value}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Sécurité */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sécurité</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => setPwdModal(true)}>
            <Icon name="key" size={20} color={COLORS.primary} style={{ marginRight: 14 }} />
            <Text style={styles.menuItemText}>Changer le mot de passe</Text>
            <Icon name="chevron-right" size={24} color={COLORS.gray400} />
          </TouchableOpacity>
        </View>

        {/* Déconnexion */}
        <View style={styles.section}>
          <Button
            title="Déconnexion"
            onPress={handleLogout}
            variant="outline"
            style={{ borderColor: COLORS.danger }}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal présence */}
      <Modal transparent visible={presenceModal} animationType="slide" onRequestClose={() => setPresenceModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPresenceModal(false)}>
          <View style={styles.bottomSheet}>
            <Text style={styles.sheetTitle}>Changer le statut</Text>
            {PRESENCE_OPTIONS.map(({ key, iconName, iconColor }) => (
              <TouchableOpacity
                key={key}
                style={[styles.presenceOption, user.presence_status === key && styles.presenceOptionActive]}
                onPress={() => changePresence(key)}
              >
                <Icon name={iconName} size={24} color={iconColor} />
                <Text style={styles.presenceOptionText}>{PRESENCE_LABELS[key]}</Text>
                {user.presence_status === key && <Icon name="check" size={20} color={COLORS.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Modal changement mdp */}
      <Modal transparent visible={pwdModal} animationType="slide" onRequestClose={() => setPwdModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPwdModal(false)}>
          <View style={styles.bottomSheet}>
            <Text style={styles.sheetTitle}>Changer le mot de passe</Text>
            <Input
              label="Mot de passe actuel"
              value={pwdForm.current}
              onChangeText={(v) => setPwdF('current', v)}
              secureTextEntry
            />
            <Input
              label="Nouveau mot de passe"
              value={pwdForm.newPwd}
              onChangeText={(v) => setPwdF('newPwd', v)}
              secureTextEntry
            />
            <Input
              label="Confirmer"
              value={pwdForm.confirm}
              onChangeText={(v) => setPwdF('confirm', v)}
              secureTextEntry
            />
            <Button title="Changer" onPress={changePassword} loading={saving} />
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
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 20,
  },
  headerTitle: { fontSize: SIZES.xl, fontWeight: '700', color: COLORS.white },
  adminBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: SIZES.radiusFull,
  },
  adminBtnText: { color: COLORS.white, fontSize: SIZES.sm, fontWeight: '600' },
  profileCard: {
    backgroundColor: COLORS.white,
    margin: 16,
    borderRadius: SIZES.radiusLg,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarSection: { alignItems: 'center', marginBottom: 16 },
  changeAvatarBtn: { marginTop: 8 },
  changeAvatarText: { color: COLORS.primary, fontSize: SIZES.sm, fontWeight: '500' },
  displayName: { fontSize: SIZES.xxl, fontWeight: '700', color: COLORS.gray900, marginBottom: 2 },
  username: { fontSize: SIZES.sm, color: COLORS.gray500, marginBottom: 2 },
  email: { fontSize: SIZES.sm, color: COLORS.gray400, marginBottom: 12 },
  roleBadge: {
    backgroundColor: COLORS.gray100,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: SIZES.radiusFull,
    marginBottom: 14,
  },
  roleBadgeAdmin: { backgroundColor: COLORS.primaryXLight },
  roleText: { fontSize: SIZES.sm, color: COLORS.gray600 },
  roleTextAdmin: { color: COLORS.primaryDark, fontWeight: '600' },
  presenceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray50,
    borderRadius: SIZES.radiusFull,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    gap: 8,
  },
  presenceDot: { width: 10, height: 10, borderRadius: 5 },
  presenceBtnText: { fontSize: SIZES.sm, color: COLORS.gray700, flex: 1 },
  section: {
    backgroundColor: COLORS.white,
    margin: 16,
    marginTop: 0,
    borderRadius: SIZES.radiusLg,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: SIZES.lg, fontWeight: '600', color: COLORS.gray800 },
  editBtn: { color: COLORS.primary, fontSize: SIZES.sm, fontWeight: '500' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  infoLabel: { fontSize: SIZES.sm, color: COLORS.gray500 },
  infoValue: { fontSize: SIZES.sm, color: COLORS.gray800, fontWeight: '500' },
  editForm: { gap: 4 },
  fieldLabel: { fontSize: SIZES.sm, fontWeight: '500', color: COLORS.gray700, marginBottom: 8 },
  deptGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  deptChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: SIZES.radiusFull,
    borderWidth: 1.5,
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.gray50,
  },
  deptChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryXLight },
  deptText: { fontSize: SIZES.xs, color: COLORS.gray600 },
  deptTextActive: { color: COLORS.primaryDark, fontWeight: '600' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  menuItemIcon: { fontSize: 18, marginRight: 14 },
  menuItemText: { flex: 1, fontSize: SIZES.md, color: COLORS.gray800 },
  menuChevron: { color: COLORS.gray400, fontSize: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  bottomSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 48,
    gap: 4,
  },
  sheetTitle: {
    fontSize: SIZES.xl,
    fontWeight: '700',
    color: COLORS.gray900,
    marginBottom: 16,
    textAlign: 'center',
  },
  presenceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: SIZES.radiusMd,
    gap: 12,
  },
  presenceOptionActive: { backgroundColor: COLORS.primaryXXLight },
  presenceOptionIcon: { fontSize: 22 },
  presenceOptionText: { flex: 1, fontSize: SIZES.md, color: COLORS.gray800 },
  checkmark: { color: COLORS.primary, fontSize: 18, fontWeight: '700' },
});

export default ProfileScreen;
