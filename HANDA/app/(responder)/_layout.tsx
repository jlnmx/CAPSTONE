import { ThemeAwareView } from '@components/ThemeAware';
/**
 * Responder Stack Layout
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs, useRouter, useSegments } from 'expo-router';
import * as Location from 'expo-location';
import { ThemedText as Text } from '@components/ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedPressable } from '@components/Buttons';
import { StartupLocationPermission } from '@components/StartupLocationPermission';
import { useAuth } from '@hooks/useAuth';
import { useTheme } from '@hooks/useTheme';
import { useUnreadActiveIncidentCount } from '@hooks/useUnreadActiveIncidentCount';
import { useResponderLive } from '@hooks/useRealtime';
import { authenticatedFetch } from '@services/apiClient';
import { resolveResponderLocationArea, type ResponderLocationArea } from '@services/responderLive';
import { getResponsiveTabBarOptions, getResponsiveTabIconSize } from '@utils/responsiveTabBar';

interface TabBarIconProps {
  name: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  color: string;
  size: number;
  focused: boolean;
  badgeCount?: number;
}

function TabBarIcon({ name, color, size, focused, badgeCount = 0 }: TabBarIconProps) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: focused ? 1.06 : 1, useNativeDriver: true, speed: 24, bounciness: 5 }).start();
  }, [focused, scale]);

  return (
    <Animated.View style={[styles.tabIcon, focused && styles.tabIconActive, { transform: [{ scale }] }]}>
      <MaterialCommunityIcons name={name} size={size} color={color} />
      {badgeCount > 0 && <ThemeAwareView style={styles.incidentBadge}><Text style={styles.incidentBadgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text></ThemeAwareView>}
    </Animated.View>
  );
}

const AREA_REFRESH_INTERVAL_MS = 60_000;
const AREA_REFRESH_DISTANCE_METERS = 500;
const PRESENCE_HEARTBEAT_INTERVAL_MS = 15_000;

function distanceMeters(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): number {
  const latitudeMeters = (to.latitude - from.latitude) * 111_000;
  const longitudeMeters = (to.longitude - from.longitude) * 111_000 * Math.cos(from.latitude * Math.PI / 180);
  return Math.sqrt(latitudeMeters ** 2 + longitudeMeters ** 2);
}

function ResponderPresenceHeartbeat({ locationPermissionGranted }: { locationPermissionGranted: boolean }) {
  const { publishLocation } = useResponderLive();

  useEffect(() => {
    let active = true;
    let subscription: Location.LocationSubscription | null = null;
    let geocoding = false;
    let lastGeocodedAt = 0;
    let lastApiHeartbeatAt = 0;
    let presenceWarningLogged = false;
    let lastGeocodedCoordinates: { latitude: number; longitude: number } | null = null;
    let latestCoordinates: { latitude: number; longitude: number; accuracy?: number } | null = null;
    const currentArea: ResponderLocationArea = {};
    const sendApiHeartbeat = () => {
      if (!active || Date.now() - lastApiHeartbeatAt < 12_000) return;
      lastApiHeartbeatAt = Date.now();
      const location = latestCoordinates
        ? { ...latestCoordinates, city: currentArea.city, barangay: currentArea.barangay }
        : {};
      void authenticatedFetch('/api/v1/responders/me/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(location),
      }).then((response) => {
        if (!response.ok) throw new Error(`Presence update returned ${response.status}.`);
        presenceWarningLogged = false;
      }).catch((error: unknown) => {
        if (!presenceWarningLogged) console.warn('Responder online status could not be refreshed.', error);
        presenceWarningLogged = true;
      });
    };

    sendApiHeartbeat();
    const heartbeat = setInterval(sendApiHeartbeat, PRESENCE_HEARTBEAT_INTERVAL_MS);

    if (locationPermissionGranted) {
      void Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const coordinates = { latitude, longitude };
          latestCoordinates = { ...coordinates, accuracy: accuracy ?? undefined };
          publishLocation(latitude, longitude, accuracy ?? undefined, currentArea);
          sendApiHeartbeat();

          const now = Date.now();
          const movedEnough = lastGeocodedCoordinates !== null
            && distanceMeters(lastGeocodedCoordinates, coordinates) >= AREA_REFRESH_DISTANCE_METERS;
          if (geocoding || (lastGeocodedAt && now - lastGeocodedAt < AREA_REFRESH_INTERVAL_MS && !movedEnough)) return;

          geocoding = true;
          lastGeocodedAt = now;
          lastGeocodedCoordinates = coordinates;
          void Location.reverseGeocodeAsync(coordinates)
            .then((addresses) => {
              if (!active) return;
              const area = resolveResponderLocationArea(addresses[0]);
              currentArea.city = area.city;
              currentArea.barangay = area.barangay;
              publishLocation(latitude, longitude, accuracy ?? undefined, area);
              sendApiHeartbeat();
            })
            .catch((error: unknown) => {
              console.warn('Responder location area could not be resolved.', error);
            })
            .finally(() => { geocoding = false; });
        },
      ).then((watcher) => {
        if (active) subscription = watcher;
        else watcher.remove();
      }).catch((error: unknown) => {
        console.warn('Responder live location could not start.', error);
      });
    }

    return () => {
      active = false;
      clearInterval(heartbeat);
      subscription?.remove();
    };
  }, [locationPermissionGranted, publishLocation]);

  return null;
}

export default function ResponderLayout() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const unreadIncidentCount = useUnreadActiveIncidentCount();
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
    {isAuthenticated && user?.role === 'responder' && <ResponderPresenceHeartbeat key={user.id} locationPermissionGranted={locationPermissionGranted} />}
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
        tabBarActiveTintColor: '#D45B92',
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
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="alert-outline" color={color} size={tabIconSize} focused={focused} badgeCount={unreadIncidentCount} />,
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
    {isAuthenticated && user?.role === 'responder' && <StartupLocationPermission onPermissionGranted={() => setLocationPermissionGranted(true)} />}
    </>
  );
}

const styles = StyleSheet.create({
  tabIcon: { width: 42, height: 32, borderRadius: 13, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  tabIconActive: { backgroundColor: 'rgba(33,139,37,0.12)' },
  incidentBadge: { position: 'absolute', top: -5, right: -5, minWidth: 17, height: 17, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#A83F70', borderWidth: 1.5, borderColor: '#FFFFFF', shadowColor: '#3D1730', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3 },
  incidentBadgeText: { color: '#FFFFFF', fontSize: 8, lineHeight: 10, fontWeight: '900', textAlign: 'center', includeFontPadding: false },
});
