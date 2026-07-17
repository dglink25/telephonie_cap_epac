// src/services/callNotificationService.ts
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SERVER_BASE } from '../config';

const { CallServiceModule } = NativeModules;

let emitter: NativeEventEmitter | null = null;

function getEmitter(): NativeEventEmitter | null {
  if (Platform.OS !== 'android' || !CallServiceModule) return null;
  if (!emitter) {
    emitter = new NativeEventEmitter(CallServiceModule);
  }
  return emitter;
}

/**
 * Démarre le service de fond avec le token d'authentification.
 */
export async function startCallNotificationService(): Promise<void> {
  if (Platform.OS !== 'android' || !CallServiceModule) return;
  try {
    const token = await AsyncStorage.getItem('accessToken');
    if (!token) {
      console.warn('[CallService] Pas de token — service non démarré');
      return;
    }
    await saveServiceConfig(token, SERVER_BASE);
    console.log('[CallService] Démarrage service avec', SERVER_BASE);
    CallServiceModule.startService(token, SERVER_BASE);
  } catch (err) {
    console.error('[CallService] Erreur démarrage:', err);
  }
}

/**
 * Arrête le service de fond (à la déconnexion).
 */
export async function stopCallNotificationService(): Promise<void> {
  if (Platform.OS !== 'android' || !CallServiceModule) return;
  try {
    await clearServiceConfig();
    CallServiceModule.stopService();
    console.log('[CallService] Service arrêté');
  } catch (err) {
    console.error('[CallService] Erreur arrêt:', err);
  }
}

/**
 * Arrête la sonnerie du service natif depuis le JS.
 * DOIT être appelé dès que l'utilisateur décroche depuis l'écran
 * (pas depuis le bouton de la notification) pour éviter que la
 * sonnerie continue à jouer en arrière-plan.
 */
export function stopNativeRingtone(): void {
  if (Platform.OS !== 'android' || !CallServiceModule) return;
  try {
    CallServiceModule.stopRingtone();
    console.log('[CallService] Sonnerie native arrêtée');
  } catch (err) {
    console.warn('[CallService] Erreur arrêt sonnerie:', err);
  }
}

/**
 * Écoute les appels entrants reçus par le service natif.
 */
export function onIncomingCallFromService(
  callback: (data: {
    callId: string;
    callerId: string;
    callerName: string;
    callerAvatar: string;
    type: string;
    isGroupCall: boolean;
  }) => void
): () => void {
  const e = getEmitter();
  if (!e) return () => {};
  const sub = e.addListener('incomingCall', callback);
  return () => sub.remove();
}

/**
 * Écoute les fins d'appel reçues par le service natif.
 */
export function onCallEndedFromService(
  callback: (data: { callId: string }) => void
): () => void {
  const e = getEmitter();
  if (!e) return () => {};
  const sub = e.addListener('callEnded', callback);
  return () => sub.remove();
}

async function saveServiceConfig(token: string, serverUrl: string): Promise<void> {
  await AsyncStorage.setItem('service_token', token);
  await AsyncStorage.setItem('service_server_url', serverUrl);
}

async function clearServiceConfig(): Promise<void> {
  await AsyncStorage.multiRemove(['service_token', 'service_server_url']);
}
