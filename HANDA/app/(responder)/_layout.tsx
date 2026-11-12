/**
 * Responder Stack Layout
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs, useRouter, useSegments } from 'expo-router';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedPressable } from '@components/Buttons';
import { StartupLocationPermission } from '@components/StartupLocationPermission';
import { useAuth } from '@hooks/useAuth';
import { useTheme } from '@hooks/useTheme';
import { useResponderLive } from '@hooks/useRealtime';
import { getResponsiveTabBarOptions, getResponsiveTabIconSize } from '@utils/responsiveTabBar';

interface TabBarIconProps {
  name: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  color: string;
  size: number;
  focused: boolean;
}

function TabBarIcon({ name, color, size, focused }: TabBarIconProps) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: focused ? 1.06 : 1, useNativeDriver: true, speed: 24, bounciness: 5 }).start();
  }, [focused, scale]);

  return (
    <Animated.View style={[styles.tabIcon, focused && styles.tabIconActive, { transform: [{ scale }] }]}>
      <MaterialCommunityIcons name={name} size={size} color={color} />
    </Animated.View>
  );
}

function ResponderPresenceHeartbeat({ locationPermissionGranted }: { locationPermissionGranted: boolean }) {
  const { status, publishLocation } = useResponderLive();

  useEffect(() => {
    if (!locationPermissionGranted || status !== 'SUBSCRIBED') return undefined;
    let active = true;
    let subscription: Location.LocationSubscription | null = null;
    void Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
      (position) => publishLocation(
        position.coords.latitude,
        position.coords.longitude,
        position.coords.accuracy ?? undefined,
      ),
    ).then((watcher) => {
      if (active) subscription = watcher;
      else watcher.remove();
    }).catch((error: unknown) => {
      console.warn('Responder live location could not start.', error);
    });

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [locationPermissionGranted, publishLocation, status]);

  return null;
}

export default function ResponderLayout() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
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
    {isAuthenticated && user?.role === 'responder' && <ResponderPresenceHeartbeat locationPermissionGranted={locationPermissionGranted} />}
    <Tabs
      backBehavior="history"
      screenOptions={{
        ...responsiveTabBar,
        headerShown: false,
        animation: 'fade',
        tabBarHideOnKeyboard: true,
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
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="home-variant-outline" color={color} size={tabIconSize} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="evacuees"
        options={{
          title: 'Evacuees',
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="account-group-outline" color={color} size={tabIconSize} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="incidents"
        options={{
          title: 'Incidents',
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="alert-outline" color={color} size={tabIconSize} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="map-outline" color={color} size={tabIconSize} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="dots-horizontal" color={color} size={tabIconSize} focused={focused} />,
        }}
      />
      <Tabs.Screen name="responder-center-status" options={{ href: null }} />
      <Tabs.Screen name="response-history" options={{ href: null }} />
      <Tabs.Screen name="chatbot" options={{ href: null }} />
      <Tabs.Screen name="weather" options={{ href: null }} />
    </Tabs>
    <StartupLocationPermission onPermissionGranted={() => setLocationPermissionGranted(true)} />
    </>
  );
}

const styles = StyleSheet.create({
  tabIcon: { width: 42, height: 32, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tabIconActive: { backgroundColor: 'rgba(33,139,37,0.12)' },
});
