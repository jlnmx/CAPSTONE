/**
 * Login Screen
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, Pressable } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { useAuth } from '@hooks/useAuth';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, BorderRadius } from '@constants/colors';
import { TextInput, PasswordInput } from '@components/TextInputs';
import { PrimaryButton } from '@components/Buttons';
import AppBackArrow from '@components/AppBackArrow';

export default function LoginScreen() {
  const { login, loginAsDemo, error, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleLogin = async () => {
    setValidationError('');
    const identifier = email.trim();

    if (!identifier || !password) {
      setValidationError('Please enter your email or mobile number and password.');
      return;
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const normalizedMobile = identifier.replace(/[\s()-]/g, '');
    const isPhilippineMobile = /^(09\d{9}|\+639\d{9}|639\d{9})$/.test(normalizedMobile);
    if (!isEmail && !isPhilippineMobile) {
      setValidationError('Enter a valid email or Philippine mobile number.');
      return;
    }

    await login(identifier, password, ['resident', 'responder']);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}><AppBackArrow /><View style={styles.brandCopy}><Text style={styles.brandName}>HANDA</Text><Text style={styles.tagline}>Laging handa para sayo.</Text></View></View>

      <View style={styles.formSection}>
        <TextInput
          placeholder="Email or mobile number"
          value={email}
          onChangeText={setEmail}
          keyboardType="default"
          containerStyle={styles.inputContainer}
          inputStyle={styles.referenceInput}
          error={validationError ? undefined : undefined}
        />

        <PasswordInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          containerStyle={styles.inputContainer}
          inputStyle={styles.referenceInput}
          error={validationError ? undefined : undefined}
        />

        {/* Error Message */}
        {(validationError || error) && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorMessage}>{validationError || error}</Text>
          </View>
        )}

        <PrimaryButton
          label="Login"
          onPress={handleLogin}
          loading={isLoading}
          disabled={isLoading}
          style={styles.loginButton}
          textStyle={styles.referenceButtonText}
        />

        <PrimaryButton
          label="Forgot Password?"
          onPress={() => router.push('/(auth)/forgot-password')}
          style={styles.forgotButton}
          textStyle={styles.forgotButtonText}
        />

        <View style={styles.createPromptRow}>
          <Text style={styles.createPrompt}>Don&apos;t have an account yet?</Text>
          <Pressable onPress={() => router.push('/(auth)/register-role')} accessibilityRole="link">
            <Text style={styles.createLink}>Create an Account</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { width: '100%', maxWidth: 620, minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, backgroundColor: '#218B25' },
  brandCopy: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  contentContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  brandSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 28,
  },
  brandName: {
    color: '#FFFFFF',
    fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', web: 'Segoe UI' }),
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 2,
    lineHeight: 50,
  },
  tagline: {
    color: '#DFF1DF',
    fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', web: 'Segoe UI' }),
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  formSection: {
    width: 360,
    maxWidth: '92%',
    padding: 22,
    borderWidth: 1,
    borderColor: '#8BC58B',
    borderRadius: 16,
    backgroundColor: Colors.surfaceMuted,
    marginTop: 0,
  },
  inputContainer: {
    marginBottom: 18,
  },
  referenceInput: {
    height: 48,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderColor: Colors.border,
    borderRadius: 9,
    backgroundColor: Colors.surface,
    fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', web: 'Segoe UI' }),
    fontSize: 14,
    color: Colors.text,
  },
  errorContainer: {
    backgroundColor: Colors.emergency,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  errorMessage: {
    color: Colors.white,
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
  },
  loginButton: {
    height: 48,
    minHeight: 48,
    paddingVertical: 0,
    borderRadius: 9,
    backgroundColor: '#2D2D2D',
    marginBottom: 20,
    shadowOpacity: 0,
    elevation: 0,
    shadowColor: 'transparent',
  },
  createPrompt: {
    color: '#218B25',
    fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', web: 'Segoe UI' }),
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  createPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    columnGap: 4,
  },
  forgotButton: {
    height: 34,
    minHeight: 34,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    shadowColor: 'transparent',
    marginBottom: 4,
  },
  forgotButtonText: {
    color: '#218B25',
    fontSize: 13,
    fontWeight: '600',
  },
  createLink: {
    color: '#218B25',
    fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', web: 'Segoe UI' }),
    fontSize: 13,
    fontWeight: '700',
  },
  referenceButtonText: {
    fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', web: 'Segoe UI' }),
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
  },
});
