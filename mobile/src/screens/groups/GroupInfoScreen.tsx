// src/screens/groups/GroupInfoScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, FlatList, Modal, Pressable,
} from 'react-native';
import { groupsAPI } from '../../services/api';
import { Avatar, Button, Input } from '../../components/common';
import { COLORS, SIZES } from '../../utils/constants';
import { useAuthStore } from '../../store/authStore';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

interface Member {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  presence_status: string;
  department: string | null;
  ConversationMember?: { role: string };
}

interface GroupInfo {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  is_general: boolean;
  memberCount: number;
  currentUserRole: string;
  currentUserIsAdmin: boolean;
  members: Member[];
}

interface Props {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ GroupInfo: { groupId: string } }, 'GroupInfo'>;
}

const GroupInfoScreen: React.FC<Props> = ({ navigation, route }) => {
  const { groupId } = route.params;
  const { user: me } = useAuthStore();
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadGroup(); }, []);

  const loadGroup = async () => {
    try {
      const resp = await groupsAPI.getInfo(groupId);
      setGroup(resp.data.data.group);
      setEditName(resp.data.data.group.name || '');
      setEditDesc(resp.data.data.group.description || '');
    } catch {
      Alert.alert('Erreur', 'Impossible de charger le groupe');
    }
  };

  const saveGroupInfo = async () => {
    setSaving(true);
    try {
      await groupsAPI.updateInfo(groupId, { name: editName, description: editDesc });
      setEditModal(false);
      loadGroup();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Impossible de modifier');
    }
    setSaving(false);
  };

  const removeMember = (member: Member) => {
    Alert.alert(
      'Retirer le membre',
      `Retirer ${member.display_name} du groupe ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            try {
              await groupsAPI.removeMember(groupId, member.id);
              loadGroup();
            } catch (e: any) {
              Alert.alert('Erreur', e?.response?.data?.message || '');
            }
          },
        },
      ]
    );
  };

  const leaveGroup = () => {
    Alert.alert(
      'Quitter le groupe',
      'Confirmer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: async () => {
            try {
              await groupsAPI.leaveGroup(groupId);
              navigation.goBack();
            } catch (e: any) {
              Alert.alert('Erreur', e?.response?.data?.message || '');
            }
          },
        },
      ]
    );
  };

  const promoteToAdmin = async (member: Member) => {
    try {
      await groupsAPI.updateMemberRole(groupId, member.id, 'admin');
      loadGroup();
    } catch {}
  };

  if (!group) return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Infos du groupe</Text>
        {group.currentUserIsAdmin && !group.is_general && (
          <TouchableOpacity onPress={() => setEditModal(true)}>
            <Text style={styles.editBtn}>✏️</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Info groupe */}
        <View style={styles.groupCard}>
          <Avatar url={group.avatar_url} name={group.name} size={80} />
          <Text style={styles.groupName}>{group.name}</Text>
          {group.is_general && (
            <View style={styles.generalBadge}>
              <Text style={styles.generalBadgeText}>🌐 Groupe Général</Text>
            </View>
          )}
          {group.description ? (
            <Text style={styles.groupDesc}>{group.description}</Text>
          ) : null}
          <Text style={styles.memberCount}>{group.memberCount} membres</Text>
        </View>

        {/* Membres */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Membres</Text>
          {group.members.map((m) => {
            const memberRole = m.ConversationMember?.role || 'member';
            const isAdmin = memberRole === 'admin';
            const isMe = m.id === me?.id;
            return (
              <View key={m.id} style={styles.memberItem}>
                <Avatar url={m.avatar_url} name={m.display_name} size={40} presenceStatus={m.presence_status} />
                <View style={styles.memberInfo}>
                  <View style={styles.memberNameRow}>
                    <Text style={styles.memberName}>{m.display_name}</Text>
                    {isMe && <Text style={styles.meBadge}> (moi)</Text>}
                  </View>
                  <Text style={styles.memberDept}>{m.department || m.username}</Text>
                </View>
                {isAdmin && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>Admin</Text>
                  </View>
                )}
                {group.currentUserIsAdmin && !isMe && !group.is_general && (
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        m.display_name,
                        '',
                        [
                          { text: 'Annuler', style: 'cancel' },
                          !isAdmin
                            ? { text: '⭐ Nommer admin', onPress: () => promoteToAdmin(m) }
                            : { text: '', style: 'cancel' },
                          { text: '🚫 Retirer', style: 'destructive', onPress: () => removeMember(m) },
                        ].filter((a) => a.text)
                      );
                    }}
                    style={styles.memberMenu}
                  >
                    <Text style={styles.memberMenuText}>···</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {/* Actions */}
        {!group.is_general && (
          <View style={styles.section}>
            <Button
              title="Quitter le groupe"
              onPress={leaveGroup}
              variant="outline"
              style={{ borderColor: COLORS.danger }}
            />
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal édition */}
      <Modal transparent visible={editModal} animationType="slide" onRequestClose={() => setEditModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditModal(false)}>
          <View style={styles.bottomSheet}>
            <Text style={styles.sheetTitle}>Modifier le groupe</Text>
            <Input label="Nom" value={editName} onChangeText={setEditName} autoCapitalize="words" />
            <Input
              label="Description (optionnel)"
              value={editDesc}
              onChangeText={setEditDesc}
              multiline
              numberOfLines={3}
            />
            <Button title="Enregistrer" onPress={saveGroupInfo} loading={saving} />
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
    paddingHorizontal: 16,
  },
  backBtn: { padding: 4 },
  backText: { color: COLORS.white, fontSize: 22 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: SIZES.lg, fontWeight: '700', color: COLORS.white },
  editBtn: { fontSize: 22, padding: 4 },
  groupCard: {
    backgroundColor: COLORS.white,
    margin: 16,
    borderRadius: SIZES.radiusLg,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  groupName: { fontSize: SIZES.xxl, fontWeight: '700', color: COLORS.gray900, textAlign: 'center' },
  generalBadge: {
    backgroundColor: COLORS.primaryXLight,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: SIZES.radiusFull,
  },
  generalBadgeText: { color: COLORS.primaryDark, fontSize: SIZES.sm, fontWeight: '600' },
  groupDesc: { fontSize: SIZES.sm, color: COLORS.gray500, textAlign: 'center' },
  memberCount: { fontSize: SIZES.sm, color: COLORS.gray400 },
  section: {
    backgroundColor: COLORS.white,
    margin: 16,
    marginTop: 0,
    borderRadius: SIZES.radiusLg,
    padding: 20,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray800,
    marginBottom: 12,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  memberInfo: { flex: 1 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center' },
  memberName: { fontSize: SIZES.md, fontWeight: '500', color: COLORS.gray900 },
  meBadge: { fontSize: SIZES.xs, color: COLORS.gray400 },
  memberDept: { fontSize: SIZES.xs, color: COLORS.gray400, marginTop: 1 },
  adminBadge: {
    backgroundColor: COLORS.primaryXLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: SIZES.radiusFull,
  },
  adminBadgeText: { fontSize: SIZES.xs, color: COLORS.primaryDark, fontWeight: '600' },
  memberMenu: { padding: 8 },
  memberMenuText: { fontSize: 18, color: COLORS.gray500 },
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
});

export default GroupInfoScreen;
