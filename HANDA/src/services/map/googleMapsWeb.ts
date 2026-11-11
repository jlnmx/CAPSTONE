let googleMapsPromise: Promise<void> | null = null;

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY ?? '';

export function loadGoogleMapsApi(): Promise<void> {
  if (!API_KEY) return Promise.reject(new Error('Google Maps web API key is missing.'));
  if (typeof window.google !== 'undefined' && window.google.maps) return Promise.resolve();
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(API_KEY)}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      googleMapsPromise = null;
      reject(new Error('Google Maps JavaScript API failed to load. Check the key and Maps JavaScript API restrictions.'));
    };
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}
