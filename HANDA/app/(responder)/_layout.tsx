/**
 * Responder Stack Layout
 */

import React, { useEffect } from 'react';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { Colors } from '@constants/colors';
import { AnimatedPressable } from '@components/Buttons';
import { useAuth } from '@hooks/useAuth';
import { useTheme } from '@hooks/useTheme';

interface TabBarIconProps {
  name: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  color: string;
}

function TabBarIcon({ name, color }: TabBarIconProps) {
  return <MaterialCommunityIcons name={name} size={22} color={color} />;
}

export default function ResponderLayout() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const { palette } = useTheme();

  useEffect(() => {
    if (isLoading || segments[0] !== '(responder)') return;
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    } else if (user?.role !== 'responder') {
      router.replace(user?.role === 'resident' ? '/(resident)' : '/(admin)');
    }
  }, [isAuthenticated, isLoading, router, segments, user]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: (props) => (
          <AnimatedPressable
            onPress={(event) => props.onPress?.(event)}
            style={props.style}
            accessibilityRole="button"
            accessibilityLabel={props.accessibilityLabel}
          >
            {props.children}
          </AnimatedPressable>
        ),
        tabBarLabelPosition: 'below-icon',
        tabBarActiveTintColor: '#218B25',
        tabBarInactiveTintColor: '#6B7B85',
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          borderTopWidth: 1,
          height: 72,
          marginHorizontal: 8,
          marginBottom: 8,
          borderRadius: 16,
          paddingBottom: 7,
          paddingTop: 6,
          shadowColor: '#163A25',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
          elevation: 5,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '700',
          lineHeight: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabBarIcon name="home-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="evacuees"
        options={{
          title: 'Evacuees',
          tabBarIcon: ({ color }) => <TabBarIcon name="account-group-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="incidents"
        options={{
          title: 'Incidents',
          tabBarIcon: ({ color }) => <TabBarIcon name="alert-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color }) => <TabBarIcon name="map-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <TabBarIcon name="dots-horizontal" color={color} />,
        }}
      />
      <Tabs.Screen name="responder-center-status" options={{ href: null }} />
    </Tabs>
  );
}
