// src/services/permissionsService.ts
import { Platform, Alert, Linking } from 'react-native';
import {
  request, check, requestMultiple, checkMultiple,
  PERMISSIONS, RESULTS, openSettings,
  type Permission,
} from 'react-native-permissions';

/**
 * Gestion centralisée des permissions Android 14/15/16+
 *
 * Android 14 (API 34) introduit :
 * - READ_MEDIA_VISUAL_USER_SELECTED (accès partiel galerie)
 * - Obligation d'afficher un dialog pour USE_FULL_SCREEN_INTENT
 * - POST_NOTIFICATIONS obligatoire
 *
 * Android 15 (API 35) :
 * - Restrictions supplémentaires sur les Foreground Services
 * - health connect permissions
 *
 * Android 16 (API 36) :
 * - Nouvelles restrictions sur le démarrage d'activités en arrière-plan
 */

// ── Demande toutes les permissions au démarrage ────────────────

export async function requestAllPermissions(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const apiLevel = Platform.Version as number;

  try {
    // ── Notifications (Android 13+, API 33+) ──────────────────
    if (apiLevel >= 33) {
      await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
    }

    // ── Médias (Android 13+) ──────────────────────────────────
    if (apiLevel >= 33) {
      await requestMultiple([
        PERMISSIONS.ANDROID.READ_MEDIA_IMAGES,
        PERMISSIONS.ANDROID.READ_MEDIA_VIDEO,
        PERMISSIONS.ANDROID.READ_MEDIA_AUDIO,
      ]);
    } else {
      await request(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
    }

    // ── Micro + Caméra ────────────────────────────────────────
    await requestMultiple([
      PERMISSIONS.ANDROID.CAMERA,
      PERMISSIONS.ANDROID.RECORD_AUDIO,
    ]);

    // ── Bluetooth (Android 12+, API 31+) ─────────────────────
    if (apiLevel >= 31) {
      await requestMultiple([
        PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
        PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
      ]);
    }

  } catch (err) {
    console.warn('[Permissions] Erreur lors de la demande:', err);
  }
}

// ── Permission micro pour les appels ──────────────────────────

export async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const result = await request(PERMISSIONS.ANDROID.RECORD_AUDIO);
  return result === RESULTS.GRANTED;
}

// ── Permission caméra pour les appels vidéo ───────────────────

export async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const result = await request(PERMISSIONS.ANDROID.CAMERA);
  return result === RESULTS.GRANTED;
}

// ── Permission galerie photo ───────────────────────────────────

export async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const apiLevel = Platform.Version as number;

  if (apiLevel >= 34) {
    // Android 14+ : accès complet OU accès partiel
    const fullAccess = await check(PERMISSIONS.ANDROID.READ_MEDIA_IMAGES);
    if (fullAccess === RESULTS.GRANTED) return true;

    // Essayer l'accès partiel (READ_MEDIA_VISUAL_USER_SELECTED)
    try {
      const partial = await request(
        'android.permission.READ_MEDIA_VISUAL_USER_SELECTED' as Permission
      );
      return partial === RESULTS.GRANTED || partial === RESULTS.LIMITED;
    } catch {
      // Fallback si la permission n'existe pas sur cet appareil
      const result = await request(PERMISSIONS.ANDROID.READ_MEDIA_IMAGES);
      return result === RESULTS.GRANTED;
    }
  } else if (apiLevel >= 33) {
    const result = await requestMultiple([
      PERMISSIONS.ANDROID.READ_MEDIA_IMAGES,
      PERMISSIONS.ANDROID.READ_MEDIA_VIDEO,
    ]);
    return (
      result[PERMISSIONS.ANDROID.READ_MEDIA_IMAGES] === RESULTS.GRANTED ||
      result[PERMISSIONS.ANDROID.READ_MEDIA_VIDEO] === RESULTS.GRANTED
    );
  } else {
    const result = await request(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
    return result === RESULTS.GRANTED;
  }
}

// ── Permission notifications ───────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const apiLevel = Platform.Version as number;

  if (apiLevel >= 33) {
    const result = await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
    if (result === RESULTS.DENIED || result === RESULTS.BLOCKED) {
      showPermissionAlert(
        'Notifications requises',
        'Les notifications sont nécessaires pour recevoir les appels entrants. Activez-les dans les paramètres.',
      );
      return false;
    }
    return result === RESULTS.GRANTED;
  }
  return true;
}

// ── Vérifier toutes les permissions critiques ──────────────────

export async function checkCriticalPermissions(): Promise<{
  microphone: boolean;
  camera: boolean;
  notifications: boolean;
}> {
  if (Platform.OS !== 'android') {
    return { microphone: true, camera: true, notifications: true };
  }

  const apiLevel = Platform.Version as number;

  const [mic, cam] = await Promise.all([
    check(PERMISSIONS.ANDROID.RECORD_AUDIO),
    check(PERMISSIONS.ANDROID.CAMERA),
  ]);

  let notif = true;
  if (apiLevel >= 33) {
    const notifResult = await check(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
    notif = notifResult === RESULTS.GRANTED;
  }

  return {
    microphone: mic === RESULTS.GRANTED,
    camera: cam === RESULTS.GRANTED,
    notifications: notif,
  };
}

// ── Ouvrir les paramètres si permission refusée définitivement ─

export function showPermissionAlert(title: string, message: string): void {
  Alert.alert(title, message, [
    { text: 'Annuler', style: 'cancel' },
    {
      text: 'Ouvrir les paramètres',
      onPress: () => openSettings().catch(() => Linking.openSettings()),
    },
  ]);
}
