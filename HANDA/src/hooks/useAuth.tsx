/**
 * Authentication Hook
 * Provides authentication context to the app
 */

import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthUser, AuthContextType, UserRole } from '@/types/index';
import { AuthService } from '@services/authService';
import { clearAccessToken, getAccessToken, subscribeToUnauthorized } from '@services/apiClient';
import { disposeRealtime } from '@services/realtimeClient';
import { clearOfflineCache } from '@services/offlineCache';
import { unregisterPushDevice } from '@services/pushNotifications';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_PROFILE_KEY = 'handa.authProfile';
const STAY_LOGGED_IN_KEY = 'handa.stayLoggedIn';

interface AuthProviderProps {
  children: ReactNode;
}

async function clearStoredSession() {
  disposeRealtime();
  await clearAccessToken().catch(() => undefined);
  await Promise.all([
    AsyncStorage.removeItem('userId'),
    AsyncStorage.removeItem(AUTH_PROFILE_KEY),
    clearOfflineCache(),
  ]).catch((storageError) => console.error('Session cleanup error:', storageError));
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingSavedSession, setUsingSavedSession] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const stayLoggedIn = (await AsyncStorage.getItem(STAY_LOGGED_IN_KEY)) !== '0';
        if (!stayLoggedIn) {
          try {
            await unregisterPushDevice();
          } catch (registrationError) {
            console.error('Could not unregister notifications for the expired session:', registrationError);
          }
          await clearStoredSession();
          return;
        }
        const authUser = await AuthService.restoreSession();
        if (!mounted) return;
        if (authUser) {
          setUser(authUser);
          await AsyncStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(authUser));
          return;
        }
        // Offline or server unavailable: keep the user signed in with the last saved profile.
        if (await getAccessToken()) {
          const savedProfile = await AsyncStorage.getItem(AUTH_PROFILE_KEY);
          if (savedProfile && mounted) {
            setUser(JSON.parse(savedProfile) as AuthUser);
            setUsingSavedSession(true);
          }
        }
      } catch (restoreError) {
        console.error('Session restore error:', restoreError);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!usingSavedSession) return undefined;
    let cancelled = false;
    const refresh = async () => {
      const authUser = await AuthService.restoreSession();
      if (cancelled) return;
      if (authUser) {
        setUser(authUser);
        setUsingSavedSession(false);
        await AsyncStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(authUser));
      } else if (!(await getAccessToken())) {
        setUser(null);
        setUsingSavedSession(false);
        setError('Your session expired. Sign in again.');
        await clearStoredSession();
      }
    };
    const timer = setInterval(() => void refresh(), 30_000);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      appState.remove();
    };
  }, [usingSavedSession]);

  useEffect(() => subscribeToUnauthorized(() => {
    setUser(null);
    setError('Your session expired. Sign in again.');
    void clearStoredSession();
  }), []);

  const finishLogin = async (authUser: AuthUser, stayLoggedIn = true) => {
    setUser(authUser);
    setUsingSavedSession(false);
    await Promise.all([
      AsyncStorage.setItem('userId', authUser.id),
      AsyncStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(authUser)),
      AsyncStorage.setItem(STAY_LOGGED_IN_KEY, stayLoggedIn ? '1' : '0'),
    ]);
  };

  const login = async (email: string, password: string, allowedRoles?: readonly UserRole[], stayLoggedIn = true) => {
    try {
      setIsLoading(true);
      setError(null);

      const authUser = await AuthService.login(email, password, allowedRoles);

      if (authUser) {
        await finishLogin(authUser, stayLoggedIn);
      } else {
        setError('Invalid email/mobile number or password.');
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
    if (accessToken) {
      const { setAccessToken } = await import('@services/apiClient');
      await setAccessToken(accessToken);
    }
    setUser(authUser);
    await Promise.all([
      AsyncStorage.setItem('userId', authUser.id),
      AsyncStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(authUser)),
    ]);
  };

  const logout = async () => {
    setIsLoading(true);
    if (user && !user.isDemo && (user.role === 'resident' || user.role === 'responder')) {
      try {
        await unregisterPushDevice();
      } catch (e) {
        console.error('Could not unregister push notifications:', e);
        const signOutAnyway = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Notifications could not be disabled',
            'Reconnect to stop notifications on this phone. If you sign out now, notifications may still appear until this device is registered again.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Sign out anyway', style: 'destructive', onPress: () => resolve(true) },
            ],
            { cancelable: false },
          );
        });
        if (!signOutAnyway) {
          setIsLoading(false);
          return false;
        }
      }
    }
    try {
      await AuthService.logout();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setUser(null);
      setUsingSavedSession(false);
      await clearStoredSession();
      setIsLoading(false);
    }
    return true;
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
