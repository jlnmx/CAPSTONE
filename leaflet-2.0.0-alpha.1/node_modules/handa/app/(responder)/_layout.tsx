/**
 * Responder Stack Layout
 */

import React, { useEffect } from 'react';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@constants/colors';
import { AnimatedPressable } from '@components/Buttons';
import { StartupLocationPermission } from '@components/StartupLocationPermission';
import { useAuth } from '@hooks/useAuth';
import { useTheme } from '@hooks/useTheme';
import { getResponsiveTabBarOptions, getResponsiveTabIconSize } from '@utils/responsiveTabBar';

interface TabBarIconProps {
  name: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  color: string;
  size: number;
}

function TabBarIcon({ name, color, size }: TabBarIconProps) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

export default function ResponderLayout() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const { palette } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const responsiveTabBar = getResponsiveTabBarOptions(width, insets.bottom, palette);
  const tabIconSize = getResponsiveTabIconSize(width);

  useEffect(() => {
    if (isLoading || segments[0] !== '(responder)') return;
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    } else if (user?.role !== 'responder') {
      router.replace(user?.role === 'resident' ? '/(resident)' : '/(admin)');
    }
  }, [isAuthenticated, isLoading, router, segments, user]);

  return (
    <>
    <Tabs
      screenOptions={{
        ...responsiveTabBar,
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
        tabBarActiveTintColor: '#218B25',
        tabBarInactiveTintColor: '#6B7B85',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabBarIcon name="home-outline" color={color} size={tabIconSize} />,
        }}
      />
      <Tabs.Screen
        name="evacuees"
        options={{
          title: 'Evacuees',
          tabBarIcon: ({ color }) => <TabBarIcon name="account-group-outline" color={color} size={tabIconSize} />,
        }}
      />
      <Tabs.Screen
        name="incidents"
        options={{
          title: 'Incidents',
          tabBarIcon: ({ color }) => <TabBarIcon name="alert-outline" color={color} size={tabIconSize} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color }) => <TabBarIcon name="map-outline" color={color} size={tabIconSize} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <TabBarIcon name="dots-horizontal" color={color} size={tabIconSize} />,
        }}
      />
      <Tabs.Screen name="responder-center-status" options={{ href: null }} />
    </Tabs>
    <StartupLocationPermission />
    </>
  );
}
