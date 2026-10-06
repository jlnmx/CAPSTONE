/**
 * Mock Authentication Service
 * For development and demo purposes only
 */

import { AuthUser, UserRole } from '@/types/index';
import { API_BASE_URL, authenticatedFetch, clearAccessToken, getAccessToken, setAccessToken } from './apiClient';

const MOCK_USERS = {
  admin: {
    id: 'admin-001',
    email: 'admin@handa.local',
    password: 'admin123',
    name: 'HANDA Administrator',
    role: 'admin' as UserRole,
  },
  responder: {
    id: 'responder-001',
    email: 'responder@handa.local',
    password: 'responder123',
    name: 'Juan Dela Cruz',
    role: 'responder' as UserRole,
  },
  resident: {
    id: 'resident-001',
    email: 'resident@handa.local',
    password: 'resident123',
    name: 'Maria Santos',
    role: 'resident' as UserRole,
  },
};

const DEMO_USERS = {
  admin: {
    id: 'demo-admin-001',
    email: 'demo-admin@handa.local',
    name: 'Demo Administrator',
    role: 'admin' as UserRole,
    isDemo: true,
  },
  responder: {
    id: 'demo-responder-001',
    email: 'demo-responder@handa.local',
    name: 'Demo Responder',
    role: 'responder' as UserRole,
    isDemo: true,
  },
  resident: {
    id: 'demo-resident-001',
    email: 'demo-resident@handa.local',
    name: 'Demo Resident',
    role: 'resident' as UserRole,
    isDemo: true,
  },
};

export class AuthService {
  /**
   * Authenticate user with email and password
   */
  static async login(
    email: string,
    password: string
  ): Promise<AuthUser | null> {
    let apiReachable = false;
    let connectionError: unknown;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      let response: Response;
      try {
        response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      apiReachable = true;
      if (response.ok) {
        const result = await response.json() as { accessToken?: string; user?: AuthUser };
        if (result.accessToken && result.user) {
          await setAccessToken(result.accessToken);
          return result.user;
        }
      }
      if (response.status === 401) {
        return null;
      }
      throw new Error(`Login service returned ${response.status}.`);
    } catch (error) {
      if (apiReachable) {
        throw error;
      }
      connectionError = error;
    }

    for (const user of Object.values(MOCK_USERS)) {
      if (user.email.toLowerCase() === email.toLowerCase() && user.password === password) {
        // Don't return the password
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }
    }

    if (connectionError) {
      const message = connectionError instanceof Error && connectionError.name === 'AbortError'
        ? 'The login request timed out. Check the HANDA server connection and try again.'
        : 'Cannot reach the HANDA server. Check that the backend is running and the app server URL is correct.';
      throw new Error(message);
    }

    return null;
  }

  /**
   * Login as demo user (for testing without credentials)
   */
  static async loginAsDemo(role: UserRole): Promise<AuthUser | null> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    const demoUser = DEMO_USERS[role];
    if (demoUser) {
      return demoUser;
    }

    return null;
  }

  /**
   * Logout (cleanup any stored auth data)
   */
  static async logout(): Promise<void> {
    try {
      if (await getAccessToken()) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          await authenticatedFetch('/api/v1/auth/logout', {
            method: 'POST',
            signal: controller.signal,
          });
        } catch {
          // Local logout should still complete when the API is unavailable.
        } finally {
          clearTimeout(timeout);
        }
      }
    } finally {
      await clearAccessToken();
    }
  }

  /**
   * Validate current session (called on app start)
   */
  static async validateSession(
    userId: string
  ): Promise<AuthUser | null> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check if user exists
    for (const user of Object.values(MOCK_USERS)) {
      if (user.id === userId) {
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }
    }

    for (const user of Object.values(DEMO_USERS)) {
      if (user.id === userId) {
        return user;
      }
    }

    return null;
  }

  static async restoreSession(): Promise<AuthUser | null> {
    if (!(await getAccessToken())) {
      return null;
    }

    try {
      const response = await authenticatedFetch('/api/v1/auth/me');
      if (!response.ok) {
        await clearAccessToken();
        return null;
      }
      return await response.json() as AuthUser;
    } catch {
      return null;
    }
  }
}
