import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CategoryColors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useDashboard } from '@/hooks/use-dashboard';
import { useTheme } from '@/hooks/use-theme';
import { categorizeEvent, EVENT_CATEGORY_TABS, eventTypesForCategory } from '@/lib/event-categories';

type CategoryTabKey = (typeof EVENT_CATEGORY_TABS)[number]['key'];

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function DashboardScreen() {
  const theme = useTheme();
  const { session, signOut } = useAuth();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryTabKey>('all');

  const categoryEventTypes = useMemo(
    () => (selectedCategory === 'all' ? null : eventTypesForCategory(selectedCategory)),
    [selectedCategory]
  );
  const { devices, events, loading, error } = useDashboard({
    deviceId: selectedDeviceId,
    categoryEventTypes,
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View>
            <ThemedText type="code" themeColor="accent" style={styles.eyebrow}>
              MONITORIX
            </ThemedText>
            <ThemedText themeColor="textSecondary" type="small">
              {session?.user.email}
            </ThemedText>
          </View>
          <Pressable onPress={signOut}>
            <ThemedText type="link" themeColor="textSecondary">
              Sign out
            </ThemedText>
          </Pressable>
        </View>

        {error && (
          <ThemedText themeColor="danger" type="small">
            {error}
          </ThemedText>
        )}

        {devices.length === 0 && !loading ? (
          <ThemedView type="backgroundElement" style={[styles.emptyDevices, { borderColor: theme.border }]}>
            <ThemedText type="smallBold">No devices yet</ThemedText>
            <ThemedText themeColor="textSecondary" type="small">
              Run the monitoring agent on a PC and sign in with this account to see it here.
            </ThemedText>
          </ThemedView>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            <Pressable onPress={() => setSelectedDeviceId(null)}>
              <ThemedView
                style={[
                  styles.chip,
                  { borderColor: selectedDeviceId === null ? theme.accent : theme.border },
                  selectedDeviceId === null && { backgroundColor: theme.backgroundSelected },
                ]}>
                <ThemedText type="small" themeColor={selectedDeviceId === null ? 'accent' : 'textSecondary'}>
                  All devices
                </ThemedText>
              </ThemedView>
            </Pressable>
            {devices.map((device) => (
              <Pressable key={device.id} onPress={() => setSelectedDeviceId(device.id)}>
                <ThemedView
                  style={[
                    styles.chip,
                    { borderColor: selectedDeviceId === device.id ? theme.accent : theme.border },
                    selectedDeviceId === device.id && { backgroundColor: theme.backgroundSelected },
                  ]}>
                  <ThemedText
                    type="small"
                    themeColor={selectedDeviceId === device.id ? 'accent' : 'textSecondary'}>
                    {device.name}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={[styles.tabRow, { borderBottomColor: theme.border }]}>
          {EVENT_CATEGORY_TABS.map((tab) => {
            const active = selectedCategory === tab.key;
            return (
              <Pressable key={tab.key} onPress={() => setSelectedCategory(tab.key)} style={styles.tab}>
                <ThemedText type="smallBold" themeColor={active ? 'text' : 'textSecondary'}>
                  {tab.label}
                </ThemedText>
                <View style={[styles.tabIndicator, active && { backgroundColor: theme.accent }]} />
              </Pressable>
            );
          })}
        </View>

        <FlatList
          style={styles.eventsList}
          data={events}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            !loading ? (
              <ThemedText themeColor="textSecondary" type="small" style={styles.emptyEvents}>
                No events in this view yet.
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => {
            const category = categorizeEvent(item.event_type);
            return (
              <View style={styles.eventRow}>
                <View style={[styles.eventAccent, { backgroundColor: CategoryColors[category] }]} />
                <ThemedView type="backgroundElement" style={[styles.eventBody, { borderColor: theme.border }]}>
                  <View style={styles.eventRowHeader}>
                    <ThemedText type="code" style={{ color: CategoryColors[category] }}>
                      {item.event_type}
                    </ThemedText>
                    <ThemedText themeColor="textSecondary" type="code">
                      {formatTimestamp(item.created_at)}
                    </ThemedText>
                  </View>
                  <ThemedText type="small" style={styles.eventMessage}>
                    {item.message}
                  </ThemedText>
                  {item.devices?.name && (
                    <ThemedText themeColor="textSecondary" type="small">
                      {item.devices.name}
                    </ThemedText>
                  )}
                </ThemedView>
              </View>
            );
          }}
        />
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
  emptyDevices: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  chipRow: {
    flexDirection: 'row',
    flexGrow: 0,
  },
  chip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    marginRight: Spacing.two,
  },
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  tabIndicator: {
    height: 2,
    width: '100%',
    borderRadius: Radius.pill,
  },
  eventsList: {
    flex: 1,
  },
  emptyEvents: {
    paddingTop: Spacing.four,
    textAlign: 'center',
  },
  eventRow: {
    flexDirection: 'row',
    marginBottom: Spacing.two,
  },
  eventAccent: {
    width: 3,
    borderTopLeftRadius: Radius.small,
    borderBottomLeftRadius: Radius.small,
  },
  eventBody: {
    flex: 1,
    borderTopRightRadius: Radius.medium,
    borderBottomRightRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 0,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  eventRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eventMessage: {
    paddingTop: Spacing.half,
  },
});
