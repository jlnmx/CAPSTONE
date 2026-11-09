import React, { useRef, useState } from 'react';
import { Animated, ColorValue, Easing, Image, ImageSourcePropType, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable as Pressable } from '@components/Buttons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientHeader, Reveal } from '@components/ScreenKit';

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
        <GradientHeader title="Preparedness Guide" subtitle="Know what to do before, during and after" icon="book-open-page-variant" />
        {selectedGuide ? <GuideDetail guide={selectedGuide} openSection={openSection} setOpenSection={setOpenSection} onBack={() => setSelectedGuide(null)} /> : <>
          <View style={styles.search}><MaterialCommunityIcons name="magnify" size={22} color="#218B25" /><TextInput value={search} onChangeText={setSearch} placeholder="Search type of disaster" placeholderTextColor="#8FA891" style={styles.searchInput} /></View>
          <View style={styles.list}>{visibleGuides.map((guide, index) => <Reveal key={guide.title} index={index}><GuideCard guide={guide} onPress={() => openGuide(guide)} /></Reveal>)}</View>
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

const cardThemes: Record<string, { bg: string; tag: string; subtitle: string; chipBg: string; chipText: string; iconBg: string; iconColor: string }> = {
  'EARTHQUAKE': { bg: '#D6503F', tag: 'EARTHQUAKE', subtitle: 'Ground shaking & fault line safety procedures.', chipBg: '#FCE3DD', chipText: '#B83A2A', iconBg: '#FFF1EC', iconColor: '#D6503F' },
  'FLASH FLOOD': { bg: '#1F3A52', tag: 'FLOOD', subtitle: 'Evacuation steps for rising river & lake waters.', chipBg: '#DCE8F2', chipText: '#1F3A52', iconBg: '#E8EFF5', iconColor: '#1F3A52' },
  'CHEMICAL LEAK': { bg: '#8A4410', tag: 'INDUSTRIAL', subtitle: 'Shelter-in-place & chemical spill protocols.', chipBg: '#FDEBC8', chipText: '#8A4410', iconBg: '#FFF3D6', iconColor: '#C25E0A' },
  'FIRE': { bg: '#B0382B', tag: 'FIRE', subtitle: 'Escape plans, extinguishers & smoke safety.', chipBg: '#FCE3DD', chipText: '#B0382B', iconBg: '#FFF1EC', iconColor: '#B0382B' },
  'WILDFIRE': { bg: '#A36A2C', tag: 'WILDFIRE', subtitle: 'Early evacuation & ember protection steps.', chipBg: '#FBEBD4', chipText: '#7A4A14', iconBg: '#FFF4E3', iconColor: '#A36A2C' },
  'TYPHOON': { bg: '#8A2416', tag: 'TYPHOON', subtitle: '72-hour Go-Bag checklist & city hotlines.', chipBg: '#FFF04D', chipText: '#6B1B10', iconBg: '#FFF04D', iconColor: '#8A2416' },
  'VOLCANIC ERUPTION': { bg: '#1E4A12', tag: 'VOLCANIC', subtitle: 'N95 mask & ashfall protection procedures.', chipBg: '#FFF04D', chipText: '#1E4A12', iconBg: '#FFF04D', iconColor: '#1E4A12' },
};

function GuideCard({ guide, onPress }: { guide: Guide; onPress: () => void }) {
  const motion = useRef(new Animated.Value(0)).current;
  const theme = cardThemes[guide.title] ?? { bg: String(guide.color), tag: guide.title, subtitle: 'Preparedness guide', chipBg: '#FFFFFF', chipText: '#333333', iconBg: '#FFFFFF', iconColor: String(guide.color) };
  const animateTo = (value: number) => Animated.spring(motion, { toValue: value, useNativeDriver: true, friction: 7, tension: 120 }).start();
  const rotation = motion.interpolate({ inputRange: [0, 1], outputRange: ['0deg', guide.title === 'TYPHOON' ? '8deg' : guide.title === 'VOLCANIC ERUPTION' ? '-4deg' : '0deg'] });
  const lift = motion.interpolate({ inputRange: [0, 1], outputRange: [0, guide.title === 'VOLCANIC ERUPTION' ? -5 : 0] });

  return <Pressable
    style={[styles.guideCard, { backgroundColor: theme.bg }]}
    onPress={onPress}
    onPressIn={() => animateTo(1)}
    onPressOut={() => animateTo(0)}
    onHoverIn={() => animateTo(1)}
    onHoverOut={() => animateTo(0)}
    accessibilityLabel={`${guide.title} preparedness guide`}
  >
    <Animated.View style={[styles.guideIcon, { backgroundColor: theme.iconBg, transform: [{ scale: motion.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }, { rotate: rotation }, { translateY: lift }] }]}>
      <MaterialCommunityIcons name={guide.icon} size={26} color={theme.iconColor} />
    </Animated.View>
    <View style={styles.guideCopy}>
      <View style={[styles.guideChip, { backgroundColor: theme.chipBg }]}><Text style={[styles.guideChipText, { color: theme.chipText }]}>{theme.tag}</Text></View>
      <Text style={styles.guideTitle}>{titleCase(guide.title)} Safety</Text>
      <Text style={styles.guideSubtitle}>{theme.subtitle}</Text>
    </View>
    <View style={styles.guideChevron}><MaterialCommunityIcons name="chevron-right" size={20} color={Colors.white} /></View>
  </Pressable>;
}

const phaseMeta = {
  before: { label: 'Before', icon: 'clipboard-check-outline', color: '#2F7FD1', hint: 'Prepare ahead' },
  during: { label: 'During', icon: 'alert-octagon-outline', color: '#D9822B', hint: 'Stay safe in the moment' },
  after: { label: 'After', icon: 'shield-check-outline', color: '#218B25', hint: 'Recover carefully' },
} as const;

function AccordionBody({ tips, color }: { tips: string[]; color: string }) {
  const enter = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter]);
  return <Animated.View style={[styles.accordionBody, { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]}>
    {tips.map((tip, index) => <View key={tip} style={styles.tipRow}><View style={[styles.tipNumber, { backgroundColor: `${color}1A` }]}><Text style={[styles.tipNumberText, { color }]}>{index + 1}</Text></View><Text style={styles.tip}>{tip}</Text></View>)}
  </Animated.View>;
}

function GuideDetail({ guide, openSection, setOpenSection, onBack }: { guide: Guide; openSection: 'before' | 'during' | 'after' | null; setOpenSection: (section: 'before' | 'during' | 'after' | null) => void; onBack: () => void }) {
  const sections = { before: guide.before, during: guide.during, after: guide.after };
  return <View style={styles.detail}>
    <Pressable style={styles.backButton} onPress={onBack}><MaterialCommunityIcons name="arrow-left" size={18} color="#218B25" /><Text style={styles.backText}>All disasters</Text></Pressable>
    <Reveal index={0}>
      <View style={styles.hero}>
        <Image source={guide.image} style={styles.disasterImage} />
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']} style={styles.heroShade} />
        <View style={styles.heroCopy}>
          <View style={styles.heroIcon}><MaterialCommunityIcons name={guide.icon} size={22} color="#FFFFFF" /></View>
          <View style={styles.heroText}><Text style={styles.detailTitle}>{titleCase(guide.title)} Safety</Text><Text style={styles.heroSub}>{guide.before.length + guide.during.length + guide.after.length} steps to keep you safe</Text></View>
        </View>
      </View>
    </Reveal>
    <View style={styles.accordionList}>{(['before', 'during', 'after'] as const).map((section, index) => {
      const meta = phaseMeta[section];
      const open = openSection === section;
      return <Reveal key={section} index={index + 1}>
        <View style={[styles.accordion, open && { borderColor: meta.color }]}>
          <Pressable style={styles.accordionHeader} onPress={() => setOpenSection(open ? null : section)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
            <View style={[styles.phaseIcon, { backgroundColor: `${meta.color}1A` }]}><MaterialCommunityIcons name={meta.icon} size={20} color={meta.color} /></View>
            <View style={styles.phaseCopy}><Text style={styles.accordionTitle}>{meta.label}</Text><Text style={styles.phaseHint}>{meta.hint} · {sections[section].length} steps</Text></View>
            <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={24} color={meta.color} />
          </Pressable>
          {open && <AccordionBody tips={sections[section]} color={meta.color} />}
        </View>
      </Reveal>;
    })}</View>
  </View>;
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { width: '100%', maxWidth: 850, alignSelf: 'center', paddingBottom: 24 },
  header: { minHeight: 58, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#218B25' },
  headerCopy: { flex: 1 },
  headerTitle: { color: Colors.white, fontSize: 24, fontWeight: '900', lineHeight: 25 },
  headerSubtitle: { color: Colors.white, fontSize: 15, fontWeight: '800', lineHeight: 17 },
  search: { height: 48, marginHorizontal: 14, marginTop: 18, marginBottom: 14, paddingHorizontal: 14, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#D9E3D9', flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14, marginHorizontal: 10, paddingVertical: 0 },
  list: { gap: 12, marginHorizontal: 14 },
  guideCard: { minHeight: 96, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 4 },
  guideCopy: { flex: 1, minWidth: 0 },
  guideChip: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5, marginBottom: 5 },
  guideChipText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  guideTitle: { color: '#FFFFFF', fontFamily: 'Sora_700Bold', fontSize: 15 },
  guideSubtitle: { color: 'rgba(255,255,255,0.88)', fontSize: 12, lineHeight: 16, marginTop: 2 },
  guideChevron: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  guideIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  detail: { paddingHorizontal: 14, paddingTop: 14 },
  backButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#E4F1E4', marginBottom: 12 },
  backText: { color: '#218B25', fontSize: 12, fontWeight: '700', marginLeft: 5 },
  hero: { height: 200, borderRadius: 22, overflow: 'hidden', backgroundColor: '#1B2A1C' },
  disasterImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 },
  heroCopy: { position: 'absolute', left: 14, right: 14, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.22)' },
  heroText: { flex: 1 },
  detailTitle: { color: '#FFFFFF', fontFamily: 'Sora_700Bold', fontSize: 20 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  accordionList: { gap: 12, marginTop: 16 },
  accordion: { borderWidth: 1.5, borderColor: '#E0EAE0', borderRadius: 20, overflow: 'hidden', backgroundColor: '#FFFFFF', shadowColor: '#103A18', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  accordionHeader: { minHeight: 68, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  phaseIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  phaseCopy: { flex: 1 },
  accordionTitle: { color: Colors.text, fontFamily: 'Sora_700Bold', fontSize: 16 },
  phaseHint: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  accordionBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tipNumber: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tipNumberText: { fontSize: 11, fontWeight: '800' },
  tip: { flex: 1, color: Colors.text, fontSize: 13, lineHeight: 19 },
});
