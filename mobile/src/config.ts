// Généré par deploy.sh — NE PAS ÉDITER
export const SERVER_BASE = 'http://192.168.18.103:18282';
export const MEDIA_PORT = '';
export function getMediaUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${SERVER_BASE}${path.startsWith('/') ? path : '/' + path}`;
}
