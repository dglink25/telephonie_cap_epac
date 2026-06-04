// src/components/CachedImage.tsx
import React, { useState, useEffect } from 'react';
import { ActivityIndicator, View, StyleProp, ViewStyle, Text, Image, ImageStyle } from 'react-native';
import FastImage, { ResizeMode } from 'react-native-fast-image';
import { getImageAsBase64 } from '../utils/imageCache';
import { COLORS } from '../utils/constants';

interface CachedImageProps {
  source: { uri: string; priority?: any };
  style?: StyleProp<ViewStyle>;
  resizeMode?: ResizeMode;
  onLoadStart?: () => void;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Composant Image qui télécharge l'image via l'API et l'affiche en base64
 * pour contourner les problèmes de certificat SSL
 */
export const CachedImage: React.FC<CachedImageProps> = ({
  source,
  style,
  resizeMode,
  onLoadStart,
  onLoad,
  onError,
}) => {
  const [base64Uri, setBase64Uri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadImage = async () => {
      if (!source?.uri) {
        setLoading(false);
        setError(true);
        return;
      }

      try {
        setLoading(true);
        setError(false);
        onLoadStart?.();

        const base64 = await getImageAsBase64(source.uri);

        if (!isMounted) return;

        if (base64) {
          setBase64Uri(base64);
          setError(false);
          onLoad?.();
        } else {
          setError(true);
          onError?.();
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('[CachedImage] Erreur:', err);
        setError(true);
        onError?.();
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
    };
  }, [source?.uri]);

  if (loading) {
    return (
      <View style={[style as any, { justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.gray200 }]}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }

  if (error || !base64Uri) {
    console.log('[CachedImage] ❌ Affichage erreur - error:', error, 'base64Uri présent:', !!base64Uri);
    return (
      <View style={[style as any, { backgroundColor: COLORS.gray300, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: COLORS.gray600, fontSize: 12 }}>❌</Text>
      </View>
    );
  }

  console.log('[CachedImage] ✅ Rendu Image standard - URI length:', base64Uri.length, 'style:', style);
  
  // Utiliser Image standard au lieu de FastImage pour le base64
  // FastImage a des problèmes avec les très gros base64 sur Android
  return (
    <Image
      source={{ uri: base64Uri }}
      style={style as ImageStyle}
      resizeMode="cover"
      onLoadStart={() => console.log('[Image] Loading started')}
      onLoad={() => console.log('[Image] Load success ✅')}
      onError={(e) => console.error('[Image] Load error:', e.nativeEvent)}
    />
  );
};
