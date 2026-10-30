import { usePathname, useRouter } from 'expo-router';
import { useAuth } from '@hooks/useAuth';

export function useAppBack() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuth();

  return () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    switch (pathname) {
      case '/':
        router.replace(isAuthenticated
          ? user?.role === 'admin' ? '/(admin)' : user?.role === 'responder' ? '/(responder)' : '/(resident)'
          : '/(auth)/login');
        return;
      case '/forgot-password':
        router.replace('/(auth)/login');
        return;
      case '/login':
        router.replace('/(auth)/register-role');
        return;
      case '/register-role':
        router.replace('/(auth)/login');
        return;
      case '/register':
      case '/register-responder':
        router.replace('/(auth)/register-role');
        return;
      case '/household':
        router.replace('/(resident)');
        return;
      case '/add-center':
        router.replace('/(admin)/centers');
        return;
      case '/logs':
        router.replace('/(admin)/system');
        return;
      default:
        router.replace(isAuthenticated
          ? user?.role === 'admin' ? '/(admin)' : user?.role === 'responder' ? '/(responder)' : '/(resident)'
          : '/(auth)/login');
    }
  };
}
