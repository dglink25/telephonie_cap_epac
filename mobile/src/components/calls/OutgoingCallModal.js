// mobile/src/components/calls/OutgoingCallModal.js
import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import useCallStore from '../../store/callStore';
import { terminateCall } from '../../services/webrtcService';

export default function OutgoingCallModal() {
  const { outgoingCall } = useCallStore();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const soundRef = useRef(null);

  // Animation
  useEffect(() => {
    if (!outgoingCall) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [outgoingCall]);

  // Son de retour
  useEffect(() => {
    let mounted = true;
    if (outgoingCall) {
      Audio.Sound.createAsync(
        require('../../../assets/sounds/ringback.wav'),
        { isLooping: true, volume: 0.8 }
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
  }, [!!outgoingCall]);

  const handleCancel = () => {
    if (!outgoingCall) return;
    terminateCall(outgoingCall.callId);
  };

  if (!outgoingCall) return null;

  return (
    <Modal transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.pulseContainer}>
              <Animated.View
                style={[styles.pulseRing, { transform: [{ scale: pulseAnim }], opacity: 0.3 }]}
              />
              <View style={styles.avatar}>
                <Text style={styles.avatarLetter}>
                  {outgoingCall.calleeInitial || '?'}
                </Text>
              </View>
            </View>
            <Text style={styles.status}>
              Appel {outgoingCall.type === 'video' ? 'vidéo' : 'audio'} en cours…
            </Text>
            <Text style={styles.calleeName}>{outgoingCall.calleeName}</Text>
            <Text style={styles.waiting}>En attente de réponse</Text>
          </View>

          <View style={styles.btnContainer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
            <Text style={styles.cancelLabel}>Annuler</Text>
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
    backgroundColor: '#15803d',
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  pulseContainer: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  pulseRing: {
    position: 'absolute',
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#fff',
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#16a34a',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarLetter: { fontSize: 32, fontWeight: '700', color: '#fff' },
  status: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  calleeName: { fontSize: 24, fontWeight: '700', color: '#fff' },
  waiting: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  btnContainer: { paddingVertical: 28, alignItems: 'center', gap: 8 },
  cancelBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#ef4444',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  cancelLabel: { fontSize: 13, fontWeight: '600', color: '#64748b' },
});