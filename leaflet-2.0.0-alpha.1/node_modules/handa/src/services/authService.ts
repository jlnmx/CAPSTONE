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
        const result = await response.json().catch(() => null) as { detail?: string } | null;
        throw new Error(result?.detail || 'Invalid email or password.');
      }
      throw new Error(`Login service returned ${response.status}.`);
    } catch (error) {
      if (apiReachable) {
        throw error;
      }
      connectionError = error;
    }

    if (connectionError) {
      const message = connectionError instanceof Error && connectionError.name === 'AbortError'
        ? 'The login request timed out. Check the HANDA server connection and try again.'
        : 'Cannot reach the HANDA server. Check that the backend is running and the app server URL is correct.';
      throw new Error(message);
    }

    throw new Error('The login service is unavailable. Check that the HANDA server is running and try again.');
  }

  /**
   * Login as demo user (for testing without credentials)
   */
  static async loginAsDemo(role: UserRole): Promise<AuthUser | null> {
    const demoAccount = MOCK_USERS[role];
    try {
      const user = await this.login(demoAccount.email, demoAccount.password);
      return user ? { ...user, isDemo: true } : null;
    } catch {
      throw new Error('Demo sign-in requires the HANDA API. Start the backend and try again.');
    }
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
