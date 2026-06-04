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

// Configuration STUN/TURN servers — LAN en priorité
const ICE_SERVERS = {
  iceServers: [
    {
      urls: [
        'turn:192.168.100.195:3478?transport=udp',
        'turn:192.168.100.195:3478?transport=tcp',
      ],
      username: 'cap-epac',
      credential: 'CapEpacTurn2025',
    },
    { urls: 'stun:192.168.100.195:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export interface WebRTCCallConfig {
  callId: string;
  isVideoCall: boolean;
  isInitiator: boolean;
  remoteUserId: string;
}

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callConfig: WebRTCCallConfig | null = null;
  private isAudioMuted = false;
  private isVideoMuted = false;
  private pendingIceCandidates: RTCIceCandidate[] = [];

  // ── FLAG CRITIQUE : empêche toute double initialisation ────
  // Une fois une offre créée/en cours, on ne recrée JAMAIS la PC
  private isInitialized = false;

  // Callbacks
  private onLocalStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onCallEndCallback: (() => void) | null = null;

  // ── Initialiser un appel ───────────────────────────────────
  async initializeCall(config: WebRTCCallConfig): Promise<void> {
    // ✅ FIX PRINCIPAL: Si déjà initialisé pour le même callId → ignorer
    // C'est la cause du "Local fingerprint does not match identity"
    // React peut appeler initializeCall deux fois (StrictMode, re-render)
    if (this.isInitialized && this.callConfig?.callId === config.callId) {
      console.warn('[WebRTC] initializeCall ignoré — déjà initialisé pour callId=', config.callId);
      return;
    }

    // Si c'est un appel différent, nettoyer proprement d'abord
    if (this.isInitialized && this.callConfig?.callId !== config.callId) {
      console.warn('[WebRTC] Nouveau callId détecté — nettoyage avant réinitialisation');
      this.cleanup();
    }

    console.log('[WebRTC] Initialize call:', config);
    this.isInitialized = true;
    this.callConfig = config;

    try {
      // 1. Obtenir le stream local
      await this.getUserMedia(config.isVideoCall);

      // 2. Créer la PeerConnection (une seule fois par session)
      this.peerConnection = this.buildPeerConnection();

      // 3. Ajouter les tracks locaux
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          this.peerConnection!.addTrack(track, this.localStream!);
        });
      }

      // 4. Si appelant → créer et envoyer l'offre
      if (config.isInitiator) {
        await this.createOffer();
      }

      // 5. InCallManager
      InCallManager.start({ media: config.isVideoCall ? 'video' : 'audio' });
      InCallManager.setKeepScreenOn(true);
      InCallManager.setForceSpeakerphoneOn(config.isVideoCall);

      console.log('[WebRTC] Call initialized successfully');
    } catch (error) {
      console.error('[WebRTC] Initialize call error:', error);
      // En cas d'échec, réinitialiser le flag pour permettre une nouvelle tentative
      this.isInitialized = false;
      throw error;
    }
  }

  // ── Obtenir le media local ─────────────────────────────────
  private async getUserMedia(isVideo: boolean): Promise<void> {
    // Si on a déjà un stream actif pour ce type, le réutiliser
    if (this.localStream) {
      console.log('[WebRTC] Stream local déjà disponible, réutilisation');
      if (this.onLocalStreamCallback) {
        this.onLocalStreamCallback(this.localStream);
      }
      return;
    }

    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: isVideo
          ? {
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 24 },
              facingMode: 'user',
            }
          : false,
      };

      const stream = await mediaDevices.getUserMedia(constraints);
      this.localStream = stream;

      if (this.onLocalStreamCallback) {
        this.onLocalStreamCallback(stream);
      }

      console.log('[WebRTC] Local stream obtained');
    } catch (error) {
      console.error('[WebRTC] getUserMedia error:', error);
      throw new Error("Impossible d'accéder au micro/caméra. Vérifiez les permissions.");
    }
  }

  // ── Construire la PeerConnection (appelé UNE SEULE FOIS) ───
  private buildPeerConnection(): RTCPeerConnection {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && this.callConfig) {
        socketService.emit('webrtc:ice-candidate', {
          callId: this.callConfig.callId,
          candidate: event.candidate,
          targetUserId: this.callConfig.remoteUserId,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC] Remote track received');
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(event.streams[0]);
        }
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('[WebRTC] Connection state:', state);
      if (state === 'failed') {
        console.error('[WebRTC] Connexion échouée');
        if (this.onCallEndCallback) this.onCallEndCallback();
      }
      // Ne pas appeler endCall() sur 'disconnected' — peut être temporaire
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE state:', pc.iceConnectionState);
    };

    pc.onsignalingstatechange = () => {
      console.log('[WebRTC] Signaling state:', pc.signalingState);
    };

    console.log('[WebRTC] PeerConnection créée');
    return pc;
  }

  // ── Créer une offre (Appelant) ─────────────────────────────
  private async createOffer(): Promise<void> {
    if (!this.peerConnection || !this.callConfig) return;

    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: this.callConfig.isVideoCall,
      });

      await this.peerConnection.setLocalDescription(offer);

      console.log('[WebRTC] Offre SDP créée et envoyée');
      socketService.emit('webrtc:offer', {
        callId: this.callConfig.callId,
        sdp: offer,
        targetUserId: this.callConfig.remoteUserId,
      });
    } catch (error) {
      console.error('[WebRTC] createOffer error:', error);
      throw error;
    }
  }

  // ── Gérer une offre reçue (Appelé) ────────────────────────
  async handleOffer(sdp: RTCSessionDescription): Promise<void> {
    if (!this.peerConnection || !this.callConfig) {
      console.error('[WebRTC] handleOffer: PeerConnection non initialisée');
      return;
    }

    const state = this.peerConnection.signalingState;
    if (state !== 'stable') {
      console.warn('[WebRTC] handleOffer: état de signalisation inattendu:', state);
      if (state === 'have-remote-offer') {
        // Offre déjà définie — ignorer le doublon
        console.warn('[WebRTC] Offre déjà reçue, ignorée');
        return;
      }
    }

    try {
      console.log('[WebRTC] setRemoteDescription (offre)');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

      // Appliquer les candidats ICE en attente
      for (const candidate of this.pendingIceCandidates) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (_) {}
      }
      this.pendingIceCandidates = [];

      console.log('[WebRTC] Création de la réponse SDP');
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      console.log('[WebRTC] Réponse SDP envoyée');
      socketService.emit('webrtc:answer', {
        callId: this.callConfig.callId,
        sdp: answer,
        targetUserId: this.callConfig.remoteUserId,
      });
    } catch (error) {
      console.error('[WebRTC] handleOffer error:', error);
      throw error;
    }
  }

  // ── Gérer une réponse reçue (Appelant) ────────────────────
  async handleAnswer(sdp: RTCSessionDescription): Promise<void> {
    if (!this.peerConnection) {
      console.error('[WebRTC] handleAnswer: PeerConnection non initialisée');
      return;
    }

    const state = this.peerConnection.signalingState;
    if (state !== 'have-local-offer') {
      console.warn('[WebRTC] handleAnswer: état inattendu:', state, '— ignoré');
      return;
    }

    try {
      console.log('[WebRTC] setRemoteDescription (réponse)');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

      // Appliquer les candidats ICE en attente
      for (const candidate of this.pendingIceCandidates) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (_) {}
      }
      this.pendingIceCandidates = [];
    } catch (error) {
      console.error('[WebRTC] handleAnswer error:', error);
      throw error;
    }
  }

  // ── Gérer un ICE candidate reçu ───────────────────────────
  async handleIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.peerConnection) return;

    if (!this.peerConnection.remoteDescription) {
      // Mettre en file d'attente — remoteDescription pas encore définie
      this.pendingIceCandidates.push(candidate);
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.warn('[WebRTC] addIceCandidate error:', error);
    }
  }

  // ── Toggle Audio ───────────────────────────────────────────
  toggleAudio(): boolean {
    if (!this.localStream) return false;
    this.isAudioMuted = !this.isAudioMuted;
    this.localStream.getAudioTracks().forEach((t) => { t.enabled = !this.isAudioMuted; });
    return this.isAudioMuted;
  }

  // ── Toggle Video ───────────────────────────────────────────
  toggleVideo(): boolean {
    if (!this.localStream) return false;
    this.isVideoMuted = !this.isVideoMuted;
    this.localStream.getVideoTracks().forEach((t) => { t.enabled = !this.isVideoMuted; });
    return this.isVideoMuted;
  }

  // ── Switch Camera ──────────────────────────────────────────
  async switchCamera(): Promise<void> {
    if (!this.localStream) return;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      // @ts-ignore
      videoTrack._switchCamera();
    }
  }

  // ── Toggle Speaker ─────────────────────────────────────────
  toggleSpeaker(enabled: boolean): void {
    InCallManager.setForceSpeakerphoneOn(enabled);
  }

  // ── Nettoyer sans notifier ─────────────────────────────────
  private cleanup(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((t) => t.stop());
      this.remoteStream = null;
    }
    if (this.peerConnection) {
      try { this.peerConnection.close(); } catch (_) {}
      this.peerConnection = null;
    }
    this.callConfig = null;
    this.isInitialized = false;
    this.isAudioMuted = false;
    this.isVideoMuted = false;
    this.pendingIceCandidates = [];
  }

  // ── Terminer l'appel (appelé explicitement) ────────────────
  endCall(): void {
    console.log('[WebRTC] Ending call');
    this.cleanup();
    InCallManager.stop();
    if (this.onCallEndCallback) {
      this.onCallEndCallback();
    }
  }

  // ── Setters callbacks ──────────────────────────────────────
  onLocalStream(callback: (stream: MediaStream) => void): void {
    this.onLocalStreamCallback = callback;
    // Si le stream est déjà prêt (réinitialisation rapide), notifier immédiatement
    if (this.localStream) callback(this.localStream);
  }

  onRemoteStream(callback: (stream: MediaStream) => void): void {
    this.onRemoteStreamCallback = callback;
    if (this.remoteStream) callback(this.remoteStream);
  }

  onCallEnd(callback: () => void): void {
    this.onCallEndCallback = callback;
  }

  // ── Getters ────────────────────────────────────────────────
  getLocalStream(): MediaStream | null { return this.localStream; }
  getRemoteStream(): MediaStream | null { return this.remoteStream; }
  isAudioMutedState(): boolean { return this.isAudioMuted; }
  isVideoMutedState(): boolean { return this.isVideoMuted; }
  isReady(): boolean { return this.isInitialized && this.peerConnection !== null; }
}

export const webrtcService = new WebRTCService();
export { RTCView };
