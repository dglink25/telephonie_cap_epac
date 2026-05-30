// src/store/callStore.ts
import { create } from 'zustand';

export type CallStatus =
  | 'idle'
  | 'calling'
  | 'incoming'
  | 'connecting'
  | 'active'
  | 'ended';

export interface ActiveCall {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string | null;
  calleeId?: string;
  type: 'audio' | 'video' | 'group_audio' | 'group_video';
  isGroupCall: boolean;
  groupName?: string;
  startedAt?: Date;
  duration?: number;
}

interface CallState {
  status: CallStatus;
  activeCall: ActiveCall | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isSpeakerOn: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callHistory: CallLog[];

  setStatus: (status: CallStatus) => void;
  setActiveCall: (call: ActiveCall | null) => void;
  setMuted: (muted: boolean) => void;
  setVideoOff: (off: boolean) => void;
  setSpeaker: (on: boolean) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  endCall: () => void;
  addToHistory: (log: CallLog) => void;
}

export interface CallLog {
  id: string;
  caller_id: string;
  callee_id: string;
  type: string;
  status: string;
  duration_seconds: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  caller?: { id: string; display_name: string; avatar_url: string | null };
  callee?: { id: string; display_name: string; avatar_url: string | null };
}

export const useCallStore = create<CallState>((set) => ({
  status: 'idle',
  activeCall: null,
  isMuted: false,
  isVideoOff: false,
  isSpeakerOn: false,
  localStream: null,
  remoteStream: null,
  callHistory: [],

  setStatus: (status) => set({ status }),
  setActiveCall: (activeCall) => set({ activeCall }),
  setMuted: (isMuted) => set({ isMuted }),
  setVideoOff: (isVideoOff) => set({ isVideoOff }),
  setSpeaker: (isSpeakerOn) => set({ isSpeakerOn }),
  setLocalStream: (localStream) => set({ localStream }),
  setRemoteStream: (remoteStream) => set({ remoteStream }),

  endCall: () =>
    set({
      status: 'idle',
      activeCall: null,
      isMuted: false,
      isVideoOff: false,
      localStream: null,
      remoteStream: null,
    }),

  addToHistory: (log) =>
    set((s) => ({ callHistory: [log, ...s.callHistory].slice(0, 100) })),
}));
