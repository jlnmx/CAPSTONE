import React, { useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput as NativeTextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@hooks/useAuth';
import { Colors } from '@constants/colors';
import { API_BASE_URL } from '@services/apiClient';

const NativeDateTimePicker = Platform.OS === 'web' ? null : require('@react-native-community/datetimepicker').default;

export default function RegisterScreen() {
  const router = useRouter();
  const { setAuthenticatedUser } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [birthdayDate, setBirthdayDate] = useState(new Date(2000, 0, 1));
  const [isBirthdayPickerOpen, setIsBirthdayPickerOpen] = useState(false);
  const [sex, setSex] = useState('');
  const [isSexPickerOpen, setIsSexPickerOpen] = useState(false);
  const [mobileNumber, setMobileNumber] = useState('');
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
    if (sex !== 'Male' && sex !== 'Female') errors.sex = 'Select Male or Female.';
    if (!/^(09\d{9}|\+639\d{9}|639\d{9})$/.test(normalizedMobile)) errors.mobileNumber = 'Use a valid Philippine number, e.g. 09171234567.';
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
        body: JSON.stringify({ firstName: firstName.trim(), middleName: middleName.trim() || null, lastName: lastName.trim(), birthday, sex, mobileNumber: normalizedMobile, email: normalizedEmail, password }),
        signal: abortController.signal,
      });
      const result = await response.json() as { id?: string; accessToken?: string; detail?: string; message?: string };
      if (!response.ok) {
        setValidationErrors({ form: result.detail || 'Registration could not be completed.' });
        return;
      }
      const fullName = [firstName.trim(), middleName.trim(), lastName.trim()].filter(Boolean).join(' ');
      await setAuthenticatedUser({ id: result.id || `resident-${Date.now()}`, name: fullName, email: normalizedEmail, role: 'resident' }, result.accessToken);
      router.replace('/(resident)');
    } catch (error) {
      const errorName = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
      setValidationErrors({ form: errorName === 'AbortError' ? 'The registration service timed out. Check that your phone and API are on the same Wi-Fi network.' : 'Unable to connect to the registration service.' });
    } finally {
      clearTimeout(requestTimeout);
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>REGISTER</Text>
        </View>
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>PERSONAL INFORMATION</Text>
          <FormField label="First Name" error={validationErrors.firstName}>
            <NativeTextInput style={styles.input} placeholder="Enter Name" placeholderTextColor={PLACEHOLDER_COLOR} value={firstName} onChangeText={setFirstName} autoCapitalize="words" returnKeyType="next" />
          </FormField>
          <FormField label="Middle Name" required={false} optional error={validationErrors.middleName}>
            <NativeTextInput style={styles.input} placeholder="Enter Name" placeholderTextColor={PLACEHOLDER_COLOR} value={middleName} onChangeText={setMiddleName} autoCapitalize="words" returnKeyType="next" />
          </FormField>
          <FormField label="Last Name" error={validationErrors.lastName}>
            <NativeTextInput style={styles.input} placeholder="Enter Name" placeholderTextColor={PLACEHOLDER_COLOR} value={lastName} onChangeText={setLastName} autoCapitalize="words" returnKeyType="next" />
          </FormField>
          <View style={styles.row}>
            <FormField label="Birthdate" error={validationErrors.birthday}>
              {Platform.OS === 'web' ? (
                <NativeTextInput
                  value={birthday}
                  onChangeText={setBirthday}
                  placeholder="Pick Calendar"
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  style={styles.input}
                  {...({ type: 'date', max: new Date().toISOString().slice(0, 10) } as object)}
                />
              ) : (
                <TouchableOpacity style={styles.selectInput} onPress={() => setIsBirthdayPickerOpen(true)} accessibilityRole="button">
                  <Text style={birthday ? styles.selectValue : styles.selectPlaceholder}>{birthday || 'Pick Calendar'}</Text>
                </TouchableOpacity>
              )}
              {NativeDateTimePicker && isBirthdayPickerOpen && (
                <NativeDateTimePicker
                  value={birthdayDate}
                  mode="date"
                  display="default"
                  maximumDate={new Date()}
                  onChange={(_event: unknown, selectedDate?: Date) => {
                    setIsBirthdayPickerOpen(false);
                    if (selectedDate) {
                      setBirthdayDate(selectedDate);
                      setBirthday(`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`);
                    }
                  }}
                />
              )}
            </FormField>
            <FormField label="Sex" error={validationErrors.sex}>
              <TouchableOpacity style={styles.selectInput} onPress={() => setIsSexPickerOpen(true)} accessibilityRole="button" accessibilityLabel="Choose sex">
                <Text style={sex ? styles.selectValue : styles.selectPlaceholder}>{sex || 'Male or Female'}</Text>
              </TouchableOpacity>
            </FormField>
          </View>
          <FormField label="Contact Number" error={validationErrors.mobileNumber}>
            <NativeTextInput style={styles.input} placeholder="(+63) 900-000-0000" placeholderTextColor={PLACEHOLDER_COLOR} value={mobileNumber} onChangeText={setMobileNumber} keyboardType="phone-pad" returnKeyType="next" />
          </FormField>
          <FormField label="Enter email address" error={validationErrors.email}>
            <NativeTextInput style={styles.input} placeholder="Enter email address" placeholderTextColor={PLACEHOLDER_COLOR} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" returnKeyType="next" />
          </FormField>
          <FormField label="Password" error={validationErrors.password}>
            <NativeTextInput style={styles.input} placeholder="Enter password" placeholderTextColor={PLACEHOLDER_COLOR} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" returnKeyType="next" />
          </FormField>
          <FormField label="Confirm Password" error={validationErrors.confirmPassword}>
            <NativeTextInput style={styles.input} placeholder="Enter password" placeholderTextColor={PLACEHOLDER_COLOR} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" returnKeyType="done" />
          </FormField>
          {validationErrors.form && <Text style={styles.formError}>{validationErrors.form}</Text>}
          <TouchableOpacity style={styles.submitButton} onPress={handleRegister} disabled={isSubmitting} accessibilityRole="button">
            {isSubmitting ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitText}>Sign Up</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
      <Modal transparent visible={isSexPickerOpen} animationType="fade" onRequestClose={() => setIsSexPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setIsSexPickerOpen(false)}>
          <View style={styles.sexOptions}>
            <Text style={styles.sexTitle}>Select Sex</Text>
            {['Male', 'Female'].map((option) => (
              <TouchableOpacity key={option} style={styles.sexOption} onPress={() => { setSex(option); setIsSexPickerOpen(false); }} accessibilityRole="button">
                <Text style={styles.sexOptionText}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

interface FormFieldProps {
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}

function FormField({ label, required = true, optional = false, error, children }: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}{optional && <Text style={styles.optional}> (optional)</Text>}{required && <Text style={styles.required}> *</Text>}
      </Text>
      {children}
      {error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

const PLACEHOLDER_COLOR = '#8EAF8E';
const GREEN = '#218B25';
const FONT_FAMILY = Platform.select({ ios: 'Avenir Next', android: 'sans-serif', web: 'Segoe UI' });

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  contentContainer: { flexGrow: 1, paddingBottom: 32 },
  header: { minHeight: 66, justifyContent: 'center', paddingHorizontal: 14, backgroundColor: GREEN, borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  headerTitle: { color: Colors.white, fontFamily: FONT_FAMILY, fontSize: 32, fontWeight: '800' },
  form: { paddingHorizontal: 14, paddingTop: 13 },
  sectionTitle: { color: '#236B27', fontFamily: FONT_FAMILY, fontSize: 20, fontWeight: '400', marginBottom: 6 },
  field: { flex: 1, marginBottom: 9 },
  label: { color: '#236B27', fontFamily: FONT_FAMILY, fontSize: 13, marginBottom: 5 },
  optional: { fontStyle: 'italic' },
  required: { color: '#D33A3A' },
  input: { height: 37, paddingHorizontal: 15, paddingVertical: 0, borderWidth: 1, borderColor: '#D7D7D7', borderRadius: 10, backgroundColor: Colors.white, color: '#263B28', fontFamily: FONT_FAMILY, fontSize: 12 },
  row: { flexDirection: 'row', columnGap: 18 },
  selectInput: { height: 37, justifyContent: 'center', paddingHorizontal: 15, borderWidth: 1, borderColor: '#D7D7D7', borderRadius: 10, backgroundColor: Colors.white },
  selectPlaceholder: { color: PLACEHOLDER_COLOR, fontFamily: FONT_FAMILY, fontSize: 12 },
  selectValue: { color: '#263B28', fontFamily: FONT_FAMILY, fontSize: 12 },
  fieldError: { color: Colors.emergency, fontFamily: FONT_FAMILY, fontSize: 11, marginTop: 3 },
  formError: { color: Colors.emergency, fontFamily: FONT_FAMILY, fontSize: 12, marginBottom: 8 },
  submitButton: { height: 40, alignItems: 'center', justifyContent: 'center', marginTop: 1, borderRadius: 8, backgroundColor: GREEN },
  submitText: { color: Colors.white, fontFamily: FONT_FAMILY, fontSize: 16, fontWeight: '500' },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0, 0, 0, 0.35)' },
  sexOptions: { width: '100%', maxWidth: 300, padding: 18, borderRadius: 10, backgroundColor: Colors.white },
  sexTitle: { color: '#236B27', fontFamily: FONT_FAMILY, fontSize: 17, fontWeight: '600', marginBottom: 8 },
  sexOption: { minHeight: 44, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#E5E5E5' },
  sexOptionText: { color: '#263B28', fontFamily: FONT_FAMILY, fontSize: 15 },
});
