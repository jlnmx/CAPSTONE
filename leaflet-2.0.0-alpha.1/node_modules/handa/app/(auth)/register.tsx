import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput as NativeTextInput, View } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { AnimatedPressable as TouchableOpacity } from '@components/Buttons';
import { useRouter } from 'expo-router';
import { useAuth } from '@hooks/useAuth';
import { API_BASE_URL } from '@services/apiClient';
import { useResponsiveLayout } from '@hooks/useResponsiveLayout';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthUser, ResidentHouseholdMember } from '@types/index';
import { BINAN_BARANGAYS, RESPONDER_ORGANIZATIONS } from '@constants/responderOrganizations';
import * as ImagePicker from 'expo-image-picker';
import AppBackArrow from '@components/AppBackArrow';

const NativeDateTimePicker = Platform.OS === 'web' ? null : require('@react-native-community/datetimepicker').default;

type RegistrationRole = 'Resident' | 'Responder';
type ResponderType = 'Official' | 'Volunteer';
type VerificationDocument = {
  base64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  name: string;
  previewUri: string;
};

type RegistrationFormProps = { role?: RegistrationRole; responderType?: ResponderType };

export function RegistrationForm({ role = 'Resident', responderType }: RegistrationFormProps) {
  const { isCompact } = useResponsiveLayout();
  const accent = GREEN;
  const isResponder = role === 'Responder';
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
  const [responderOrganization, setResponderOrganization] = useState('');
  const [responderBarangay, setResponderBarangay] = useState('');
  const [responderPicker, setResponderPicker] = useState<'organization' | 'barangay' | null>(null);
  const pickerOptions: readonly string[] = responderPicker === 'barangay' ? BINAN_BARANGAYS : RESPONDER_ORGANIZATIONS;
  const [mobileNumber, setMobileNumber] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [householdMembers, setHouseholdMembers] = useState<ResidentHouseholdMember[]>([]);
  const [verificationDocument, setVerificationDocument] = useState<VerificationDocument | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturingId, setIsCapturingId] = useState(false);
  const [cameraBounds, setCameraBounds] = useState({ width: 0, height: 0 });
  const cameraRef = useRef<CameraView>(null);
  const [isPendingConfirmationOpen, setIsPendingConfirmationOpen] = useState(false);
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [editingMemberIndex, setEditingMemberIndex] = useState<number | null>(null);
  const [memberName, setMemberName] = useState('');
  const [memberRelationship, setMemberRelationship] = useState('');
  const [memberError, setMemberError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const stepLabels = isResponder ? ['Personal info', 'Account', 'Responder details'] : ['Personal info', 'Account', 'Household'];

  const continueToNextStep = () => {
    const errors: Record<string, string> = {};
    if (currentStep === 0) {
      if (!firstName.trim()) errors.firstName = 'First name is required.';
      if (!lastName.trim()) errors.lastName = 'Last name is required.';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday.trim())) errors.birthday = 'Select a valid birthday.';
      if (sex !== 'Male' && sex !== 'Female') errors.sex = 'Select Male or Female.';
      if (!/^(09\d{9}|\+639\d{9}|639\d{9})$/.test(mobileNumber.replace(/[\s()-]/g, ''))) errors.mobileNumber = 'Use a valid Philippine number, e.g. 09171234567.';
      if (!address.trim()) errors.address = 'Current address is required.';
    } else if (currentStep === 1) {
      if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email.trim())) errors.email = 'Enter a valid email address.';
      if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        errors.password = 'Use 8+ characters with uppercase, lowercase, number, and symbol.';
      }
      if (!confirmPassword) errors.confirmPassword = 'Confirm your password.';
      else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';
    }

    setValidationErrors(errors);
    if (Object.keys(errors).length === 0) setCurrentStep((step) => Math.min(step + 1, 2));
  };

  const selectResponderId = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType;
    if (!asset.base64 || !isVerificationDocumentMimeType(mimeType)) {
      setValidationErrors((current) => ({ ...current, verificationDocument: 'Choose a JPEG, PNG, or WebP image.' }));
      return;
    }
    if (asset.fileSize != null && asset.fileSize > 4 * 1024 * 1024) {
      setValidationErrors((current) => ({ ...current, verificationDocument: 'The ID image must be 4 MB or smaller.' }));
      return;
    }
    setVerificationDocument({
      base64: asset.base64,
      mimeType,
      name: asset.fileName || `${responderType?.toLowerCase() || 'responder'}-id.${mimeType.split('/')[1]}`,
      previewUri: `data:${mimeType};base64,${asset.base64}`,
    });
    setValidationErrors((current) => ({ ...current, verificationDocument: '' }));
  };

  const openIdCamera = async () => {
    setValidationErrors((current) => ({ ...current, verificationDocument: '' }));
    try {
      if (!await CameraView.isAvailableAsync()) {
        setValidationErrors((current) => ({ ...current, verificationDocument: 'A camera is not available on this device. Choose an ID photo instead.' }));
        return;
      }
      const permission = await Camera.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setValidationErrors((current) => ({
          ...current,
          verificationDocument: permission.canAskAgain
            ? 'Allow camera access to take a responder ID photo.'
            : 'Camera access is disabled. Enable it in device settings or choose an ID photo instead.',
        }));
        return;
      }
      setIsCameraReady(false);
      setCameraBounds({ width: 0, height: 0 });
      setIsCameraOpen(true);
    } catch (error) {
      setValidationErrors((current) => ({
        ...current,
        verificationDocument: error instanceof Error ? error.message : 'The camera could not be opened. Choose an ID photo instead.',
      }));
    }
  };

  const captureResponderId = async () => {
    if (!cameraRef.current || !isCameraReady || isCapturingId || !cameraBounds.width || !cameraBounds.height) return;
    setIsCapturingId(true);
    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!picture?.uri || !picture.width || !picture.height) throw new Error('The camera did not return a usable photo.');

      const cardRatio = 85.6 / 53.98;
      const frameWidth = Math.min(cameraBounds.width - 40, (cameraBounds.height - 208) * cardRatio);
      const frameHeight = frameWidth / cardRatio;
      const scale = Math.max(cameraBounds.width / picture.width, cameraBounds.height / picture.height);
      const renderedWidth = picture.width * scale;
      const renderedHeight = picture.height * scale;
      const frameTop = 66 + (cameraBounds.height - 66 - 142 - frameHeight) / 2;
      const originX = Math.max(0, Math.round((renderedWidth - frameWidth) / (2 * scale)));
      const originY = Math.max(0, Math.round((frameTop + (renderedHeight - cameraBounds.height) / 2) / scale));
      const cropWidth = Math.min(picture.width - originX, Math.round(frameWidth / scale));
      const cropHeight = Math.min(picture.height - originY, Math.round(frameHeight / scale));
      if (cropWidth < 1 || cropHeight < 1) throw new Error('Could not crop the ID photo. Please try again.');

      const cropped = await manipulateAsync(picture.uri, [
        { crop: { originX, originY, width: cropWidth, height: cropHeight } },
        { resize: { width: Math.min(1600, cropWidth) } },
      ], { compress: 0.85, format: SaveFormat.JPEG, base64: true });
      if (!cropped.base64) throw new Error('The cropped ID photo could not be prepared for upload.');
      if (Math.ceil(cropped.base64.length * 3 / 4) > 4 * 1024 * 1024) throw new Error('The cropped ID photo is too large. Retake it in better lighting.');

      setVerificationDocument({
        base64: cropped.base64,
        mimeType: 'image/jpeg',
        name: `${responderType?.toLowerCase() || 'responder'}-id.jpg`,
        previewUri: cropped.uri,
      });
      setValidationErrors((current) => ({ ...current, verificationDocument: '' }));
      setIsCameraOpen(false);
    } catch (error) {
      setValidationErrors((current) => ({
        ...current,
        verificationDocument: error instanceof Error ? error.message : 'The ID photo could not be cropped. Please try again.',
      }));
    } finally {
      setIsCapturingId(false);
    }
  };

  const openMemberDialog = (index: number | null = null) => {
    setEditingMemberIndex(index);
    setMemberName(index == null ? '' : householdMembers[index].name);
    setMemberRelationship(index == null ? '' : householdMembers[index].relationship);
    setMemberError('');
    setIsMemberDialogOpen(true);
  };

  const saveMember = () => {
    const member = { name: memberName.trim(), relationship: memberRelationship.trim() };
    if (!member.name || !member.relationship) {
      setMemberError('Enter the member name and relationship.');
      return;
    }
    if (editingMemberIndex == null && householdMembers.length >= 20) {
      setMemberError('A household can include up to 21 people, including you.');
      return;
    }
    setHouseholdMembers((current) => editingMemberIndex == null
      ? [...current, member]
      : current.map((item, index) => index === editingMemberIndex ? member : item));
    setIsMemberDialogOpen(false);
  };

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
    if (!address.trim()) errors.address = 'Current address is required.';
    if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(normalizedEmail)) errors.email = 'Enter a valid email address.';
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      errors.password = 'Use 8+ characters with uppercase, lowercase, number, and symbol.';
    }
    if (!confirmPassword) errors.confirmPassword = 'Confirm your password.';
    else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';
    if (!isResponder && householdMembers.some((member) => !member.name.trim() || !member.relationship.trim())) errors.householdMembers = 'Complete or remove each household member.';
    if (isResponder && (!responderType || !verificationDocument)) errors.verificationDocument = 'Upload your responder ID to submit this application.';
    if (isResponder && !responderOrganization) errors.responderOrganization = 'Choose your organization.';
    if (isResponder && responderOrganization === 'Barangay Responder' && !responderBarangay) errors.responderBarangay = 'Choose the barangay you serve.';

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
        body: JSON.stringify({
          firstName: firstName.trim(),
          middleName: middleName.trim() || null,
          lastName: lastName.trim(),
          birthday,
          sex,
          mobileNumber: normalizedMobile,
          currentAddress: address.trim(),
          email: normalizedEmail,
          password,
          role,
          ...(isResponder
            ? {
              responderType,
              responderOrganization,
              responderBarangay: responderOrganization === 'Barangay Responder' ? responderBarangay : null,
              verificationDocumentBase64: verificationDocument?.base64,
              verificationDocumentMimeType: verificationDocument?.mimeType,
              verificationDocumentName: verificationDocument?.name,
            }
            : { members: householdMembers }),
        }),
        signal: abortController.signal,
      });
      const result = await response.json() as { id?: string; status?: string; accessToken?: string; user?: AuthUser; detail?: unknown; message?: string };
      if (!response.ok) {
        setValidationErrors({ form: getRegistrationErrorMessage(result.detail) });
        return;
      }
      if (isResponder) {
        setIsPendingConfirmationOpen(true);
        return;
      }
      const fullName = [firstName.trim(), middleName.trim(), lastName.trim()].filter(Boolean).join(' ');
      await setAuthenticatedUser({
        ...result.user,
        id: result.user?.id || result.id || `resident-${Date.now()}`,
        name: fullName,
        email: normalizedEmail,
        role: 'resident',
        firstName: result.user?.firstName || firstName.trim(),
        middleName: result.user?.middleName || middleName.trim(),
        lastName: result.user?.lastName || lastName.trim(),
        birthday: result.user?.birthday || birthday,
        sex: result.user?.sex || sex,
        mobileNumber: result.user?.mobileNumber || normalizedMobile,
        currentAddress: result.user?.currentAddress || address.trim(),
        householdMembers: result.user?.householdMembers ?? householdMembers,
      }, result.accessToken);
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
          <AppBackArrow />
          <View style={styles.headerCopy}>
            <Text style={styles.headerEyebrow}>HANDA ACCOUNT</Text>
            <Text style={styles.headerTitle}>{isResponder ? 'Responder application' : 'Create your account'}</Text>
            <Text style={styles.headerSubtitle}>{isResponder ? 'Apply to support your community.' : 'A few details will get you ready for emergencies.'}</Text>
          </View>
        </View>
        <View style={styles.form}>
          <View style={styles.stepper} accessibilityRole="progressbar" accessibilityLabel={`Step ${currentStep + 1} of ${stepLabels.length}`}>
            {stepLabels.map((label, index) => (
              <React.Fragment key={label}>
                <TouchableOpacity style={styles.stepItem} onPress={() => setCurrentStep(index)} disabled={index >= currentStep} accessibilityRole="button" accessibilityLabel={`${label}${index < currentStep ? ', completed' : index === currentStep ? ', current step' : ', not started'}`}>
                  <View style={[styles.stepNumber, index < currentStep && styles.stepNumberComplete, index === currentStep && styles.stepNumberCurrent]}>
                    {index < currentStep ? <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" /> : <Text style={[styles.stepNumberText, index === currentStep && styles.stepNumberTextCurrent]}>{index + 1}</Text>}
                  </View>
                  <Text style={[styles.stepLabel, index === currentStep && styles.stepLabelCurrent]} numberOfLines={1}>{label}</Text>
                </TouchableOpacity>
                {index < stepLabels.length - 1 && <View style={[styles.stepConnector, index < currentStep && styles.stepConnectorComplete]} />}
              </React.Fragment>
            ))}
          </View>

          <View style={styles.stepHeading}>
            <Text style={styles.stepCount}>STEP {currentStep + 1} OF {stepLabels.length}</Text>
            <Text style={styles.sectionTitle}>{['Personal information', 'Email and password', isResponder ? 'Responder details' : 'Household members'][currentStep]}</Text>
            <Text style={styles.stepDescription}>{[
              'Tell us how to identify and contact you.',
              'Set up the email and password for your account.',
              isResponder ? `${responderType ?? 'Responder'} applications require administrator approval.` : 'Add household members for emergency coordination. This step is optional.',
            ][currentStep]}</Text>
          </View>

          {currentStep === 0 && <>
          <FormField label="First Name" error={validationErrors.firstName}>
            <NativeTextInput style={styles.input} placeholder="Enter Name" placeholderTextColor={PLACEHOLDER_COLOR} value={firstName} onChangeText={setFirstName} autoCapitalize="words" returnKeyType="next" selectionColor={GREEN} />
          </FormField>
          <FormField label="Middle Name" required={false} optional error={validationErrors.middleName}>
            <NativeTextInput style={styles.input} placeholder="Enter Name" placeholderTextColor={PLACEHOLDER_COLOR} value={middleName} onChangeText={setMiddleName} autoCapitalize="words" returnKeyType="next" selectionColor={GREEN} />
          </FormField>
          <FormField label="Last Name" error={validationErrors.lastName}>
            <NativeTextInput style={styles.input} placeholder="Enter Name" placeholderTextColor={PLACEHOLDER_COLOR} value={lastName} onChangeText={setLastName} autoCapitalize="words" returnKeyType="next" selectionColor={GREEN} />
          </FormField>
          <View style={[styles.row, isCompact && styles.rowStacked]}>
            <FormField compact={isCompact} label="Birthdate" error={validationErrors.birthday}>
              {Platform.OS === 'web' ? (
                React.createElement('input', {
                  type: 'date',
                  value: birthday,
                  max: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
                  onChange: (event: { target: { value: string } }) => setBirthday(event.target.value),
                  'aria-label': 'Select birthdate from calendar',
                  style: {
                    width: '100%',
                    height: 48,
                    boxSizing: 'border-box',
                    padding: '0 14px',
                    border: `1px solid ${BORDER}`,
                    borderRadius: 6,
                    backgroundColor: SURFACE,
                    color: TEXT,
                    fontFamily: FONT_FAMILY,
                    fontSize: 15,
                    accentColor: GREEN,
                  },
                })
              ) : (
                <TouchableOpacity style={styles.selectInput} onPress={() => setIsBirthdayPickerOpen(true)} accessibilityRole="button" accessibilityLabel="Select birthdate from calendar">
                  <Text style={birthday ? styles.selectValue : styles.selectPlaceholder}>{birthday || 'Select birthdate'}</Text>
                  <MaterialCommunityIcons name="calendar-blank-outline" size={19} color={TEXT_MUTED} />
                </TouchableOpacity>
              )}
              {NativeDateTimePicker && isBirthdayPickerOpen && (
                <NativeDateTimePicker
                  value={birthdayDate}
                  mode="date"
                  display={Platform.OS === 'android' ? 'calendar' : 'default'}
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
            <FormField compact={isCompact} label="Sex" error={validationErrors.sex}>
              <TouchableOpacity style={styles.selectInput} onPress={() => setIsSexPickerOpen(true)} accessibilityRole="button" accessibilityLabel="Choose sex">
                <Text style={sex ? styles.selectValue : styles.selectPlaceholder}>{sex || 'Male or Female'}</Text>
              </TouchableOpacity>
            </FormField>
          </View>
          <FormField label="Contact Number" error={validationErrors.mobileNumber}>
            <NativeTextInput style={styles.input} placeholder="(+63) 900-000-0000" placeholderTextColor={PLACEHOLDER_COLOR} value={mobileNumber} onChangeText={setMobileNumber} keyboardType="phone-pad" returnKeyType="next" selectionColor={GREEN} />
          </FormField>
          <FormField label="Current Address" error={validationErrors.address}>
            <NativeTextInput style={styles.input} placeholder="Enter current address" placeholderTextColor={PLACEHOLDER_COLOR} value={address} onChangeText={setAddress} autoCapitalize="words" returnKeyType="next" selectionColor={GREEN} />
          </FormField>
          </>}

          {currentStep === 1 && <>
          <FormField label="Enter email address" error={validationErrors.email}>
            <NativeTextInput style={styles.input} placeholder="Enter email address" placeholderTextColor={PLACEHOLDER_COLOR} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" returnKeyType="next" selectionColor={GREEN} />
          </FormField>
          <FormField label="Password" error={validationErrors.password}>
            <View style={styles.passwordInput}>
              <NativeTextInput style={[styles.input, styles.passwordField]} placeholder="Create a password" placeholderTextColor={PLACEHOLDER_COLOR} value={password} onChangeText={setPassword} secureTextEntry={!isPasswordVisible} autoCapitalize="none" autoComplete="new-password" returnKeyType="next" selectionColor={GREEN} />
              <TouchableOpacity style={styles.passwordToggle} onPress={() => setIsPasswordVisible((visible) => !visible)} accessibilityRole="button" accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}>
                <MaterialCommunityIcons name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'} size={21} color={TEXT_MUTED} />
              </TouchableOpacity>
            </View>
          </FormField>
          <FormField label="Confirm Password" error={validationErrors.confirmPassword}>
            <View style={styles.passwordInput}>
              <NativeTextInput style={[styles.input, styles.passwordField]} placeholder="Re-enter your password" placeholderTextColor={PLACEHOLDER_COLOR} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!isConfirmPasswordVisible} autoCapitalize="none" autoComplete="new-password" returnKeyType="done" selectionColor={GREEN} />
              <TouchableOpacity style={styles.passwordToggle} onPress={() => setIsConfirmPasswordVisible((visible) => !visible)} accessibilityRole="button" accessibilityLabel={isConfirmPasswordVisible ? 'Hide confirm password' : 'Show confirm password'}>
                <MaterialCommunityIcons name={isConfirmPasswordVisible ? 'eye-off-outline' : 'eye-outline'} size={21} color={TEXT_MUTED} />
              </TouchableOpacity>
            </View>
          </FormField>
          <Text style={styles.passwordHint}>At least 8 characters, including uppercase, lowercase, a number, and a symbol.</Text>
          </>}

          {currentStep === 2 && isResponder && <View style={styles.stepPanel}>
          <View style={styles.verificationSection}>
            <Text style={styles.householdLabel}>ORGANIZATION</Text>
            <Text style={styles.householdEmpty}>Tell us which agency or group you respond with. It is shared with residents when you acknowledge an incident.</Text>
            <FormField label="Organization" error={validationErrors.responderOrganization}>
              <TouchableOpacity style={styles.selectInput} onPress={() => setResponderPicker('organization')} accessibilityRole="button" accessibilityLabel="Choose organization">
                <Text style={responderOrganization ? styles.selectValue : styles.selectPlaceholder}>{responderOrganization || 'PNP, BFP, POSO, BCDRRMO, or Barangay Responder'}</Text>
              </TouchableOpacity>
            </FormField>
            {responderOrganization === 'Barangay Responder' && <FormField label="Barangay" error={validationErrors.responderBarangay}>
              <TouchableOpacity style={styles.selectInput} onPress={() => setResponderPicker('barangay')} accessibilityRole="button" accessibilityLabel="Choose barangay">
                <Text style={responderBarangay ? styles.selectValue : styles.selectPlaceholder}>{responderBarangay || 'Choose your barangay'}</Text>
              </TouchableOpacity>
            </FormField>}
          </View>
          <View style={styles.verificationSection}>
            <Text style={styles.householdLabel}>{responderType?.toUpperCase() ?? 'RESPONDER'} ID</Text>
            <Text style={styles.householdEmpty}>Take a photo and align your ID inside the guide for automatic card-size cropping, or choose an existing JPEG, PNG, or WebP image. Admins will review it with your application.</Text>
            <View style={styles.idPhotoActions}>
              <TouchableOpacity style={styles.idPhotoButton} onPress={() => void openIdCamera()} accessibilityRole="button" accessibilityLabel="Take and automatically crop a responder ID photo">
                <MaterialCommunityIcons name="camera-outline" size={19} color={GREEN} /><Text style={styles.idPhotoButtonText}>Take ID photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.idPhotoButton} onPress={() => void selectResponderId()} accessibilityRole="button" accessibilityLabel="Choose responder ID photo from library">
                <MaterialCommunityIcons name="image-outline" size={19} color={GREEN} /><Text style={styles.idPhotoButtonText}>Choose photo</Text>
              </TouchableOpacity>
            </View>
            {verificationDocument && <View style={styles.idPhotoPreview}>
              <Image source={{ uri: verificationDocument.previewUri }} style={styles.idPhotoThumbnail} resizeMode="contain" accessibilityLabel="Responder ID photo preview" />
              <View style={styles.idPhotoPreviewCopy}>
                <Text style={styles.idPhotoPreviewTitle}>ID ready for administrator review</Text>
                <Text style={styles.householdEmpty}>{verificationDocument.name}</Text>
              </View>
              <MaterialCommunityIcons name="check-circle" size={21} color={GREEN} />
            </View>}
            {!!validationErrors.verificationDocument && <Text style={styles.fieldError}>{validationErrors.verificationDocument}</Text>}
          </View>
          </View>}
          {currentStep === 2 && !isResponder && <View style={styles.householdSection}>
            <View style={styles.householdHeader}>
              <View style={styles.householdHeaderCopy}>
                <Text style={styles.householdLabel}>HOUSEHOLD MEMBERS</Text>
                <Text style={styles.householdCount}>{householdMembers.length} added</Text>
              </View>
              <Text style={styles.householdLimit}>Up to 20</Text>
            </View>
            <TouchableOpacity style={[styles.addMemberButton, householdMembers.length >= 20 && styles.addMemberButtonDisabled]} onPress={() => openMemberDialog()} disabled={householdMembers.length >= 20} accessibilityRole="button" accessibilityLabel="Add household member">
              <View style={styles.addMemberContent}>
                <View style={styles.addMemberIcon}>
                  <MaterialCommunityIcons name="plus" size={19} color={GREEN} />
                </View>
                <Text style={styles.addMemberText}>Add household member</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={GREEN} />
              </View>
            </TouchableOpacity>
            {householdMembers.length === 0 && <Text style={styles.householdEmpty}>Add the people who belong to your household for emergency coordination.</Text>}
            {householdMembers.map((member, index) => (
              <View key={`${index}-${member.name}`} style={styles.memberRow}>
                <View style={styles.memberCopy}><Text style={styles.memberName}>{member.name}</Text><Text style={styles.memberRelationship}>{member.relationship}</Text></View>
                <TouchableOpacity style={styles.memberAction} onPress={() => openMemberDialog(index)} accessibilityRole="button" accessibilityLabel={`Edit ${member.name}`}><MaterialCommunityIcons name="pencil-outline" size={18} color="#1769AA" /></TouchableOpacity>
                <TouchableOpacity style={styles.memberAction} onPress={() => setHouseholdMembers((current) => current.filter((_item, itemIndex) => itemIndex !== index))} accessibilityRole="button" accessibilityLabel={`Delete ${member.name}`}><MaterialCommunityIcons name="trash-can-outline" size={18} color="#D62828" /></TouchableOpacity>
              </View>
            ))}
            {!!validationErrors.householdMembers && <Text style={styles.fieldError}>{validationErrors.householdMembers}</Text>}
          </View>}
          {validationErrors.form && <Text style={styles.formError}>{validationErrors.form}</Text>}
          <View style={styles.navigationActions}>
            {currentStep > 0 ? <TouchableOpacity style={styles.backButton} onPress={() => { setValidationErrors({}); setCurrentStep((step) => step - 1); }} accessibilityRole="button">
              <MaterialCommunityIcons name="arrow-left" size={18} color={GREEN} /><Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity> : <View />}
            {currentStep < 2 ? <TouchableOpacity style={styles.nextButton} onPress={continueToNextStep} accessibilityRole="button">
              <Text style={styles.submitText}>Continue</Text><MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
            </TouchableOpacity> : <TouchableOpacity style={styles.submitButton} onPress={handleRegister} disabled={isSubmitting} accessibilityRole="button">
              {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>{isResponder ? 'Submit application' : 'Create account'}</Text>}
            </TouchableOpacity>}
          </View>
        </View>
      </ScrollView>
      <Modal transparent visible={responderPicker !== null} animationType="fade" onRequestClose={() => setResponderPicker(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setResponderPicker(null)}>
          <View style={styles.sexOptions}>
            <Text style={styles.sexTitle}>{responderPicker === 'barangay' ? 'Select Barangay' : 'Select Organization'}</Text>
            <ScrollView style={styles.pickerList}>
              {pickerOptions.map((option) => (
                <TouchableOpacity key={option} style={styles.sexOption} onPress={() => {
                  if (responderPicker === 'barangay') {
                    setResponderBarangay(option);
                  } else {
                    setResponderOrganization(option);
                    if (option !== 'Barangay Responder') setResponderBarangay('');
                  }
                  setResponderPicker(null);
                }} accessibilityRole="button">
                  <Text style={styles.sexOptionText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
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
      <Modal transparent visible={isMemberDialogOpen} animationType="fade" onRequestClose={() => setIsMemberDialogOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setIsMemberDialogOpen(false)}>
          <Pressable style={styles.memberDialog} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.sexTitle}>{editingMemberIndex == null ? 'Add household member' : 'Edit household member'}</Text>
                <NativeTextInput style={styles.input} placeholder="Full name" placeholderTextColor={PLACEHOLDER_COLOR} value={memberName} onChangeText={setMemberName} autoCapitalize="words" selectionColor={GREEN} />
                <NativeTextInput style={[styles.input, styles.memberRelationshipInput]} placeholder="Relationship to you" placeholderTextColor={PLACEHOLDER_COLOR} value={memberRelationship} onChangeText={setMemberRelationship} autoCapitalize="words" selectionColor={GREEN} />
            {!!memberError && <Text style={styles.fieldError}>{memberError}</Text>}
            <View style={styles.memberDialogActions}>
              <TouchableOpacity style={styles.memberCancel} onPress={() => setIsMemberDialogOpen(false)}><Text style={styles.memberCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.memberSave} onPress={saveMember}><Text style={styles.memberSaveText}>Save member</Text></TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={isCameraOpen} animationType="slide" onRequestClose={() => setIsCameraOpen(false)}>
        <View style={styles.cameraModal} onLayout={(event) => setCameraBounds({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            onCameraReady={() => setIsCameraReady(true)}
            onMountError={(event) => {
              setIsCameraOpen(false);
              setValidationErrors((current) => ({ ...current, verificationDocument: `The camera could not start: ${event.message}` }));
            }}
          />
          <View style={styles.cameraTopBar}>
            <TouchableOpacity style={styles.cameraCloseButton} onPress={() => setIsCameraOpen(false)} accessibilityRole="button" accessibilityLabel="Close camera">
              <MaterialCommunityIcons name="close" size={23} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>Capture responder ID</Text>
            <View style={styles.cameraCloseButton} />
          </View>
          <View style={styles.cameraGuideArea} pointerEvents="none">
            <View style={[
              styles.cameraIdFrame,
              {
                width: cameraBounds.width
                  ? Math.max(0, Math.min(cameraBounds.width - 40, (cameraBounds.height - 190) * (85.6 / 53.98)))
                  : '82%',
                aspectRatio: 85.6 / 53.98,
              },
            ]}>
              <Text style={styles.cameraGuideLabel}>ALIGN ID INSIDE FRAME</Text>
            </View>
          </View>
          <View style={styles.cameraBottomBar}>
            <Text style={styles.cameraInstruction}>Keep the full ID inside the frame. It will be cropped automatically.</Text>
            <TouchableOpacity
              style={[styles.captureButton, (!isCameraReady || isCapturingId) && styles.addMemberButtonDisabled]}
              onPress={() => void captureResponderId()}
              disabled={!isCameraReady || isCapturingId}
              accessibilityRole="button"
              accessibilityLabel="Take and crop ID photo"
            >
              {isCapturingId ? <ActivityIndicator color={GREEN} /> : <View style={styles.captureButtonInner} />}
            </TouchableOpacity>
          </View>
          {!isCameraReady && <View style={styles.cameraLoading}><ActivityIndicator color="#FFFFFF" /><Text style={styles.cameraInstruction}>Starting camera…</Text></View>}
        </View>
      </Modal>
      <Modal transparent visible={isPendingConfirmationOpen} animationType="fade" onRequestClose={() => { setIsPendingConfirmationOpen(false); router.replace('/(auth)/login'); }}>
        <View style={styles.modalBackdrop}>
          <View style={styles.pendingDialog}>
            <MaterialCommunityIcons name="clock-check-outline" size={42} color={GREEN} />
            <Text style={styles.pendingTitle}>Application submitted</Text>
            <Text style={styles.pendingMessage}>Your {responderType?.toLowerCase()} responder application is pending administrator approval. We will notify you by email and SMS when it is reviewed.</Text>
            <TouchableOpacity style={styles.submitButton} onPress={() => { setIsPendingConfirmationOpen(false); router.replace('/(auth)/login'); }} accessibilityRole="button"><Text style={styles.submitText}>Back to sign in</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function RegisterScreen() {
  return <RegistrationForm role="Resident" />;
}

interface FormFieldProps {
  label: string;
  compact?: boolean;
  required?: boolean;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}

function FormField({ label, required = true, optional = false, error, compact = false, children }: FormFieldProps) {
  return (
    <View style={[styles.field, compact && styles.fieldStacked]}>
      <Text style={styles.label}>
        {label}{optional && <Text style={styles.optional}> (optional)</Text>}{required && <Text style={styles.required}> *</Text>}
      </Text>
      {children}
      {error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

function getRegistrationErrorMessage(detail: unknown): string {
  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail.flatMap((issue: unknown) => {
      if (!issue || typeof issue !== 'object' || !('msg' in issue) || typeof issue.msg !== 'string') {
        return [];
      }

      const location = 'loc' in issue && Array.isArray(issue.loc) ? issue.loc[issue.loc.length - 1] : undefined;
      const field = typeof location === 'string' ? `${location}: ` : '';
      return [`${field}${issue.msg}`];
    });

    if (messages.length > 0) {
      return messages.join('\n');
    }
  }

  return 'Registration could not be completed. Check your information and try again.';
}

function isVerificationDocumentMimeType(value: string | null | undefined): value is VerificationDocument['mimeType'] {
  return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
}

const PAGE_BACKGROUND = '#F5F7FA';
const SURFACE = '#FFFFFF';
const SURFACE_MUTED = '#F0F2F5';
const TEXT = '#17212B';
const TEXT_MUTED = '#475467';
const BORDER = '#D7E2EA';
const PLACEHOLDER_COLOR = '#667085';
const GREEN = '#218B25';
const FONT_FAMILY = Platform.select({ ios: 'Avenir Next', android: 'sans-serif', web: 'Segoe UI' });

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BACKGROUND },
  contentContainer: { flexGrow: 1, width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 32 },
  header: { minHeight: 124, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 16, borderRadius: 10, backgroundColor: GREEN },
  headerCopy: { flex: 1 },
  headerEyebrow: { color: '#DFF1DF', fontFamily: FONT_FAMILY, fontSize: 10, fontWeight: '800' },
  headerTitle: { color: '#FFFFFF', fontFamily: FONT_FAMILY, fontSize: 25, fontWeight: '800', marginTop: 5 },
  headerSubtitle: { color: '#E7F4E7', fontFamily: FONT_FAMILY, fontSize: 12, lineHeight: 18, marginTop: 4 },
  form: { marginTop: 12, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 18, borderWidth: 1, borderColor: BORDER, borderRadius: 10, backgroundColor: SURFACE },
  formIntro: { color: TEXT_MUTED, fontFamily: FONT_FAMILY, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  stepItem: { flex: 1, minWidth: 0, alignItems: 'center', gap: 5 },
  stepNumber: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: BORDER, borderRadius: 14, backgroundColor: SURFACE_MUTED },
  stepNumberComplete: { borderColor: GREEN, backgroundColor: GREEN },
  stepNumberCurrent: { borderColor: GREEN, backgroundColor: '#E8F2E8' },
  stepNumberText: { color: TEXT_MUTED, fontFamily: FONT_FAMILY, fontSize: 11, fontWeight: '700' },
  stepNumberTextCurrent: { color: GREEN },
  stepLabel: { maxWidth: '100%', color: TEXT_MUTED, fontFamily: FONT_FAMILY, fontSize: 10, textAlign: 'center' },
  stepLabelCurrent: { color: GREEN, fontWeight: '800' },
  stepConnector: { height: 2, flex: 0.6, marginHorizontal: 5, marginBottom: 15, backgroundColor: BORDER },
  stepConnectorComplete: { backgroundColor: GREEN },
  stepHeading: { marginBottom: 17 },
  stepCount: { color: GREEN, fontFamily: FONT_FAMILY, fontSize: 10, fontWeight: '800' },
  sectionTitle: { color: TEXT, fontFamily: FONT_FAMILY, fontSize: 21, fontWeight: '800', marginTop: 3 },
  stepDescription: { color: TEXT_MUTED, fontFamily: FONT_FAMILY, fontSize: 12, lineHeight: 18, marginTop: 4 },
  stepPanel: { gap: 2 },
  field: { flex: 1, minWidth: 0, marginBottom: 12 },
  fieldStacked: { flex: 0, width: '100%' },
  label: { color: TEXT, fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  optional: { fontStyle: 'italic' },
  required: { color: '#D33A3A' },
  input: { height: 48, paddingHorizontal: 14, paddingVertical: 0, borderWidth: 1, borderColor: BORDER, borderRadius: 6, backgroundColor: SURFACE, color: TEXT, fontFamily: FONT_FAMILY, fontSize: 15 },
  passwordInput: { position: 'relative', justifyContent: 'center' },
  passwordField: { paddingRight: 52 },
  passwordToggle: { position: 'absolute', right: 3, width: 44, height: 42, alignItems: 'center', justifyContent: 'center' },
  passwordHint: { color: TEXT_MUTED, fontFamily: FONT_FAMILY, fontSize: 11, lineHeight: 16, marginTop: -4, marginBottom: 8 },
  row: { flexDirection: 'row', columnGap: 18 },
  rowStacked: { flexDirection: 'column', columnGap: 0 },
  selectInput: { height: 48, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: BORDER, borderRadius: 6, backgroundColor: SURFACE },
  selectPlaceholder: { color: PLACEHOLDER_COLOR, fontFamily: FONT_FAMILY, fontSize: 12 },
  selectValue: { color: TEXT, fontFamily: FONT_FAMILY, fontSize: 14 },
  fieldError: { color: '#D62828', fontFamily: FONT_FAMILY, fontSize: 11, marginTop: 3 },
  formError: { color: '#D62828', fontFamily: FONT_FAMILY, fontSize: 12, marginBottom: 8 },
  navigationActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 13 },
  backButton: { minWidth: 88, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 12, borderWidth: 1, borderColor: BORDER, borderRadius: 6, backgroundColor: SURFACE },
  backButtonText: { color: GREEN, fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: '700' },
  nextButton: { minHeight: 48, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 6, backgroundColor: GREEN },
  submitButton: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 6, backgroundColor: GREEN },
  submitText: { color: '#FFFFFF', fontFamily: FONT_FAMILY, fontSize: 14, fontWeight: '800' },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0, 0, 0, 0.35)' },
  sexOptions: { width: '100%', maxWidth: 300, padding: 18, borderRadius: 10, backgroundColor: SURFACE },
  pickerList: { maxHeight: 360 },
  sexTitle: { color: TEXT, fontFamily: FONT_FAMILY, fontSize: 17, fontWeight: '600', marginBottom: 8 },
  sexOption: { minHeight: 44, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#E5E5E5' },
  sexOptionText: { color: TEXT, fontFamily: FONT_FAMILY, fontSize: 15 },
  householdSection: { marginTop: 16, paddingTop: 13, borderTopWidth: 1, borderTopColor: '#E2ECE2' },
  verificationSection: { marginTop: 16, paddingTop: 13, borderTopWidth: 1, borderTopColor: '#E2ECE2' },
  householdHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  householdHeaderCopy: { flex: 1 },
  householdLabel: { color: TEXT, fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  householdCount: { color: TEXT_MUTED, fontFamily: FONT_FAMILY, fontSize: 11, marginTop: 2 },
  householdLimit: { color: TEXT_MUTED, fontFamily: FONT_FAMILY, fontSize: 11, marginTop: 1 },
  addMemberButton: { width: '100%', minHeight: 52, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: '#8BC58B', borderRadius: 9, backgroundColor: SURFACE_MUTED },
  addMemberButtonDisabled: { opacity: 0.55 },
  idPhotoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  idPhotoButton: { minHeight: 46, flexGrow: 1, flexBasis: 140, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#8BC58B', borderRadius: 8, backgroundColor: SURFACE_MUTED },
  idPhotoButtonText: { color: GREEN, fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: '700' },
  idPhotoPreview: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, padding: 9, borderWidth: 1, borderColor: '#CDE5CD', borderRadius: 8, backgroundColor: '#F6FBF6' },
  idPhotoThumbnail: { width: 96, height: 62, borderRadius: 4, backgroundColor: '#E8ECEF' },
  idPhotoPreviewCopy: { flex: 1 },
  idPhotoPreviewTitle: { color: TEXT, fontFamily: FONT_FAMILY, fontSize: 11, fontWeight: '700' },
  cameraModal: { flex: 1, backgroundColor: '#101418' },
  cameraTopBar: { minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  cameraCloseButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  cameraTitle: { color: '#FFFFFF', fontFamily: FONT_FAMILY, fontSize: 16, fontWeight: '700' },
  cameraGuideArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  cameraIdFrame: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: '#FFFFFF', borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)' },
  cameraGuideLabel: { color: '#FFFFFF', fontFamily: FONT_FAMILY, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, textShadowColor: '#000000', textShadowRadius: 4 },
  cameraBottomBar: { minHeight: 142, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 18, backgroundColor: 'rgba(16,20,24,0.72)' },
  cameraInstruction: { color: '#FFFFFF', fontFamily: FONT_FAMILY, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  captureButton: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center', marginTop: 12, borderWidth: 3, borderColor: '#FFFFFF', borderRadius: 34 },
  captureButtonInner: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFFFFF' },
  cameraLoading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(16,20,24,0.72)' },
  addMemberContent: { flexDirection: 'row', alignItems: 'center' },
  addMemberIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginRight: 9, borderRadius: 15, backgroundColor: SURFACE_MUTED },
  addMemberText: { flex: 1, color: GREEN, fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: '700' },
  householdEmpty: { color: TEXT_MUTED, fontFamily: FONT_FAMILY, fontSize: 11, lineHeight: 16, marginTop: 7, marginHorizontal: 2 },
  memberRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, paddingLeft: 12, borderWidth: 1, borderColor: BORDER, borderRadius: 8, backgroundColor: PAGE_BACKGROUND },
  memberCopy: { flex: 1 },
  memberName: { color: TEXT, fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: '700' },
  memberRelationship: { color: TEXT_MUTED, fontFamily: FONT_FAMILY, fontSize: 10, marginTop: 2 },
  memberAction: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  memberDialog: { width: '100%', maxWidth: 400, padding: 18, borderRadius: 10, backgroundColor: SURFACE },
  memberRelationshipInput: { marginTop: 10 },
  memberDialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  memberCancel: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: BORDER, borderRadius: 6 },
  memberCancelText: { color: TEXT_MUTED, fontWeight: '700' },
  memberSave: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 6, backgroundColor: GREEN },
  memberSaveText: { color: '#FFFFFF', fontWeight: '700' },
  pendingDialog: { width: '100%', maxWidth: 420, alignItems: 'center', padding: 24, borderRadius: 10, backgroundColor: SURFACE },
  pendingTitle: { marginTop: 12, color: TEXT, fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: '800', textAlign: 'center' },
  pendingMessage: { marginTop: 8, color: TEXT_MUTED, fontFamily: FONT_FAMILY, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
