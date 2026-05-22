// mobile/src/components/calls/IncomingCallModal.js
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import useCallStore from '../../store/callStore';
import useSocketStore from '../../store/socketStore';
import Toast from 'react-native-toast-message';

export default function IncomingCallModal() {
  const { incomingCall, clearIncomingCall } = useCallStore();
  const { socket } = useSocketStore();
  const [accepting, setAccepting] = useState(false);
  const pendingOfferRef = useRef(null);
  const soundRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Animation de pulsation
  useEffect(() => {
    if (!incomingCall) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [incomingCall]);

  // Sonnerie
  useEffect(() => {
    let mounted = true;
    if (incomingCall) {
      Audio.Sound.createAsync(
        require('../../../assets/sounds/ringtone.wav'),
        { isLooping: true, volume: 1.0 }
      ).then(({ sound }) => {
        if (mounted) {
          soundRef.current = sound;
          sound.playAsync().catch(() => {});
        }
      }).catch(() => {});
    } else {
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    return () => {
      mounted = false;
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, [!!incomingCall]);

  useEffect(() => {
    if (!incomingCall) {
      pendingOfferRef.current = null;
      setAccepting(false);
    }
  }, [incomingCall]);

  useEffect(() => {
    if (!socket || !incomingCall) return;

    const onOffer = ({ sdp, callId, fromUserId }) => {
      pendingOfferRef.current = { sdp, callId, fromUserId };
    };

    const onEnded = ({ callId }) => {
      if (incomingCall?.callId === callId) {
        clearIncomingCall();
        Toast.show({ type: 'info', text1: 'Appel annulé' });
      }
    };

    socket.on('webrtc:offer', onOffer);
    socket.on('call:ended', onEnded);
    return () => {
      socket.off('webrtc:offer', onOffer);
      socket.off('call:ended', onEnded);
    };
  }, [socket, incomingCall]);

  const waitForOffer = (ms) =>
    new Promise((resolve) => {
      if (pendingOfferRef.current) return resolve(pendingOfferRef.current);
      const iv = setInterval(() => {
        if (pendingOfferRef.current) {
          clearInterval(iv);
          clearTimeout(to);
          resolve(pendingOfferRef.current);
        }
      }, 50);
      const to = setTimeout(() => { clearInterval(iv); resolve(null); }, ms);
    });

  const handleAccept = async () => {
    if (!incomingCall || accepting) return;
    setAccepting(true);
    soundRef.current?.stopAsync().catch(() => {});

    try {
      socket.emit('call:accept', { callId: incomingCall.callId });
      const offer = await waitForOffer(15000);
      if (!offer) {
        Toast.show({ type: 'error', text1: 'Délai dépassé', text2: "Réessayez l'appel" });
        socket.emit('call:reject', { callId: incomingCall.callId });
        clearIncomingCall();
        return;
      }
      // Import dynamique du service WebRTC
      const { answerIncomingCall, addIceCandidate } = await import('../../services/webrtcService');
      await answerIncomingCall(offer.fromUserId, offer.sdp, offer.callId, incomingCall.type);
      clearIncomingCall();
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Erreur micro', text2: err.message });
      socket.emit('call:reject', { callId: incomingCall.callId });
      clearIncomingCall();
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = () => {
    if (!incomingCall) return;
    soundRef.current?.stopAsync().catch(() => {});
    socket?.emit('call:reject', { callId: incomingCall.callId });
    clearIncomingCall();
  };

  if (!incomingCall) return null;

  return (
    <Modal transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Animated.View style={[styles.avatarWrap, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarLetter}>
                  {incomingCall.callerName?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            </Animated.View>
            <Text style={styles.subtitle}>
              Appel {incomingCall.type === 'video' ? 'vidéo' : 'audio'} entrant
            </Text>
            <Text style={styles.callerName}>{incomingCall.callerName}</Text>
            {accepting && (
              <Text style={styles.connecting}>Connexion en cours…</Text>
            )}
          </View>

          {/* Boutons */}
          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.btn, styles.btnReject]}
              onPress={handleReject}
              disabled={accepting}
            >
              <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              <Text style={styles.btnLabel}>Refuser</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnAccept]}
              onPress={handleAccept}
              disabled={accepting}
            >
              <Ionicons name={accepting ? 'sync' : 'call'} size={28} color="#fff" />
              <Text style={styles.btnLabel}>{accepting ? 'Connexion…' : 'Accepter'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 28,
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#16a34a',
    paddingVertical: 36,
    alignItems: 'center',
    gap: 8,
  },
  avatarWrap: { marginBottom: 4 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#15803d',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarLetter: { fontSize: 32, fontWeight: '700', color: '#fff' },
  subtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 },
  callerName: { fontSize: 24, fontWeight: '700', color: '#fff' },
  connecting: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 },
  buttons: {
    flexDirection: 'row',
    padding: 24,
    gap: 16,
    justifyContent: 'center',
  },
  btn: {
    flex: 1, borderRadius: 20, paddingVertical: 16,
    alignItems: 'center', gap: 6,
  },
  btnReject: { backgroundColor: '#ef4444' },
  btnAccept: { backgroundColor: '#16a34a' },
  btnLabel: { color: '#fff', fontSize: 13, fontWeight: '600' },
});