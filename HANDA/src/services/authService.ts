/**
 * Mock Authentication Service
 * For development and demo purposes only
 */

import { AuthUser, UserRole } from '@/types/index';

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
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Check against mock users
    for (const user of Object.values(MOCK_USERS)) {
      if (user.email.toLowerCase() === email.toLowerCase() && user.password === password) {
        // Don't return the password
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }
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
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));
    // In production, would call API and invalidate tokens
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
}
