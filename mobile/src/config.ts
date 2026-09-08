// Généré automatiquement par deploy.sh — NE PAS ÉDITER MANUELLEMENT
// Pour changer le serveur : bash deploy.sh <nouvelle_ip>

export const SERVER_BASE = 'http://192.168.18.113:18282';
export const MEDIA_PORT = '';

export function getMediaUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${SERVER_BASE}${path.startsWith('/') ? path : '/' + path}`;
}
