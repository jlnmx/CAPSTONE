import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {
  Camera,
  CircleLayer,
  LineLayer,
  MapView,
  ShapeSource,
  UserLocation,
} from '@maplibre/maplibre-react-native';
import { Colors } from '@constants/colors';
import {
  AGAP_BASE_VECTOR_STYLE,
  BINAN_CENTER,
  DEFAULT_EVACUATION_CENTERS,
  DEFAULT_ROUTE,
  DEFAULT_SOS_LOCATIONS,
} from '@services/map/emergencyStyle';
import {
  cacheEmergencyLayers,
  hasNetworkConnectivity,
  readEmergencyLayers,
} from '@services/map/offlineCache';

type GeoJsonCollection = {
  type: string;
  features: Array<{
    type: string;
    geometry: {
      type: string;
      coordinates: number[] | number[][];
    };
    properties: Record<string, string | number | undefined>;
  }>;
};

export default function AGAPMap() {
  const [evacuationCenters, setEvacuationCenters] = useState<GeoJsonCollection>(DEFAULT_EVACUATION_CENTERS as GeoJsonCollection);
  const [sosLocations, setSosLocations] = useState<GeoJsonCollection>(DEFAULT_SOS_LOCATIONS as GeoJsonCollection);
  const [routeData, setRouteData] = useState<GeoJsonCollection>(DEFAULT_ROUTE as GeoJsonCollection);
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    const hydrateEmergencyLayers = async () => {
      const cachedLayers = await readEmergencyLayers();
      if (cachedLayers) {
        setEvacuationCenters(cachedLayers.centers as GeoJsonCollection);
        setSosLocations(cachedLayers.sos as GeoJsonCollection);
        setRouteData(cachedLayers.route as GeoJsonCollection);
      }

      const online = await hasNetworkConnectivity();
      setOfflineMode(!online);

      if (online) {
        const latestSnapshot = {
          centers: DEFAULT_EVACUATION_CENTERS,
          sos: DEFAULT_SOS_LOCATIONS,
          route: DEFAULT_ROUTE,
        };

        await cacheEmergencyLayers(latestSnapshot);
      }
    };

    void hydrateEmergencyLayers();
  }, []);

  const goToUserLocation = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Location permission needed', 'Allow location access to center the map on your position.');
      return;
    }

    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const nextCoordinate: [number, number] = [position.coords.longitude, position.coords.latitude];

    // MapLibre Camera supports flyTo through its imperative API; the map's internal camera is kept by the component and user location is visible.
    Alert.alert('Location ready', `Lat: ${nextCoordinate[1].toFixed(5)}, Lon: ${nextCoordinate[0].toFixed(5)}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AGAP MAP</Text>
        <Text style={styles.headerSubtitle}>Biñan City | Emergency response</Text>
        <View style={[styles.onlineBadge, offlineMode && styles.offlineBadge]}>
          <Text style={styles.onlineText}>{offlineMode ? 'Offline' : 'Online'}</Text>
        </View>
      </View>

      <View style={styles.mapFrame}>
        <MapView
          style={styles.map}
          mapStyle={AGAP_BASE_VECTOR_STYLE}
          logoEnabled={false}
          attributionEnabled
          rotateEnabled
          scrollEnabled
          zoomEnabled
        >
          <Camera
            defaultSettings={{
              centerCoordinate: BINAN_CENTER,
              zoomLevel: 12.5,
              pitch: 45,
              heading: 0,
            }}
          />

          <UserLocation visible />

          <ShapeSource id="evacuation-center-source" shape={evacuationCenters as any}>
            <CircleLayer
              id="evacuation-center-layer"
              style={{
                circleRadius: 11,
                circleColor: '#22c55e',
                circleStrokeColor: '#dcfce7',
                circleStrokeWidth: 2,
              }}
            />
          </ShapeSource>

          <ShapeSource id="sos-source" shape={sosLocations as any}>
            <CircleLayer
              id="sos-layer"
              style={{
                circleRadius: 12,
                circleColor: '#ef4444',
                circleStrokeColor: '#fff1f2',
                circleStrokeWidth: 2,
              }}
            />
          </ShapeSource>

          <ShapeSource id="route-source" shape={routeData as any}>
            <LineLayer
              id="route-layer"
              style={{
                lineColor: '#f59e0b',
                lineWidth: 5,
                lineDasharray: [1, 0.8],
              }}
            />
          </ShapeSource>
        </MapView>
      </View>

      <View style={styles.controls}>
        <MapControl label="Evacuation" icon="home-city-outline" onPress={() => {}} />
        <MapControl label="SOS" icon="alert-outline" onPress={() => {}} />
        <MapControl label="Your location" icon="crosshairs-gps" onPress={goToUserLocation} />
      </View>
    </View>
  );
}

function MapControl({ label, icon, onPress }: { label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.control} onPress={onPress} activeOpacity={0.75}>
      <MaterialCommunityIcons name={icon} size={17} color="#218B25" />
      <Text style={styles.controlText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    backgroundColor: '#218B25',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerTitle: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#DFF1DF',
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
  },
  onlineBadge: {
    backgroundColor: '#166534',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  offlineBadge: {
    backgroundColor: '#7f1d1d',
  },
  onlineText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  mapFrame: {
    flex: 1,
    marginHorizontal: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#218B25',
    borderRadius: 10,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  controls: {
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  control: {
    height: 34,
    borderWidth: 1,
    borderColor: '#218B25',
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  controlText: {
    color: '#218B25',
    fontSize: 12,
    fontWeight: '600',
  },
});
