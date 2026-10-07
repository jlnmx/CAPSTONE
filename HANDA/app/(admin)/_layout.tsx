/**
 * Administrator Stack Layout
 */

import React, { useEffect } from 'react';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import { useAuth } from '@hooks/useAuth';
import { useTheme } from '@hooks/useTheme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function TabIcon({ name, color }: { name: IconName; color: string }) {
  return <MaterialCommunityIcons name={name} size={22} color={color} />;
}

export default function AdminLayout() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const { palette } = useTheme();

  useEffect(() => {
    if (isLoading || segments[0] !== '(admin)') return;
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    } else if (user?.role !== 'admin') {
      router.replace(user?.role === 'resident' ? '/(resident)' : '/(responder)');
    }
  }, [isAuthenticated, isLoading, router, segments, user]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 7,
          paddingTop: 5,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Overview', tabBarIcon: ({ color }) => <TabIcon name="view-dashboard-outline" color={color} /> }} />
      <Tabs.Screen name="users" options={{ title: 'Users', tabBarIcon: ({ color }) => <TabIcon name="account-multiple-outline" color={color} /> }} />
      <Tabs.Screen name="evacuees" options={{ title: 'Evacuees', tabBarIcon: ({ color }) => <TabIcon name="account-group-outline" color={color} /> }} />
      <Tabs.Screen name="centers" options={{ title: 'Centers', tabBarIcon: ({ color }) => <TabIcon name="home-city-outline" color={color} /> }} />
      <Tabs.Screen name="system" options={{ title: 'System', tabBarIcon: ({ color }) => <TabIcon name="cog-outline" color={color} /> }} />
      <Tabs.Screen name="analytics" options={{ title: 'Analytics', tabBarIcon: ({ color }) => <TabIcon name="chart-line" color={color} /> }} />
      <Tabs.Screen name="disasters" options={{ title: 'Disasters', tabBarIcon: ({ color }) => <TabIcon name="weather-hurricane" color={color} /> }} />
      <Tabs.Screen name="operations" options={{ title: 'Operations', tabBarIcon: ({ color }) => <TabIcon name="clipboard-text-outline" color={color} /> }} />
      <Tabs.Screen name="more" options={{ href: null }} />
      <Tabs.Screen name="add-center" options={{ href: null }} />
    </Tabs>
  );
}