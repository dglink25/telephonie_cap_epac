// src/screens/calls/IncomingCallScreen.tsx
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Vibration, Animated, Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useCallStore } from '../../store/callStore';
import { socketService } from '../../services/socket';
import { Avatar } from '../../components/common';
import { COLORS, SIZES } from '../../utils/constants';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const { width } = Dimensions.get('window');

interface Props {
  navigation: NativeStackNavigationProp<any>;
}

const IncomingCallScreen: React.FC<Props> = ({ navigation }) => {
  const { activeCall, setStatus, endCall } = useCallStore();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Sonnerie : pattern vibration
    const pattern = [0, 700, 500, 700, 500];
    Vibration.vibrate(pattern, true);

    // Animation pulse
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();

    return () => {
      Vibration.cancel();
      loop.stop();
    };
  }, []);

  // ✅ FIX: Si l'appel se termine avant d'accepter → retour aux tabs
  useEffect(() => {
    if (!activeCall) {
      navigation.replace('Tabs');
    }
  }, [activeCall]);

  if (!activeCall) return null;

  const handleAccept = () => {
    Vibration.cancel();
    // ✅ FIX: Envoyer call:accept au serveur — le serveur va notifier l'appelant
    // L'appelant (OutgoingCallScreen) va alors naviguer vers ActiveCallScreen
    // et créer l'offre WebRTC qui sera stockée dans le store (handleWebRTCOffer)
    socketService.acceptCall(activeCall.callId);
    setStatus('connecting');
    // Naviguer vers ActiveCallScreen comme appelé (isIncoming: true)
    navigation.replace('ActiveCall', { isIncoming: true });
  };

  const handleReject = () => {
    Vibration.cancel();
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
