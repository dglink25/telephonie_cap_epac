// src/screens/TestImageScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { COLORS, SIZES } from '../utils/constants';
import { getMediaUrl } from '../services/api';

const TestImageScreen = () => {
  const [imageUrl, setImageUrl] = useState('/uploads/images/1780435221329_ced4aeaf10966f69.jpg');
  const [testUrl, setTestUrl] = useState('');
  const [imageError, setImageError] = useState('');
  const [imageLoaded, setImageLoaded] = useState(false);

  const fullUrl = getMediaUrl(imageUrl);

  // URLs de test
  const testUrls = [
    '/uploads/images/1780435221329_ced4aeaf10966f69.jpg',
    'uploads/images/1780435221329_ced4aeaf10966f69.jpg',
    'http://10.73.47.159/uploads/images/1780435221329_ced4aeaf10966f69.jpg',
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Test d'affichage d'images</Text>

      <View style={styles.section}>
        <Text style={styles.label}>URL configurée:</Text>
        <Text style={styles.code}>Serveur: http://10.73.47.159</Text>
        <Text style={styles.code}>Chemin: {imageUrl}</Text>
        <Text style={styles.code}>URL complète: {fullUrl}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Statut:</Text>
        <Text style={imageLoaded ? styles.success : styles.warning}>
          {imageLoaded ? '✅ Image chargée' : '⏳ En attente...'}
        </Text>
        {imageError && <Text style={styles.error}>❌ Erreur: {imageError}</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Test Image 1 - Avec getMediaUrl():</Text>
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: fullUrl }}
            style={styles.testImage}
            resizeMode="cover"
            onLoadStart={() => {
              console.log('[TestImage] 🔄 Chargement démarré:', fullUrl);
              setImageLoaded(false);
              setImageError('');
            }}
            onLoad={() => {
              console.log('[TestImage] ✅ Image chargée:', fullUrl);
              setImageLoaded(true);
              setImageError('');
            }}
            onError={(e) => {
              const error = e.nativeEvent.error || 'Erreur inconnue';
              console.error('[TestImage] ❌ Erreur:', error, 'URL:', fullUrl);
              setImageError(error);
              setImageLoaded(false);
            }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Test Image 2 - URL directe:</Text>
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: 'http://10.73.47.159/uploads/images/1780435221329_ced4aeaf10966f69.jpg' }}
            style={styles.testImage}
            resizeMode="cover"
            onLoadStart={() => console.log('[TestImage2] 🔄 Chargement...')}
            onLoad={() => console.log('[TestImage2] ✅ Chargée')}
            onError={(e) => console.error('[TestImage2] ❌ Erreur:', e.nativeEvent.error)}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Test URLs alternatives:</Text>
        {testUrls.map((url, index) => (
          <TouchableOpacity
            key={index}
            style={styles.button}
            onPress={() => setImageUrl(url)}
          >
            <Text style={styles.buttonText}>Tester: {url.substring(0, 50)}...</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Tester une URL personnalisée:</Text>
        <TextInput
          style={styles.input}
          value={testUrl}
          onChangeText={setTestUrl}
          placeholder="Entrer un chemin d'image..."
          placeholderTextColor={COLORS.gray400}
        />
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            if (testUrl) {
              setImageUrl(testUrl);
              setTestUrl('');
            }
          }}
        >
          <Text style={styles.buttonText}>Tester cette URL</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Image Google (Test réseau):</Text>
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png' }}
            style={[styles.testImage, { height: 100 }]}
            resizeMode="contain"
            onLoad={() => console.log('[TestImageGoogle] ✅ Google logo chargé')}
            onError={(e) => console.error('[TestImageGoogle] ❌ Erreur:', e.nativeEvent.error)}
          />
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: 16,
  },
  title: {
    fontSize: SIZES.xl,
    fontWeight: '700',
    color: COLORS.gray900,
    marginBottom: 20,
    marginTop: 40,
  },
  section: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: COLORS.gray50,
    borderRadius: SIZES.radiusMd,
  },
  label: {
    fontSize: SIZES.md,
    fontWeight: '600',
    color: COLORS.gray800,
    marginBottom: 8,
  },
  code: {
    fontSize: SIZES.sm,
    fontFamily: 'monospace',
    color: COLORS.primary,
    backgroundColor: COLORS.white,
    padding: 8,
    borderRadius: SIZES.radiusSm,
    marginBottom: 4,
  },
  success: {
    fontSize: SIZES.md,
    color: COLORS.success,
    fontWeight: '600',
  },
  warning: {
    fontSize: SIZES.md,
    color: COLORS.warning,
    fontWeight: '600',
  },
  error: {
    fontSize: SIZES.sm,
    color: COLORS.danger,
    marginTop: 8,
  },
  imageWrapper: {
    backgroundColor: COLORS.gray200,
    borderRadius: SIZES.radiusMd,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  testImage: {
    width: '100%',
    height: 200,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: SIZES.radiusMd,
    marginTop: 8,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: SIZES.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: SIZES.radiusMd,
    padding: 12,
    fontSize: SIZES.md,
    color: COLORS.gray900,
    marginBottom: 8,
  },
});

export default TestImageScreen;
