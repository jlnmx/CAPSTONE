import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';
import { searchMapPlaces } from '@services/map/googleMaps';
import type { SearchedPlace } from '@services/map/googleMaps';

export type MapSearchSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  latitude: number;
  longitude: number;
  kind: 'center' | 'incident' | 'place';
};

type Props = {
  query: string;
  onChangeQuery: (query: string) => void;
  localSuggestions: MapSearchSuggestion[];
  onSelect: (suggestion: MapSearchSuggestion) => void;
  onNavigate: (suggestion: MapSearchSuggestion) => void;
  placeholder: string;
  accessibilityLabel: string;
};

function toSuggestion(place: SearchedPlace): MapSearchSuggestion {
  return {
    id: `place-${place.id}`,
    title: place.name,
    subtitle: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    kind: 'place',
  };
}

export default function MapSearchBox({
  query,
  onChangeQuery,
  localSuggestions,
  onSelect,
  onNavigate,
  placeholder,
  accessibilityLabel,
}: Props) {
  const [remoteSuggestions, setRemoteSuggestions] = useState<MapSearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [open, setOpen] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchedLocal = useMemo(() => {
    if (!normalizedQuery) return [];
    const words = normalizedQuery.split(/\s+/);
    return localSuggestions.filter((item) => words.every((word) => (
      `${item.title} ${item.subtitle}`.toLocaleLowerCase().includes(word)
    ))).slice(0, 4);
  }, [localSuggestions, normalizedQuery]);
  const suggestions = [...matchedLocal, ...remoteSuggestions]
    .filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index)
    .slice(0, 6);

  useEffect(() => {
    let active = true;
    if (normalizedQuery.length < 2) {
      setRemoteSuggestions([]);
      setLoading(false);
      setSearchError('');
      return () => { active = false; };
    }

    setRemoteSuggestions([]);
    setLoading(true);
    setSearchError('');
    const timer = setTimeout(() => {
      void searchMapPlaces(query.trim()).then((places) => {
        if (active) setRemoteSuggestions(places.map(toSuggestion));
      }).catch((error: unknown) => {
        if (active) setSearchError(error instanceof Error ? error.message : 'Place suggestions are unavailable.');
      }).finally(() => {
        if (active) setLoading(false);
      });
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [normalizedQuery, query]);

  const choose = (suggestion: MapSearchSuggestion, navigate = false) => {
    setOpen(false);
    onChangeQuery('');
    if (navigate) onNavigate(suggestion);
    else onSelect(suggestion);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.searchBar}>
        <MaterialCommunityIcons name="magnify" size={21} color={Colors.primary} />
        <TextInput
          value={query}
          onChangeText={(value) => { onChangeQuery(value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onSubmitEditing={() => { if (suggestions[0]) choose(suggestions[0]); }}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          returnKeyType="search"
          accessibilityLabel={accessibilityLabel}
          style={styles.searchInput}
        />
        {loading ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
        {query.length > 0 ? (
          <Pressable onPress={() => { onChangeQuery(''); setOpen(false); }} accessibilityRole="button" accessibilityLabel="Clear map search">
            <MaterialCommunityIcons name="close-circle" size={20} color={Colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {open && normalizedQuery.length > 0 ? (
        <View style={styles.results}>
          <ScrollView keyboardShouldPersistTaps="always" nestedScrollEnabled style={styles.resultsScroll}>
            {suggestions.map((suggestion) => (
              <View key={suggestion.id} style={styles.resultRow}>
                <Pressable
                  onPress={() => choose(suggestion)}
                  style={styles.resultMain}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${suggestion.title} on map`}
                >
                  <View style={styles.resultIcon}>
                    <MaterialCommunityIcons
                      name={suggestion.kind === 'center' ? 'home-city-outline' : suggestion.kind === 'incident' ? 'alert-circle-outline' : 'map-marker-outline'}
                      size={19}
                      color={suggestion.kind === 'incident' ? Colors.emergency : Colors.primary}
                    />
                  </View>
                  <View style={styles.resultCopy}>
                    <Text numberOfLines={1} style={styles.resultTitle}>{suggestion.title}</Text>
                    <Text numberOfLines={1} style={styles.resultSubtitle}>{suggestion.subtitle || 'Place'}</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => choose(suggestion, true)}
                  style={styles.navigateButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Navigate to ${suggestion.title}`}
                >
                  <MaterialCommunityIcons name="navigation-variant" size={17} color={Colors.primary} />
                  <Text style={styles.navigateLabel}>Navigate</Text>
                </Pressable>
              </View>
            ))}
            {!loading && suggestions.length === 0 && !searchError ? (
              <Text style={styles.emptyText}>{normalizedQuery.length < 2 ? 'Type one more character to search nearby places.' : 'No matching centers or places yet.'}</Text>
            ) : null}
            {!!searchError ? <Text accessibilityRole="alert" style={styles.errorText}>{searchError}</Text> : null}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 12, left: 12, right: 12, zIndex: 20 },
  searchBar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, borderRadius: 13, backgroundColor: Colors.white, elevation: 5, shadowColor: '#142418', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14, paddingVertical: 11 },
  results: { marginTop: 7, maxHeight: 300, overflow: 'hidden', borderRadius: 14, backgroundColor: Colors.white, elevation: 7, shadowColor: '#142418', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  resultsScroll: { maxHeight: 300 },
  resultRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8ECE8', paddingLeft: 12, paddingRight: 9 },
  resultMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  resultIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#EEF6EE' },
  resultCopy: { flex: 1, gap: 2 },
  resultTitle: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  resultSubtitle: { color: Colors.textMuted, fontSize: 10 },
  navigateButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 9, backgroundColor: '#EDF6ED' },
  navigateLabel: { color: Colors.primary, fontSize: 10, fontWeight: '800' },
  emptyText: { padding: 15, color: Colors.textMuted, fontSize: 12, textAlign: 'center' },
  errorText: { padding: 12, color: '#A52D2D', fontSize: 11 },
});
