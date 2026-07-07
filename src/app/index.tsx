import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useDashboard } from '@/hooks/use-dashboard';

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function DashboardScreen() {
  const { session, signOut } = useAuth();
  const { devices, events, loading, error } = useDashboard();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const filteredEvents = useMemo(
    () => (selectedDeviceId ? events.filter((event) => event.device_id === selectedDeviceId) : events),
    [events, selectedDeviceId]
  );
  const selectedDeviceName = selectedDeviceId
    ? (devices.find((device) => device.id === selectedDeviceId)?.name ?? null)
    : null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View>
            <ThemedText type="title" style={styles.title}>
              Monitorix
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

        {error && <ThemedText style={styles.error}>{error}</ThemedText>}

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">Devices ({devices.length})</ThemedText>
          {!loading && devices.length === 0 && (
            <ThemedText themeColor="textSecondary" type="small">
              No devices yet. Connect a monitoring agent to register one.
            </ThemedText>
          )}
          {devices.map((device) => (
            <View key={device.id} style={styles.row}>
              <ThemedText type="default">{device.name}</ThemedText>
              <ThemedText themeColor="textSecondary" type="small">
                {formatTimestamp(device.created_at)}
              </ThemedText>
            </View>
          ))}
        </ThemedView>

        {devices.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            <Pressable onPress={() => setSelectedDeviceId(null)}>
              <ThemedView
                type={selectedDeviceId === null ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.chip}>
                <ThemedText type="small" themeColor={selectedDeviceId === null ? 'text' : 'textSecondary'}>
                  All
                </ThemedText>
              </ThemedView>
            </Pressable>
            {devices.map((device) => (
              <Pressable key={device.id} onPress={() => setSelectedDeviceId(device.id)}>
                <ThemedView
                  type={selectedDeviceId === device.id ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.chip}>
                  <ThemedText
                    type="small"
                    themeColor={selectedDeviceId === device.id ? 'text' : 'textSecondary'}>
                    {device.name}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <ThemedText type="smallBold" style={styles.eventsTitle}>
          Recent events{selectedDeviceName ? ` — ${selectedDeviceName}` : ''}
        </ThemedText>
        <FlatList
          style={styles.eventsList}
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            !loading ? (
              <ThemedText themeColor="textSecondary" type="small">
                No events yet.
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => (
            <ThemedView type="backgroundElement" style={styles.eventRow}>
              <View style={styles.eventRowHeader}>
                <ThemedText type="smallBold">{item.event_type}</ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                  {formatTimestamp(item.created_at)}
                </ThemedText>
              </View>
              <ThemedText type="small">{item.message}</ThemedText>
              {item.devices?.name && (
                <ThemedText themeColor="textSecondary" type="small">
                  {item.devices.name}
                </ThemedText>
              )}
            </ThemedView>
          )}
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
    paddingBottom: BottomTabInset + Spacing.three,
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
  title: {
    fontSize: 28,
    lineHeight: 32,
  },
  error: {
    color: '#d92c2c',
  },
  section: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chipRow: {
    flexDirection: 'row',
    flexGrow: 0,
  },
  chip: {
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    marginRight: Spacing.two,
  },
  eventsTitle: {
    paddingTop: Spacing.two,
  },
  eventsList: {
    flex: 1,
  },
  eventRow: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    marginBottom: Spacing.two,
    gap: Spacing.half,
  },
  eventRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
