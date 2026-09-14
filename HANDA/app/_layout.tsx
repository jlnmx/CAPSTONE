/**
 * Root Layout
 */

import React from 'react';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { AuthProvider } from '@hooks/useAuth';
import { initializeLocalDatabase } from '@services/localDatabase';

export default function RootLayout() {
  useEffect(() => {
    initializeLocalDatabase();
  }, []);

  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
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
