// src/components/common/index.tsx
import React from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle, StyleProp,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { COLORS, SIZES, SHADOWS } from '../../utils/constants';
import { getMediaUrl } from '../../services/api';

// ── Avatar ────────────────────────────────────────────────────────
interface AvatarProps {
  url?: string | null;
  name?: string;
  size?: number;
  presenceStatus?: string;
  style?: StyleProp<ViewStyle>;
}

export const Avatar: React.FC<AvatarProps> = ({
  url, name = '?', size = SIZES.avatarMd, presenceStatus, style,
}) => {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const presenceColor: Record<string, string> = {
    online: COLORS.online,
    away: COLORS.away,
    dnd: COLORS.danger,
    offline: COLORS.offline,
  };

  const imageUrl = url ? getMediaUrl(url) : null;
  
  // Log pour debug
  if (imageUrl) {
    console.log('[Avatar] Image URL:', imageUrl);
  }

  return (
    <View style={[{ width: size, height: size }, style]}>
      {imageUrl ? (
        <FastImage
          source={{ 
            uri: imageUrl,
            priority: FastImage.priority.normal,
          }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode={FastImage.resizeMode.cover}
          onError={() => {
            console.error('[Avatar] Failed to load image:', imageUrl);
          }}
          onLoad={() => {
            console.log('[Avatar] Image loaded successfully:', imageUrl);
          }}
        />
      ) : (
        <View
          style={[
            styles.avatarPlaceholder,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <Text style={[styles.avatarInitials, { fontSize: size * 0.36 }]}>
            {initials}
          </Text>
        </View>
      )}
      {presenceStatus && (
        <View
          style={[
            styles.presenceDot,
            {
              width: size * 0.28,
              height: size * 0.28,
              borderRadius: size * 0.14,
              backgroundColor: presenceColor[presenceStatus] || COLORS.offline,
              bottom: 0,
              right: 0,
            },
          ]}
        />
      )}
    </View>
  );
};

// ── Badge ─────────────────────────────────────────────────────────
interface BadgeProps {
  count: number;
  max?: number;
}

export const Badge: React.FC<BadgeProps> = ({ count, max = 99 }) => {
  if (count <= 0) return null;
  const label = count > max ? `${max}+` : String(count);
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
};

// ── Button ────────────────────────────────────────────────────────
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  title, onPress, variant = 'primary', size = 'md',
  loading = false, disabled = false, icon, style,
}) => {
  const variantStyles: Record<string, { container: ViewStyle; text: TextStyle }> = {
    primary: {
      container: { backgroundColor: COLORS.primary },
      text: { color: COLORS.white },
    },
    outline: {
      container: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.primary },
      text: { color: COLORS.primary },
    },
    ghost: {
      container: { backgroundColor: 'transparent' },
      text: { color: COLORS.primary },
    },
    danger: {
      container: { backgroundColor: COLORS.danger },
      text: { color: COLORS.white },
    },
  };

  const sizeMap = {
    sm: { height: 36, fontSize: SIZES.sm, paddingH: 12 },
    md: { height: 48, fontSize: SIZES.md, paddingH: 20 },
    lg: { height: 56, fontSize: SIZES.lg, paddingH: 24 },
  };

  const s = sizeMap[size];
  const vs = variantStyles[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.78}
      style={[
        styles.button,
        vs.container,
        { height: s.height, paddingHorizontal: s.paddingH, opacity: disabled ? 0.55 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : COLORS.primary} size="small" />
      ) : (
        <>
          {icon && <View style={{ marginRight: 8 }}>{icon}</View>}
          <Text style={[styles.buttonText, vs.text, { fontSize: s.fontSize }]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

// ── Input ─────────────────────────────────────────────────────────
interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  error?: string;
  multiline?: boolean;
  numberOfLines?: number;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label, value, onChangeText, placeholder, secureTextEntry = false,
  error, multiline = false, numberOfLines = 1, leftIcon, rightIcon,
  style, keyboardType = 'default', autoCapitalize = 'none', editable = true,
}) => (
  <View style={[styles.inputContainer, style]}>
    {label && <Text style={styles.inputLabel}>{label}</Text>}
    <View
      style={[
        styles.inputWrapper,
        error ? styles.inputError : null,
        !editable ? styles.inputDisabled : null,
      ]}
    >
      {leftIcon && <View style={styles.inputIcon}>{leftIcon}</View>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.gray400}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        numberOfLines={numberOfLines}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        editable={editable}
        style={[
          styles.input,
          leftIcon ? { paddingLeft: 8 } : null,
          rightIcon ? { paddingRight: 8 } : null,
          multiline ? { height: numberOfLines * 24, textAlignVertical: 'top', paddingTop: 10 } : null,
        ]}
      />
      {rightIcon && <View style={styles.inputIcon}>{rightIcon}</View>}
    </View>
    {error && <Text style={styles.inputErrorText}>{error}</Text>}
  </View>
);

// ── Divider ───────────────────────────────────────────────────────
export const Divider: React.FC<{ text?: string }> = ({ text }) => (
  <View style={styles.dividerContainer}>
    <View style={styles.dividerLine} />
    {text && <Text style={styles.dividerText}>{text}</Text>}
    {text && <View style={styles.dividerLine} />}
  </View>
);

// ── EmptyState ────────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, subtitle, action }) => (
  <View style={styles.emptyState}>
    <Text style={styles.emptyTitle}>{title}</Text>
    {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
    {action && (
      <Button
        title={action.label}
        onPress={action.onPress}
        size="sm"
        style={{ marginTop: 16 }}
      />
    )}
  </View>
);

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  avatarPlaceholder: {
    backgroundColor: COLORS.primaryXLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  presenceDot: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  badge: {
    backgroundColor: COLORS.danger,
    borderRadius: SIZES.radiusFull,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  button: {
    borderRadius: SIZES.radiusMd,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray700,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray50,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1.5,
    borderColor: COLORS.gray200,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: SIZES.md,
    color: COLORS.gray900,
    height: 48,
  },
  inputIcon: {
    marginHorizontal: 4,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  inputErrorText: {
    color: COLORS.danger,
    fontSize: SIZES.xs,
    marginTop: 4,
    marginLeft: 2,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.gray200,
  },
  dividerText: {
    fontSize: SIZES.xs,
    color: COLORS.gray500,
    marginHorizontal: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray700,
    textAlign: 'center',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: SIZES.sm,
    color: COLORS.gray500,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
