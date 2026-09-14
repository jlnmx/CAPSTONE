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
          showVisibilityToggle={false}
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
    paddingTop: 30,
    paddingBottom: 40,
  },
  brandSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
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
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: 1,
    lineHeight: 54,
  },
  tagline: {
    color: '#218B25',
    fontSize: 14,
    marginTop: 2,
  },
  formSection: {
    width: 286,
    maxWidth: '90%',
    padding: 14,
    borderWidth: 1,
    borderColor: '#8BC58B',
    borderRadius: 10,
    backgroundColor: '#F0F2F5',
    marginTop: 0,
  },
  inputContainer: {
    marginBottom: 16,
  },
  referenceInput: {
    height: 36,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderColor: '#D5D5D5',
    borderRadius: 7,
    backgroundColor: Colors.white,
    fontSize: 12,
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
    height: 35,
    minHeight: 35,
    paddingVertical: 0,
    borderRadius: 6,
    backgroundColor: '#2D2D2D',
    marginBottom: 23,
    shadowOpacity: 0,
    elevation: 0,
    shadowColor: 'transparent',
  },
  createPrompt: {
    color: '#218B25',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  referenceButtonText: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0,
  },
  createButton: {
    height: 35,
    minHeight: 35,
    paddingVertical: 0,
    borderRadius: 6,
    backgroundColor: '#2D2D2D',
    shadowOpacity: 0,
    elevation: 0,
    shadowColor: 'transparent',
  },
});
