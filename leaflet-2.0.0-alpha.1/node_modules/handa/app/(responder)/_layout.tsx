/**
 * Responder Stack Layout
 */

import React from 'react';
import { Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Colors } from '@constants/colors';

interface TabBarIconProps {
  name: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  color: string;
}

function TabBarIcon({ name, color }: TabBarIconProps) {
  return <MaterialCommunityIcons name={name} size={24} color={color} />;
}

export default function ResponderLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#218B25',
        tabBarInactiveTintColor: '#218B25',
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: '#8BC58B',
          borderTopWidth: 1,
          height: 62,
          marginHorizontal: 5,
          borderRadius: 10,
          paddingBottom: 5,
          paddingTop: 2,
        },
        tabBarLabelStyle: {
          fontSize: 8,
          fontWeight: '500',
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
