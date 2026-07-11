import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CategoryColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { categorizeEvent, getEventDetail } from '@/lib/event-categories';
import { getEventIcon } from '@/lib/event-icons';
import type { MonitoringEvent } from '@/types/monitoring';

export type EventWithDevice = MonitoringEvent & { devices: { name: string } | null };

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function EventRow({
  event,
  selected,
  onPress,
}: {
  event: EventWithDevice;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const category = categorizeEvent(event.event_type);
  const detail = getEventDetail(event.metadata);

  return (
    <Pressable style={styles.eventRow} onPress={onPress}>
      <View style={[styles.eventAccent, { backgroundColor: CategoryColors[category] }]} />
      <ThemedView
        type="backgroundElement"
        style={[styles.eventBody, { borderColor: selected ? theme.accent : theme.border }]}>
        <View style={[styles.eventIconBox, { backgroundColor: CategoryColors[category] + '22' }]}>
          <MaterialCommunityIcons
            name={getEventIcon(event.event_type, event.metadata)}
            size={18}
            color={CategoryColors[category]}
          />
        </View>
        <View style={styles.eventContent}>
          <View style={styles.eventRowHeader}>
            <ThemedText type="code" style={{ color: CategoryColors[category] }}>
              {event.event_type}
            </ThemedText>
            <ThemedText themeColor="textSecondary" type="code">
              {formatTimestamp(event.created_at)}
            </ThemedText>
          </View>
          {detail ? (
            <ThemedText type="smallBold" style={styles.eventMessage} numberOfLines={1}>
              {detail}
            </ThemedText>
          ) : (
            <ThemedText type="small" style={styles.eventMessage}>
              {event.message}
            </ThemedText>
          )}
          {event.devices?.name && (
            <ThemedText themeColor="textSecondary" type="small">
              {event.devices.name}
            </ThemedText>
          )}
        </View>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    flexDirection: 'row',
    alignItems: 'center',
    borderTopRightRadius: Radius.medium,
    borderBottomRightRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 0,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  eventIconBox: {
    width: 34,
    height: 34,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  eventContent: {
    flex: 1,
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
