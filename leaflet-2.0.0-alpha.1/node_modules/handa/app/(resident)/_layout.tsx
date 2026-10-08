/**
 * Resident Stack Layout
 */

import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@constants/colors';
import { AnimatedPressable } from '@components/Buttons';
import { useAuth } from '@hooks/useAuth';
import { useTheme } from '@hooks/useTheme';

interface TabBarIconProps {
  name: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  color: string;
}

function TabBarIcon({ name, color }: TabBarIconProps) {
  return <MaterialCommunityIcons name={name} size={23} color={color} />;
}

function SosTabIcon({ active }: { active: boolean }) {
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

  return <Animated.View style={[styles.sosTab, { transform: [{ scale: pulse }] }]}><Text style={styles.sosTabText}>SOS</Text></Animated.View>;
}

export default function ResidentLayout() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const { palette } = useTheme();

  useEffect(() => {
    if (isLoading || segments[0] !== '(resident)') return;
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    } else if (user?.role !== 'resident') {
      router.replace(user?.role === 'admin' ? '/(admin)' : '/(responder)');
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
          lineHeight: 11,
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
        name="incidents"
        options={{
          title: 'Incidents',
          tabBarIcon: ({ color }) => <TabBarIcon name="alert-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="sos"
        options={{
          title: 'SOS',
          tabBarIcon: ({ focused }) => <SosTabIcon active={focused} />,
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
      <Tabs.Screen name="alerts" options={{ href: null }} />
      <Tabs.Screen name="report" options={{ href: null }} />
      <Tabs.Screen name="register-evacuee" options={{ href: null }} />
      <Tabs.Screen name="verify-status" options={{ href: null }} />
      <Tabs.Screen name="household" options={{ href: null }} />
      <Tabs.Screen name="center-status" options={{ href: null }} />
      <Tabs.Screen name="emergency-contacts" options={{ href: null }} />
      <Tabs.Screen name="preparedness-guide" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  sosTab: { width: 42, height: 42, marginTop: -10, borderRadius: 22, borderWidth: 2, borderColor: '#E33E48', backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  sosTabText: { color: '#E33E48', fontSize: 13, fontWeight: '900' },
});
