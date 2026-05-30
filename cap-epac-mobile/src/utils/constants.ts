// src/utils/constants.ts

export const COLORS = {
  primary: '#16a34a',
  primaryDark: '#15803d',
  primaryLight: '#22c55e',
  primaryXLight: '#dcfce7',
  primaryXXLight: '#f0fdf4',
  white: '#ffffff',
  black: '#000000',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
  danger: '#dc2626',
  dangerLight: '#fee2e2',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  info: '#3b82f6',
  infoLight: '#dbeafe',
  online: '#16a34a',
  away: '#f59e0b',
  dnd: '#dc2626',
  offline: '#9ca3af',
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
};

export const SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 24,
  heading: 28,
  icon: 24,
  avatarSm: 36,
  avatarMd: 44,
  avatarLg: 60,
  radiusSm: 6,
  radiusMd: 10,
  radiusLg: 16,
  radiusXL: 24,
  radiusFull: 999,
  paddingSm: 8,
  paddingMd: 16,
  paddingLg: 24,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
};

export const PRESENCE_COLORS: Record<string, string> = {
  online: COLORS.online,
  away: COLORS.away,
  dnd: COLORS.danger,
  offline: COLORS.offline,
};

export const PRESENCE_LABELS: Record<string, string> = {
  online: 'En ligne',
  away: 'Absent',
  dnd: 'Ne pas déranger',
  offline: 'Hors ligne',
};

export const DEPARTMENTS = [
  'Direction',
  'Responsable Division',
  'Secrétariat',
  'Soutien Informatique',
] as const;

export type Department = typeof DEPARTMENTS[number];

export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;

export const MAX_FILE_SIZE_MB = 100;
export const MAX_AVATAR_SIZE_MB = 5;