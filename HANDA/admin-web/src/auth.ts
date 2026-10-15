import React, { createContext, useContext, useEffect, useState } from 'react';
import { ACCESS_TOKEN_KEY, apiRequest, clearAccessToken, setUnauthorizedHandler } from './api';
import type { AuthUser } from './types';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  error: string;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const API_BASE = (import.meta.env.VITE_API_URL?.trim() || 'http://localhost:8000').replace(/\/$/, '');

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setError('Your session has expired. Sign in again.');
    });
    let active = true;
    void (async () => {
      if (!sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
        if (active) setIsLoading(false);
        return;
      }
      try {
        const profile = await apiRequest<AuthUser>('/api/v1/auth/me');
        if (active && profile.role === 'admin') setUser(profile);
        else clearAccessToken();
      } catch {
        clearAccessToken();
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const signIn = async (email: string, password: string) => {
    setError('');
    const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const result = await response.json().catch(() => ({})) as { accessToken?: string; user?: AuthUser; detail?: string };
    if (!response.ok) throw new Error(result.detail || 'Unable to sign in. Check your email and password.');
    if (!result.accessToken || !result.user) throw new Error('The server returned an incomplete sign-in response.');
    if (result.user.role !== 'admin') throw new Error('Only administrator accounts can access the Command Center.');
    sessionStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
    setUser(result.user);
  };

  const signOut = async () => {
    try { await apiRequest<void>('/api/v1/auth/logout', { method: 'POST' }); } catch { /* Local sign-out still completes without the API. */ }
    clearAccessToken();
    setUser(null);
  };

  return React.createElement(AuthContext.Provider, { value: { user, isLoading, error, signIn, signOut, clearError: () => setError('') } }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}