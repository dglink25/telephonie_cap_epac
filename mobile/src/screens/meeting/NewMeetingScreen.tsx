// src/screens/meeting/NewMeetingScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Share, Alert,
  ScrollView, SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, SIZES, SHADOWS } from '../../utils/constants';
import { conversationsAPI } from '../../services/api';
import api, { SERVER_BASE } from '../../services/api';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import Clipboard from '@react-native-clipboard/clipboard';
import { showMessage } from 'react-native-flash-message';

interface Props {
  navigation: NativeStackNavigationProp<any>;
  route?: RouteProp<any, any>;
}

const NewMeetingScreen: React.FC<Props> = ({ navigation }) => {
  const [tab, setTab]           = useState<'create' | 'join'>('create');
  const [roomInput, setRoomInput] = useState('');
  const [loading, setLoading]   = useState(false);
  const [created, setCreated]   = useState<any>(null);

  const jitsiUrl = SERVER_BASE.replace(':8282', ':8443').replace(/:\d+$/, ':8443');

  const handleCreate = async () => {
    setLoading(true);
    try {
      const resp = await api.post('/meetings/create', { name: '' });
      setCreated(resp.data.data);
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Impossible de créer la réunion');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    const room = roomInput.trim().toUpperCase();
    if (!room) return;
    navigation.navigate('Meeting', { roomName: room, jitsiUrl });
  };

  const handleStart = () => {
    if (!created) return;
    navigation.navigate('Meeting', { roomName: created.roomName, jitsiUrl });
  };

  const handleShare = async () => {
    if (!created) return;
    await Share.share({
      message: `Rejoignez ma visioconférence CAP-EPAC !\nCode : ${created.roomName}\nLien : ${jitsiUrl}/${created.roomName}`,
    });
  };

  const handleCopy = () => {
    if (!created) return;
    Clipboard.setString(created.roomName);
    showMessage({ message: 'Code copié', type: 'success', duration: 2000 });
  };

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Visioconférence</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Icône */}
        <View style={styles.iconWrap}>
          <Icon name="video-plus" size={48} color={COLORS.primary} />
        </View>
        <Text style={styles.subtitle}>Jusqu'à 200 participants</Text>

        {/* Onglets */}
        <View style={styles.tabs}>
          {(['create', 'join'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => { setTab(t); setCreated(null); }}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'create' ? 'Nouvelle réunion' : 'Rejoindre'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Créer */}
        {tab === 'create' && !created && (
          <View style={styles.card}>
            <View style={styles.featureList}>
              {[
                { icon: 'monitor-share',    text: 'Partage d\'écran' },
                { icon: 'closed-caption',   text: 'Sous-titres automatiques' },
                { icon: 'link-variant',     text: 'Lien de partage' },
                { icon: 'shield-lock',      text: 'Gestion des accès' },
                { icon: 'record-circle',    text: 'Enregistrement' },
                { icon: 'emoticon-happy',   text: 'Réactions en direct' },
              ].map((f) => (
                <View key={f.icon} style={styles.featureItem}>
                  <Icon name={f.icon} size={18} color={COLORS.primary} />
                  <Text style={styles.featureText}>{f.text}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={COLORS.white} />
                : <>
                    <Icon name="video-plus" size={20} color={COLORS.white} />
                    <Text style={styles.primaryBtnText}>Créer la réunion</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* Salle créée */}
        {tab === 'create' && created && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Salle créée</Text>
            <View style={styles.roomCodeBox}>
              <Text style={styles.roomCode}>{created.roomName}</Text>
              <TouchableOpacity onPress={handleCopy} style={styles.copyBtn}>
                <Icon name="content-copy" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.cardLabel}>Durée de validité</Text>
            <Text style={styles.cardValue}>8 heures</Text>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={handleShare}>
                <Icon name="share-variant" size={18} color={COLORS.primary} />
                <Text style={styles.secondaryBtnText}>Partager</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn2} onPress={handleStart}>
                <Icon name="video" size={18} color={COLORS.white} />
                <Text style={styles.primaryBtnText}>Démarrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Rejoindre */}
        {tab === 'join' && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Code ou nom de la salle</Text>
            <TextInput
              style={styles.input}
              value={roomInput}
              onChangeText={(v) => setRoomInput(v.toUpperCase())}
              placeholder="Ex: CAPEPAC-A1B2"
              placeholderTextColor={COLORS.gray400}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, (!roomInput.trim() || loading) && { opacity: 0.5 }]}
              onPress={handleJoin}
              disabled={!roomInput.trim() || loading}
            >
              <Icon name="account-group" size={20} color={COLORS.white} />
              <Text style={styles.primaryBtnText}>Rejoindre</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  backBtn: { width: 40, padding: 4 },
  headerTitle: { flex: 1, textAlign: 'center', color: COLORS.white, fontSize: SIZES.lg, fontWeight: '700' },
  content: { padding: 20, alignItems: 'center' },
  iconWrap: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: COLORS.primaryXLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, marginTop: 8,
  },
  subtitle: { color: COLORS.gray500, fontSize: SIZES.sm, marginBottom: 24 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.gray200,
    borderRadius: SIZES.radiusFull,
    padding: 3,
    width: '100%',
    marginBottom: 20,
  },
  tab: {
    flex: 1, paddingVertical: 10,
    borderRadius: SIZES.radiusFull,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: COLORS.white, ...SHADOWS.sm },
  tabText: { fontSize: SIZES.sm, color: COLORS.gray500, fontWeight: '500' },
  tabTextActive: { color: COLORS.primary, fontWeight: '700' },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radiusLg,
    padding: 20,
    width: '100%',
    ...SHADOWS.md,
    gap: 12,
  },
  featureList: { gap: 8 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: SIZES.sm, color: COLORS.gray700 },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radiusFull,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtn2: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radiusFull,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.md },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: SIZES.radiusFull,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.md },
  actionRow: { flexDirection: 'row', gap: 10 },
  cardLabel: { fontSize: SIZES.xs, color: COLORS.gray500, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardValue: { fontSize: SIZES.md, color: COLORS.gray700 },
  roomCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryXXLight,
    borderRadius: SIZES.radiusMd,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  roomCode: { flex: 1, fontSize: SIZES.xxl, fontWeight: '800', color: COLORS.primaryDark, fontFamily: 'monospace', letterSpacing: 2 },
  copyBtn: { padding: 4 },
  input: {
    backgroundColor: COLORS.gray100,
    borderRadius: SIZES.radiusMd,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: SIZES.lg,
    color: COLORS.gray900,
    fontFamily: 'monospace',
    letterSpacing: 2,
    borderWidth: 1.5,
    borderColor: COLORS.gray200,
  },
});

export default NewMeetingScreen;
