import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventDetails } from '@/components/dashboard/event-details';
import { StatsRow } from '@/components/dashboard/stats-row';
import { EnrollmentTokenCard } from '@/components/enrollment-token-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  CategoryColors,
  MaxContentWidth,
  MaxContentWidthWide,
  Radius,
  Spacing,
  WideBreakpoint,
} from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useDashboard } from '@/hooks/use-dashboard';
import { useNow } from '@/hooks/use-now';
import { useOrganization } from '@/hooks/use-organization';
import { useTheme } from '@/hooks/use-theme';
import { isDeviceOnline } from '@/lib/device-status';
import { categorizeEvent, EVENT_CATEGORY_TABS, eventTypesForCategory, getEventDetail } from '@/lib/event-categories';
import type { Device } from '@/types/monitoring';

type CategoryTabKey = (typeof EVENT_CATEGORY_TABS)[number]['key'];

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function DashboardScreen() {
  const theme = useTheme();
  const { session, signOut } = useAuth();
  const { organization } = useOrganization();
  const { width } = useWindowDimensions();
  const isWide = width >= WideBreakpoint;
  const now = useNow(15_000);

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryTabKey>('all');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const categoryEventTypes = useMemo(
    () => (selectedCategory === 'all' ? null : eventTypesForCategory(selectedCategory)),
    [selectedCategory]
  );
  const { devices, events, eventsToday, loading, error } = useDashboard({
    deviceId: selectedDeviceId,
    categoryEventTypes,
  });

  const onlineCount = useMemo(() => devices.filter((d) => isDeviceOnline(d, now)).length, [devices, now]);
  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId]
  );

  function toggleEvent(eventId: string) {
    setSelectedEventId((prev) => (prev === eventId ? null : eventId));
  }

  const header = (
    <View style={styles.header}>
      <View>
        <ThemedText type="code" themeColor="accent" style={styles.eyebrow}>
          MONITORIX
        </ThemedText>
        <ThemedText type="smallBold">{organization?.name}</ThemedText>
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
  );

  const emptyDevices = (
    <ThemedView type="backgroundElement" style={[styles.emptyDevices, { borderColor: theme.border }]}>
      <ThemedText type="smallBold">No devices yet</ThemedText>
      <ThemedText themeColor="textSecondary" type="small">
        Run the monitoring agent on a PC with your enrollment token to see it here.
      </ThemedText>
    </ThemedView>
  );

  const categoryTabs = (
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
  );

  function renderDeviceRow(device: Device) {
    const online = isDeviceOnline(device, now);
    const active = selectedDeviceId === device.id;
    return (
      <Pressable key={device.id} onPress={() => setSelectedDeviceId(active ? null : device.id)}>
        <ThemedView
          type={active ? undefined : 'backgroundElement'}
          style={[
            styles.deviceRow,
            { borderColor: active ? theme.accent : theme.border },
            active && { backgroundColor: theme.backgroundSelected },
          ]}>
          <View
            style={[styles.statusDot, { backgroundColor: online ? theme.success : theme.border }]}
          />
          <View style={styles.deviceRowText}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {device.name}
            </ThemedText>
            <ThemedText type="small" themeColor={online ? 'success' : 'textSecondary'}>
              {online ? 'Online' : device.last_seen_at ? `Seen ${formatTimestamp(device.last_seen_at)}` : 'Never seen'}
            </ThemedText>
          </View>
        </ThemedView>
      </Pressable>
    );
  }

  const deviceChips = (
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
      {devices.map((device) => {
        const active = selectedDeviceId === device.id;
        const online = isDeviceOnline(device, now);
        return (
          <Pressable key={device.id} onPress={() => setSelectedDeviceId(device.id)}>
            <ThemedView
              style={[
                styles.chip,
                styles.chipContent,
                { borderColor: active ? theme.accent : theme.border },
                active && { backgroundColor: theme.backgroundSelected },
              ]}>
              <View
                style={[styles.statusDot, { backgroundColor: online ? theme.success : theme.border }]}
              />
              <ThemedText type="small" themeColor={active ? 'accent' : 'textSecondary'}>
                {device.name}
              </ThemedText>
            </ThemedView>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const eventsList = (
    <FlatList
      style={styles.eventsList}
      data={events}
      keyExtractor={(item) => item.id}
      extraData={selectedEventId}
      ListEmptyComponent={
        !loading ? (
          <ThemedText themeColor="textSecondary" type="small" style={styles.emptyEvents}>
            No events in this view yet.
          </ThemedText>
        ) : null
      }
      renderItem={({ item }) => {
        const category = categorizeEvent(item.event_type);
        const detail = getEventDetail(item.metadata);
        const selected = selectedEventId === item.id;
        return (
          <View>
            <Pressable style={styles.eventRow} onPress={() => toggleEvent(item.id)}>
              <View style={[styles.eventAccent, { backgroundColor: CategoryColors[category] }]} />
              <ThemedView
                type="backgroundElement"
                style={[
                  styles.eventBody,
                  { borderColor: selected ? theme.accent : theme.border },
                ]}>
                <View style={styles.eventRowHeader}>
                  <ThemedText type="code" style={{ color: CategoryColors[category] }}>
                    {item.event_type}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" type="code">
                    {formatTimestamp(item.created_at)}
                  </ThemedText>
                </View>
                {detail ? (
                  <ThemedText type="smallBold" style={styles.eventMessage} numberOfLines={1}>
                    {detail}
                  </ThemedText>
                ) : (
                  <ThemedText type="small" style={styles.eventMessage}>
                    {item.message}
                  </ThemedText>
                )}
                {item.devices?.name && (
                  <ThemedText themeColor="textSecondary" type="small">
                    {item.devices.name}
                  </ThemedText>
                )}
              </ThemedView>
            </Pressable>
            {!isWide && selected && (
              <View style={styles.inlineDetails}>
                <EventDetails event={item} />
              </View>
            )}
          </View>
        );
      }}
    />
  );

  if (isWide) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={[styles.safeArea, styles.safeAreaWide]}>
          {header}
          {error && (
            <ThemedText themeColor="danger" type="small">
              {error}
            </ThemedText>
          )}
          <StatsRow deviceCount={devices.length} onlineCount={onlineCount} eventsToday={eventsToday} />
          <View style={styles.columns}>
            <View style={styles.devicesColumn}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.columnLabel}>
                DEVICES
              </ThemedText>
              {devices.length === 0 && !loading ? emptyDevices : devices.map(renderDeviceRow)}
              <View style={styles.tokenCardSlot}>
                {organization && <EnrollmentTokenCard organizationId={organization.id} />}
              </View>
            </View>
            <View style={styles.eventsColumn}>
              {categoryTabs}
              {eventsList}
            </View>
            <View style={styles.detailsColumn}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.columnLabel}>
                DETAILS
              </ThemedText>
              <EventDetails event={selectedEvent} />
            </View>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {header}
        {error && (
          <ThemedText themeColor="danger" type="small">
            {error}
          </ThemedText>
        )}
        {organization && <EnrollmentTokenCard organizationId={organization.id} />}
        <StatsRow deviceCount={devices.length} onlineCount={onlineCount} eventsToday={eventsToday} />
        {devices.length === 0 && !loading ? emptyDevices : deviceChips}
        {categoryTabs}
        {eventsList}
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
  safeAreaWide: {
    maxWidth: MaxContentWidthWide,
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
  columns: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.four,
  },
  devicesColumn: {
    width: 260,
    gap: Spacing.two,
  },
  eventsColumn: {
    flex: 1,
    gap: Spacing.three,
  },
  detailsColumn: {
    width: 340,
    gap: Spacing.two,
  },
  columnLabel: {
    letterSpacing: 1.5,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  deviceRowText: {
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    flexShrink: 0,
  },
  tokenCardSlot: {
    marginTop: 'auto',
    paddingBottom: Spacing.three,
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
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
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
  inlineDetails: {
    marginBottom: Spacing.two,
  },
});
