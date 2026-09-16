/**
 * Administrator Stack Layout
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function TabIcon({ name, color }: { name: IconName; color: string }) {
  return <MaterialCommunityIcons name={name} size={22} color={color} />;
}

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: '#D7E2EA',
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
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color }) => <TabIcon name="dots-horizontal" color={color} /> }} />
    </Tabs>
  );
}