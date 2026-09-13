/**
 * Root Layout
 */

import React from 'react';
import { Stack } from 'expo-router';
import { AuthProvider } from '@hooks/useAuth';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animationEnabled: true,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(responder)" />
        <Stack.Screen name="(resident)" />
      </Stack>
    </AuthProvider>
  );
}
