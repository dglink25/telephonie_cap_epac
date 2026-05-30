// src/screens/calls/ActiveCallScreen.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, Platform, Animated,
} from 'react-native';
import { useCallStore } from '../../store/callStore';
import { useAuthStore } from '../../store/authStore';
import { socketService } from '../../services/socket';
import { useWebRTCEvents } from '../../hooks/useSocket';
import { Avatar } from '../../components/common';
import { COLORS, SIZES } from '../../utils/constants';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

interface Props {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ ActiveCall: { isIncoming?: boolean } }, 'ActiveCall'>;
}

// Formatage durée HH:MM:SS
const formatDuration = (secs: number): string => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const ActiveCallScreen: React.FC<Props> = ({ navigation, route }) => {
  const { activeCall, status, isMuted, isVideoOff, isSpeakerOn,
    setMuted, setVideoOff, setSpeaker, setStatus, endCall } = useCallStore();
  const { user } = useAuthStore();

  const [duration, setDuration] = useState(0);
  const [connecting, setConnecting] = useState(status === 'connecting');
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const connectingAnim = useRef(new Animated.Value(0)).current;

  // Animation points de connexion
  useEffect(() => {
    if (connecting) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(connectingAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(connectingAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [connecting]);

  // Démarrer le chrono quand l'appel est actif
  useEffect(() => {
    if (status === 'active') {
      setConnecting(false);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [status]);

  // Initialiser WebRTC si appelant
  useEffect(() => {
    if (!route.params?.isIncoming && activeCall) {
      initPeerConnection();
    }
    return () => {
      peerConnection.current?.close();
    };
  }, []);

  const initPeerConnection = useCallback(async () => {
    try {
      // Configuration STUN locale (réseau LAN)
      const config: RTCConfiguration = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      };

      // NOTE: En production React Native, utiliser react-native-webrtc
      // import { RTCPeerConnection, RTCSessionDescription, mediaDevices } from 'react-native-webrtc';
      // Ici on simule l'interface pour la structure du code

      if (!activeCall) return;

      // Créer la connexion pair
      // const pc = new RTCPeerConnection(config);
      // peerConnection.current = pc;

      // Obtenir le flux local
      // const stream = await mediaDevices.getUserMedia({
      //   audio: true,
      //   video: activeCall.type === 'video' || activeCall.type === 'group_video',
      // });
      // stream.getTracks().forEach(track => pc.addTrack(track, stream));
      // useCallStore.getState().setLocalStream(stream);

      // Créer l'offre SDP
      // const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      // await pc.setLocalDescription(offer);
      // socketService.sendOffer(activeCall.calleeId || activeCall.callerId, offer, activeCall.callId);

      setStatus('active'); // Simulé — sera géré par les événements WebRTC
    } catch (err) {
      console.error('WebRTC init error:', err);
      Alert.alert('Erreur', 'Impossible d\'établir la connexion audio');
    }
  }, [activeCall]);

  // Gestion des événements WebRTC entrants
  const handleOffer = useCallback(async (data: unknown) => {
    const { sdp, callId, fromUserId } = data as { sdp: unknown; callId: string; fromUserId: string };
    if (!activeCall || callId !== activeCall.callId) return;
    // await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(sdp));
    // const answer = await peerConnection.current?.createAnswer();
    // await peerConnection.current?.setLocalDescription(answer);
    // socketService.sendAnswer(fromUserId, answer, callId);
    setStatus('active');
  }, [activeCall]);

  const handleAnswer = useCallback(async (data: unknown) => {
    const { sdp } = data as { sdp: unknown };
    // await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(sdp));
    setStatus('active');
  }, []);

  const handleIceCandidate = useCallback(async (data: unknown) => {
    const { candidate } = data as { candidate: unknown };
    // await peerConnection.current?.addIceCandidate(new RTCIceCandidate(candidate));
  }, []);

  useWebRTCEvents(handleOffer, handleAnswer, handleIceCandidate);

  const handleEnd = () => {
    if (!activeCall) return;
    socketService.endCall(activeCall.callId);
    peerConnection.current?.close();
    endCall();
    navigation.replace('Tabs');
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setMuted(newMuted);
    // peerConnection.current?.getSenders()
    //   .find(s => s.track?.kind === 'audio')
    //   ?.track && (track.enabled = !newMuted);
    if (activeCall) {
      socketService.toggleMute(
        activeCall.callId,
        newMuted,
        activeCall.calleeId || activeCall.callerId
      );
    }
  };

  const toggleVideo = () => {
    const newOff = !isVideoOff;
    setVideoOff(newOff);
    if (activeCall) {
      socketService.toggleVideo(
        activeCall.callId,
        !newOff,
        activeCall.calleeId || activeCall.callerId
      );
    }
  };

  const toggleSpeaker = () => setSpeaker(!isSpeakerOn);

  if (!activeCall) return null;

  const isVideo = activeCall.type === 'video' || activeCall.type === 'group_video';

  return (
    <View style={styles.container}>
      <View style={styles.bg} />

      {/* Remote video placeholder */}
      {isVideo && !isVideoOff && (
        <View style={styles.remoteVideo}>
          <Text style={styles.remoteVideoText}>📹 Flux vidéo distant</Text>
          <Text style={styles.remoteVideoSub}>(react-native-webrtc requis)</Text>
        </View>
      )}

      {/* Local video thumbnail */}
      {isVideo && (
        <View style={styles.localVideo}>
          <Text style={styles.localVideoText}>📷</Text>
        </View>
      )}

      <View style={styles.content}>
        {/* Info appelant */}
        {(!isVideo || isVideoOff) && (
          <View style={styles.callerInfo}>
            <Avatar
              url={activeCall.callerAvatar}
              name={activeCall.callerName}
              size={90}
            />
            <Text style={styles.callerName}>{activeCall.callerName}</Text>
            {activeCall.isGroupCall && (
              <Text style={styles.groupName}>{activeCall.groupName}</Text>
            )}
          </View>
        )}

        {/* Statut / Durée */}
        <View style={styles.statusRow}>
          {connecting ? (
            <Animated.Text style={[styles.statusText, { opacity: connectingAnim }]}>
              Connexion en cours...
            </Animated.Text>
          ) : (
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          )}
        </View>

        {/* Contrôles */}
        <View style={styles.controls}>
          <View style={styles.controlRow}>
            {/* Micro */}
            <View style={styles.ctrlGroup}>
              <TouchableOpacity
                style={[styles.ctrlBtn, isMuted && styles.ctrlBtnActive]}
                onPress={toggleMute}
              >
                <Text style={styles.ctrlIcon}>{isMuted ? '🔇' : '🎤'}</Text>
              </TouchableOpacity>
              <Text style={styles.ctrlLabel}>{isMuted ? 'Muet' : 'Micro'}</Text>
            </View>

            {/* Fin d'appel */}
            <View style={styles.ctrlGroup}>
              <TouchableOpacity style={styles.endBtn} onPress={handleEnd}>
                <Text style={styles.endBtnIcon}>📵</Text>
              </TouchableOpacity>
              <Text style={styles.ctrlLabel}>Raccrocher</Text>
            </View>

            {/* Haut-parleur */}
            <View style={styles.ctrlGroup}>
              <TouchableOpacity
                style={[styles.ctrlBtn, isSpeakerOn && styles.ctrlBtnActive]}
                onPress={toggleSpeaker}
              >
                <Text style={styles.ctrlIcon}>{isSpeakerOn ? '🔊' : '🔈'}</Text>
              </TouchableOpacity>
              <Text style={styles.ctrlLabel}>HP</Text>
            </View>
          </View>

          {/* Ligne 2 : Vidéo si applicable */}
          {isVideo && (
            <View style={styles.controlRow}>
              <View style={styles.ctrlGroup}>
                <TouchableOpacity
                  style={[styles.ctrlBtn, isVideoOff && styles.ctrlBtnActive]}
                  onPress={toggleVideo}
                >
                  <Text style={styles.ctrlIcon}>{isVideoOff ? '📵' : '📹'}</Text>
                </TouchableOpacity>
                <Text style={styles.ctrlLabel}>{isVideoOff ? 'Vidéo off' : 'Vidéo'}</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#064e3b' },
  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remoteVideoText: { color: COLORS.white, fontSize: SIZES.xl, opacity: 0.6 },
  remoteVideoSub: { color: 'rgba(255,255,255,0.4)', fontSize: SIZES.xs, marginTop: 6 },
  localVideo: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 90,
    height: 130,
    backgroundColor: '#374151',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
    zIndex: 10,
  },
  localVideoText: { fontSize: 30 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 80,
    paddingBottom: 50,
    paddingHorizontal: 24,
  },
  callerInfo: { alignItems: 'center', gap: 14 },
  callerName: { fontSize: 26, fontWeight: '700', color: COLORS.white, textAlign: 'center' },
  groupName: { fontSize: SIZES.md, color: 'rgba(255,255,255,0.7)' },
  statusRow: { alignItems: 'center' },
  statusText: { color: 'rgba(255,255,255,0.7)', fontSize: SIZES.lg },
  durationText: { color: COLORS.white, fontSize: 28, fontWeight: '300', letterSpacing: 2 },
  controls: { width: '100%', gap: 20 },
  controlRow: { flexDirection: 'row', justifyContent: 'space-around' },
  ctrlGroup: { alignItems: 'center', gap: 8 },
  ctrlBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  ctrlBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderColor: COLORS.white,
  },
  ctrlIcon: { fontSize: 24 },
  ctrlLabel: { color: 'rgba(255,255,255,0.75)', fontSize: SIZES.xs },
  endBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  endBtnIcon: { fontSize: 30 },
});

export default ActiveCallScreen;
