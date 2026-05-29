import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';


const SOCKET_URL = 'https://192.168.100.195';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private connectionPromise: Promise<void> | null = null;

  async connect(): Promise<void> {
    // Éviter les connexions multiples simultanées
    if (this.socket?.connected) return;
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = this._doConnect();
    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async _doConnect(): Promise<void> {
    const token = await AsyncStorage.getItem('accessToken');
    if (!token) throw new Error('Token manquant — connexion socket impossible');

    // Fermer proprement une ancienne connexion
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    return new Promise<void>((resolve, reject) => {
      // ── IMPORTANT pour Android ──────────────────────────────────
      // Sur React Native/Android, la vérification SSL est gérée par
      // OkHttp via network_security_config.xml.
      // L'option rejectUnauthorized est une option Node.js qui N'A
      // AUCUN EFFET sur la couche réseau Android.
      // Il ne faut PAS passer d'options SSL ici.
      // ────────────────────────────────────────────────────────────
      this.socket = io(SOCKET_URL, {
        auth: { token },
        // Essayer websocket en premier, polling en fallback
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 8000,
        randomizationFactor: 0.5,
        timeout: 15000,
        // Forcer la connexion sécurisée (wss:// et https://)
        secure: true,
        // Pas d'option rejectUnauthorized ici — géré par Android
      });

      const onConnect = () => {
        console.log('[Socket] ✅ Connecté:', this.socket?.id);
        this.reconnectAttempts = 0;
        this._emit('socket:connected', {});
        resolve();
        cleanup();
      };

      const onConnectError = (error: Error) => {
        console.error('[Socket] ❌ Erreur connexion:', error.message);
        this.reconnectAttempts++;
        this._emit('socket:error', { error: error.message });
        // Ne rejeter que si c'est la première tentative
        if (this.reconnectAttempts === 1) {
          reject(error);
          cleanup();
        }
      };

      const cleanup = () => {
        this.socket?.off('connect', onConnect);
        this.socket?.off('connect_error', onConnectError);
      };

      this.socket.once('connect', onConnect);
      this.socket.once('connect_error', onConnectError);

      // Événements permanents (pas once)
      this.socket.on('disconnect', (reason) => {
        console.log('[Socket] Déconnecté:', reason);
        this._emit('socket:disconnected', { reason });
      });

      this.socket.on('reconnect', (attempt: number) => {
        console.log('[Socket] Reconnecté après', attempt, 'tentatives');
        this._emit('socket:connected', {});
      });

      this.socket.on('reconnect_error', (error: Error) => {
        console.error('[Socket] Échec reconnexion:', error.message);
      });

      this.socket.on('reconnect_failed', () => {
        console.error('[Socket] Reconnexion abandonnée');
        this._emit('socket:error', { error: 'Reconnexion abandonnée' });
      });

      // ── Rediriger tous les événements serveur ─────────────────
      const serverEvents = [
        'message:new',
        'message:edited',
        'message:deleted',
        'message:reaction_added',
        'message:reaction_removed',
        'message:typing',
        'conversation:new',
        'conversation:read',
        'user:presence',
        'call:incoming',
        'call:initiated',
        'call:accepted',
        'call:rejected',
        'call:ended',
        'call:error',
        'call:member_rejected',
        'call:mute-changed',
        'call:video-changed',
        'webrtc:offer',
        'webrtc:answer',
        'webrtc:ice-candidate',
        'group:updated',
        'group:joined',
        'group:left',
        'group:removed',
        'group:members_updated',
      ];

      serverEvents.forEach((event) => {
        this.socket?.on(event, (data: unknown) => {
          this._emit(event, data);
        });
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.reconnectAttempts = 0;
    this.connectionPromise = null;
  }

  // ── Émettre un événement vers le serveur ──────────────────────
  sendEvent(event: string, data: unknown): void {
    if (!this.socket?.connected) {
      console.warn('[Socket] Pas connecté — événement ignoré:', event);
      return;
    }
    this.socket.emit(event, data);
  }

  // ── S'abonner à un événement ──────────────────────────────────
  on(event: string, callback: (...args: unknown[]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    // Retourner une fonction de désabonnement
    return () => this.off(event, callback);
  }

  off(event: string, callback: (...args: unknown[]) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  private _emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.error('[Socket] Erreur listener:', event, e);
      }
    });
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // ── Raccourcis ────────────────────────────────────────────────

  sendTyping(conversationId: string, isTyping: boolean): void {
    this.sendEvent('message:typing', { conversationId, isTyping });
  }

  joinConversation(conversationId: string): void {
    this.sendEvent('conversation:join', conversationId);
  }

  leaveConversation(conversationId: string): void {
    this.sendEvent('conversation:leave', conversationId);
  }

  setPresence(status: string): void {
    this.sendEvent('user:set-status', { status });
  }

  initiateCall(data: {
    calleeId?: string;
    type: string;
    callId?: string;
    conversationId?: string;
  }): void {
    this.sendEvent('call:initiate', data);
  }

  acceptCall(callId: string): void {
    this.sendEvent('call:accept', { callId });
  }

  rejectCall(callId: string): void {
    this.sendEvent('call:reject', { callId });
  }

  endCall(callId: string): void {
    this.sendEvent('call:end', { callId });
  }

  sendOffer(targetUserId: string, sdp: unknown, callId: string): void {
    this.sendEvent('webrtc:offer', { targetUserId, sdp, callId });
  }

  sendAnswer(targetUserId: string, sdp: unknown, callId: string): void {
    this.sendEvent('webrtc:answer', { targetUserId, sdp, callId });
  }

  sendIceCandidate(
    targetUserId: string,
    candidate: unknown,
    callId: string
  ): void {
    this.sendEvent('webrtc:ice-candidate', { targetUserId, candidate, callId });
  }

  toggleMute(callId: string, isMuted: boolean, targetUserId: string): void {
    this.sendEvent('call:toggle-mute', { callId, isMuted, targetUserId });
  }

  toggleVideo(callId: string, videoOn: boolean, targetUserId: string): void {
    this.sendEvent('call:toggle-video', { callId, videoOn, targetUserId });
  }
}

export const socketService = new SocketService();