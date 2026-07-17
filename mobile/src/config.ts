
// ─── Configuration réseau centralisée ────────────────────────────────────────
// ⚠️  Modifiez UNIQUEMENT cette valeur lorsque l'IP ou le port du serveur change.

// Port 8282 = HTTP pur dédié au mobile (pas de redirection HTTPS)
export const SERVER_BASE = 'http://192.168.10.139:8282';

export const MEDIA_PORT = '';

/**
 * Construit l'URL complète d'un média à partir d'un chemin relatif ou absolu.
 * Exemple : getMediaUrl('/uploads/images/foo.jpg') → 'http://192.168.10.139:8282/uploads/images/foo.jpg'
 */

export function getMediaUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${SERVER_BASE}${path.startsWith('/') ? path : '/' + path}`;
}
