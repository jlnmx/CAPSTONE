/**
 * Authentication Hook
 * Provides authentication context to the app
 */

import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthUser, AuthContextType, UserRole } from '@/types/index';
import { AuthService } from '@services/authService';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_PROFILE_KEY = 'handa.authProfile';

function mergeAuthProfile(serverProfile: AuthUser, cachedProfile: AuthUser | null): AuthUser {
  if (!cachedProfile) return serverProfile;
  return {
    ...cachedProfile,
    ...serverProfile,
    firstName: serverProfile.firstName?.trim() || cachedProfile.firstName,
    middleName: serverProfile.middleName?.trim() || cachedProfile.middleName,
    lastName: serverProfile.lastName?.trim() || cachedProfile.lastName,
    birthday: serverProfile.birthday?.trim() || cachedProfile.birthday,
    sex: serverProfile.sex?.trim() || cachedProfile.sex,
    mobileNumber: serverProfile.mobileNumber?.trim() || cachedProfile.mobileNumber,
    currentAddress: serverProfile.currentAddress?.trim() || cachedProfile.currentAddress,
    householdMembers: serverProfile.householdMembers?.length
      ? serverProfile.householdMembers
      : cachedProfile.householdMembers ?? serverProfile.householdMembers ?? [],
  };
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const authUser = await AuthService.restoreSession();
        if (!authUser) return;
        const cachedProfileValue = await AsyncStorage.getItem(AUTH_PROFILE_KEY);
        let cachedProfile: AuthUser | null = null;
        try {
          cachedProfile = cachedProfileValue ? JSON.parse(cachedProfileValue) as AuthUser : null;
        } catch {
          await AsyncStorage.removeItem(AUTH_PROFILE_KEY);
        }
        const restoredUser = mergeAuthProfile(authUser, cachedProfile);
        if (!mounted) return;
        setUser(restoredUser);
        await AsyncStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(restoredUser));
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const finishLogin = async (authUser: AuthUser) => {
    setUser(authUser);
    await Promise.all([
      AsyncStorage.setItem('userId', authUser.id),
      AsyncStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(authUser)),
    ]);
  };

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const authUser = await AuthService.login(email, password);

      if (authUser) {
        await finishLogin(authUser);
      } else {
        setError('Invalid email or password.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred during login. Please try again.');
      console.error('Login error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsDemo = async (role: UserRole) => {
    try {
      setIsLoading(true);
      setError(null);

      const authUser = await AuthService.loginAsDemo(role);

      if (authUser) {
        await finishLogin(authUser);
      } else {
        setError('Failed to login as demo user.');
      }
    } catch (e) {
      setError('An error occurred during demo login.');
      console.error('Demo login error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const setAuthenticatedUser = async (authUser: AuthUser, accessToken?: string) => {
    setError(null);
    setUser(authUser);
    await Promise.all([
      AsyncStorage.setItem('userId', authUser.id),
      AsyncStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(authUser)),
    ]);
    if (accessToken) {
      const { setAccessToken } = await import('@services/apiClient');
      await setAccessToken(accessToken);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await AuthService.logout();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setUser(null);
      await Promise.all([
        AsyncStorage.removeItem('userId'),
        AsyncStorage.removeItem(AUTH_PROFILE_KEY),
      ]);
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    loginAsDemo,
    setAuthenticatedUser,
    logout,
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
