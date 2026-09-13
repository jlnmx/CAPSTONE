/**
 * Authentication Hook
 * Provides authentication context to the app
 */

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthUser, AuthContextType, UserRole } from '@types/index';
import { AuthService } from '@services/authService';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    bootstrapAsync();
  }, []);

  const bootstrapAsync = async () => {
    try {
      setIsLoading(true);
      const storedUserId = await AsyncStorage.getItem('userId');

      if (storedUserId) {
        const validatedUser = await AuthService.validateSession(storedUserId);
        if (validatedUser) {
          setUser(validatedUser);
        } else {
          // Session invalid, clear storage
          await AsyncStorage.removeItem('userId');
        }
      }
    } catch (e) {
      console.error('Failed to restore session:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const authUser = await AuthService.login(email, password);

      if (authUser) {
        setUser(authUser);
        await AsyncStorage.setItem('userId', authUser.id);
      } else {
        setError('Invalid email or password.');
      }
    } catch (e) {
      setError('An error occurred during login. Please try again.');
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
        setUser(authUser);
        await AsyncStorage.setItem('userId', authUser.id);
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

  const logout = async () => {
    try {
      setIsLoading(true);
      await AuthService.logout();
      setUser(null);
      await AsyncStorage.removeItem('userId');
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    loginAsDemo,
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
