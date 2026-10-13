import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { RegistrationForm } from './register';

export default function RegisterResponderScreen() {
  const { responderType: routeResponderType } = useLocalSearchParams<{ responderType?: string }>();
  const responderType = routeResponderType === 'Official' || routeResponderType === 'Volunteer'
    ? routeResponderType
    : undefined;

  return <RegistrationForm role="Responder" responderType={responderType} />;
}