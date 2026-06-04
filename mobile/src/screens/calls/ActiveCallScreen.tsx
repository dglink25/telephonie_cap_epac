// src/screens/calls/ActiveCallScreen.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, Animated,
} from 'react-native';
import { useCallStore } from '../../store/callStore';
import { useAuthStore } from '../../store/authStore';
import { socketService } from '../../services/socket';
import { webrtcService, RTCView } from '../../services/webrtc';
import type { MediaStream } from 'react-native-webrtc';
// ✅ FIX: useWebRTCEvents n'écoute plus webrtc:offer (géré globalement dans useSocket)
import { useWebRTCEvents } from '../../hooks/useSocket';
import { Avatar } from '../../components/common';
import { COLORS, SIZES } from '../../utils/constants';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

interface Props {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ ActiveCall: { isIncoming?: boolean } }, 'ActiveCall'>;
}

const formatDuration = (secs: number): string => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const ActiveCallScreen: React.FC<Props> = ({ navigation, route }) => {
  const {
    activeCall, status, setStatus, endCall: storeEndCall,
    pendingOffer, setPendingOffer,
  } = useCallStore();
  const { user } = useAuthStore();

  const [duration, setDuration] = useState(0);
  const [connecting, setConnecting] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const connectingAnim = useRef(new Animated.Value(0)).current;
  const isInitialized = useRef(false);

  // Animation connexion
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

  // Chronomètre
  useEffect(() => {
    if (status === 'active' && !timerRef.current) {
      setConnecting(false);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [status]);

  // Initialiser WebRTC
  useEffect(() => {
    if (!activeCall || isInitialized.current) return;
    isInitialized.current = true;
    initializeWebRTC();

    return () => {
      cleanupCall();
    };
  }, [activeCall]);

  // ✅ FIX CRITIQUE: Surveiller l'offre pendante du store
  // Elle peut arriver AVANT ou APRÈS le montage de ce composant
  useEffect(() => {
    if (!pendingOffer || !activeCall) return;
    if (pendingOffer.callId !== activeCall.callId) return;
    // On est l'appelé → traiter l'offre dès qu'elle est disponible ET que WebRTC est prêt
    if (!isInitialized.current) return;

    console.log('[ActiveCall] Traitement de l\'offre pendante callId=', pendingOffer.callId);
    const offer = pendingOffer;
    // Effacer l'offre du store pour éviter de la retraiter
    setPendingOffer(null);

    webrtcService.handleOffer(offer.sdp).catch((err) => {
      console.error('[ActiveCall] handleOffer error:', err);
      Alert.alert('Erreur', 'Impossible de traiter l\'offre WebRTC', [
        { text: 'OK', onPress: handleEnd },
      ]);
    });
  }, [pendingOffer, activeCall]);

  const initializeWebRTC = async () => {
    if (!activeCall) return;

    try {
      console.log('[ActiveCall] Initializing WebRTC');

      const isVideo = activeCall.type === 'video' || activeCall.type === 'group_video';
      const isInitiator = !route.params?.isIncoming;

      webrtcService.onLocalStream((stream) => {
        console.log('[ActiveCall] Local stream received');
        setLocalStream(stream);
      });

      webrtcService.onRemoteStream((stream) => {
        console.log('[ActiveCall] Remote stream received');
        setRemoteStream(stream);
        setConnecting(false);
        setStatus('active');
      });

      webrtcService.onCallEnd(() => {
        console.log('[ActiveCall] Call ended by WebRTC');
        handleEnd();
      });

      const remoteUserId = isInitiator
        ? (activeCall.calleeId || activeCall.callerId)
        : activeCall.callerId;

      await webrtcService.initializeCall({
        callId: activeCall.callId,
        isVideoCall: isVideo,
        isInitiator,
        remoteUserId,
      });

      setIsSpeakerOn(isVideo);

      // ✅ FIX: Si on est l'appelé ET qu'une offre est déjà en attente dans le store
      // (arrivée avant le montage du composant), la traiter immédiatement
      if (!isInitiator) {
        const currentPending = useCallStore.getState().pendingOffer;
        if (currentPending && currentPending.callId === activeCall.callId) {
          console.log('[ActiveCall] Offre déjà en attente — traitement immédiat');
          setPendingOffer(null);
          await webrtcService.handleOffer(currentPending.sdp);
        }
      }

    } catch (error: any) {
      console.error('[ActiveCall] WebRTC init error:', error);
      Alert.alert(
        'Erreur',
        error.message || 'Impossible d\'établir la connexion',
        [{ text: 'OK', onPress: handleEnd }]
      );
    }
  };

  const cleanupCall = () => {
    console.log('[ActiveCall] Cleanup');
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
    isInitialized.current = false;
  };

  // ✅ FIX: useWebRTCEvents ne prend plus onOffer (géré globalement)
  const handleAnswer = useCallback(async (data: unknown) => {
    const { sdp, callId } = data as { sdp: any; callId: string };
    if (!activeCall || callId !== activeCall.callId) return;
    try {
      console.log('[ActiveCall] Handling answer');
      await webrtcService.handleAnswer(sdp);
    } catch (error) {
      console.error('[ActiveCall] Handle answer error:', error);
    }
  }, [activeCall]);

  const handleIceCandidate = useCallback(async (data: unknown) => {
    const { candidate, callId } = data as { candidate: any; callId: string };
    if (!activeCall || callId !== activeCall.callId) return;
    try {
      await webrtcService.handleIceCandidate(candidate);
    } catch (error) {
      console.error('[ActiveCall] Handle ICE candidate error:', error);
    }
  }, [activeCall]);

  useWebRTCEvents(handleAnswer, handleIceCandidate);

  const handleEnd = () => {
    if (!activeCall) return;
    socketService.endCall(activeCall.callId);
    webrtcService.endCall();
    storeEndCall();
    navigation.replace('Tabs');
  };

  const toggleMute = () => {
    const newMuted = webrtcService.toggleAudio();
    setIsMuted(newMuted);
    if (activeCall) {
      socketService.toggleMute(
        activeCall.callId,
        newMuted,
        activeCall.calleeId || activeCall.callerId
      );
    }
  };

  const toggleVideo = () => {
    const newOff = webrtcService.toggleVideo();
    setIsVideoOff(newOff);
    if (activeCall) {
      socketService.toggleVideo(
        activeCall.callId,
        !newOff,
        activeCall.calleeId || activeCall.callerId
      );
    }
  };

  const toggleSpeaker = () => {
    const newState = !isSpeakerOn;
    webrtcService.toggleSpeaker(newState);
    setIsSpeakerOn(newState);
  };

  const switchCamera = async () => {
    try {
      await webrtcService.switchCamera();
    } catch (error) {
      console.error('[ActiveCall] Switch camera error:', error);
    }
  };

  if (!activeCall) return null;

  const isVideo = activeCall.type === 'video' || activeCall.type === 'group_video';

  return (
    <View style={styles.container}>
      <View style={styles.bg} />

      {/* Remote video */}
      {isVideo && remoteStream && !isVideoOff ? (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={styles.remoteVideo}
          objectFit="cover"
          mirror={false}
        />
      ) : isVideo ? (
        <View style={styles.remoteVideoPlaceholder}>
          <Avatar
            url={activeCall.callerAvatar}
            name={activeCall.callerName}
            size={120}
          />
          <Text style={styles.remoteVideoText}>Vidéo désactivée</Text>
        </View>
      ) : null}

      {/* Local video thumbnail */}
      {isVideo && localStream && (
        <TouchableOpacity
          style={styles.localVideo}
          onPress={switchCamera}
          activeOpacity={0.8}
        >
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.localVideoView}
            objectFit="cover"
            mirror={true}
          />
          <View style={styles.switchCameraBtn}>
            <Icon name="camera-flip" size={20} color={COLORS.white} />
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.content}>
        {(!isVideo || isVideoOff || !remoteStream) && (
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

        <View style={styles.statusRow}>
          {connecting ? (
            <Animated.Text style={[styles.statusText, { opacity: connectingAnim }]}>
              Connexion en cours...
            </Animated.Text>
          ) : (
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          )}
        </View>

        <View style={styles.controls}>
          <View style={styles.controlRow}>
            <View style={styles.ctrlGroup}>
              <TouchableOpacity
                style={[styles.ctrlBtn, isMuted && styles.ctrlBtnActive]}
                onPress={toggleMute}
              >
                <Icon
                  name={isMuted ? 'microphone-off' : 'microphone'}
                  size={26}
                  color={COLORS.white}
                />
              </TouchableOpacity>
              <Text style={styles.ctrlLabel}>{isMuted ? 'Muet' : 'Micro'}</Text>
            </View>

            <View style={styles.ctrlGroup}>
              <TouchableOpacity style={styles.endBtn} onPress={handleEnd}>
                <Icon name="phone-hangup" size={32} color={COLORS.white} />
              </TouchableOpacity>
              <Text style={styles.ctrlLabel}>Raccrocher</Text>
            </View>

            <View style={styles.ctrlGroup}>
              <TouchableOpacity
                style={[styles.ctrlBtn, isSpeakerOn && styles.ctrlBtnActive]}
                onPress={toggleSpeaker}
              >
                <Icon
                  name={isSpeakerOn ? 'volume-high' : 'volume-medium'}
                  size={26}
                  color={COLORS.white}
                />
              </TouchableOpacity>
              <Text style={styles.ctrlLabel}>HP</Text>
            </View>
          </View>

          {isVideo && (
            <View style={styles.controlRow}>
              <View style={styles.ctrlGroup}>
                <TouchableOpacity
                  style={[styles.ctrlBtn, isVideoOff && styles.ctrlBtnActive]}
                  onPress={toggleVideo}
                >
                  <Icon
                    name={isVideoOff ? 'video-off' : 'video'}
                    size={26}
                    color={COLORS.white}
                  />
                </TouchableOpacity>
                <Text style={styles.ctrlLabel}>{isVideoOff ? 'Vidéo off' : 'Vidéo'}</Text>
              </View>

              <View style={styles.ctrlGroup}>
                <TouchableOpacity style={styles.ctrlBtn} onPress={switchCamera}>
                  <Icon name="camera-flip" size={26} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.ctrlLabel}>Retourner</Text>
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
    backgroundColor: '#000',
  },
  remoteVideoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  remoteVideoText: { color: COLORS.white, fontSize: SIZES.lg, opacity: 0.7 },
  localVideo: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.white,
    zIndex: 10,
    backgroundColor: '#374151',
  },
  localVideoView: { width: '100%', height: '100%' },
  switchCameraBtn: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
  },
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
});

export default ActiveCallScreen;
