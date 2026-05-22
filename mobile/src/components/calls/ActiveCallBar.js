// mobile/src/components/calls/ActiveCallBar.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useCallStore from '../../store/callStore';
import useSocketStore from '../../store/socketStore';
import { terminateCall, formatDuration } from '../../services/webrtcService';

export default function ActiveCallBar() {
  const {
    activeCall, isMuted, isOnHold, callDuration,
    toggleMute, toggleHold,
  } = useCallStore();
  const { emit } = useSocketStore();
  const insets = useSafeAreaInsets();

  if (!activeCall) return null;

  const targetId = activeCall.calleeId || activeCall.callerId;

  const handleMute = () => {
    const muted = toggleMute();
    emit('call:toggle-mute', { callId: activeCall.callId, isMuted: muted, targetUserId: targetId });
  };

  const handleHangup = () => terminateCall(activeCall.callId);

  const name = activeCall.calleeName || activeCall.callerName || '...';

  return (
    <View style={[styles.container, { bottom: insets.bottom + 72 }]}>
      {/* Infos */}
      <View style={styles.info}>
        <View style={styles.dot} />
        <View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.duration}>
            {isOnHold ? 'En attente' : formatDuration(callDuration)}
          </Text>
        </View>
      </View>

      {/* Contrôles */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.ctrl, isMuted && styles.ctrlActive]}
          onPress={handleMute}
        >
          <Ionicons
            name={isMuted ? 'mic-off' : 'mic'}
            size={18}
            color={isMuted ? '#16a34a' : '#64748b'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.ctrl, isOnHold && styles.ctrlActive]}
          onPress={toggleHold}
        >
          <Ionicons
            name={isOnHold ? 'play' : 'pause'}
            size={18}
            color={isOnHold ? '#16a34a' : '#64748b'}
          />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.ctrl, styles.ctrlEnd]} onPress={handleHangup}>
          <Ionicons name="call" size={18} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12, right: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  info: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  name: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  duration: { fontSize: 12, color: '#64748b', marginTop: 1 },
  controls: { flexDirection: 'row', gap: 8 },
  ctrl: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center', alignItems: 'center',
  },
  ctrlActive: { backgroundColor: '#dcfce7' },
  ctrlEnd: { backgroundColor: '#ef4444' },
});