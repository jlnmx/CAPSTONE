import React, { useRef, useState } from 'react';
import { Animated, ColorValue, Easing, Image, ImageSourcePropType, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable as Pressable } from '@components/Buttons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';

type Guide = {
  title: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  color: ColorValue;
  image: ImageSourcePropType;
  before: string[];
  during: string[];
  after: string[];
};

const guides: Guide[] = [
  {
    title: 'TYPHOON', icon: 'weather-hurricane', color: '#3E568F',
    image: require('../../pics/Typhoon.jpg'),
    before: ['Monitor PAGASA weather bulletins and local government advisories.', 'Prepare a Go Bag.', 'Store enough water and food for several days.', 'Charge phones and power banks.', 'Secure roofs, windows, signs, outdoor furniture, and other loose objects.', 'Trim dangerous branches when safe to do so.', 'Clear drainage systems.', 'Move valuables and electrical appliances to higher areas if flooding is possible.', 'Know your evacuation center and route.', 'If authorities order evacuation, leave before conditions become dangerous.'],
    during: ['Stay indoors and away from windows.', 'Keep listening to official weather and evacuation updates.', 'Do not travel through floodwater or cross damaged bridges.', 'Be alert for the calm eye of the storm; dangerous winds may return.'],
    after: ['Wait for the all-clear before leaving your shelter.', 'Avoid downed power lines, debris, and floodwater.', 'Check on neighbors and report hazards to responders.', 'Document damage only when it is safe to do so.'],
  },
  {
    title: 'FLASH FLOOD', icon: 'waves', color: Colors.textMuted,
    image: require('../../pics/flash-flood.webp'),
    before: ['Know whether your home is in a flood-prone area.', 'Keep important documents in a waterproof container.', 'Prepare a Go Bag and move valuables to higher ground.', 'Plan a route to the nearest safe, elevated location.'],
    during: ['Move to higher ground immediately when warned.', 'Never walk, swim, or drive through moving floodwater.', 'Turn off electricity only if you can do so safely.', 'Follow evacuation orders and official updates.'],
    after: ['Return only when authorities say it is safe.', 'Avoid contaminated water and damaged buildings.', 'Have electrical systems checked before switching them on.', 'Report blocked roads and hazards to responders.'],
  },
  {
    title: 'EARTHQUAKE', icon: 'alert-circle-outline', color: '#D09629',
    image: require('../../pics/Earthquake.jpg'),
    before: ['Secure shelves, appliances, and heavy objects.', 'Prepare an emergency kit and identify safe spots indoors.', 'Practice Drop, Cover, and Hold On with your household.', 'Know how to shut off gas, water, and electricity.'],
    during: ['Drop to your hands and knees, cover your head, and hold on.', 'Stay away from windows, glass, and tall furniture.', 'If outdoors, move away from buildings, trees, and power lines.', 'Do not use elevators.'],
    after: ['Expect aftershocks and check for injuries.', 'Leave damaged buildings and avoid re-entry.', 'Check for gas leaks, fire, and electrical damage from a safe location.', 'Follow official instructions and contact your household.'],
  },
  {
    title: 'VOLCANIC ERUPTION', icon: 'alert-outline', color: '#A94448',
    image: require('../../pics/Volcano.jpg'),
    before: ['Learn your community evacuation zones and routes.', 'Prepare masks, goggles, medicine, water, and food.', 'Keep vehicles fueled and pets included in your plan.', 'Monitor official alerts for changes in activity.'],
    during: ['Evacuate when instructed and follow designated routes.', 'Stay indoors with windows and doors closed if ash is falling.', 'Wear a mask and eye protection outdoors.', 'Avoid river valleys and low-lying areas where mudflows may travel.'],
    after: ['Return only after authorities give permission.', 'Clear ash from roofs carefully and avoid stirring it up.', 'Keep checking updates for renewed activity.', 'Seek medical help for breathing or eye irritation.'],
  },
  {
    title: 'CHEMICAL LEAK', icon: 'flask-outline', color: '#3F8738',
    image: require('../../pics/Chemical Leak.jpg'),
    before: ['Learn the warning signals and shelter-in-place procedures.', 'Keep a battery radio, masks, and basic supplies ready.', 'Know how to leave the area using more than one route.', 'Store household chemicals safely and separately.'],
    during: ['Move away from the release and avoid touching the substance.', 'Go indoors or evacuate as directed by authorities.', 'Close windows, doors, and ventilation systems if sheltering indoors.', 'Do not eat or drink anything exposed to the chemical.'],
    after: ['Do not return until officials declare the area safe.', 'Remove contaminated clothing and follow decontamination instructions.', 'Seek medical attention if you feel unwell.', 'Report the incident and any symptoms to responders.'],
  },
  {
    title: 'FIRE', icon: 'fire', color: '#B44F45',
    image: require('../../pics/Fire.jpg'),
    before: ['Install and test smoke alarms on every level of the building.', 'Keep fire extinguishers accessible and learn how to use them.', 'Keep exits, hallways, and stairways clear.', 'Plan two ways out of every room and choose an outdoor meeting point.', 'Store matches, lighters, fuels, and flammable materials safely.', 'Do not overload electrical outlets or use damaged cords.'],
    during: ['Alert everyone in the building and leave immediately.', 'Stay low under smoke and use the nearest safe exit.', 'Never use an elevator during a building fire.', 'Close doors behind you if it is safe to slow the spread of smoke and fire.', 'If clothing catches fire, stop, drop, and roll.', 'Call emergency services from a safe location and never re-enter the building.'],
    after: ['Do not return until firefighters or authorities declare the building safe.', 'Tell responders if anyone may still be inside.', 'Avoid damaged wiring, gas lines, structural damage, and contaminated water.', 'Arrange medical attention for burns or smoke exposure.', 'Document damage only when authorities allow it and it is safe to do so.'],
  },
  {
    title: 'WILDFIRE', icon: 'pine-tree-fire', color: '#A36A2C',
    image: require('../../pics/Forest Fire.jpg'),
    before: ['Keep vegetation and combustible materials away from buildings.', 'Prepare a Go Bag and keep vehicles ready to leave.', 'Know more than one evacuation route.', 'Monitor local fire and evacuation advisories.'],
    during: ['Evacuate early when authorities advise leaving.', 'Follow designated routes and never drive through smoke or flames.', 'Close windows and doors if sheltering temporarily.', 'Wear a mask and protect your eyes from ash.'],
    after: ['Return only when authorities give permission.', 'Watch for hot ash, unstable trees, and damaged power lines.', 'Check buildings for hidden embers before re-entry.', 'Keep monitoring updates for flare-ups and renewed evacuation orders.'],
  },
];

export default function PreparednessGuideScreen() {
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);
  const [search, setSearch] = useState('');
  const [openSection, setOpenSection] = useState<'before' | 'during' | 'after' | null>('before');

  const visibleGuides = guides.filter((guide) => guide.title.toLowerCase().includes(search.toLowerCase().trim()));

  const openGuide = (guide: Guide) => {
    setSelectedGuide(guide);
    setOpenSection('before');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}><Text style={styles.headerTitle}>GUIDE</Text><Text style={styles.headerSubtitle}>PREPAREDNESS GUIDE</Text></View>
        {selectedGuide ? <GuideDetail guide={selectedGuide} openSection={openSection} setOpenSection={setOpenSection} onBack={() => setSelectedGuide(null)} /> : <>
          <View style={styles.search}><MaterialCommunityIcons name="menu" size={18} color={Colors.white} /><TextInput value={search} onChangeText={setSearch} placeholder="Search type of disaster" placeholderTextColor="#D8EAD8" style={styles.searchInput} /><MaterialCommunityIcons name="magnify" size={22} color={Colors.white} /></View>
          <View style={styles.list}>{visibleGuides.map((guide) => <GuideCard key={guide.title} guide={guide} onPress={() => openGuide(guide)} />)}</View>
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

function GuideCard({ guide, onPress }: { guide: Guide; onPress: () => void }) {
  const motion = useRef(new Animated.Value(0)).current;
  const animateTo = (value: number) => Animated.spring(motion, { toValue: value, useNativeDriver: true, friction: 7, tension: 120 }).start();
  const rotation = motion.interpolate({ inputRange: [0, 1], outputRange: ['0deg', guide.title === 'TYPHOON' ? '8deg' : guide.title === 'VOLCANIC ERUPTION' ? '-4deg' : '0deg'] });
  const lift = motion.interpolate({ inputRange: [0, 1], outputRange: [0, guide.title === 'VOLCANIC ERUPTION' ? -5 : 0] });

  return <Pressable
    style={[styles.guideCard, { backgroundColor: guide.color }]}
    onPress={onPress}
    onPressIn={() => animateTo(1)}
    onPressOut={() => animateTo(0)}
    onHoverIn={() => animateTo(1)}
    onHoverOut={() => animateTo(0)}
    accessibilityLabel={`${guide.title} preparedness guide`}
  >
    <Text style={styles.guideTitle}>{guide.title}</Text>
    <Animated.View style={[styles.guideIcon, { transform: [{ scale: motion.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }, { rotate: rotation }, { translateY: lift }] }]}>
      <MaterialCommunityIcons name={guide.icon} size={42} color={guide.color} />
    </Animated.View>
  </Pressable>;
}

function GuideDetail({ guide, openSection, setOpenSection, onBack }: { guide: Guide; openSection: 'before' | 'during' | 'after' | null; setOpenSection: (section: 'before' | 'during' | 'after' | null) => void; onBack: () => void }) {
  const sections = { before: guide.before, during: guide.during, after: guide.after };
  return <View style={styles.detail}><Pressable style={styles.backButton} onPress={onBack}><MaterialCommunityIcons name="arrow-left" size={20} color="#218B25" /><Text style={styles.backText}>All disasters</Text></Pressable><Text style={styles.detailTitle}>{titleCase(guide.title)}</Text><Image source={guide.image} style={styles.disasterImage} /><View style={styles.accordionList}>{(['before', 'during', 'after'] as const).map((section) => <View key={section} style={styles.accordion}><Pressable style={styles.accordionHeader} onPress={() => setOpenSection(openSection === section ? null : section)}><Text style={styles.accordionTitle}>{section.toUpperCase()}</Text><MaterialCommunityIcons name={openSection === section ? 'chevron-up' : 'chevron-down'} size={22} color="#78A67B" /></Pressable>{openSection === section && <View style={styles.accordionBody}>{sections[section].map((tip) => <Text key={tip} style={styles.tip}>· {tip}</Text>)}</View>}</View>)}</View></View>;
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { width: '100%', maxWidth: 850, alignSelf: 'center', paddingBottom: 24 },
  header: { height: 58, paddingHorizontal: 10, justifyContent: 'center', backgroundColor: '#218B25' },
  headerTitle: { color: Colors.white, fontSize: 24, fontWeight: '900', lineHeight: 25 },
  headerSubtitle: { color: Colors.white, fontSize: 15, fontWeight: '800', lineHeight: 17 },
  search: { height: 36, marginHorizontal: 5, marginVertical: 15, paddingHorizontal: 11, borderRadius: 18, backgroundColor: '#73AE6F', flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, color: Colors.white, fontSize: 11, marginHorizontal: 10, paddingVertical: 0 },
  list: { gap: 9, marginHorizontal: 9 },
  guideCard: { minHeight: 57, paddingLeft: 10, paddingRight: 6, borderRadius: 6, flexDirection: 'row', alignItems: 'center' },
  guideTitle: { flex: 1, color: Colors.white, fontSize: 12, fontWeight: '900' },
  guideIcon: { width: 48, height: 48, borderRadius: 5, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  detail: { paddingHorizontal: 10, paddingTop: 10 },
  backButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { color: '#218B25', fontSize: 11, fontWeight: '700', marginLeft: 5 },
  detailTitle: { color: Colors.text, fontSize: 18, fontWeight: '800', marginTop: 6, marginBottom: 6 },
  disasterImage: { width: '100%', height: 125, borderRadius: 7, resizeMode: 'cover' },
  accordionList: { gap: 9, marginTop: 14 },
  accordion: { borderWidth: 1, borderColor: '#8BC58B', borderRadius: 8, overflow: 'hidden' },
  accordionHeader: { minHeight: 58, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accordionTitle: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  accordionBody: { paddingHorizontal: 12, paddingBottom: 10 },
  tip: { color: Colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 2 },
});
