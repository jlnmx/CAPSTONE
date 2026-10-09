import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '@constants/colors';
import { CurrentLocationMapProps } from './CurrentLocationMap';

export default function CurrentLocationMap({ coordinate }: CurrentLocationMapProps) {
  const center = coordinate ? [coordinate.latitude, coordinate.longitude] : [14.3036, 121.0781];
  const mapHtml = useMemo(() => `
    <!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>html,body,#map{margin:0;width:100%;height:100%;background:#e5efe8}.leaflet-control-attribution{font-size:8px}</style>
    </head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
      const position = ${JSON.stringify(center)};
      const map = L.map('map', { zoomControl: false, attributionControl: true }).setView(position, ${coordinate ? 16 : 13});
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map);
      ${coordinate ? "L.circleMarker(position, { radius: 10, color: '#FFFFFF', fillColor: '#218B25', fillOpacity: 1, weight: 3 }).addTo(map).bindPopup('<strong>Your current location</strong>').openPopup();" : ''}
    </script></body></html>
  `, [coordinate]);

  return <View style={styles.container}><WebView source={{ html: mapHtml }} style={styles.webView} originWhitelist={['*']} javaScriptEnabled domStorageEnabled /></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceMuted },
  webView: { flex: 1 },
});