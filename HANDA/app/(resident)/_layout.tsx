/**
 * Resident Stack Layout
 */

import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@constants/colors';

interface TabBarIconProps {
  name: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  color: string;
}

function TabBarIcon({ name, color }: TabBarIconProps) {
  return <MaterialCommunityIcons name={name} size={23} color={color} />;
}

function SosTabIcon() {
  return <View style={styles.sosTab}><Text style={styles.sosTabText}>SOS</Text></View>;
}

export default function ResidentLayout() {
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
          height: 64,
          marginHorizontal: 5,
          borderRadius: 10,
          paddingBottom: 5,
          paddingTop: 3,
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
          title: '',
          tabBarIcon: ({ color }) => <TabBarIcon name="home-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: '',
          tabBarIcon: ({ color }) => <TabBarIcon name="alert-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="sos"
        options={{
          title: '',
          tabBarShowLabel: false,
          tabBarIcon: () => <SosTabIcon />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: '',
          tabBarIcon: ({ color }) => <TabBarIcon name="map-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: '',
          tabBarIcon: ({ color }) => <TabBarIcon name="dots-horizontal" color={color} />,
        }}
      />
      <Tabs.Screen name="alerts" options={{ href: null }} />
      <Tabs.Screen name="register-evacuee" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  sosTab: { width: 42, height: 42, marginTop: -10, borderRadius: 22, borderWidth: 2, borderColor: '#E33E48', backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  sosTabText: { color: '#E33E48', fontSize: 13, fontWeight: '900' },
});
