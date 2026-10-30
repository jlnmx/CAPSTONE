import React, { useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AnimatedPressable as TouchableOpacity } from '@components/Buttons';
import { AuthService } from '@services/authService';
import AppBackArrow from '@components/AppBackArrow';

const GREEN = '#218B25';
const PAGE_BACKGROUND = '#F5F7FA';
const SURFACE = '#FFFFFF';
const SURFACE_MUTED = '#F0F2F5';
const TEXT = '#17212B';
const TEXT_MUTED = '#475467';
const FIELD_BORDER = '#D7E2EA';
const PLACEHOLDER = '#667085';
type Channel = 'email' | 'sms';
type Step = 'request' | 'otp' | 'password';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const accent = GREEN;
  const errorColor = '#B42318';
  const successColor = GREEN;
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}><AppBackArrow /><View><Text style={styles.headerBrand}>HANDA</Text><Text style={styles.headerSubtitle}>ACCOUNT RECOVERY</Text></View></View>
      <Text style={styles.title}>Forgot password?</Text>
      <Text style={styles.subtitle}>
        {step === 'request' ? 'Choose where you want to receive your reset code.' : step === 'otp' ? `Enter the code sent to ${destination}.` : 'Create a new password for your account.'}
      </Text>

      <View style={styles.form}>
        {step === 'request' && (
          <>
            <View style={styles.channelRow}>
              {(['email', 'sms'] as Channel[]).map((option) => (
                <TouchableOpacity key={option} style={[styles.channelButton, channel === option && styles.channelButtonActive]} onPress={() => setChannel(option)} accessibilityRole="button">
                  <Text style={[styles.channelText, channel === option && styles.channelTextActive]}>{option === 'email' ? 'Email' : 'SMS'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder={channel === 'email' ? 'Email address' : 'Mobile number'}
              placeholderTextColor={PLACEHOLDER}
              value={identifier}
              onChangeText={setIdentifier}
              keyboardType={channel === 'email' ? 'email-address' : 'phone-pad'}
              autoCapitalize="none"
              autoComplete={channel === 'email' ? 'email' : 'tel'}
            />
            <ActionButton label="Send reset code" onPress={submitRequest} loading={isSubmitting} />
          </>
        )}

        {step === 'otp' && (
          <>
            <TextInput style={styles.input} placeholder="6-digit code" placeholderTextColor={PLACEHOLDER} value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} selectionColor={GREEN} />
            <ActionButton label="Verify code" onPress={verifyOtp} loading={isSubmitting} />
            <TouchableOpacity style={styles.linkButton} onPress={resend}><Text style={styles.linkText}>Send a new code</Text></TouchableOpacity>
          </>
        )}

        {step === 'password' && (
          <>
            <TextInput style={styles.input} placeholder="New password" placeholderTextColor={PLACEHOLDER} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" selectionColor={GREEN} />
            <TextInput style={styles.input} placeholder="Confirm new password" placeholderTextColor={PLACEHOLDER} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" selectionColor={GREEN} />
            <ActionButton label="Update password" onPress={completeReset} loading={isSubmitting} />
          </>
        )}

        {!!message && <Text style={[styles.success, { color: successColor }]}>{message}</Text>}
        {!!error && <Text style={[styles.error, { color: errorColor }]}>{error}</Text>}
      </View>
    </ScrollView>
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
  container: { flex: 1, backgroundColor: PAGE_BACKGROUND },
  content: { flexGrow: 1, alignItems: 'center', paddingTop: 16, paddingBottom: 56 },
  header: { width: '100%', minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, backgroundColor: GREEN },
  headerBrand: { color: '#FFFFFF', fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', web: 'Segoe UI' }), fontSize: 21, fontWeight: '800' },
  headerSubtitle: { color: '#DFF1DF', fontSize: 9, fontWeight: '800', marginTop: 2 },
  title: { color: TEXT, fontSize: 25, fontWeight: '700', marginTop: 28 },
  subtitle: { color: TEXT_MUTED, fontSize: 14, textAlign: 'center', maxWidth: 320, lineHeight: 21, marginTop: 8, marginBottom: 24 },
  form: { width: 360, maxWidth: '92%', padding: 22, borderWidth: 1, borderColor: FIELD_BORDER, borderRadius: 12, backgroundColor: SURFACE_MUTED },
  channelRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  channelButton: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FIELD_BORDER, borderRadius: 9, backgroundColor: SURFACE },
  channelButtonActive: { borderColor: GREEN, backgroundColor: SURFACE },
  channelText: { color: TEXT_MUTED, fontWeight: '600' },
  channelTextActive: { color: GREEN },
  input: { height: 48, borderWidth: 1, borderColor: FIELD_BORDER, borderRadius: 9, backgroundColor: SURFACE, paddingHorizontal: 14, marginBottom: 16, color: TEXT, fontSize: 16 },
  actionButton: { height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#2D2D2D', marginBottom: 12 },
  actionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  linkButton: { alignItems: 'center', padding: 8 },
  linkText: { color: GREEN, fontSize: 13, fontWeight: '600' },
  success: { color: GREEN, fontSize: 13, lineHeight: 19, marginTop: 8 },
  error: { color: '#B42318', fontSize: 13, lineHeight: 19, marginTop: 8 },
});
