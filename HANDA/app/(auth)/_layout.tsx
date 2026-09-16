/**
 * Auth Stack Layout
 */

import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuth } from '@hooks/useAuth';

export default function AuthLayout() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (isAuthenticated && inAuthGroup) {
      if (user?.role === 'admin') {
        router.replace('/(admin)');
      } else if (user?.role === 'resident') {
        router.replace('/(resident)');
      } else {
        router.replace('/(responder)');
      }
    } else if (!isAuthenticated && !inAuthGroup) {
      // User is not authenticated, redirect to login
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, isLoading, segments, user]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="login" />
    </Stack>
  );
}
