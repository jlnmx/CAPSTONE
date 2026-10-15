import React from 'react';
import { Redirect } from 'expo-router';

export default function MobileAdminRoute() {
  return <Redirect href="/(auth)/login" />;
}