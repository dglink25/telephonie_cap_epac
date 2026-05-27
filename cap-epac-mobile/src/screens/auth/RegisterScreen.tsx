// src/screens/auth/RegisterScreen.tsx
import React, { useState } from 'react';

import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { authAPI } from '../../services/api';
import { Button, Input } from '../../components/common';
import { COLORS, SIZES, DEPARTMENTS } from '../../utils/constants';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface Props {
  navigation: NativeStackNavigationProp<any>;
}

const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const [form, setForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    display_name: '',
    department: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.username.trim() || form.username.length < 3)
      e.username = 'Min. 3 caractères';
    if (!/^[a-zA-Z0-9._-]+$/.test(form.username))
      e.username = 'Caractères alphanumériques uniquement';
    if (!form.display_name.trim() || form.display_name.length < 2)
      e.display_name = 'Min. 2 caractères';
    if (form.password.length < 8)
      e.password = 'Min. 8 caractères';
    if (!/[A-Z]/.test(form.password))
      e.password = 'Au moins une majuscule';
    if (!/[0-9]/.test(form.password))
      e.password = 'Au moins un chiffre';
    if (form.password !== form.confirmPassword)
      e.confirmPassword = 'Les mots de passe ne correspondent pas';
    if (!form.department)
      e.department = 'Sélectionnez un service';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await authAPI.register({
        username: form.username.trim().toLowerCase(),
        password: form.password,
        display_name: form.display_name.trim(),
        department: form.department,
      });
      Alert.alert(
        'Compte créé !',
        'Votre compte a été créé avec succès. Connectez-vous.',
        [{ text: 'Connexion', onPress: () => navigation.replace('Login') }]
      );
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Erreur lors de la création';
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>Retour</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Rejoignez le réseau CAP-EPAC</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Nom d'affichage"
            value={form.display_name}
            onChangeText={(v) => set('display_name', v)}
            placeholder="Ex : Max Frejus"
            autoCapitalize="words"
            error={errors.display_name}
          />

          <Input
            label="Identifiant"
            value={form.username}
            onChangeText={(v) => set('username', v)}
            placeholder="Ex : max.frejus ou MaxFrejus "
            error={errors.username}
          />

          <Text style={styles.sectionLabel}>Service</Text>
          <View style={styles.deptGrid}>
            {DEPARTMENTS.map((dept) => (
              <TouchableOpacity
                key={dept}
                onPress={() => set('department', dept)}
                style={[
                  styles.deptChip,
                  form.department === dept && styles.deptChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.deptChipText,
                    form.department === dept && styles.deptChipTextActive,
                  ]}
                >
                  {dept}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.department && (
            <Text style={styles.errorText}>{errors.department}</Text>
          )}

          <Input
            label="Mot de passe"
            value={form.password}
            onChangeText={(v) => set('password', v)}
            placeholder="Min. 8 car., 1 majuscule, 1 chiffre"
            secureTextEntry
            error={errors.password}
          />

          <Input
            label="Confirmer le mot de passe"
            value={form.confirmPassword}
            onChangeText={(v) => set('confirmPassword', v)}
            placeholder="Répéter le mot de passe"
            secureTextEntry
            error={errors.confirmPassword}
          />

          <Button
            title="Créer mon compte"
            onPress={handleRegister}
            loading={loading}
            size="lg"
            style={styles.submitBtn}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  scroll: { flexGrow: 1 },
  header: {
    backgroundColor: COLORS.primary,
    padding: 24,
    paddingTop: 50,
    paddingBottom: 32,
  },
  backBtn: { marginBottom: 16 },
  backText: { color: COLORS.white, fontSize: SIZES.md, opacity: 0.85 },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 4,
  },
  subtitle: { color: 'rgba(255,255,255,0.75)', fontSize: SIZES.sm },
  form: { padding: 24 },
  infoBox: {
    backgroundColor: COLORS.primaryXXLight,
    borderRadius: SIZES.radiusMd,
    padding: 10,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  infoText: { color: COLORS.primaryDark, fontSize: SIZES.sm },
  sectionLabel: {
    fontSize: SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray700,
    marginBottom: 10,
  },
  deptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  deptChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: SIZES.radiusFull,
    borderWidth: 1.5,
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.gray50,
  },
  deptChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryXLight,
  },
  deptChipText: { fontSize: SIZES.sm, color: COLORS.gray600 },
  deptChipTextActive: { color: COLORS.primaryDark, fontWeight: '600' },
  errorText: { color: COLORS.danger, fontSize: SIZES.xs, marginBottom: 12 },
  submitBtn: { marginTop: 8, width: '100%' },
});

export default RegisterScreen;
