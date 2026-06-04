// src/screens/main/NewConversationScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert,
} from 'react-native';
import { usersAPI, conversationsAPI } from '../../services/api';
import { Avatar, Button, Input } from '../../components/common';
import { COLORS, SIZES } from '../../utils/constants';
import { useAuthStore } from '../../store/authStore';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface Props {
  navigation: NativeStackNavigationProp<any>;
}

interface User {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  presence_status: string;
  department: string | null;
}

const NewConversationScreen: React.FC<Props> = ({ navigation }) => {
  const { user: me } = useAuthStore();
  const [mode, setMode] = useState<'direct' | 'group'>('direct');
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await usersAPI.getAll({ search, limit: 100 });
        setUsers(resp.data.data.users.filter((u: User) => u.id !== me?.id));
      } catch {}
    };
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const toggleUser = (u: User) => {
    if (mode === 'direct') {
      setSelected([u]);
      return;
    }
    setSelected((prev) =>
      prev.find((p) => p.id === u.id)
        ? prev.filter((p) => p.id !== u.id)
        : [...prev, u]
    );
  };

  const handleCreate = async () => {
    if (!selected.length) {
      Alert.alert('', 'Sélectionnez au moins un contact');
      return;
    }
    if (mode === 'group' && !groupName.trim()) {
      Alert.alert('', 'Donnez un nom au groupe');
      return;
    }
    setCreating(true);
    try {
      const resp = await conversationsAPI.create({
        type: mode,
        name: mode === 'group' ? groupName.trim() : undefined,
        member_ids: selected.map((u) => u.id),
      });
      const conv = resp.data.data.conversation;
      navigation.replace('Chat', {
        conversationId: conv.id,
        name: mode === 'group' ? groupName : selected[0].display_name,
        type: mode,
      });
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Impossible de créer');
    }
    setCreating(false);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouvelle conversation</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Mode */}
      <View style={styles.modeRow}>
        {(['direct', 'group'] as const).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
            onPress={() => { setMode(m); setSelected([]); }}
          >
            <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
              {m === 'direct' ? '👤 Direct' : '👥 Groupe'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Nom du groupe */}
      {mode === 'group' && (
        <View style={styles.groupNameRow}>
          <Input
            label=""
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Nom du groupe..."
            autoCapitalize="words"
          />
        </View>
      )}

      {/* Sélection */}
      {selected.length > 0 && (
        <View style={styles.selectedRow}>
          {selected.map((u) => (
            <TouchableOpacity key={u.id} onPress={() => toggleUser(u)} style={styles.selectedChip}>
              <Text style={styles.selectedChipText}>{u.display_name}</Text>
              <Text style={styles.selectedRemove}>✕</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Recherche */}
      <View style={styles.searchBar}>
        <Text>🔍  </Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher..."
          placeholderTextColor={COLORS.gray400}
        />
      </View>

      {/* Liste */}
      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        renderItem={({ item: u }) => {
          const isSelected = !!selected.find((s) => s.id === u.id);
          return (
            <TouchableOpacity
              style={[styles.userItem, isSelected && styles.userItemSelected]}
              onPress={() => toggleUser(u)}
              activeOpacity={0.7}
            >
              <Avatar url={u.avatar_url} name={u.display_name} size={40} presenceStatus={u.presence_status} />
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{u.display_name}</Text>
                <Text style={styles.userDept}>{u.department || u.username}</Text>
              </View>
              {mode === 'group' && (
                <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
              )}
              {mode === 'direct' && isSelected && (
                <Text style={styles.selectedIndicator}>✓</Text>
              )}
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* Bouton créer */}
      {selected.length > 0 && (
        <View style={styles.createBtnContainer}>
          <Button
            title={
              mode === 'direct'
                ? `Démarrer avec ${selected[0].display_name}`
                : `Créer le groupe (${selected.length} membres)`
            }
            onPress={handleCreate}
            loading={creating}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  closeBtn: { width: 40, alignItems: 'center' },
  closeText: { color: COLORS.white, fontSize: 20 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: SIZES.lg, fontWeight: '700', color: COLORS.white },
  modeRow: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: COLORS.gray100,
    borderRadius: SIZES.radiusLg,
    padding: 4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: SIZES.radiusMd,
  },
  modeBtnActive: { backgroundColor: COLORS.white, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  modeBtnText: { fontSize: SIZES.sm, color: COLORS.gray500 },
  modeBtnTextActive: { color: COLORS.primary, fontWeight: '700' },
  groupNameRow: { paddingHorizontal: 16 },
  selectedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryXLight,
    borderRadius: SIZES.radiusFull,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  selectedChipText: { color: COLORS.primaryDark, fontSize: SIZES.sm, fontWeight: '500' },
  selectedRemove: { color: COLORS.primary, fontSize: 12 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: SIZES.radiusLg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: SIZES.md, color: COLORS.gray900 },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userItemSelected: { backgroundColor: COLORS.primaryXXLight },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: SIZES.md, fontWeight: '500', color: COLORS.gray900 },
  userDept: { fontSize: SIZES.xs, color: COLORS.gray400, marginTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkmark: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  selectedIndicator: { color: COLORS.primary, fontSize: 20 },
  separator: { height: 1, backgroundColor: COLORS.gray100, marginLeft: 68 },
  createBtnContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray100,
  },
});

export default NewConversationScreen;
