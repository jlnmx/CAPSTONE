/**
 * Resident Stack Layout
 */

import React, { useEffect, useRef } from 'react';
import { Animated, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { StyleSheet, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText as Text } from '@components/ThemedText';
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

function SosTabIcon({ active, size }: { active: boolean; size: number }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return undefined;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.08, duration: 850, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [active, pulse]);

  return (
    <Animated.View style={[styles.sosTabShell, { transform: [{ scale: pulse }] }]}>
      <View style={[styles.sosTab, { width: size + (Platform.OS === 'web' ? 20 : 14), height: size + (Platform.OS === 'web' ? 20 : 14) }]}>
        <MaterialCommunityIcons name="alarm-light-outline" size={size * 0.48} color="#FFFFFF" />
        <Text style={styles.sosTabText}>SOS</Text>
      </View>
    </Animated.View>
  );
}

export default function ResidentLayout() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const { palette } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const responsiveTabBar = getResponsiveTabBarOptions(width, insets.bottom, palette);
  const tabIconSize = getResponsiveTabIconSize(width);

  useEffect(() => {
    if (isLoading || segments[0] !== '(resident)') return;
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    } else if (user?.role !== 'resident') {
      router.replace(user?.role === 'admin' ? '/(admin)' : '/(responder)');
    }
  }, [isAuthenticated, isLoading, router, segments, user]);

  return (
    <>
    <Tabs
      screenOptions={{
        ...responsiveTabBar,
        headerShown: false,
        animation: 'fade',
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
        name="incidents"
        options={{
          title: 'Incidents',
          tabBarIcon: ({ color }) => <TabBarIcon name="alert-outline" color={color} size={tabIconSize} />,
        }}
      />
      <Tabs.Screen
        name="sos"
        options={{
          title: 'SOS',
          tabBarLabel: () => null,
          tabBarIcon: ({ focused }) => <SosTabIcon active={focused} size={tabIconSize} />,
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
      <Tabs.Screen name="alerts" options={{ href: null }} />
      <Tabs.Screen name="report" options={{ href: null }} />
      <Tabs.Screen name="register-evacuee" options={{ href: null }} />
      <Tabs.Screen name="verify-status" options={{ href: null }} />
      <Tabs.Screen name="household" options={{ href: null }} />
      <Tabs.Screen name="center-status" options={{ href: null }} />
      <Tabs.Screen name="emergency-contacts" options={{ href: null }} />
      <Tabs.Screen name="emergency-contact-details" options={{ href: null }} />
      <Tabs.Screen name="preparedness-guide" options={{ href: null }} />
      <Tabs.Screen name="chatbot" options={{ href: null }} />
      <Tabs.Screen name="weather" options={{ href: null }} />
    </Tabs>
    <StartupLocationPermission />
    </>
  );
}

const styles = StyleSheet.create({
  sosTabShell: { marginTop: Platform.OS === 'web' ? -10 : -1, borderRadius: 999, padding: 3, backgroundColor: '#FCE1E1', shadowColor: '#A51D27', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6 },
  sosTab: { borderRadius: 999, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: '#D62828', alignItems: 'center', justifyContent: 'center', gap: 0 },
  sosTabText: { color: '#FFFFFF', fontSize: 11, lineHeight: 13, fontWeight: '900', letterSpacing: 0.7 },
});
