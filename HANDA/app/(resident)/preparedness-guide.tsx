import { ThemeAwareView, ThemeAwareSafeAreaView, ThemeAwareScrollView, ThemeAwarePressable, ThemeAwareTextInput } from '@components/ThemeAware';
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
  image?: ImageSourcePropType;
  before: string[];
  during: string[];
  after: string[];
  searchTerms?: string[];
  sectionTitles?: Partial<Record<'before' | 'during' | 'after', string>>;
};

type SortMode = 'recommended' | 'alphabetical';

const RECOMMENDED_GUIDE_ORDER = ['GO BAG', 'TYPHOON', 'FLASH FLOOD', 'EARTHQUAKE', 'VOLCANIC ERUPTION', 'FIRE', 'WILDFIRE', 'CHEMICAL LEAK'];

const guides: Guide[] = [
  {
    title: 'GO BAG', icon: 'bag-personal-outline', color: Colors.primary,
    before: [
      'Drinking water and ready-to-eat food for each household member for at least three days.',
      'Copies of IDs, key documents, emergency contacts, and a small amount of cash in a waterproof pouch.',
      'First-aid supplies, personal medicines, prescriptions, and basic hygiene items.',
      'Flashlight, spare batteries, battery-powered radio, charged power bank, and charging cables.',
      'A change of clothes, sturdy footwear, rain protection, face masks, and a whistle.',
      'Baby, older adult, disability, and pet supplies your household specifically needs.',
    ],
    during: [
      'Keep the bag near an exit and take it when evacuating; do not delay leaving to collect belongings.',
      'Use medicines and first-aid items only as needed, and keep essential documents protected from water.',
      'Conserve phone battery and follow instructions from local authorities and responders.',
    ],
    after: [
      'Replace food, water, medicine, and other items you used or that have expired.',
      'Check batteries, power banks, documents, and clothing, then adjust the bag for household needs.',
      'Review the kit every six months and whenever household members or needs change.',
    ],
    searchTerms: ['emergency kit', '72 hour kit', 'supplies', 'checklist'],
    sectionTitles: { before: 'What to pack', during: 'Using your GO bag', after: 'After an emergency' },
  },
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
  const [sortMode, setSortMode] = useState<SortMode>('recommended');
  const [openSection, setOpenSection] = useState<'before' | 'during' | 'after' | null>('before');

  const normalizedSearch = search.trim().toLowerCase();
  const visibleGuides = guides
    .filter((guide) => {
      const theme = cardThemes[guide.title];
      return `${guideCardTitle(guide)} ${guide.title} ${theme.tag} ${theme.subtitle} ${guide.searchTerms?.join(' ') ?? ''}`
        .toLowerCase()
        .includes(normalizedSearch);
    })
    .sort((first, second) => sortMode === 'alphabetical'
      ? guideCardTitle(first).localeCompare(guideCardTitle(second))
      : RECOMMENDED_GUIDE_ORDER.indexOf(first.title) - RECOMMENDED_GUIDE_ORDER.indexOf(second.title));

  const openGuide = (guide: Guide) => {
    setSelectedGuide(guide);
    setOpenSection('before');
  };

  return (
    <ThemeAwareSafeAreaView style={styles.safeArea}>
      <ThemeAwareScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GradientHeader title="Preparedness Guide" subtitle="Know what to do before, during and after" icon="book-open-page-variant" showBack />
        {selectedGuide ? <GuideDetail guide={selectedGuide} openSection={openSection} setOpenSection={setOpenSection} onBack={() => setSelectedGuide(null)} /> : <>
          <ThemeAwareView style={styles.listHeading}>
            <ThemeAwareView>
              <Text style={styles.listTitle}>Explore guides</Text>
              <Text style={styles.listSubtitle}>Practical steps for you and your household</Text>
            </ThemeAwareView>
            <ThemeAwareView style={styles.countBadge}><Text style={styles.countBadgeText}>{visibleGuides.length}</Text></ThemeAwareView>
          </ThemeAwareView>
          <ThemeAwareView style={styles.search}>
            <MaterialCommunityIcons name="magnify" size={20} color={Colors.primary} />
            <ThemeAwareTextInput value={search} onChangeText={setSearch} placeholder="Search guides or supplies" placeholderTextColor="#8996A3" style={styles.searchInput} returnKeyType="search" accessibilityLabel="Search preparedness guides" />
            {search.length > 0 && <ThemeAwarePressable onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear guide search"><MaterialCommunityIcons name="close-circle" size={19} color="#8996A3" /></ThemeAwarePressable>}
          </ThemeAwareView>
          <ThemeAwareView style={styles.sortRow}>
            <Text style={styles.sortLabel}>SORT BY</Text>
            <ThemeAwareView style={styles.sortOptions}>
              <SortOption label="Recommended" icon="star-four-points" selected={sortMode === 'recommended'} onPress={() => setSortMode('recommended')} />
              <SortOption label="A–Z" icon="sort-alphabetical-ascending" selected={sortMode === 'alphabetical'} onPress={() => setSortMode('alphabetical')} />
            </ThemeAwareView>
          </ThemeAwareView>
          {visibleGuides.length > 0
            ? <ThemeAwareView style={styles.list}>{visibleGuides.map((guide, index) => <Reveal key={guide.title} index={index}><GuideCard guide={guide} onPress={() => openGuide(guide)} /></Reveal>)}</ThemeAwareView>
            : <ThemeAwareView style={styles.emptyState}><ThemeAwareView style={styles.emptyIcon}><MaterialCommunityIcons name="book-search-outline" size={25} color={Colors.primary} /></ThemeAwareView><Text style={styles.emptyTitle}>No matching guides</Text><Text style={styles.emptyText}>Try a different disaster type or search for “GO bag”.</Text></ThemeAwareView>}
        </>}
      </ThemeAwareScrollView>
    </ThemeAwareSafeAreaView>
  );
}

const cardThemes: Record<string, { accent: string; tag: string; subtitle: string; iconBg: string; iconColor: string }> = {
  'GO BAG': { accent: '#D45B92', tag: 'ESSENTIALS', subtitle: 'Build a practical emergency kit for your household.', iconBg: '#FFF0F6', iconColor: '#C3447D' },
  'EARTHQUAKE': { accent: '#D6503F', tag: 'EARTHQUAKE', subtitle: 'What to do before, during, and after shaking.', iconBg: '#FFF1EC', iconColor: '#D6503F' },
  'FLASH FLOOD': { accent: '#367694', tag: 'FLOOD', subtitle: 'Stay safe around rising water and flash floods.', iconBg: '#EAF4F8', iconColor: '#316A8D' },
  'CHEMICAL LEAK': { accent: '#A66021', tag: 'INDUSTRIAL', subtitle: 'Shelter-in-place and chemical spill guidance.', iconBg: '#FFF4E5', iconColor: '#A66021' },
  'FIRE': { accent: '#BE4A3F', tag: 'FIRE', subtitle: 'Plan safe exits and avoid smoke and flames.', iconBg: '#FFF0EE', iconColor: '#BE4A3F' },
  'WILDFIRE': { accent: '#A36A2C', tag: 'WILDFIRE', subtitle: 'Prepare to leave early and protect against ash.', iconBg: '#F9F0E5', iconColor: '#8A5A27' },
  'TYPHOON': { accent: '#715B96', tag: 'TYPHOON', subtitle: 'Prepare for strong winds, rain, and flooding.', iconBg: '#F1EDFA', iconColor: '#715B96' },
  'VOLCANIC ERUPTION': { accent: '#627C3B', tag: 'VOLCANIC', subtitle: 'Protect yourself from ashfall and eruption hazards.', iconBg: '#F0F5E9', iconColor: '#627C3B' },
};

function SortOption({ label, icon, selected, onPress }: { label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; selected: boolean; onPress: () => void }) {
  return (
    <ThemeAwarePressable style={[styles.sortOption, selected && styles.sortOptionSelected]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}>
      <MaterialCommunityIcons name={icon} size={14} color={selected ? '#FFFFFF' : '#667085'} />
      <Text style={[styles.sortOptionText, selected && styles.sortOptionTextSelected]}>{label}</Text>
    </ThemeAwarePressable>
  );
}

function GuideCard({ guide, onPress }: { guide: Guide; onPress: () => void }) {
  const motion = useRef(new Animated.Value(0)).current;
  const theme = cardThemes[guide.title];
  const animateTo = (value: number) => Animated.spring(motion, { toValue: value, useNativeDriver: true, friction: 7, tension: 120 }).start();

  const lift = motion.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const scale = motion.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });
  const stepCount = guide.before.length + guide.during.length + guide.after.length;

  return (
    <ThemeAwarePressable
      onPress={onPress}
      onPressIn={() => animateTo(1)}
      onPressOut={() => animateTo(0)}
      onHoverIn={() => animateTo(1)}
      onHoverOut={() => animateTo(0)}
      accessibilityRole="button"
      accessibilityLabel={`${guideCardTitle(guide)} preparedness guide`}
    >
      <Animated.View style={[styles.guideCard, { borderColor: `${theme.accent}30`, transform: [{ translateY: lift }, { scale }] }]}>
        <ThemeAwareView style={[styles.guideAccent, { backgroundColor: theme.accent }]} />
        <Animated.View style={[styles.guideIcon, { backgroundColor: theme.iconBg, transform: [{ scale: motion.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) }] }]}>
          <MaterialCommunityIcons name={guide.icon} size={25} color={theme.iconColor} />
        </Animated.View>
        <ThemeAwareView style={styles.guideCopy}>
          <Text style={[styles.guideChipText, { color: theme.accent }]}>{theme.tag}</Text>
          <Text style={styles.guideTitle} numberOfLines={2}>{guideCardTitle(guide)}</Text>
          <Text style={styles.guideSubtitle} numberOfLines={2}>{theme.subtitle}</Text>
          <ThemeAwareView style={styles.guideMeta}>
            <MaterialCommunityIcons name="format-list-checks" size={13} color="#7B8794" />
            <Text style={styles.guideMetaText}>{stepCount} quick steps</Text>
          </ThemeAwareView>
        </ThemeAwareView>
        <ThemeAwareView style={[styles.guideChevron, { backgroundColor: theme.iconBg }]}>
          <MaterialCommunityIcons name="arrow-up-right" size={18} color={theme.iconColor} />
        </ThemeAwareView>
      </Animated.View>
    </ThemeAwarePressable>
  );
}

const phaseMeta = {
  before: { label: 'Before', icon: 'clipboard-check-outline', color: '#2F7FD1', hint: 'Prepare ahead' },
  during: { label: 'During', icon: 'alert-octagon-outline', color: '#D9822B', hint: 'Stay safe in the moment' },
  after: { label: 'After', icon: 'shield-check-outline', color: '#D45B92', hint: 'Recover carefully' },
} as const;

function AccordionBody({ tips, color }: { tips: string[]; color: string }) {
  const enter = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter]);
  return <Animated.View style={[styles.accordionBody, { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]}>
    {tips.map((tip, index) => <ThemeAwareView key={tip} style={styles.tipRow}><ThemeAwareView style={[styles.tipNumber, { backgroundColor: `${color}1A` }]}><Text style={[styles.tipNumberText, { color }]}>{index + 1}</Text></ThemeAwareView><Text style={styles.tip}>{tip}</Text></ThemeAwareView>)}
  </Animated.View>;
}

function GuideDetail({ guide, openSection, setOpenSection, onBack }: { guide: Guide; openSection: 'before' | 'during' | 'after' | null; setOpenSection: (section: 'before' | 'during' | 'after' | null) => void; onBack: () => void }) {
  const sections = { before: guide.before, during: guide.during, after: guide.after };
  return <ThemeAwareView style={styles.detail}>
    <ThemeAwarePressable style={styles.backButton} onPress={onBack}><MaterialCommunityIcons name="arrow-left" size={18} color={Colors.primary} /><Text style={styles.backText}>All guides</Text></ThemeAwarePressable>
    <Reveal index={0}>
      <ThemeAwareView style={styles.hero}>
        {guide.image ? <>
          <Image source={guide.image} style={styles.disasterImage} />
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']} style={styles.heroShade} />
        </> : <>
          <LinearGradient colors={['#D45B92', '#765C91']} style={StyleSheet.absoluteFill} />
          <MaterialCommunityIcons name="bag-personal-outline" size={150} color="rgba(255,255,255,0.12)" style={styles.heroWatermark} />
        </>}
        <ThemeAwareView style={styles.heroCopy}>
          <ThemeAwareView style={styles.heroIcon}><MaterialCommunityIcons name={guide.icon} size={22} color="#FFFFFF" /></ThemeAwareView>
          <ThemeAwareView style={styles.heroText}><Text style={styles.detailTitle}>{guideCardTitle(guide)}</Text><Text style={styles.heroSub}>{guide.before.length + guide.during.length + guide.after.length} practical steps</Text></ThemeAwareView>
        </ThemeAwareView>
      </ThemeAwareView>
    </Reveal>
    <ThemeAwareView style={styles.accordionList}>{(['before', 'during', 'after'] as const).map((section, index) => {
      const meta = phaseMeta[section];
      const open = openSection === section;
      return <Reveal key={section} index={index + 1}>
        <ThemeAwareView style={[styles.accordion, open && { borderColor: meta.color }]}>
          <ThemeAwarePressable style={styles.accordionHeader} onPress={() => setOpenSection(open ? null : section)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
            <ThemeAwareView style={[styles.phaseIcon, { backgroundColor: `${meta.color}1A` }]}><MaterialCommunityIcons name={meta.icon} size={20} color={meta.color} /></ThemeAwareView>
            <ThemeAwareView style={styles.phaseCopy}><Text style={styles.accordionTitle}>{guide.sectionTitles?.[section] ?? meta.label}</Text><Text style={styles.phaseHint}>{meta.hint} · {sections[section].length} steps</Text></ThemeAwareView>
            <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={24} color={meta.color} />
          </ThemeAwarePressable>
          {open && <AccordionBody tips={sections[section]} color={meta.color} />}
        </ThemeAwareView>
      </Reveal>;
    })}</ThemeAwareView>
  </ThemeAwareView>;
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function guideCardTitle(guide: Guide) {
  return guide.title === 'GO BAG' ? "What's inside a GO bag?" : `${titleCase(guide.title)} Safety`;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { width: '100%', maxWidth: 850, alignSelf: 'center', paddingBottom: 24 },
  header: { minHeight: 58, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#D45B92' },
  headerCopy: { flex: 1 },
  headerTitle: { color: Colors.white, fontSize: 24, fontWeight: '900', lineHeight: 25 },
  headerSubtitle: { color: Colors.white, fontSize: 15, fontWeight: '800', lineHeight: 17 },
  listHeading: { marginHorizontal: 16, marginTop: 18, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listTitle: { color: '#17212B', fontFamily: 'Sora_700Bold', fontSize: 18 },
  listSubtitle: { color: '#667085', fontSize: 11, marginTop: 3 },
  countBadge: { minWidth: 34, height: 34, paddingHorizontal: 9, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0F6' },
  countBadgeText: { color: Colors.primary, fontFamily: 'Sora_700Bold', fontSize: 13 },
  search: { minHeight: 48, marginHorizontal: 14, marginBottom: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E8EE', flexDirection: 'row', alignItems: 'center', shadowColor: '#253044', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 13, marginHorizontal: 10, paddingVertical: 0 },
  sortRow: { marginHorizontal: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sortLabel: { color: '#8993A1', fontFamily: 'InstrumentSans_700Bold', fontSize: 9, letterSpacing: 1 },
  sortOptions: { flexDirection: 'row', gap: 7 },
  sortOption: { minHeight: 32, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, borderColor: '#E4E8EE', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  sortOptionSelected: { backgroundColor: '#26384B', borderColor: '#26384B' },
  sortOptionText: { color: '#667085', fontFamily: 'InstrumentSans_600SemiBold', fontSize: 10 },
  sortOptionTextSelected: { color: '#FFFFFF' },
  list: { gap: 10, marginHorizontal: 14, paddingBottom: 10 },
  guideCard: { minHeight: 112, paddingVertical: 13, paddingHorizontal: 13, borderRadius: 20, borderWidth: 1, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 11, shadowColor: '#24364B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 2 },
  guideAccent: { position: 'absolute', top: 16, bottom: 16, left: 0, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  guideCopy: { flex: 1, minWidth: 0 },
  guideChipText: { fontFamily: 'InstrumentSans_700Bold', fontSize: 9, letterSpacing: 1, marginBottom: 3 },
  guideTitle: { color: '#1C2938', fontFamily: 'Sora_700Bold', fontSize: 14, lineHeight: 19 },
  guideSubtitle: { color: '#667085', fontFamily: 'InstrumentSans_400Regular', fontSize: 11, lineHeight: 15, marginTop: 3 },
  guideMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7 },
  guideMetaText: { color: '#7B8794', fontFamily: 'InstrumentSans_600SemiBold', fontSize: 10 },
  guideChevron: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  guideIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  emptyState: { marginHorizontal: 14, marginTop: 12, padding: 24, alignItems: 'center', borderRadius: 20, borderWidth: 1, borderColor: '#E4E8EE', backgroundColor: '#FFFFFF' },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0F6' },
  emptyTitle: { color: '#1C2938', fontFamily: 'Sora_700Bold', fontSize: 15, marginTop: 12 },
  emptyText: { color: '#667085', fontFamily: 'InstrumentSans_400Regular', fontSize: 12, textAlign: 'center', lineHeight: 17, marginTop: 5 },
  detail: { paddingHorizontal: 14, paddingTop: 14 },
  backButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#FFF1F6', marginBottom: 12 },
  backText: { color: Colors.primary, fontSize: 12, fontWeight: '700', marginLeft: 5 },
  hero: { height: 200, borderRadius: 22, overflow: 'hidden', backgroundColor: '#1B2A1C' },
  disasterImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 },
  heroWatermark: { position: 'absolute', right: 12, top: 14 },
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
