import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CategoryColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { categorizeEvent } from '@/lib/event-categories';
import { getEventIcon } from '@/lib/event-icons';
import type { JsonValue, MonitoringEvent } from '@/types/monitoring';

type EventWithDevice = MonitoringEvent & { devices: { name: string } | null };

function metadataEntries(metadata: JsonValue): [string, string][] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
  return Object.entries(metadata)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]);
}

function formatFullTimestamp(iso: string) {
  return new Date(iso).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function EventDetails({ event }: { event: EventWithDevice | null }) {
  const theme = useTheme();

  if (!event) {
    return (
      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
        <ThemedText type="smallBold">Event details</ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          Select an event to inspect its full metadata.
        </ThemedText>
      </ThemedView>
    );
  }

  const category = categorizeEvent(event.event_type);
  const entries = metadataEntries(event.metadata);

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.titleRow}>
        <View style={[styles.iconBox, { backgroundColor: CategoryColors[category] + '22' }]}>
          <MaterialCommunityIcons
            name={getEventIcon(event.event_type, event.metadata)}
            size={20}
            color={CategoryColors[category]}
          />
        </View>
        <ThemedText type="code" style={{ color: CategoryColors[category] }}>
          {event.event_type}
        </ThemedText>
      </View>
      <ThemedText type="smallBold">{event.message}</ThemedText>

      <View style={styles.metaBlock}>
        <View style={styles.metaRow}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.metaKey}>
            Device
          </ThemedText>
          <ThemedText type="small" style={styles.metaValue}>
            {event.devices?.name ?? event.device_id}
          </ThemedText>
        </View>
        <View style={styles.metaRow}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.metaKey}>
            Time
          </ThemedText>
          <ThemedText type="small" style={styles.metaValue}>
            {formatFullTimestamp(event.created_at)}
          </ThemedText>
        </View>
      </View>

      {entries.length > 0 && (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Metadata
          </ThemedText>
          <ScrollView style={styles.metadataScroll}>
            {entries.map(([key, value]) => (
              <View key={key} style={styles.metaRow}>
                <ThemedText type="code" themeColor="textSecondary" style={styles.metaKey}>
                  {key}
                </ThemedText>
                <ThemedText type="code" style={styles.metaValue} selectable>
                  {value}
                </ThemedText>
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaBlock: {
    gap: Spacing.one,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  metaKey: {
    width: 90,
    flexShrink: 0,
  },
  metaValue: {
    flex: 1,
  },
  metadataScroll: {
    maxHeight: 320,
  },
});
