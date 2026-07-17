// src/screens/calls/IncomingCallScreen.tsx
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Vibration, Animated, Dimensions, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import InCallManager from 'react-native-incall-manager';
import { useCallStore } from '../../store/callStore';
import { socketService } from '../../services/socket';
import { stopNativeRingtone } from '../../services/callNotificationService';
import { Avatar } from '../../components/common';
import { COLORS, SIZES } from '../../utils/constants';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

const { width } = Dimensions.get('window');

interface Props {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ IncomingCall: { openedFromNotification?: boolean } }, 'IncomingCall'>;
  // openedFromNotification : vrai quand l'écran est ouvert depuis le bouton
  // "Accepter" de la notification Android native — la sonnerie est déjà
  // gérée par le service natif, pas besoin de la redémarrer.
  openedFromNotification?: boolean;
}

const IncomingCallScreen: React.FC<Props> = ({ navigation, route }) => {
  const openedFromNotification = route?.params?.openedFromNotification ?? false;
  const { activeCall, setStatus, endCall } = useCallStore();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // Indique si c'est CE composant qui a démarré la sonnerie
  // (pour ne l'arrêter que s'il l'a démarrée)
  const startedRingtone = useRef(false);

  useEffect(() => {
    // ── Anti-doublon sonnerie ──────────────────────────────────
    // Si l'app vient d'être ouverte depuis la notification Android native,
    // le service natif gère déjà la sonnerie → ne pas la redémarrer.
    // On joue la sonnerie JS seulement si l'app était déjà ouverte en foreground.
    const serviceAlreadyRinging = Platform.OS === 'android' && openedFromNotification;

    if (!serviceAlreadyRinging) {
      InCallManager.startRingtone('_BUNDLE_');
      InCallManager.setKeepScreenOn(true);
      Vibration.vibrate([0, 700, 500, 700, 500], true);
      startedRingtone.current = true;
    } else {
      // L'écran s'ouvre via notification — juste garder l'écran allumé
      InCallManager.setKeepScreenOn(true);
      startedRingtone.current = false;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();

    return () => {
      // N'arrêter la sonnerie JS que si c'est ce composant qui l'a démarrée
      if (startedRingtone.current) {
        InCallManager.stopRingtone();
        Vibration.cancel();
        startedRingtone.current = false;
      }
      InCallManager.setKeepScreenOn(false);
      loop.stop();
    };
  }, [openedFromNotification]);

  // ✅ FIX: Si l'appel se termine avant d'accepter → retour aux tabs
  useEffect(() => {
    if (!activeCall) {
      navigation.replace('Tabs');
    }
  }, [activeCall]);

  if (!activeCall) return null;

  const handleAccept = () => {
    // Arrêter la sonnerie JS si ce composant l'a démarrée
    if (startedRingtone.current) {
      InCallManager.stopRingtone();
      Vibration.cancel();
      startedRingtone.current = false;
    }
    // Arrêter aussi la sonnerie du service natif Android (toujours, par sécurité)
    stopNativeRingtone();
    InCallManager.setKeepScreenOn(false);
    socketService.acceptCall(activeCall.callId);
    setStatus('connecting');
    navigation.replace('ActiveCall', { isIncoming: true });
  };

  const handleReject = () => {
    if (startedRingtone.current) {
      InCallManager.stopRingtone();
      Vibration.cancel();
      startedRingtone.current = false;
    }
    // Arrêter aussi la sonnerie du service natif Android
    stopNativeRingtone();
    InCallManager.setKeepScreenOn(false);
    socketService.rejectCall(activeCall.callId);
    endCall();
    navigation.replace('Tabs');
  };

  const isVideo = activeCall.type === 'video' || activeCall.type === 'group_video';

  return (
    <View style={styles.container}>
      <View style={styles.bg} />

      <View style={styles.content}>
        <Text style={styles.callTypeLabel}>
          {activeCall.isGroupCall
            ? 'Appel de groupe entrant'
            : isVideo
            ? 'Appel vidéo entrant'
            : 'Appel audio entrant'}
        </Text>

        <Animated.View style={[styles.avatarPulse, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.avatarRing}>
            <Avatar
              url={activeCall.callerAvatar}
              name={activeCall.callerName}
              size={110}
            />
          </View>
        </Animated.View>

        <Text style={styles.callerName}>{activeCall.callerName}</Text>
        {activeCall.isGroupCall && activeCall.groupName && (
          <Text style={styles.groupName}>{activeCall.groupName}</Text>
        )}
        <Text style={styles.callStatus}>vous appelle...</Text>

        <View style={styles.buttons}>
          <View style={styles.btnGroup}>
            <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
              <Icon name="phone-hangup" size={32} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.btnLabel}>Refuser</Text>
          </View>

          <View style={styles.btnGroup}>
            <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
              <Icon
                name={isVideo ? 'video' : 'phone'}
                size={32}
                color={COLORS.white}
              />
            </TouchableOpacity>
            <Text style={styles.btnLabel}>Accepter</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f5132',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    paddingTop: 80,
  },
  callTypeLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: SIZES.sm,
    marginBottom: 40,
    letterSpacing: 0.5,
  },
  avatarPulse: { marginBottom: 28 },
  avatarRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callerName: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: 6,
  },
  groupName: {
    fontSize: SIZES.md,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 4,
  },
  callStatus: {
    fontSize: SIZES.md,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 64,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '80%',
  },
  btnGroup: { alignItems: 'center', gap: 10 },
  rejectBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  acceptBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primaryLight,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  btnLabel: { color: 'rgba(255,255,255,0.8)', fontSize: SIZES.sm },
});

export default IncomingCallScreen;
