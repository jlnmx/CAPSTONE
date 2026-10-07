import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, Shadows, Spacing } from '@constants/colors';
import { AnimatedPressable } from '@components/Buttons';

const notifications = [
  { icon: 'alert-circle-outline' as const, color: Colors.emergency, title: 'Current disaster', detail: 'Flood Response is active in Biñan City. Monitor official advisories and avoid flooded roads.', time: 'Now' },
  { icon: 'calendar-alert' as const, color: Colors.warning, title: 'Upcoming disaster', detail: 'Heavy rainfall is forecast for the next 24 hours. Prepare essential supplies and keep devices charged.', time: 'Today' },
  { icon: 'account-check-outline' as const, color: Colors.success, title: 'Evacuation status', detail: 'Your household is marked as checked in. Update your status if your location changes.', time: '10 min ago' },
  { icon: 'map-marker-radius-outline' as const, color: Colors.secondary, title: 'Nearby evacuation area', detail: 'Biñan City Multi-Purpose Hall is open with available capacity. View the map for directions.', time: '15 min ago' },
];

export function NotificationBell() {
  const [visible, setVisible] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);

  return (
    <>
      <AnimatedPressable
        style={styles.button}
        onPress={() => { setVisible(true); setHasUnread(false); }}
        accessibilityLabel="Open notifications"
        accessibilityRole="button"
      >
        <MaterialCommunityIcons name="bell-outline" size={29} color={Colors.white} />
        {hasUnread && <View style={styles.dot} />}
      </AnimatedPressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable style={styles.modal} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.title}>Notifications</Text>
                <Text style={styles.subtitle}>Updates that may affect your safety</Text>
              </View>
              <AnimatedPressable onPress={() => setVisible(false)} accessibilityLabel="Close notifications">
                <MaterialCommunityIcons name="close" size={24} color={Colors.textMuted} />
              </AnimatedPressable>
            </View>
            {notifications.map((notification) => (
              <View key={notification.title} style={styles.notification}>
                <View style={[styles.icon, { backgroundColor: `${notification.color}18` }]}>
                  <MaterialCommunityIcons name={notification.icon} size={22} color={notification.color} />
                </View>
                <View style={styles.copy}>
                  <View style={styles.notificationHeading}>
                    <Text style={styles.notificationTitle}>{notification.title}</Text>
                    <Text style={styles.time}>{notification.time}</Text>
                  </View>
                  <Text style={styles.detail}>{notification.detail}</Text>
                </View>
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 6, right: 5, width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.warning, borderWidth: 1, borderColor: Colors.white },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)', padding: 18, justifyContent: 'flex-start', alignItems: 'flex-end' },
  modal: { width: '100%', maxWidth: 430, marginTop: 62, backgroundColor: Colors.white, borderRadius: BorderRadius.md, padding: Spacing.lg, ...Shadows.md },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.background },
  title: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  subtitle: { color: Colors.textMuted, fontSize: 12, marginTop: 3 },
  notification: { flexDirection: 'row', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.background },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  copy: { flex: 1 },
  notificationHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notificationTitle: { color: Colors.text, fontSize: 13, fontWeight: '800' },
  time: { color: Colors.textMuted, fontSize: 10, marginLeft: 8 },
  detail: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
});
