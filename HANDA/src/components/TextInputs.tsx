/**
 * Input Components
 */

import React, { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, TextInput as RNTextInput, StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable as TouchableOpacity } from '@components/Buttons';
import { Colors, Typography, Spacing, BorderRadius } from '@constants/colors';
import { useResponsiveLayout } from '@hooks/useResponsiveLayout';
import { useTheme } from '@hooks/useTheme';

interface TextInputProps {
  label?: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  editable?: boolean;
  error?: string;
  containerStyle?: ViewStyle;
  inputStyle?: StyleProp<TextStyle>;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
}

export function TextInput({
  label,
  placeholder,
  value,
  onChangeText,
  editable = true,
  error,
  containerStyle,
  inputStyle,
  keyboardType = 'default',
}: TextInputProps) {
  const { buttonHeight, scale } = useResponsiveLayout();
  const { palette, resolvedTheme } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={containerStyle}>
      {label && <Text style={styles.label}>{label}</Text>}
      <RNTextInput
        style={[
          styles.input,
          inputStyle,
          { minHeight: buttonHeight, fontSize: Typography.sizes.base * scale, color: palette.text, backgroundColor: palette.surface },
          { borderColor: error ? Colors.emergency : focused ? Colors.secondary : palette.border },
          error && styles.inputError,
          !editable && styles.inputDisabled,
        ]}
        placeholder={placeholder}
        placeholderTextColor="#667085"
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        keyboardType={keyboardType}
        keyboardAppearance={resolvedTheme}
        selectionColor={Colors.secondary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

interface PasswordInputProps {
  label?: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  containerStyle?: ViewStyle;
  inputStyle?: StyleProp<TextStyle>;
  showVisibilityToggle?: boolean;
}

export function PasswordInput({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  containerStyle,
  inputStyle,
  showVisibilityToggle = true,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const { buttonHeight, scale } = useResponsiveLayout();
  const { palette, resolvedTheme } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={containerStyle}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.passwordContainer}>
        <RNTextInput
          style={[
            styles.input,
            styles.passwordInput,
            inputStyle,
            { minHeight: buttonHeight, fontSize: Typography.sizes.base * scale, color: palette.text, backgroundColor: palette.surface },
            { borderColor: error ? Colors.emergency : focused ? Colors.secondary : palette.border },
            error && styles.inputError,
          ]}
          placeholder={placeholder}
          placeholderTextColor="#667085"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          keyboardAppearance={resolvedTheme}
          selectionColor={Colors.secondary}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {showVisibilityToggle && (
          <TouchableOpacity
            style={styles.visibilityToggle}
            onPress={() => setShowPassword(!showPassword)}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20 * scale}
              color={Colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.sizes.base,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  inputError: {
    borderColor: Colors.emergency,
  },
  inputDisabled: {
    backgroundColor: Colors.background,
    color: Colors.textMuted,
  },
  errorText: {
    fontSize: Typography.sizes.xs,
    color: Colors.emergency,
    marginTop: Spacing.sm,
  },
  passwordContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingRight: Spacing.xl,
  },
  visibilityToggle: {
    position: 'absolute',
    right: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
});
