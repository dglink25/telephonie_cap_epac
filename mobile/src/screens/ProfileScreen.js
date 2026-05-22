// mobile/src/screens/ProfileScreen.js
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMutation } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import api from '../config/api';
import useAuthStore from '../store/authStore';
import useSocketStore from '../store/socketStore';
import Avatar from '../components/ui/Avatar';

const PRESENCE_OPTIONS = [
  { value: 'online',  label: 'En ligne',        color: '#22c55e', icon: 'ellipse' },
  { value: 'away',    label: 'Absent',           color: '#facc15', icon: 'ellipse' },
  { value: 'dnd',     label: 'Ne pas déranger',  color: '#ef4444', icon: 'ellipse' },
  { value: 'offline', label: 'Hors ligne',        color: '#94a3b8', icon: 'ellipse' },
];

// ── Section card ──────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

// ── Ligne de champ ────────────────────────────────────────────────
function FieldRow({ icon, label, value, onChangeText, placeholder, editable = true, last = false }) {
  return (
    <View style={[styles.fieldRow, !last && styles.fieldRowBorder]}>
      <Ionicons name={icon} size={18} color="#16a34a" style={styles.fieldIcon} />
      <View style={styles.fieldContent}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {editable
          ? (
            <TextInput
              style={styles.fieldInput}
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor="#cbd5e1"
            />
          )
          : <Text style={styles.fieldReadonly}>{value || '—'}</Text>
        }
      </View>
    </View>
  );
}

// ── Modal changement de mot de passe ─────────────────────────────
function PasswordModal({ visible, onClose }) {
  const [form, setForm] = useState({ current: '', newPass: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!visible) return null;

  const handleSubmit = async () => {
    if (!form.current || !form.newPass || !form.confirm) {
      Toast.show({ type: 'error', text1: 'Tous les champs sont requis' });
      return;
    }
    if (form.newPass !== form.confirm) {
      Toast.show({ type: 'error', text1: 'Les mots de passe ne correspondent pas' });
      return;
    }
    if (form.newPass.length < 8 || !/[A-Z]/.test(form.newPass) || !/[0-9]/.test(form.newPass)) {
      Toast.show({ type: 'error', text1: 'Mot de passe trop faible', text2: 'Min 8 car., 1 maj., 1 chiffre' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        current_password: form.current,
        new_password: form.newPass,
      });
      Toast.show({ type: 'success', text1: 'Mot de passe modifié' });
      onClose();
    } catch (err) {
      Toast.show({ type: 'error', text1: err.response?.data?.message || 'Erreur' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.pwOverlay}>
      <View style={styles.pwModal}>
        <View style={styles.pwHeader}>
          <Text style={styles.pwTitle}>Changer le mot de passe</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color="#64748b" />
          </TouchableOpacity>
        </View>

        {[
          { key: 'current', label: 'Mot de passe actuel', show: showCurrent, toggle: () => setShowCurrent(!showCurrent) },
          { key: 'newPass', label: 'Nouveau mot de passe', show: showNew, toggle: () => setShowNew(!showNew) },
          { key: 'confirm', label: 'Confirmer', show: showNew, toggle: null },
        ].map(({ key, label, show, toggle }) => (
          <View key={key} style={styles.pwField}>
            <Text style={styles.pwLabel}>{label}</Text>
            <View style={styles.pwInputWrap}>
              <TextInput
                style={styles.pwInput}
                secureTextEntry={!show}
                value={form[key]}
                onChangeText={(v) => setForm({ ...form, [key]: v })}
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
              />
              {toggle && (
                <TouchableOpacity onPress={toggle} style={styles.pwEye}>
                  <Ionicons name={show ? 'eye-off' : 'eye'} size={18} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.pwBtn, loading && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.pwBtnText}>Confirmer</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Page principale ───────────────────────────────────────────────
export default function ProfileScreen() {
  const { user, updateUser, logout } = useAuthStore();
  const { emit } = useSocketStore();
  const [profile, setProfile] = useState({
    display_name: user?.display_name || '',
    department: user?.department || '',
    phone_extension: user?.phone_extension || '',
  });
  const [presence, setPresence] = useState(user?.presence_status || 'online');
  const [showPwModal, setShowPwModal] = useState(false);

  // ── Mutations ───────────────────────────────────────────────────
  const profileMutation = useMutation({
    mutationFn: (data) => api.put('/users/me', data),
    onSuccess: ({ data }) => {
      updateUser(data.data.user);
      Toast.show({ type: 'success', text1: 'Profil mis à jour' });
    },
    onError: () => Toast.show({ type: 'error', text1: 'Erreur de mise à jour' }),
  });

  const avatarMutation = useMutation({
    mutationFn: (fd) => api.post('/users/me/avatar', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    onSuccess: ({ data }) => {
      updateUser({ avatar_url: data.data.avatar_url });
      Toast.show({ type: 'success', text1: 'Avatar mis à jour' });
    },
    onError: () => Toast.show({ type: 'error', text1: 'Erreur upload avatar' }),
  });

  const presenceMutation = useMutation({
    mutationFn: (status) => api.put('/users/me/presence', { status }),
    onSuccess: (_, status) => {
      updateUser({ presence_status: status });
      emit('user:set-status', { status });
    },
  });

  const handlePickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Toast.show({ type: 'error', text1: 'Permission refusée' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const fd = new FormData();
      fd.append('avatar', {
        uri: asset.uri,
        name: `avatar_${Date.now()}.jpg`,
        type: 'image/jpeg',
      });
      avatarMutation.mutate(fd);
    }
  };

  const handlePresence = (value) => {
    setPresence(value);
    presenceMutation.mutate(value);
  };

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnecter', style: 'destructive', onPress: () => logout() },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header profil */}
        <View style={styles.heroCard}>
          <TouchableOpacity style={styles.avatarWrap} onPress={handlePickAvatar}>
            <Avatar user={user} size="xl" />
            <View style={styles.cameraBadge}>
              {avatarMutation.isPending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="camera" size={14} color="#fff" />
              }
            </View>
          </TouchableOpacity>
          <Text style={styles.heroName}>{user?.display_name}</Text>
          <Text style={styles.heroUsername}>@{user?.username}</Text>
          <View style={styles.heroTags}>
            <View style={styles.heroTag}>
              <Text style={styles.heroTagText}>
                {user?.role === 'admin' ? '⚡ Admin' : '👤 Utilisateur'}
              </Text>
            </View>
            {user?.department && (
              <View style={styles.heroTag}>
                <Text style={styles.heroTagText}>{user.department}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Présence */}
        <Section title="Statut de présence">
          <View style={styles.presenceGrid}>
            {PRESENCE_OPTIONS.map((opt) => {
              const active = presence === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.presenceBtn, active && styles.presenceBtnActive]}
                  onPress={() => handlePresence(opt.value)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.presenceDot, { backgroundColor: opt.color }]} />
                  <Text style={[styles.presenceBtnText, active && styles.presenceBtnTextActive]}>
                    {opt.label}
                  </Text>
                  {active && <Ionicons name="checkmark" size={14} color="#16a34a" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </Section>

        {/* Infos personnelles */}
        <Section title="Informations personnelles">
          <FieldRow icon="person-outline" label="Identifiant" value={user?.username} editable={false} />
          <FieldRow icon="mail-outline" label="Email" value={user?.email} editable={false} />
          <FieldRow
            icon="text-outline" label="Nom affiché"
            value={profile.display_name}
            onChangeText={(v) => setProfile({ ...profile, display_name: v })}
            placeholder="Votre nom complet"
          />
          <FieldRow
            icon="business-outline" label="Service"
            value={profile.department}
            onChangeText={(v) => setProfile({ ...profile, department: v })}
            placeholder="Ex: Direction"
          />
          <FieldRow
            icon="call-outline" label="Poste tél."
            value={profile.phone_extension}
            onChangeText={(v) => setProfile({ ...profile, phone_extension: v })}
            placeholder="Ex: 1234"
            last
          />
        </Section>

        {/* Boutons action */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btnSave, profileMutation.isPending && { opacity: 0.6 }]}
            onPress={() => profileMutation.mutate(profile)}
            disabled={profileMutation.isPending}
          >
            {profileMutation.isPending
              ? <ActivityIndicator color="#fff" />
              : <><Ionicons name="save-outline" size={18} color="#fff" /><Text style={styles.btnSaveText}>Enregistrer</Text></>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnPw}
            onPress={() => setShowPwModal(true)}
          >
            <Ionicons name="lock-closed-outline" size={18} color="#16a34a" />
            <Text style={styles.btnPwText}>Mot de passe</Text>
          </TouchableOpacity>
        </View>

        {/* Déconnexion */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal mot de passe */}
      <PasswordModal visible={showPwModal} onClose={() => setShowPwModal(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { paddingBottom: 40 },

  heroCard: {
    backgroundColor: '#fff', alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9', marginBottom: 16,
  },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#16a34a', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  heroName: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 2 },
  heroUsername: { fontSize: 14, color: '#94a3b8', marginBottom: 10 },
  heroTags: { flexDirection: 'row', gap: 8 },
  heroTag: {
    backgroundColor: '#f0fdf4', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: '#dcfce7',
  },
  heroTagText: { fontSize: 12, color: '#15803d', fontWeight: '600' },

  section: { marginHorizontal: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  sectionCard: {
    backgroundColor: '#fff', borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    overflow: 'hidden',
  },

  presenceGrid: { padding: 12, gap: 8 },
  presenceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 12, backgroundColor: '#f8fafc',
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  presenceBtnActive: { backgroundColor: '#f0fdf4', borderColor: '#16a34a' },
  presenceDot: { width: 10, height: 10, borderRadius: 5 },
  presenceBtnText: { flex: 1, fontSize: 14, color: '#64748b', fontWeight: '500' },
  presenceBtnTextActive: { color: '#15803d', fontWeight: '700' },

  fieldRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  fieldRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  fieldIcon: { marginRight: 14 },
  fieldContent: { flex: 1 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  fieldInput: { fontSize: 15, color: '#0f172a', padding: 0 },
  fieldReadonly: { fontSize: 15, color: '#cbd5e1' },

  actions: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 10 },
  btnSave: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#16a34a', borderRadius: 14, paddingVertical: 13,
    shadowColor: '#16a34a', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  btnSaveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnPw: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 14, paddingVertical: 13,
    borderWidth: 1, borderColor: '#16a34a',
  },
  btnPwText: { color: '#16a34a', fontSize: 15, fontWeight: '700' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
  },
  logoutText: { color: '#ef4444', fontSize: 15, fontWeight: '700' },

  // Modal mot de passe
  pwOverlay: {
    position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pwModal: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  pwHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  pwTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  pwField: { marginBottom: 14 },
  pwLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 6 },
  pwInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, backgroundColor: '#f9fafb',
  },
  pwInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#0f172a' },
  pwEye: { paddingHorizontal: 12 },
  pwBtn: {
    backgroundColor: '#16a34a', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginTop: 8,
  },
  pwBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});