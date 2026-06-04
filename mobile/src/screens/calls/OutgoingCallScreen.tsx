// src/screens/calls/OutgoingCallScreen.tsx
import React, { useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useCallStore } from '../../store/callStore';
import { useAuthStore } from '../../store/authStore';
import { socketService } from '../../services/socket';
import { Avatar } from '../../components/common';
import { COLORS, SIZES } from '../../utils/constants';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

interface Props {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{
    OutgoingCall: {
      calleeId: string;
      calleeName: string;
      calleeAvatar?: string;
      type: 'audio' | 'video';
      conversationId?: string;
    };
  }, 'OutgoingCall'>;
}

const OutgoingCallScreen: React.FC<Props> = ({ navigation, route }) => {
  const { calleeId, calleeName, calleeAvatar, type, conversationId } = route.params;
  const { setActiveCall, setStatus, endCall, status } = useCallStore();
  const { user } = useAuthStore();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const callIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Animation pulse
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();

    // Initier l'appel dès le montage
    initiateCall();

    // ✅ FIX: Écouter call:initiated pour récupérer le callId du serveur
    const unsubInitiated = socketService.on('call:initiated', (data: unknown) => {
      const { callId } = data as { callId: string };
      callIdRef.current = callId;
      setActiveCall({
        callId,
        callerId: user?.id || '',
        callerName: user?.display_name || '',
        callerAvatar: user?.avatar_url || null,
        calleeId,
        type: type === 'video' ? 'video' : 'audio',
        isGroupCall: !!conversationId,
      });
      console.log('[OutgoingCall] call:initiated callId=', callId);
    });

    // ✅ FIX: call:error → annuler
    const unsubError = socketService.on('call:error', (data: unknown) => {
      const { message } = data as { message: string };
      console.error('[OutgoingCall] call:error:', message);
      endCall();
      navigation.goBack();
    });

    // ✅ FIX: call:ended (appelé a raccroché pendant la sonnerie)
    const unsubEnded = socketService.on('call:ended', (data: unknown) => {
      const { callId } = data as { callId: string };
      if (!callIdRef.current || callId === callIdRef.current) {
        endCall();
        navigation.goBack();
      }
    });

    // ✅ FIX: call:rejected
    const unsubRejected = socketService.on('call:rejected', (data: unknown) => {
      const { callId } = data as { callId: string };
      if (!callIdRef.current || callId === callIdRef.current) {
        endCall();
        navigation.goBack();
      }
    });

    // ✅ FIX: call:accepted → naviguer vers ActiveCall (appelant, isIncoming: false)
    // useSocket.ts gère aussi ce cas via handleCallAccepted — mais OutgoingCallScreen
    // peut être monté AVANT que useSocketEvents soit actif, donc on écoute localement aussi
    const unsubAccepted = socketService.on('call:accepted', (data: unknown) => {
      const { callId } = data as { callId: string };
      if (callId === callIdRef.current) {
        setStatus('connecting');
        navigation.replace('ActiveCall', { isIncoming: false });
      }
    });

    return () => {
      loop.stop();
      unsubInitiated();
      unsubError();
      unsubEnded();
      unsubRejected();
      unsubAccepted();
    };
  }, []);

  const initiateCall = useCallback(() => {
    console.log('[OutgoingCall] Initiation appel vers', calleeId, type);
    socketService.initiateCall({
      calleeId,
      type,
      conversationId,
    });
  }, [calleeId, type, conversationId]);

  const handleCancel = () => {
    if (callIdRef.current) {
      socketService.endCall(callIdRef.current);
    }
    endCall();
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.bg} />

      <View style={styles.content}>
        <Text style={styles.callTypeLabel}>
          {type === 'video' ? 'Appel vidéo' : 'Appel audio'}
        </Text>

        <Animated.View style={[styles.avatarPulse, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.avatarRing}>
            <Avatar url={calleeAvatar} name={calleeName} size={110} />
          </View>
        </Animated.View>

        <Text style={styles.calleeName}>{calleeName}</Text>

        <View style={styles.dotsRow}>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  opacity: pulseAnim.interpolate({
                    inputRange: [1, 1.12],
                    outputRange: [0.3 + i * 0.3, 1 - i * 0.15],
                  }),
                },
              ]}
            />
          ))}
        </View>

        <Text style={styles.statusText}>Appel en cours...</Text>

        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
          <Icon name="phone-hangup" size={32} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.cancelLabel}>Annuler</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#14532d' },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  callTypeLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: SIZES.sm,
    marginBottom: 16,
  },
  avatarPulse: { marginBottom: 12 },
  avatarRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calleeName: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.white,
    textAlign: 'center',
  },
  dotsRow: { flexDirection: 'row', gap: 8 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
  },
  statusText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: SIZES.md,
    marginBottom: 48,
  },
  cancelBtn: {
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
  cancelLabel: { color: 'rgba(255,255,255,0.7)', fontSize: SIZES.sm },
});

export default OutgoingCallScreen;
