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
import { HandaLogo } from '@components/HandaLogo';
import { TextInput, PasswordInput } from '@components/TextInputs';
import { PrimaryButton, SecondaryButton, LinkButton } from '@components/Buttons';

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

  const handleDemoLogin = async (role: 'responder' | 'resident') => {
    try {
      await loginAsDemo(role);
    } catch (err) {
      Alert.alert('Error', 'Failed to login as demo user.');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Logo Section */}
      <View style={styles.logoSection}>
        <HandaLogo size="large" showTagline={true} />
      </View>

      {/* Form Section */}
      <View style={styles.formSection}>
        <TextInput
          label="Email or Username"
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          containerStyle={styles.inputContainer}
          error={validationError ? undefined : undefined}
        />

        <PasswordInput
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          containerStyle={styles.inputContainer}
          error={validationError ? undefined : undefined}
        />

        {/* Error Message */}
        {(validationError || error) && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorMessage}>{validationError || error}</Text>
          </View>
        )}

        {/* Login Button */}
        <PrimaryButton
          label="Login"
          onPress={handleLogin}
          loading={isLoading}
          disabled={isLoading}
          style={styles.loginButton}
        />

        {/* Forgot Password */}
        <View style={styles.forgotContainer}>
          <LinkButton
            label="Forgot Password?"
            onPress={() => Alert.alert('Info', 'Password reset feature coming soon.')}
          />
        </View>

        {/* Divider */}
        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.divider} />
        </View>

        {/* Demo Login */}
        <View style={styles.demoSection}>
          <Text style={styles.demoTitle}>Try Demo Account</Text>
          <SecondaryButton
            label="Continue as Responder"
            onPress={() => handleDemoLogin('responder')}
            loading={isLoading}
            disabled={isLoading}
            style={styles.demoButton}
          />
          <SecondaryButton
            label="Continue as Resident"
            onPress={() => handleDemoLogin('resident')}
            loading={isLoading}
            disabled={isLoading}
            style={styles.demoButton}
          />
        </View>
      </View>

      {/* Test Credentials Info */}
      <View style={styles.testCredsSection}>
        <Text style={styles.testCredsTitle}>Test Credentials</Text>
        <Text style={styles.testCredsMuted}>
          Email: responder@handa.local{'\n'}
          Password: responder123
        </Text>
        <Text style={styles.testCredsMuted}>
          Email: resident@handa.local{'\n'}
          Password: resident123
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingVertical: Spacing.xl,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    marginTop: Spacing.lg,
  },
  formSection: {
    paddingHorizontal: Spacing.lg,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
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
    marginBottom: Spacing.md,
  },
  forgotContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.textMuted,
    opacity: 0.3,
  },
  dividerText: {
    marginHorizontal: Spacing.md,
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
  },
  demoSection: {
    marginBottom: Spacing.lg,
  },
  demoTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  demoButton: {
    marginBottom: Spacing.md,
  },
  testCredsSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  testCredsTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  testCredsMuted: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
    fontFamily: 'SpaceMono',
  },
});
