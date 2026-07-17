// src/components/common/NetworkStatus.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing,
} from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, SIZES } from '../../utils/constants';

type Status = 'connected' | 'disconnected' | 'loading';

interface Props {
  /** Si true, affiche aussi une barre pendant le chargement */
  showLoading?: boolean;
  loadingText?: string;
}

/**
 * Bandeau réseau affiché en haut de l'écran.
 *
 * - Rouge animé : pas de connexion
 * - Vert animé  : connexion rétablie (disparaît après 3s)
 * - Bleu animé  : chargement en cours
 */
export const NetworkStatus: React.FC<Props> = ({
  showLoading = false,
  loadingText = 'Chargement...',
}) => {
  const [netStatus, setNetStatus] = useState<'connected' | 'disconnected' | null>(null);
  const [visible, setVisible] = useState(false);
  const translateY = useRef(new Animated.Value(-60)).current;
  const dotAnim   = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Écoute NetInfo ─────────────────────────────────────────
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      const isConnected = !!(state.isConnected && state.isInternetReachable !== false);
      setNetStatus(isConnected ? 'connected' : 'disconnected');
    });
    // État initial
    NetInfo.fetch().then((state) => {
      const isConnected = !!(state.isConnected && state.isInternetReachable !== false);
      setNetStatus(isConnected ? 'connected' : 'disconnected');
    });
    return () => unsub();
  }, []);

  // ── Animation d'entrée/sortie ──────────────────────────────
  useEffect(() => {
    if (netStatus === null) return;

    clearTimeout(hideTimer.current);

    if (netStatus === 'disconnected' || showLoading) {
      // Apparaître
      setVisible(true);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 6,
      }).start();
    } else if (netStatus === 'connected') {
      // Flash vert puis disparaître
      setVisible(true);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 6,
      }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(translateY, {
          toValue: -60,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setVisible(false));
      }, 3000);
    }

    return () => clearTimeout(hideTimer.current);
  }, [netStatus, showLoading]);

  // ── Animation des points (loading) ────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  if (!visible) return null;

  const isOffline  = netStatus === 'disconnected';
  const isOnline   = netStatus === 'connected' && !showLoading;
  const isLoading  = showLoading;

  const bgColor = isOffline ? COLORS.danger
                : isLoading ? COLORS.info
                : COLORS.primary;

  const iconName = isOffline ? 'wifi-off'
                 : isLoading ? 'loading'
                 : 'wifi-check';

  const label = isOffline ? 'Pas de connexion internet'
              : isLoading ? loadingText
              : 'Connexion rétablie';

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: bgColor, transform: [{ translateY }] }]}
    >
      {/* Icône */}
      {isLoading ? (
        <Animated.View style={{ opacity: dotAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }}>
          <Icon name="dots-horizontal" size={18} color={COLORS.white} />
        </Animated.View>
      ) : (
        <Icon name={iconName} size={16} color={COLORS.white} />
      )}

      {/* Texte */}
      <Text style={styles.text}>{label}</Text>

      {/* Points animés pour le chargement */}
      {isLoading && (
        <View style={styles.dotsRow}>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  opacity: dotAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3 + i * 0.2, 1 - i * 0.2],
                  }),
                  transform: [{
                    scale: dotAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1.2],
                    }),
                  }],
                },
              ]}
            />
          ))}
        </View>
      )}
    </Animated.View>
  );
};

// ── Version plein écran (quand toute la page est indisponible) ─

export const OfflineScreen: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => {
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -12, duration: 600, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0,   duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={fullStyles.container}>
      <Animated.View style={{ transform: [{ translateY: bounceAnim }] }}>
        <Icon name="wifi-off" size={72} color={COLORS.gray300} />
      </Animated.View>
      <Text style={fullStyles.title}>Pas de connexion</Text>
      <Text style={fullStyles.subtitle}>
        Vérifiez votre connexion internet ou le VPN et réessayez
      </Text>
      {onRetry && (
        <View style={fullStyles.retryBtn}>
          <Icon name="refresh" size={18} color={COLORS.white} style={{ marginRight: 8 }} />
          <Text style={fullStyles.retryText} onPress={onRetry}>Réessayer</Text>
        </View>
      )}
    </View>
  );
};

// ── Indicateur de chargement plein écran ─────────────────────

export const LoadingScreen: React.FC<{ text?: string }> = ({ text = 'Chargement...' }) => {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1, duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const rotate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={fullStyles.container}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Icon name="loading" size={52} color={COLORS.primary} />
      </Animated.View>
      <Animated.Text style={[fullStyles.loadingText, { opacity: fadeAnim }]}>
        {text}
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
    paddingTop: 44, // SafeArea
  },
  text: {
    color: COLORS.white,
    fontSize: SIZES.sm,
    fontWeight: '600',
  },
  dotsRow: { flexDirection: 'row', gap: 4, marginLeft: 4 },
  dot: {
    width: 6, height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.white,
  },
});

const fullStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    gap: 16,
    padding: 32,
  },
  title: {
    fontSize: SIZES.xxl,
    fontWeight: '700',
    color: COLORS.gray800,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: SIZES.sm,
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    marginTop: 8,
  },
  retryText: {
    color: COLORS.white,
    fontSize: SIZES.md,
    fontWeight: '600',
  },
  loadingText: {
    fontSize: SIZES.lg,
    color: COLORS.gray500,
    fontWeight: '500',
  },
});
