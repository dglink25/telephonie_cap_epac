// src/services/audioRecorder.ts
import { Platform } from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';

/**
 * Service d'enregistrement audio simplifié
 * Wrapper autour de react-native-audio-recorder-player
 */
class AudioRecorderService {
  private recorder: AudioRecorderPlayer;
  private currentPath: string | null = null;
  private isRecording = false;
  private isPlaying = false;

  constructor() {
    this.recorder = new AudioRecorderPlayer();
  }

  /**
   * Démarrer l'enregistrement
   */
  async startRecording(): Promise<string> {
    if (this.isRecording) {
      throw new Error('Un enregistrement est déjà en cours');
    }

    try {
      // Générer le chemin du fichier
      const timestamp = Date.now();
      const fileName = `audio_${timestamp}.${Platform.OS === 'ios' ? 'm4a' : 'mp4'}`;
      
      // Path selon la plateforme
      const path = Platform.select({
        ios: fileName,
        android: `/data/data/com.capepactemp/files/${fileName}`,
      });

      if (!path) {
        throw new Error('Impossible de générer le chemin du fichier');
      }

      console.log('[AudioRecorder] Starting recording:', path);
      
      const uri = await this.recorder.startRecorder(path);
      this.currentPath = uri;
      this.isRecording = true;

      return uri;
    } catch (error) {
      console.error('[AudioRecorder] Start recording error:', error);
      throw new Error('Impossible de démarrer l\'enregistrement');
    }
  }

  /**
   * Arrêter l'enregistrement
   */
  async stopRecording(): Promise<string | null> {
    if (!this.isRecording) {
      console.warn('[AudioRecorder] No recording in progress');
      return null;
    }

    try {
      const result = await this.recorder.stopRecorder();
      this.recorder.removeRecordBackListener();
      this.isRecording = false;

      console.log('[AudioRecorder] Recording stopped:', result);
      return result;
    } catch (error) {
      console.error('[AudioRecorder] Stop recording error:', error);
      this.isRecording = false;
      return null;
    }
  }

  /**
   * Ajouter un listener pour la durée
   */
  onRecordProgress(callback: (duration: number) => void): void {
    this.recorder.addRecordBackListener((e: any) => {
      // Durée en secondes
      const durationSec = Math.floor(e.currentPosition / 1000);
      callback(durationSec);
    });
  }

  /**
   * Supprimer les listeners
   */
  removeListeners(): void {
    this.recorder.removeRecordBackListener();
    this.recorder.removePlayBackListener();
  }

  /**
   * Obtenir l'état actuel
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Obtenir le chemin actuel
   */
  getCurrentPath(): string | null {
    return this.currentPath;
  }

  // ═══════════════════════════════════════════════════════════
  // PLAYER METHODS
  // ═══════════════════════════════════════════════════════════

  /**
   * Démarrer la lecture d'un fichier audio
   */
  async startPlayer(uri: string, onFinish?: () => void): Promise<void> {
    if (this.isPlaying) {
      await this.stopPlayer();
    }

    try {
      console.log('[AudioRecorder] Starting playback:', uri);
      
      const msg = await this.recorder.startPlayer(uri);
      this.isPlaying = true;

      // Listener pour savoir quand la lecture est terminée
      this.recorder.addPlayBackListener((e: any) => {
        if (e.currentPosition >= e.duration && e.duration > 0) {
          console.log('[AudioRecorder] Playback finished');
          this.stopPlayer();
          onFinish?.();
        }
      });

      console.log('[AudioRecorder] Player started:', msg);
    } catch (error) {
      console.error('[AudioRecorder] Start player error:', error);
      this.isPlaying = false;
      throw new Error('Impossible de lire l\'audio');
    }
  }

  /**
   * Arrêter la lecture
   */
  async stopPlayer(): Promise<void> {
    if (!this.isPlaying) {
      return;
    }

    try {
      await this.recorder.stopPlayer();
      this.recorder.removePlayBackListener();
      this.isPlaying = false;
      console.log('[AudioRecorder] Player stopped');
    } catch (error) {
      console.error('[AudioRecorder] Stop player error:', error);
      this.isPlaying = false;
    }
  }

  /**
   * Pause la lecture
   */
  async pausePlayer(): Promise<void> {
    if (!this.isPlaying) {
      return;
    }

    try {
      await this.recorder.pausePlayer();
      console.log('[AudioRecorder] Player paused');
    } catch (error) {
      console.error('[AudioRecorder] Pause player error:', error);
    }
  }

  /**
   * Reprendre la lecture
   */
  async resumePlayer(): Promise<void> {
    try {
      await this.recorder.resumePlayer();
      console.log('[AudioRecorder] Player resumed');
    } catch (error) {
      console.error('[AudioRecorder] Resume player error:', error);
    }
  }

  /**
   * Ajouter un listener pour la progression de la lecture
   */
  onPlayerProgress(callback: (currentPosition: number, duration: number) => void): void {
    this.recorder.addPlayBackListener((e: any) => {
      callback(e.currentPosition, e.duration);
    });
  }

  /**
   * Obtenir l'état de lecture
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

export const audioRecorderService = new AudioRecorderService();
