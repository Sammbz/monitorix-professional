import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type StatsRowProps = {
  deviceCount: number;
  onlineCount: number;
  eventsToday: number | null;
};

function StatTile({ label, value, dotColor }: { label: string; value: string; dotColor?: string }) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={[styles.tile, { borderColor: theme.border }]}>
      <View style={styles.labelRow}>
        {dotColor && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      </View>
      <ThemedText type="subtitle">{value}</ThemedText>
    </ThemedView>
  );
}

export function StatsRow({ deviceCount, onlineCount, eventsToday }: StatsRowProps) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <StatTile label="Devices" value={String(deviceCount)} />
      <StatTile label="Online" value={String(onlineCount)} dotColor={theme.success} />
      <StatTile label="Events today" value={eventsToday === null ? '—' : String(eventsToday)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tile: {
    flex: 1,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.half,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: Radius.pill,
  },
});
