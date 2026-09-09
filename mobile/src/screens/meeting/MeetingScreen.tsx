// src/screens/meeting/MeetingScreen.tsx
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, ActivityIndicator, Alert, Share,
  BackHandler, SafeAreaView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, SIZES } from '../../utils/constants';
import { getMediaUrl, SERVER_BASE } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

interface Props {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{
    Meeting: {
      roomName: string;
      jitsiUrl?: string;
    };
  }, 'Meeting'>;
}

const MeetingScreen: React.FC<Props> = ({ navigation, route }) => {
  const { roomName, jitsiUrl: routeJitsiUrl } = route.params;
  const { user } = useAuthStore();

  // URL Jitsi : depuis les params ou dérivée du SERVER_BASE
  const jitsiUrl = routeJitsiUrl ||
    SERVER_BASE.replace(':8282', ':8443').replace(':18282', ':19444').replace(/:\d+$/, ':19444');

  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const webViewRef              = useRef<any>(null);

  const roomUrl = `${jitsiUrl}/${roomName.toUpperCase()}`;

  // HTML injecté dans la WebView pour configurer Jitsi External API
  const injectedJS = `
    (function() {
      // Attendre que la page Jitsi soit prête
      window.addEventListener('load', function() {
        try {
          if (window.JitsiMeetExternalAPI) {
            const api = new JitsiMeetExternalAPI('${jitsiUrl.replace(/^https?:\/\//, '').replace(/:\d+$/, '')}', {
              roomName: '${roomName.toUpperCase()}',
              width: '100%',
              height: '100%',
              userInfo: {
                displayName: '${user?.display_name || 'Participant'}',
                email: '${user?.email || ''}',
              },
              configOverwrite: {
                startWithAudioMuted: false,
                startWithVideoMuted: false,
                enableClosePage: false,
                transcribingEnabled: true,
                enableReactions: true,
                resolution: 720,
                channelLastN: 200,
                applicationName: 'CAP-EPAC',
              },
              interfaceConfigOverwrite: {
                APP_NAME: 'CAP-EPAC Visioconférence',
                SHOW_JITSI_WATERMARK: false,
                SHOW_WATERMARK_FOR_GUESTS: false,
              },
            });

            api.addEventListener('readyToClose', function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LEAVE' }));
            });

            api.addEventListener('videoConferenceJoined', function(e) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'JOINED', data: e }));
            });

            api.addEventListener('participantJoined', function(e) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PARTICIPANT_JOINED', data: e }));
            });
          }
        } catch(e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: e.message }));
        }
      });
      true;
    })();
  `;

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'LEAVE') {
        navigation.goBack();
      } else if (data.type === 'ERROR') {
        setError(data.message);
      }
    } catch {}
  }, [navigation]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Rejoignez ma visioconférence CAP-EPAC :\nCode : ${roomName.toUpperCase()}\nLien : ${roomUrl}`,
        title: 'Invitation visioconférence CAP-EPAC',
      });
    } catch {}
  };

  const handleLeave = () => {
    Alert.alert(
      'Quitter la réunion',
      'Voulez-vous quitter la visioconférence ?',
      [
        { text: 'Rester', style: 'cancel' },
        { text: 'Quitter', style: 'destructive', onPress: () => navigation.goBack() },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.gray900} />

      {/* Header */}
      <SafeAreaView style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.roomInfo}>
            <Icon name="video" size={18} color={COLORS.primaryLight} />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.headerTitle}>Visioconférence</Text>
              <Text style={styles.roomName}>{roomName.toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            {/* Partager */}
            <TouchableOpacity onPress={handleShare} style={styles.headerBtn}>
              <Icon name="share-variant" size={20} color={COLORS.white} />
            </TouchableOpacity>

            {/* Quitter */}
            <TouchableOpacity onPress={handleLeave} style={styles.leaveBtn}>
              <Icon name="phone-hangup" size={18} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* WebView Jitsi */}
      <View style={styles.webViewContainer}>
        {loading && !error && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Connexion à la salle...</Text>
            <Text style={styles.loadingRoom}>{roomName.toUpperCase()}</Text>
          </View>
        )}

        {error ? (
          <View style={styles.errorContainer}>
            <Icon name="video-off" size={64} color={COLORS.gray600} />
            <Text style={styles.errorTitle}>Impossible de se connecter</Text>
            <Text style={styles.errorMsg}>{error}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => { setError(''); setLoading(true); webViewRef.current?.reload(); }}
            >
              <Text style={styles.retryText}>Réessayer</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 12 }}>
              <Text style={{ color: COLORS.gray500, fontSize: SIZES.sm }}>Retour</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ uri: roomUrl }}
            style={styles.webView}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            javaScriptEnabled
            domStorageEnabled
            allowsFullscreenVideo
            startInLoadingState={false}
            mixedContentMode="always"
            injectedJavaScript={injectedJS}
            onMessage={handleMessage}
            onLoad={() => setLoading(false)}
            onError={(e) => {
              setError(`Erreur de chargement : ${e.nativeEvent.description}`);
              setLoading(false);
            }}
            onHttpError={(e) => {
              if (e.nativeEvent.statusCode >= 400) {
                setError(`Jitsi non disponible (HTTP ${e.nativeEvent.statusCode})`);
                setLoading(false);
              }
            }}
            // Permissions caméra/micro
            onPermissionRequest={(request) => request.grant(request.resources)}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { backgroundColor: '#1a1a2e' },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  roomInfo: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: COLORS.white, fontSize: SIZES.sm, fontWeight: '600' },
  roomName: { color: COLORS.primaryLight, fontSize: SIZES.xs, fontFamily: 'monospace', marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  leaveBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.danger,
    alignItems: 'center', justifyContent: 'center',
  },
  webViewContainer: { flex: 1, position: 'relative' },
  webView: { flex: 1, backgroundColor: '#000' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingText: { color: COLORS.white, fontSize: SIZES.lg, fontWeight: '600', marginTop: 16 },
  loadingRoom: { color: COLORS.gray500, fontSize: SIZES.sm, marginTop: 4, fontFamily: 'monospace' },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#0a0a0a',
  },
  errorTitle: { color: COLORS.white, fontSize: SIZES.xl, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  errorMsg: { color: COLORS.gray500, fontSize: SIZES.sm, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    marginTop: 24,
    paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radiusFull,
  },
  retryText: { color: COLORS.white, fontWeight: '600', fontSize: SIZES.md },
});

export default MeetingScreen;
