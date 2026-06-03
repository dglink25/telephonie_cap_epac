// src/services/webrtc.ts
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
  mediaDevices,
  RTCView,
} from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import { socketService } from './socket';

// Configuration STUN/TURN servers
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // TODO: Ajouter vos propres TURN servers pour production
    // {
    //   urls: 'turn:your-turn-server.com:3478',
    //   username: 'username',
    //   credential: 'password',
    // },
  ],
};

export interface WebRTCCallConfig {
  callId: string;
  isVideoCall: boolean;
  isInitiator: boolean; // true si on initie l'appel
  remoteUserId: string;
}

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callConfig: WebRTCCallConfig | null = null;
  private isAudioMuted = false;
  private isVideoMuted = false;

  // Callbacks
  private onLocalStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onCallEndCallback: (() => void) | null = null;

  // ── Initialiser un appel ───────────────────────────────────
  async initializeCall(config: WebRTCCallConfig): Promise<void> {
    console.log('[WebRTC] Initialize call:', config);
    this.callConfig = config;

    try {
      // 1. Obtenir le stream local (audio/vidéo)
      await this.getUserMedia(config.isVideoCall);

      // 2. Créer la peer connection
      this.createPeerConnection();

      // 3. Ajouter le stream local à la connexion
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          this.peerConnection?.addTrack(track, this.localStream!);
        });
      }

      // 4. Si on est l'initiateur, créer l'offre
      if (config.isInitiator) {
        await this.createOffer();
      }

      // 5. Configurer InCallManager
      InCallManager.start({ media: config.isVideoCall ? 'video' : 'audio' });
      InCallManager.setKeepScreenOn(true);
      InCallManager.setForceSpeakerphoneOn(config.isVideoCall);

      console.log('[WebRTC] Call initialized successfully');
    } catch (error) {
      console.error('[WebRTC] Initialize call error:', error);
      throw error;
    }
  }

  // ── Obtenir le media local ─────────────────────────────────
  private async getUserMedia(isVideo: boolean): Promise<void> {
    try {
      const constraints = {
        audio: true,
        video: isVideo
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
              facingMode: 'user', // Caméra frontale
            }
          : false,
      };

      const stream = await mediaDevices.getUserMedia(constraints);
      this.localStream = stream;

      if (this.onLocalStreamCallback) {
        this.onLocalStreamCallback(stream);
      }

      console.log('[WebRTC] Local stream obtained:', stream.toURL());
    } catch (error) {
      console.error('[WebRTC] getUserMedia error:', error);
      throw new Error('Impossible d\'accéder au micro/caméra');
    }
  }

  // ── Créer la PeerConnection ────────────────────────────────
  private createPeerConnection(): void {
    this.peerConnection = new RTCPeerConnection(ICE_SERVERS);

    // Événement : ICE candidate généré
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.callConfig) {
        console.log('[WebRTC] Sending ICE candidate');
        socketService.emit('webrtc:ice-candidate', {
          callId: this.callConfig.callId,
          candidate: event.candidate,
          targetUserId: this.callConfig.remoteUserId,
        });
      }
    };

    // Événement : Track distant reçu
    this.peerConnection.ontrack = (event) => {
      console.log('[WebRTC] Remote track received:', event.streams[0].toURL());
      this.remoteStream = event.streams[0];

      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(event.streams[0]);
      }
    };

    // Événement : Changement d'état de connexion
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('[WebRTC] Connection state:', state);

      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.endCall();
      }
    };

    // Événement : Changement d'état ICE
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE state:', this.peerConnection?.iceConnectionState);
    };

    console.log('[WebRTC] PeerConnection created');
  }

  // ── Créer une offre (Caller) ───────────────────────────────
  private async createOffer(): Promise<void> {
    if (!this.peerConnection || !this.callConfig) return;

    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: this.callConfig.isVideoCall,
      });

      await this.peerConnection.setLocalDescription(offer);

      console.log('[WebRTC] Sending offer');
      socketService.emit('webrtc:offer', {
        callId: this.callConfig.callId,
        sdp: offer,
        targetUserId: this.callConfig.remoteUserId,
      });
    } catch (error) {
      console.error('[WebRTC] Create offer error:', error);
      throw error;
    }
  }

  // ── Gérer une offre reçue (Callee) ─────────────────────────
  async handleOffer(sdp: RTCSessionDescription): Promise<void> {
    if (!this.peerConnection || !this.callConfig) return;

    try {
      console.log('[WebRTC] Setting remote description (offer)');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

      console.log('[WebRTC] Creating answer');
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      console.log('[WebRTC] Sending answer');
      socketService.emit('webrtc:answer', {
        callId: this.callConfig.callId,
        sdp: answer,
        targetUserId: this.callConfig.remoteUserId,
      });
    } catch (error) {
      console.error('[WebRTC] Handle offer error:', error);
      throw error;
    }
  }

  // ── Gérer une réponse reçue (Caller) ───────────────────────
  async handleAnswer(sdp: RTCSessionDescription): Promise<void> {
    if (!this.peerConnection) return;

    try {
      console.log('[WebRTC] Setting remote description (answer)');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (error) {
      console.error('[WebRTC] Handle answer error:', error);
      throw error;
    }
  }

  // ── Gérer un ICE candidate reçu ────────────────────────────
  async handleIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.peerConnection) return;

    try {
      console.log('[WebRTC] Adding ICE candidate');
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('[WebRTC] Add ICE candidate error:', error);
    }
  }

  // ── Toggle Audio (Mute/Unmute) ─────────────────────────────
  toggleAudio(): boolean {
    if (!this.localStream) return false;

    this.isAudioMuted = !this.isAudioMuted;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !this.isAudioMuted;
    });

    console.log('[WebRTC] Audio muted:', this.isAudioMuted);
    return this.isAudioMuted;
  }

  // ── Toggle Video (On/Off) ──────────────────────────────────
  toggleVideo(): boolean {
    if (!this.localStream) return false;

    this.isVideoMuted = !this.isVideoMuted;
    this.localStream.getVideoTracks().forEach((track) => {
      track.enabled = !this.isVideoMuted;
    });

    console.log('[WebRTC] Video muted:', this.isVideoMuted);
    return this.isVideoMuted;
  }

  // ── Switch Camera (Front/Back) ─────────────────────────────
  async switchCamera(): Promise<void> {
    if (!this.localStream) return;

    try {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        // @ts-ignore - _switchCamera existe sur React Native WebRTC
        videoTrack._switchCamera();
        console.log('[WebRTC] Camera switched');
      }
    } catch (error) {
      console.error('[WebRTC] Switch camera error:', error);
    }
  }

  // ── Toggle Speaker ─────────────────────────────────────────
  toggleSpeaker(enabled: boolean): void {
    InCallManager.setForceSpeakerphoneOn(enabled);
    console.log('[WebRTC] Speaker enabled:', enabled);
  }

  // ── Terminer l'appel ───────────────────────────────────────
  endCall(): void {
    console.log('[WebRTC] Ending call');

    // Arrêter les tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop());
      this.remoteStream = null;
    }

    // Fermer la peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // InCallManager cleanup
    InCallManager.stop();

    // Reset état
    this.callConfig = null;
    this.isAudioMuted = false;
    this.isVideoMuted = false;

    // Callback
    if (this.onCallEndCallback) {
      this.onCallEndCallback();
    }

    console.log('[WebRTC] Call ended');
  }

  // ── Setters pour callbacks ─────────────────────────────────
  onLocalStream(callback: (stream: MediaStream) => void): void {
    this.onLocalStreamCallback = callback;
  }

  onRemoteStream(callback: (stream: MediaStream) => void): void {
    this.onRemoteStreamCallback = callback;
  }

  onCallEnd(callback: () => void): void {
    this.onCallEndCallback = callback;
  }

  // ── Getters ────────────────────────────────────────────────
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  isAudioMutedState(): boolean {
    return this.isAudioMuted;
  }

  isVideoMutedState(): boolean {
    return this.isVideoMuted;
  }
}

export const webrtcService = new WebRTCService();
export { RTCView }; // Export pour utiliser dans les composants
