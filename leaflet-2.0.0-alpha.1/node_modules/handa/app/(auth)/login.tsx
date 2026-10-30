/**
 * Login Screen
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import { useAuth } from '@hooks/useAuth';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, BorderRadius } from '@constants/colors';
import { TextInput, PasswordInput } from '@components/TextInputs';
import { PrimaryButton } from '@components/Buttons';

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
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerEyebrow}>HANDA ACCOUNT</Text>
          <Text style={styles.headerTitle}>Welcome back</Text>
          <Text style={styles.headerSubtitle}>Sign in to your HANDA account.</Text>
        </View>

        <View style={styles.formArea}>
          <View style={styles.formSection}>
            <View style={styles.brandLockup}>
              <View style={styles.brandIcon}>
                <MaterialCommunityIcons name="shield-check" size={22} color="#218B25" />
              </View>
              <Text style={styles.brandTitle}>HANDA</Text>
            </View>
            <TextInput
            label="Email or mobile number"
            placeholder="Enter your email or mobile number"
            value={email}
            onChangeText={setEmail}
            keyboardType="default"
            containerStyle={styles.inputContainer}
            inputStyle={styles.referenceInput}
            />

            <PasswordInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            containerStyle={styles.passwordContainer}
            inputStyle={styles.referenceInput}
            />

            <View style={styles.forgotRow}>
              <Pressable
                onPress={() => router.push('/(auth)/forgot-password')}
                accessibilityRole="link"
              >
                <Text style={styles.forgotLink}>Forgot password?</Text>
              </Pressable>
            </View>

            {(validationError || error) && (
              <View style={styles.errorContainer} accessibilityRole="alert">
                <Text style={styles.errorMessage}>{validationError || error}</Text>
              </View>
            )}

            <PrimaryButton
              label="Sign in"
              onPress={handleLogin}
              loading={isLoading}
              disabled={isLoading}
              style={styles.loginButton}
              textStyle={styles.referenceButtonText}
            />

            <View style={styles.createPromptRow}>
              <Text style={styles.createPrompt}>New to HANDA?</Text>
              <Pressable onPress={() => router.push('/(auth)/register-role')} accessibilityRole="link">
                <Text style={styles.createLink}>Create an account</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 48,
  },
  content: {
    width: '100%',
    maxWidth: 760,
    flexGrow: 1,
    alignSelf: 'center',
  },
  header: {
    minHeight: 142,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
    backgroundColor: '#218B25',
  },
  headerEyebrow: {
    color: '#DFF1DF',
    fontFamily: 'InstrumentSans_700Bold',
    fontSize: 10,
  },
  headerTitle: {
    color: Colors.white,
    fontFamily: 'Sora_700Bold',
    fontSize: 27,
    lineHeight: 36,
    marginTop: 5,
  },
  headerSubtitle: {
    color: '#E7F4E7',
    fontFamily: 'InstrumentSans_400Regular',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 5,
  },
  formArea: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  formSection: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 22,
  },
  brandIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#E8F2E8',
  },
  brandTitle: {
    color: '#218B25',
    fontFamily: 'Sora_800ExtraBold',
    fontSize: 20,
  },
  inputContainer: {
    marginBottom: 17,
  },
  passwordContainer: {
    marginBottom: 5,
  },
  referenceInput: {
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.md,
    fontFamily: 'InstrumentSans_400Regular',
    fontSize: 15,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  forgotLink: {
    color: '#218B25',
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: '#FFF1F0',
    borderWidth: 1,
    borderColor: '#F3C8C5',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  errorMessage: {
    color: Colors.emergency,
    fontFamily: 'InstrumentSans_500Medium',
    fontSize: Typography.sizes.sm,
  },
  loginButton: {
    minHeight: 54,
    paddingVertical: 0,
    borderRadius: BorderRadius.md,
    backgroundColor: '#218B25',
    marginBottom: 22,
    shadowOpacity: 0,
    elevation: 0,
    shadowColor: 'transparent',
  },
  referenceButtonText: {
    fontFamily: 'InstrumentSans_700Bold',
    fontSize: 16,
    letterSpacing: 0,
  },
  createPrompt: {
    color: Colors.textMuted,
    fontFamily: 'InstrumentSans_400Regular',
    fontSize: 14,
    textAlign: 'center',
  },
  createPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    columnGap: 5,
    rowGap: 3,
  },
  createLink: {
    color: '#218B25',
    fontFamily: 'InstrumentSans_700Bold',
    fontSize: 14,
  },
});
