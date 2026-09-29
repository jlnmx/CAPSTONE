/**
 * Responder Stack Layout
 */

import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { Colors } from '@constants/colors';
import { useAuth } from '@hooks/useAuth';

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
        tabBarLabelPosition: 'below-icon',
        tabBarActiveTintColor: '#218B25',
        tabBarInactiveTintColor: '#218B25',
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: '#8BC58B',
          borderTopWidth: 1,
          height: 64,
          marginHorizontal: 5,
          borderRadius: 10,
          paddingBottom: 5,
          paddingTop: 3,
        },
        tabBarLabelStyle: {
          fontSize: 8,
          fontWeight: '500',
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
    </Tabs>
  );
}
