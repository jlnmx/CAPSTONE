import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Network from 'expo-network';

export default function useMapConnectivity() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const updateNativeStatus = (state: Network.NetworkState) => {
      if (active) setIsOnline(state.isInternetReachable ?? state.isConnected ?? false);
    };

    if (Platform.OS === 'web') {
      const updateBrowserStatus = () => setIsOnline(window.navigator.onLine);
      updateBrowserStatus();
      window.addEventListener('online', updateBrowserStatus);
      window.addEventListener('offline', updateBrowserStatus);
      return () => {
        active = false;
        window.removeEventListener('online', updateBrowserStatus);
        window.removeEventListener('offline', updateBrowserStatus);
      };
    }

    void Network.getNetworkStateAsync().then(updateNativeStatus);
    const subscription = Network.addNetworkStateListener(updateNativeStatus);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return isOnline;
}
