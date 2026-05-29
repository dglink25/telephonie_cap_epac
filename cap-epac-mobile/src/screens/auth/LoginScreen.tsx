
import React, { useState } from 'react';
import { Image } from 'react-native';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
  StatusBar, Dimensions,
} from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { Button, Input } from '../../components/common';
import { COLORS, SIZES } from '../../utils/constants';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const { height } = Dimensions.get('window');

interface Props {
  navigation: NativeStackNavigationProp<any>;
}

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, clearError } = useAuthStore();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Champs requis', 'Veuillez saisir votre identifiant et mot de passe.');
      return;
    }
    clearError();
    try {
      await login(username.trim(), password);
    } catch {}
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header vert */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.appName}>CAP-EPAC</Text>
          <Text style={styles.appSubtitle}>Téléphonie Interne</Text>
        </View>

        {/* Formulaire */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Connexion</Text>
          <Text style={styles.formSubtitle}>
            Connectez-vous à votre compte professionnel
          </Text>

          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Input
            label="Identifiant"
            value={username}
            onChangeText={setUsername}
            placeholder="votre.identifiant"
            keyboardType="default"
            autoCapitalize="none"
          />

          <Input
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry={!showPassword}
            rightIcon={
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.showHide}>{showPassword ? 'Masquer' : 'Voir'}</Text>
              </TouchableOpacity>
            }
          />

          <Button
            title="Se connecter"
            onPress={handleLogin}
            loading={isLoading}
            style={styles.loginBtn}
            size="lg"
          />

          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.registerText}>
              Pas encore de compte ?{' '}
              <Text style={styles.registerBold}>Créer un compte</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>CAP-EPAC © 2026 — Réseau LAN interne</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primary },
  scroll: { flexGrow: 1 },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
    backgroundColor: COLORS.primary,
  },
  logoText: { fontSize: 36 },
  appName: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 2,
  },
  appSubtitle: {
    fontSize: SIZES.sm,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
  },
  formCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    minHeight: height * 0.6,
  },
  formTitle: {
    fontSize: SIZES.xxxl,
    fontWeight: '700',
    color: COLORS.gray900,
    marginBottom: 6,
  },
  formSubtitle: {
    fontSize: SIZES.sm,
    color: COLORS.gray500,
    marginBottom: 28,
  },
  errorBanner: {
    backgroundColor: COLORS.dangerLight,
    borderRadius: SIZES.radiusMd,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.danger,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: SIZES.sm,
  },
  loginBtn: { marginTop: 8, width: '100%' },
  showHide: {
    color: COLORS.primary,
    fontSize: SIZES.sm,
    fontWeight: '500',
  },
  registerLink: {
    alignItems: 'center',
    marginTop: 24,
  },
  registerText: {
    color: COLORS.gray500,
    fontSize: SIZES.sm,
  },
  registerBold: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  footer: {
    backgroundColor: COLORS.primary,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.5)',
    fontSize: SIZES.xs,
    paddingVertical: 16,

  },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    overflow: 'hidden',   // important pour le borderRadius
  },
  logoImage: {
    width: 70,
    height: 70,
  },
});

export default LoginScreen;
