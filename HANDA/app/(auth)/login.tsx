/**
 * Login Screen
 */

import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import { useAuth } from '@hooks/useAuth';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, BorderRadius } from '@constants/colors';
import { AppBoldFontFamily, AppFontFamily, AppHeadingFontFamily, AppMediumFontFamily, AppSemiboldFontFamily } from '@constants/typography';
import { TextInput, PasswordInput } from '@components/TextInputs';
import { PrimaryButton } from '@components/Buttons';

export default function LoginScreen() {
  const { login, error, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState('');
  const [stayLoggedIn, setStayLoggedIn] = useState(true);

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

    await login(identifier, password, ['resident', 'responder'], stayLoggedIn);
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#167B25', '#22962E', '#2CA33B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View pointerEvents="none" style={styles.heroOrbLarge} />
          <View pointerEvents="none" style={styles.heroOrbSmall} />
          <Animated.View entering={FadeInDown.duration(500)} style={styles.heroContent}>
            <View style={styles.heroBrandRow}>
              <View style={styles.heroMark}>
                <Image
                  source={require('../../assets/images/handa-logo.png')}
                  style={styles.heroLogo}
                  resizeMode="contain"
                  accessibilityLabel="HANDA logo"
                />
              </View>
              <View>
                <Text style={styles.heroBrand}>HANDA</Text>
                <Text style={styles.heroBrandCaption}>COMMUNITY SAFETY</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>Welcome back</Text>
            <Text style={styles.heroSubtitle}>Sign in to stay connected and ready.</Text>
          </Animated.View>
        </LinearGradient>

        <View style={styles.formArea}>
          <Animated.View entering={FadeInUp.duration(500).delay(100)} style={styles.formSection}>
            <View style={styles.cardHeading}>
              <Text style={styles.cardTitle}>Sign in to HANDA</Text>
              <Text style={styles.cardSubtitle}>Use your email or mobile number to continue.</Text>
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
                onPress={() => setStayLoggedIn((value) => !value)}
                style={styles.stayRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: stayLoggedIn }}
                accessibilityLabel="Keep me signed in"
              >
                <MaterialCommunityIcons
                  name={stayLoggedIn ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={21}
                  color={stayLoggedIn ? '#218B25' : Colors.textMuted}
                />
                <Text style={styles.stayLabel}>Keep me signed in</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/(auth)/forgot-password')}
                accessibilityRole="link"
              >
                <Text style={styles.forgotLink}>Forgot password?</Text>
              </Pressable>
            </View>

            {(validationError || error) && (
              <View style={styles.errorContainer} accessibilityRole="alert">
                <MaterialCommunityIcons name="alert-circle-outline" size={19} color={Colors.emergency} />
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

            <View style={styles.divider} />

            <View style={styles.createPromptRow}>
              <Text style={styles.createPrompt}>New to HANDA?</Text>
              <Pressable onPress={() => router.push('/(auth)/register-role')} accessibilityRole="link">
                <Text style={styles.createLink}>Create an account</Text>
              </Pressable>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(500).delay(220)} style={styles.securityNote}>
            <MaterialCommunityIcons name="shield-check-outline" size={17} color="#43824A" />
            <Text style={styles.securityText}>Your community response starts here.</Text>
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#F3F7F4',
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  hero: {
    minHeight: 248,
    paddingHorizontal: 24,
    paddingTop: 38,
    paddingBottom: 78,
    overflow: 'hidden',
  },
  heroContent: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    zIndex: 1,
  },
  heroBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 24,
  },
  heroMark: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.17)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  heroLogo: {
    width: 32,
    height: 32,
  },
  heroBrand: {
    color: Colors.white,
    fontFamily: AppBoldFontFamily,
    fontSize: 17,
    letterSpacing: 1.1,
  },
  heroBrandCaption: {
    color: '#D6F1D9',
    fontFamily: AppSemiboldFontFamily,
    fontSize: 9,
    letterSpacing: 1.15,
    marginTop: 2,
  },
  heroTitle: {
    color: Colors.white,
    fontFamily: AppHeadingFontFamily,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: '#E1F3E4',
    fontFamily: AppFontFamily,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 5,
  },
  heroOrbLarge: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.055)',
    right: -88,
    top: -105,
  },
  heroOrbSmall: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.06)',
    right: 12,
    bottom: 8,
  },
  formArea: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: -48,
  },
  formSection: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 25,
    paddingBottom: 23,
    borderWidth: 1,
    borderColor: '#E3EBE5',
    borderRadius: 24,
    backgroundColor: Colors.surface,
    shadowColor: '#1C4E29',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 5,
  },
  cardHeading: {
    marginBottom: 22,
  },
  cardTitle: {
    color: Colors.text,
    fontFamily: AppHeadingFontFamily,
    fontSize: 21,
    lineHeight: 28,
    letterSpacing: -0.25,
  },
  cardSubtitle: {
    color: Colors.textMuted,
    fontFamily: AppFontFamily,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  inputContainer: {
    marginBottom: 17,
  },
  passwordContainer: {
    marginBottom: 13,
  },
  referenceInput: {
    minHeight: 54,
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 13,
    fontFamily: AppFontFamily,
    fontSize: 15,
  },
  forgotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 21,
  },
  stayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stayLabel: {
    color: Colors.text,
    fontFamily: AppMediumFontFamily,
    fontSize: 13,
  },
  forgotLink: {
    color: '#218B25',
    fontFamily: AppSemiboldFontFamily,
    fontSize: 13,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF1F0',
    borderWidth: 1,
    borderColor: '#F3C8C5',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  errorMessage: {
    flex: 1,
    color: Colors.emergency,
    fontFamily: AppMediumFontFamily,
    fontSize: Typography.sizes.sm,
    lineHeight: 19,
  },
  loginButton: {
    minHeight: 56,
    paddingVertical: 0,
    borderRadius: 14,
    backgroundColor: '#218B25',
    marginBottom: 18,
    shadowColor: '#218B25',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 3,
  },
  referenceButtonText: {
    fontFamily: AppBoldFontFamily,
    fontSize: 16,
    letterSpacing: 0.2,
  },
  divider: {
    height: 1,
    backgroundColor: '#EDF1EE',
    marginBottom: 17,
  },
  createPrompt: {
    color: Colors.textMuted,
    fontFamily: AppFontFamily,
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
    fontFamily: AppBoldFontFamily,
    fontSize: 14,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 18,
    paddingHorizontal: 8,
  },
  securityText: {
    color: '#66796A',
    fontFamily: AppMediumFontFamily,
    fontSize: 12,
  },
});
