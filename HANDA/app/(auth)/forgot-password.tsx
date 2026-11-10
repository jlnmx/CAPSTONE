import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { AnimatedPressable as TouchableOpacity } from '@components/Buttons';
import { AuthService } from '@services/authService';
import AppBackArrow from '@components/AppBackArrow';
import { HandaLogoBadge } from '@components/HandaLogo';
import { AppBoldFontFamily, AppFontFamily, AppHeadingFontFamily, AppMediumFontFamily, AppSemiboldFontFamily } from '@constants/typography';

const GREEN = '#218B25';
const PAGE_BACKGROUND = '#F3F7F4';
const SURFACE = '#FFFFFF';
const TEXT = '#17212B';
const TEXT_MUTED = '#667085';
const FIELD_BORDER = '#DCE6DF';
const PLACEHOLDER = '#7A8791';
type Channel = 'email' | 'sms';
type Step = 'request' | 'otp' | 'password';

const STEP_CONTENT: Record<Step, { title: string; description: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = {
  request: {
    title: 'Forgot password?',
    description: 'Choose where you want to receive your secure reset code.',
    icon: 'lock-reset',
  },
  otp: {
    title: 'Check your messages',
    description: 'Enter the 6-digit code we sent to your contact.',
    icon: 'message-badge-outline',
  },
  password: {
    title: 'Create a new password',
    description: 'Choose a strong password you have not used before.',
    icon: 'form-textbox-password',
  },
};

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('request');
  const [channel, setChannel] = useState<Channel>('email');
  const [identifier, setIdentifier] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const submitRequest = async () => {
    const value = identifier.trim();
    if (channel === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Enter the email address linked to your account.');
      return;
    }
    if (channel === 'sms' && !/^(09\d{9}|\+639\d{9}|639\d{9})$/.test(value.replace(/[\s()-]/g, ''))) {
      setError('Enter a valid Philippine mobile number.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const result = await AuthService.requestPasswordReset(value, channel);
      if (!result.resetToken) {
        setError('No active account was found for that contact.');
        return;
      }
      setResetToken(result.resetToken);
      setDestination(result.destination || (channel === 'email' ? value : 'your mobile number'));
      setMessage('A one-time code was sent. It expires in 10 minutes.');
      setStep('otp');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to send the reset code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyOtp = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code you received.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await AuthService.verifyPasswordReset(resetToken, otp);
      setMessage('Code verified. Choose a new password.');
      setStep('password');
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : 'The reset code is invalid or expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const completeReset = async () => {
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      setError('Use 8+ characters with uppercase, lowercase, number, and symbol.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await AuthService.completePasswordReset(resetToken, otp, newPassword);
      setMessage('Password updated. You can now sign in.');
      setTimeout(() => router.replace('/(auth)/login'), 700);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Unable to update your password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resend = () => {
    setStep('request');
    setMessage('');
    setError('');
  };

  const content = STEP_CONTENT[step];

  return (
    <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#167B25', '#22962E', '#2CA33B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View pointerEvents="none" style={styles.headerOrb} />
          <Animated.View entering={FadeInDown.duration(450)} style={styles.headerContent}>
            <View style={styles.brandRow}>
              <AppBackArrow />
              <HandaLogoBadge size={44} />
              <View style={styles.brandCopy}>
                <Text style={styles.headerBrand}>HANDA</Text>
                <Text style={styles.headerSubtitle}>ACCOUNT RECOVERY</Text>
              </View>
            </View>
          </Animated.View>
        </LinearGradient>

        <View style={styles.body}>
          <Animated.View key={step} entering={FadeInUp.duration(320)} style={styles.intro}>
            <View style={styles.titleIcon}>
              <MaterialCommunityIcons name={content.icon} size={25} color={GREEN} />
            </View>
            <Text style={styles.title}>{content.title}</Text>
            <Text style={styles.subtitle}>
              {step === 'otp' ? `Enter the code sent to ${destination}.` : content.description}
            </Text>
          </Animated.View>

          <Animated.View key={`form-${step}`} entering={FadeInUp.duration(400).delay(70)} style={styles.form}>
            <View style={styles.progressRow} accessibilityLabel={`Step ${step === 'request' ? 1 : step === 'otp' ? 2 : 3} of 3`}>
              {(['request', 'otp', 'password'] as Step[]).map((item, index) => {
                const activeIndex = step === 'request' ? 0 : step === 'otp' ? 1 : 2;
                const complete = index < activeIndex;
                return (
                  <React.Fragment key={item}>
                    <View style={[styles.progressStep, (index === activeIndex || complete) && styles.progressStepActive]}>
                      {complete ? (
                        <MaterialCommunityIcons name="check" size={13} color="#FFFFFF" />
                      ) : (
                        <Text style={[styles.progressNumber, index === activeIndex && styles.progressNumberActive]}>{index + 1}</Text>
                      )}
                    </View>
                    {index < 2 && <View style={[styles.progressLine, index < activeIndex && styles.progressLineActive]} />}
                  </React.Fragment>
                );
              })}
            </View>

            {step === 'request' && (
              <>
                <Text style={styles.fieldLabel}>Send code by</Text>
                <View style={styles.channelRow}>
                  {(['email', 'sms'] as Channel[]).map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[styles.channelButton, channel === option && styles.channelButtonActive]}
                      onPress={() => setChannel(option)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: channel === option }}
                    >
                      <MaterialCommunityIcons
                        name={option === 'email' ? 'email-outline' : 'message-text-outline'}
                        size={18}
                        color={channel === option ? GREEN : TEXT_MUTED}
                      />
                      <Text style={[styles.channelText, channel === option && styles.channelTextActive]}>
                        {option === 'email' ? 'Email' : 'SMS'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.fieldLabel}>{channel === 'email' ? 'Email address' : 'Mobile number'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={channel === 'email' ? 'name@example.com' : '09XX XXX XXXX'}
                  placeholderTextColor={PLACEHOLDER}
                  value={identifier}
                  onChangeText={setIdentifier}
                  keyboardType={channel === 'email' ? 'email-address' : 'phone-pad'}
                  autoCapitalize="none"
                  autoComplete={channel === 'email' ? 'email' : 'tel'}
                  selectionColor={GREEN}
                />
                <ActionButton label="Send reset code" onPress={submitRequest} loading={isSubmitting} />
                <View style={styles.helperRow}>
                  <MaterialCommunityIcons name="shield-lock-outline" size={16} color={TEXT_MUTED} />
                  <Text style={styles.helperText}>Your reset code is private and expires in 10 minutes.</Text>
                </View>
              </>
            )}

            {step === 'otp' && (
              <>
                <Text style={styles.fieldLabel}>6-digit verification code</Text>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  placeholder="000000"
                  placeholderTextColor={PLACEHOLDER}
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                  selectionColor={GREEN}
                  textContentType="oneTimeCode"
                />
                <ActionButton label="Verify code" onPress={verifyOtp} loading={isSubmitting} />
                <TouchableOpacity style={styles.linkButton} onPress={resend} accessibilityRole="button">
                  <Text style={styles.linkText}>Use a different email or number</Text>
                </TouchableOpacity>
              </>
            )}

            {step === 'password' && (
              <>
                <Text style={styles.fieldLabel}>New password</Text>
                <View style={styles.passwordField}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="Enter new password"
                    placeholderTextColor={PLACEHOLDER}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                    selectionColor={GREEN}
                  />
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    onPress={() => setShowNewPassword((value) => !value)}
                    accessibilityRole="button"
                    accessibilityLabel={showNewPassword ? 'Hide new password' : 'Show new password'}
                  >
                    <MaterialCommunityIcons name={showNewPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={TEXT_MUTED} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.fieldLabel}>Confirm new password</Text>
                <View style={styles.passwordField}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="Re-enter new password"
                    placeholderTextColor={PLACEHOLDER}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    selectionColor={GREEN}
                  />
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    onPress={() => setShowConfirmPassword((value) => !value)}
                    accessibilityRole="button"
                    accessibilityLabel={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    <MaterialCommunityIcons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={TEXT_MUTED} />
                  </TouchableOpacity>
                </View>
                <View style={styles.helperRow}>
                  <MaterialCommunityIcons name="information-outline" size={16} color={TEXT_MUTED} />
                  <Text style={styles.helperText}>Use 8+ characters with uppercase, lowercase, number, and symbol.</Text>
                </View>
                <ActionButton label="Update password" onPress={completeReset} loading={isSubmitting} />
              </>
            )}

            {!!message && (
              <View style={styles.successBanner} accessibilityRole="alert">
                <MaterialCommunityIcons name="check-circle-outline" size={19} color={GREEN} />
                <Text style={styles.success}>{message}</Text>
              </View>
            )}
            {!!error && (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <MaterialCommunityIcons name="alert-circle-outline" size={19} color="#B42318" />
                <Text style={styles.error}>{error}</Text>
              </View>
            )}
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ActionButton({ label, onPress, loading }: { label: string; onPress: () => void; loading: boolean }) {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress} disabled={loading} accessibilityRole="button">
      {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.actionText}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: { flex: 1 },
  container: { flex: 1, backgroundColor: PAGE_BACKGROUND },
  content: { flexGrow: 1, paddingBottom: 32 },
  header: { minHeight: 128, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 54, overflow: 'hidden' },
  headerContent: { width: '100%', maxWidth: 520, alignSelf: 'center', zIndex: 1 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandCopy: { flex: 1 },
  headerBrand: { color: '#FFFFFF', fontFamily: AppBoldFontFamily, fontSize: 20, letterSpacing: 0.6 },
  headerSubtitle: { color: '#DFF1DF', fontFamily: AppSemiboldFontFamily, fontSize: 9, letterSpacing: 1.1, marginTop: 2 },
  headerOrb: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,255,255,0.07)', right: -60, top: -98 },
  body: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 20, marginTop: -34 },
  intro: { alignItems: 'center', marginBottom: 23, paddingHorizontal: 8 },
  titleIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E4F3E6', borderWidth: 1, borderColor: '#D3EAD6', marginBottom: 13 },
  title: { color: TEXT, fontFamily: AppHeadingFontFamily, fontSize: 24, lineHeight: 32, textAlign: 'center', letterSpacing: -0.35 },
  subtitle: { color: TEXT_MUTED, fontFamily: AppFontFamily, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 340, marginTop: 6 },
  form: {
    width: '100%',
    padding: 22,
    borderWidth: 1,
    borderColor: '#E3EBE5',
    borderRadius: 23,
    backgroundColor: SURFACE,
    shadowColor: '#1C4E29',
    shadowOffset: { width: 0, height: 11 },
    shadowOpacity: 0.09,
    shadowRadius: 22,
    elevation: 4,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  progressStep: { width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F3F1', borderWidth: 1, borderColor: '#E1E7E2' },
  progressStepActive: { backgroundColor: GREEN, borderColor: GREEN },
  progressNumber: { color: TEXT_MUTED, fontFamily: AppSemiboldFontFamily, fontSize: 12 },
  progressNumberActive: { color: '#FFFFFF' },
  progressLine: { width: 50, height: 2, backgroundColor: '#E5EBE6', marginHorizontal: 7 },
  progressLineActive: { backgroundColor: '#75BD7A' },
  fieldLabel: { color: TEXT, fontFamily: AppSemiboldFontFamily, fontSize: 13, marginBottom: 8 },
  channelRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  channelButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: FIELD_BORDER, borderRadius: 13, backgroundColor: '#FBFCFB' },
  channelButtonActive: { borderColor: GREEN, backgroundColor: '#F0F8F1' },
  channelText: { color: TEXT_MUTED, fontFamily: AppMediumFontFamily, fontSize: 14 },
  channelTextActive: { color: GREEN, fontFamily: AppSemiboldFontFamily },
  input: { minHeight: 54, borderWidth: 1, borderColor: FIELD_BORDER, borderRadius: 13, backgroundColor: '#FFFFFF', paddingHorizontal: 15, marginBottom: 17, color: TEXT, fontFamily: AppFontFamily, fontSize: 15 },
  otpInput: { fontFamily: AppBoldFontFamily, fontSize: 22, letterSpacing: 8, textAlign: 'center' },
  passwordField: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 52 },
  passwordToggle: { position: 'absolute', right: 12, top: 0, height: 54, width: 36, alignItems: 'center', justifyContent: 'center' },
  actionButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: GREEN, marginTop: 2, marginBottom: 12, shadowColor: GREEN, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 3 },
  actionText: { color: '#FFFFFF', fontFamily: AppBoldFontFamily, fontSize: 15, letterSpacing: 0.15 },
  linkButton: { alignItems: 'center', padding: 10 },
  linkText: { color: GREEN, fontFamily: AppSemiboldFontFamily, fontSize: 13 },
  helperRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 4 },
  helperText: { flex: 1, color: TEXT_MUTED, fontFamily: AppFontFamily, fontSize: 12, lineHeight: 18 },
  successBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#EFF8F0', borderWidth: 1, borderColor: '#D5EBD7', marginTop: 8 },
  success: { flex: 1, color: GREEN, fontFamily: AppMediumFontFamily, fontSize: 13, lineHeight: 19 },
  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#FFF3F2', borderWidth: 1, borderColor: '#F3D0CD', marginTop: 8 },
  error: { flex: 1, color: '#B42318', fontFamily: AppMediumFontFamily, fontSize: 13, lineHeight: 19 },
});
