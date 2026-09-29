import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput as NativeTextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useAuth } from '@hooks/useAuth';
import { Colors, Typography, Spacing, BorderRadius } from '@constants/colors';
import { PasswordInput, TextInput } from '@components/TextInputs';
import { PrimaryButton } from '@components/Buttons';
import { API_BASE_URL } from '@services/apiClient';

const NativeDateTimePicker = Platform.OS === 'web' ? null : require('@react-native-community/datetimepicker').default;
const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];

const inputStyle = {
  height: 48,
  paddingVertical: 10,
  paddingHorizontal: 14,
  borderColor: '#D5D5D5',
  borderRadius: 9,
  backgroundColor: Colors.white,
  fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', web: 'Segoe UI' }),
  fontSize: 14,
  color: Colors.text,
};

export default function RegisterScreen() {
  const router = useRouter();
  const { setAuthenticatedUser } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [birthdayDate, setBirthdayDate] = useState(new Date(2000, 0, 1));
  const [isBirthdayPickerOpen, setIsBirthdayPickerOpen] = useState(false);
  const [mobileNumber, setMobileNumber] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleRegister = async () => {
    const errors: Record<string, string> = {};
    setIsSubmitting(true);
    const normalizedMobile = mobileNumber.replace(/[\s()-]/g, '');
    const normalizedEmail = email.trim().toLowerCase();
    if (!firstName.trim()) errors.firstName = 'First name is required.';
    if (!lastName.trim()) errors.lastName = 'Last name is required.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday.trim())) errors.birthday = 'Select a valid birthday.';
    if (!/^(09\d{9}|\+639\d{9}|639\d{9})$/.test(normalizedMobile)) errors.mobileNumber = 'Use a valid Philippine number, e.g. 09171234567.';
    if (!address.trim()) errors.address = 'Current address is required.';
    if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(normalizedEmail)) errors.email = 'Enter a valid email address.';
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      errors.password = 'Use 8+ characters with uppercase, lowercase, number, and symbol.';
    }
    if (!confirmPassword) errors.confirmPassword = 'Confirm your password.';
    else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';

    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      setIsSubmitting(false);
      return;
    }

    const abortController = new AbortController();
    const requestTimeout = setTimeout(() => abortController.abort(), 10000);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), birthday, mobileNumber: normalizedMobile, currentAddress: address.trim(), email: normalizedEmail, password }),
        signal: abortController.signal,
      });
      const result = await response.json() as { id?: string; accessToken?: string; detail?: string; message?: string };
      if (!response.ok) {
        setValidationErrors({ form: result.detail || 'Registration could not be completed.' });
        return;
      }
      await setAuthenticatedUser({ id: result.id || `resident-${Date.now()}`, name: `${firstName.trim()} ${lastName.trim()}`, email: normalizedEmail, role: 'resident' }, result.accessToken);
      router.replace('/(resident)');
    } catch (error) {
      const errorName = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
      setValidationErrors({ form: errorName === 'AbortError' ? 'The registration service timed out. Check the backend and Supabase connection.' : 'Unable to connect to the registration service.' });
    } finally {
      clearTimeout(requestTimeout);
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.brandSection}>
        <Text style={styles.brandName}>HANDA</Text>
        <Text style={styles.tagline}>Create your account</Text>
      </View>
      <View style={styles.formSection}>
        <Text style={styles.formTitle}>Registration</Text>
        <Text style={styles.formSubtitle}>Enter your details to request access.</Text>
        <TextInput label="First Name" placeholder="Enter first name" value={firstName} onChangeText={setFirstName} containerStyle={styles.inputContainer} inputStyle={inputStyle} error={validationErrors.firstName} />
        <TextInput label="Last Name" placeholder="Enter last name" value={lastName} onChangeText={setLastName} containerStyle={styles.inputContainer} inputStyle={inputStyle} error={validationErrors.lastName} />
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Birthday</Text>
          {Platform.OS === 'web' ? <NativeTextInput value={birthday} onChangeText={setBirthday} placeholder="Select birthday" placeholderTextColor={Colors.textMuted} style={styles.webDateInput} {...({ type: 'date', max: new Date().toISOString().slice(0, 10) } as object)} /> : <PrimaryButton label={birthday || 'Select birthday'} onPress={() => setIsBirthdayPickerOpen(true)} style={styles.dateButton} textStyle={styles.dateButtonText} />}
          {NativeDateTimePicker && isBirthdayPickerOpen && <NativeDateTimePicker value={birthdayDate} mode="date" display="default" maximumDate={new Date()} onChange={(_, selectedDate) => { setIsBirthdayPickerOpen(false); if (selectedDate) { setBirthdayDate(selectedDate); setBirthday(`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`); } }} />}
          {validationErrors.birthday && <Text style={styles.fieldError}>{validationErrors.birthday}</Text>}
        </View>
        <TextInput label="Mobile Number" placeholder="09XXXXXXXXX" value={mobileNumber} onChangeText={setMobileNumber} keyboardType="phone-pad" containerStyle={styles.inputContainer} inputStyle={inputStyle} error={validationErrors.mobileNumber} />
        <TextInput label="Current Address" placeholder="Enter current address" value={address} onChangeText={setAddress} containerStyle={styles.inputContainer} inputStyle={inputStyle} error={validationErrors.address} />
        <TextInput label="Email Address" placeholder="Enter email address" value={email} onChangeText={setEmail} keyboardType="email-address" containerStyle={styles.inputContainer} inputStyle={inputStyle} error={validationErrors.email} />
        <PasswordInput label="Create Password" placeholder="Create password" value={password} onChangeText={setPassword} containerStyle={styles.inputContainer} inputStyle={inputStyle} error={validationErrors.password} />
        <PasswordInput label="Confirm Password" placeholder="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} containerStyle={styles.inputContainer} inputStyle={inputStyle} error={validationErrors.confirmPassword} />
        {validationErrors.form && <View style={styles.errorContainer}><Text style={styles.errorMessage}>{validationErrors.form}</Text></View>}
        <PrimaryButton label="Submit Registration" onPress={handleRegister} loading={isSubmitting} disabled={isSubmitting} style={styles.submitButton} textStyle={styles.buttonText} />
        <PrimaryButton label="Back to Login" onPress={() => router.replace('/(auth)/login')} style={styles.backButton} textStyle={styles.buttonText} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  contentContainer: { flexGrow: 1, alignItems: 'center', paddingTop: 42, paddingBottom: 48 },
  brandSection: { width: '100%', alignItems: 'center', marginBottom: 22 },
  brandName: { color: '#218B25', fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', web: 'Segoe UI' }), fontSize: 42, fontWeight: '800', letterSpacing: 2, lineHeight: 50 },
  tagline: { color: '#218B25', fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', web: 'Segoe UI' }), fontSize: 13, fontWeight: '500', marginTop: 4 },
  formSection: { width: 360, maxWidth: '92%', padding: 22, borderWidth: 1, borderColor: '#8BC58B', borderRadius: 16, backgroundColor: '#F0F2F5' },
  formTitle: { color: Colors.text, fontSize: Typography.sizes.xl, fontWeight: '800', marginBottom: 4 },
  formSubtitle: { color: Colors.textMuted, fontSize: Typography.sizes.sm, marginBottom: 18 },
  inputContainer: { marginBottom: 14 },
  inputLabel: { color: Colors.text, fontSize: Typography.sizes.sm, fontWeight: '600', marginBottom: Spacing.sm },
  dateButton: { height: 48, minHeight: 48, paddingVertical: 0, borderRadius: 9, backgroundColor: Colors.white, borderWidth: 1, borderColor: '#D5D5D5', shadowOpacity: 0, elevation: 0, shadowColor: 'transparent' },
  dateButtonText: { color: Colors.textMuted, fontSize: 14, fontWeight: '400' },
  webDateInput: { height: 48, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: '#D5D5D5', borderRadius: 9, backgroundColor: Colors.white, fontFamily: Platform.select({ web: 'Segoe UI' }), fontSize: 14, color: Colors.text } as any,
  fieldError: { color: Colors.emergency, fontSize: Typography.sizes.xs, marginTop: Spacing.sm },
  submitButton: { height: 48, minHeight: 48, paddingVertical: 0, borderRadius: 9, backgroundColor: '#2D2D2D', shadowOpacity: 0, elevation: 0, shadowColor: 'transparent', marginBottom: 12 },
  backButton: { height: 48, minHeight: 48, paddingVertical: 0, borderRadius: 9, backgroundColor: '#6F7A72', shadowOpacity: 0, elevation: 0, shadowColor: 'transparent' },
  buttonText: { fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', web: 'Segoe UI' }), fontSize: 14, fontWeight: '600', letterSpacing: 0 },
});
