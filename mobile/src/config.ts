

export const SERVER_BASE = 'http://192.168.10.150:8080';

export const MEDIA_PORT = '';

export function getMediaUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${SERVER_BASE}${path.startsWith('/') ? path : '/' + path}`;
}
