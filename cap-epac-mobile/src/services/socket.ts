// src/services/socket.ts
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOCKET_URL = 'https://192.168.100.195'; // ← IP du serveur LAN

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  async connect(): Promise<void> {
    if (this.socket?.connected) return;

    const token = await AsyncStorage.getItem('accessToken');
    if (!token) throw new Error('Token manquant');

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      // Désactiver vérif SSL en dev
      rejectUnauthorized: false,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connecté:', this.socket?.id);
      this.reconnectAttempts = 0;
      this.emit('socket:connected', {});
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Déconnecté:', reason);
      this.emit('socket:disconnected', { reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Erreur connexion:', error.message);
      this.reconnectAttempts++;
      this.emit('socket:error', { error: error.message });
    });

    // Rediriger tous les événements du serveur vers les listeners internes
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
        this.emit(event, data);
      });
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  // Émettre un événement vers le serveur
  sendEvent(event: string, data: unknown): void {
    if (!this.socket?.connected) {
      console.warn('[Socket] Tentative d\'émission sans connexion:', event);
      return;
    }
    this.socket.emit(event, data);
  }

  // S'abonner à un événement
  on(event: string, callback: (...args: unknown[]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: (...args: unknown[]) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: unknown): void {
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

  // Raccourcis pour événements courants
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

  // Appels
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

  sendIceCandidate(targetUserId: string, candidate: unknown, callId: string): void {
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
