import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';

import { EventDetails } from '@/components/dashboard/event-details';
import { EventRow } from '@/components/dashboard/event-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { HISTORY_RANGES, useEventHistory, type HistoryRange } from '@/hooks/use-event-history';
import { useTheme } from '@/hooks/use-theme';

export default function HistoryScreen() {
  const theme = useTheme();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<HistoryRange>('7d');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Debounce typing so we don't query Supabase on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const { events, loading, loadingMore, hasMore, error, loadMore } = useEventHistory({ search, range });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View>
            <ThemedText type="code" themeColor="accent" style={styles.eyebrow}>
              MONITORIX
            </ThemedText>
            <ThemedText type="subtitle">Event history</ThemedText>
          </View>
          <Link href="/" asChild>
            <Pressable>
              <ThemedText type="link" themeColor="textSecondary">
                ← Dashboard
              </ThemedText>
            </Pressable>
          </Link>
        </View>

        <TextInput
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search events (file name, app, event type…)"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.searchInput,
            { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement },
          ]}
        />

        <View style={styles.rangeRow}>
          {HISTORY_RANGES.map((item) => {
            const active = range === item.key;
            return (
              <Pressable key={item.key} onPress={() => setRange(item.key)}>
                <ThemedView
                  style={[
                    styles.rangeChip,
                    { borderColor: active ? theme.accent : theme.border },
                    active && { backgroundColor: theme.backgroundSelected },
                  ]}>
                  <ThemedText type="small" themeColor={active ? 'accent' : 'textSecondary'}>
                    {item.label}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            );
          })}
        </View>

        {error && (
          <ThemedText themeColor="danger" type="small">
            {error}
          </ThemedText>
        )}

        {loading ? (
          <ActivityIndicator color={theme.accent} style={styles.loader} />
        ) : (
          <FlatList
            style={styles.list}
            data={events}
            keyExtractor={(item) => item.id}
            extraData={selectedEventId}
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary" type="small" style={styles.empty}>
                No events match this search.
              </ThemedText>
            }
            renderItem={({ item }) => (
              <View>
                <EventRow
                  event={item}
                  selected={selectedEventId === item.id}
                  onPress={() => setSelectedEventId((prev) => (prev === item.id ? null : item.id))}
                />
                {selectedEventId === item.id && (
                  <View style={styles.inlineDetails}>
                    <EventDetails event={item} />
                  </View>
                )}
              </View>
            )}
            ListFooterComponent={
              hasMore ? (
                <Pressable onPress={loadMore} disabled={loadingMore} style={styles.loadMore}>
                  <ThemedText type="linkPrimary">{loadingMore ? 'Loading…' : 'Load more'}</ThemedText>
                </Pressable>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: Spacing.three,
  },
  eyebrow: {
    letterSpacing: 2,
    marginBottom: Spacing.half,
  },
  searchInput: {
    borderRadius: Radius.small,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  rangeChip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  list: {
    flex: 1,
  },
  loader: {
    marginTop: Spacing.five,
  },
  empty: {
    paddingTop: Spacing.four,
    textAlign: 'center',
  },
  inlineDetails: {
    marginBottom: Spacing.two,
  },
  loadMore: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
});
