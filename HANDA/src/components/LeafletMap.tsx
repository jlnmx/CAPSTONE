import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function LeafletMap() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Leaflet map is available on the web view.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e5efe8',
  },
  text: {
    color: '#218B25',
    fontSize: 14,
  },
});
