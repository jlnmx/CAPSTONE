/**
 * Login Screen
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Text,
  Platform,
} from 'react-native';
import { useAuth } from '@hooks/useAuth';
import { Colors, Typography, Spacing, BorderRadius } from '@constants/colors';
import { TextInput, PasswordInput } from '@components/TextInputs';
import { PrimaryButton } from '@components/Buttons';

export default function LoginScreen() {
  const { login, loginAsDemo, error, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleLogin = async () => {
    setValidationError('');

    // Validation
    if (!email || !password) {
      setValidationError('Please enter both email and password.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setValidationError('Please enter a valid email address.');
      return;
    }

    try {
      await login(email, password);
    } catch (err) {
      setValidationError(error || 'Login failed. Please try again.');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.brandSection}>
        <Text style={styles.sparkles}>✦</Text>
        <Text style={styles.brandName}>HANDA</Text>
        <Text style={styles.tagline}>Laging handa para sayo.</Text>
      </View>

      <View style={styles.formSection}>
        <TextInput
          placeholder="Username or Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
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

        <Text style={styles.createPrompt}>Don&apos;t have an account yet?</Text>
        <PrimaryButton
          label="Create an Account"
          onPress={() => Alert.alert('Info', 'Account creation coming soon.')}
          style={styles.createButton}
          textStyle={styles.referenceButtonText}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  contentContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 56,
  },
  brandSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 28,
    position: 'relative',
  },
  sparkles: {
    position: 'absolute',
    top: -30,
    left: '17%',
    color: '#F5D14B',
    fontSize: 46,
    lineHeight: 50,
  },
  brandName: {
    color: '#218B25',
    fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', web: 'Segoe UI' }),
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 2,
    lineHeight: 50,
  },
  tagline: {
    color: '#218B25',
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
    backgroundColor: '#F0F2F5',
    marginTop: 0,
  },
  inputContainer: {
    marginBottom: 18,
  },
  referenceInput: {
    height: 48,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderColor: '#D5D5D5',
    borderRadius: 9,
    backgroundColor: Colors.white,
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
    marginBottom: 12,
  },
  referenceButtonText: {
    fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', web: 'Segoe UI' }),
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
  },
  createButton: {
    height: 48,
    minHeight: 48,
    paddingVertical: 0,
    borderRadius: 9,
    backgroundColor: '#2D2D2D',
    shadowOpacity: 0,
    elevation: 0,
    shadowColor: 'transparent',
  },
});
