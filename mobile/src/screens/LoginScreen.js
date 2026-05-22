// mobile/src/screens/LoginScreen.js
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import useAuthStore from '../store/authStore';

export default function LoginScreen({ navigation }) {
  const { login, isLoading } = useAuthStore();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const validate = () => {
    const e = {};
    if (!form.username.trim()) e.username = "L'identifiant est requis";
    if (!form.password) e.password = 'Le mot de passe est requis';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    setGlobalError('');
    if (!validate()) { shake(); return; }

    const result = await login(form.username.trim(), form.password);
    if (!result.success) {
      setGlobalError(result.message || 'Identifiant ou mot de passe incorrect.');
      shake();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.headerSection}>
            <View style={styles.iconWrap}>
              <Ionicons name="call" size={36} color="#16a34a" />
            </View>
            <Text style={styles.title}>Téléphonie CAP-EPAC</Text>
            <Text style={styles.subtitle}>Communication réseau local</Text>
          </View>

          {/* Carte */}
          <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>
            <Text style={styles.cardTitle}>Connexion</Text>

            {/* Erreur globale */}
            {!!globalError && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color="#ef4444" />
                <Text style={styles.errorBannerText}>{globalError}</Text>
              </View>
            )}

            {/* Identifiant */}
            <View style={styles.field}>
              <Text style={styles.label}>Identifiant</Text>
              <TextInput
                style={[styles.input, errors.username && styles.inputError]}
                placeholder="Votre nom d'utilisateur"
                placeholderTextColor="#94a3b8"
                value={form.username}
                onChangeText={(v) => { setForm({ ...form, username: v }); setErrors({ ...errors, username: '' }); setGlobalError(''); }}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
              {!!errors.username && <Text style={styles.fieldError}>{errors.username}</Text>}
            </View>

            {/* Mot de passe */}
            <View style={styles.field}>
              <Text style={styles.label}>Mot de passe</Text>
              <View style={[styles.inputWrap, errors.password && styles.inputError]}>
                <TextInput
                  style={styles.inputInner}
                  placeholder="••••••••"
                  placeholderTextColor="#94a3b8"
                  value={form.password}
                  onChangeText={(v) => { setForm({ ...form, password: v }); setErrors({ ...errors, password: '' }); setGlobalError(''); }}
                  secureTextEntry={!showPass}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                  <Ionicons name={showPass ? 'eye-off' : 'eye'} size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>
              {!!errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}
            </View>

            {/* Bouton */}
            <TouchableOpacity
              style={[styles.btnPrimary, isLoading && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Se connecter</Text>
              }
            </TouchableOpacity>

            {/* Lien inscription */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              style={styles.linkRow}
            >
              <Text style={styles.linkText}>
                Pas encore de compte ?{' '}
                <Text style={styles.linkBold}>Créer un compte</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.footer}>Communication 100 % locale — LAN sécurisé</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#16a34a' },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  headerSection: { alignItems: 'center', marginBottom: 28 },
  iconWrap: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 20 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1,
    borderRadius: 12, padding: 12, marginBottom: 16,
  },
  errorBannerText: { flex: 1, color: '#dc2626', fontSize: 13, lineHeight: 18 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1e293b', backgroundColor: '#f9fafb',
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12,
    backgroundColor: '#f9fafb',
  },
  inputInner: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1e293b',
  },
  eyeBtn: { paddingHorizontal: 14 },
  inputError: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
  fieldError: { color: '#ef4444', fontSize: 12, marginTop: 4, marginLeft: 2 },
  btnPrimary: {
    backgroundColor: '#16a34a', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
    shadowColor: '#16a34a', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkRow: { alignItems: 'center', marginTop: 16 },
  linkText: { fontSize: 13, color: '#64748b' },
  linkBold: { color: '#16a34a', fontWeight: '700' },
  footer: { color: 'rgba(255,255,255,0.6)', fontSize: 11, textAlign: 'center', marginTop: 20 },
});