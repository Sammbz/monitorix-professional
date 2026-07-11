import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const HOURS = 24;
const REFRESH_MS = 60_000;

type Bucket = { bucket: string; event_count: number };

/** One bar per hour over the last 24h. Bars are Views, not a chart lib —
 * a single series of counts doesn't need one. */
export function ActivityChart() {
  const theme = useTheme();
  const [counts, setCounts] = useState<number[] | null>(null);
  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase.rpc('events_activity', { p_hours: HOURS });
      if (cancelled || error) return;

      // The RPC only returns hours that had events; spread them into a
      // dense 24-slot series ending at the current hour.
      const byHour = new Map<number, number>();
      for (const row of (data as Bucket[]) ?? []) {
        byHour.set(new Date(row.bucket).getTime(), Number(row.event_count));
      }
      const now = new Date();
      now.setMinutes(0, 0, 0);
      const series: number[] = [];
      const hourLabels: string[] = [];
      for (let i = HOURS - 1; i >= 0; i--) {
        const slot = new Date(now.getTime() - i * 3_600_000);
        series.push(byHour.get(slot.getTime()) ?? 0);
        hourLabels.push(`${slot.getHours()}h`);
      }
      setCounts(series);
      setLabels(hourLabels);
    }

    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!counts) return null;

  const max = Math.max(...counts, 1);
  const total = counts.reduce((sum, n) => sum + n, 0);

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <ThemedText type="small" themeColor="textSecondary">
          Activity — last 24 h
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {total} events
        </ThemedText>
      </View>

      <View style={styles.plot}>
        {counts.map((count, index) => (
          <View key={index} style={styles.barSlot}>
            <View
              style={[
                styles.bar,
                {
                  height: count === 0 ? 2 : Math.max((count / max) * 56, 4),
                  backgroundColor: count === 0 ? theme.border : theme.accent,
                },
              ]}
            />
          </View>
        ))}
      </View>

      <View style={styles.axisRow}>
        {labels.map((label, index) => (
          <View key={index} style={styles.barSlot}>
            {index % 6 === 0 && (
              <ThemedText type="code" themeColor="textSecondary" style={styles.axisLabel}>
                {label}
              </ThemedText>
            )}
          </View>
        ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 56,
    gap: 3,
  },
  barSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  axisRow: {
    flexDirection: 'row',
    gap: 3,
  },
  axisLabel: {
    fontSize: 10,
  },
});
