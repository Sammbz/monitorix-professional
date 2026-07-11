import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const HOURS = 24;
const REFRESH_MS = 60_000;
const PLOT_HEIGHT = 64;

type Bucket = { bucket: string; event_count: number };
type Slot = { hourLabel: string; count: number };

/** One bar per hour over the last 24h. Tap a bar to read its exact
 * hour and count; the busiest hour is labeled directly. */
export function ActivityChart() {
  const theme = useTheme();
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

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
      const series: Slot[] = [];
      for (let i = HOURS - 1; i >= 0; i--) {
        const slot = new Date(now.getTime() - i * 3_600_000);
        series.push({
          hourLabel: `${String(slot.getHours()).padStart(2, '0')}h`,
          count: byHour.get(slot.getTime()) ?? 0,
        });
      }
      setSlots(series);
    }

    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!slots) return null;

  const max = Math.max(...slots.map((s) => s.count), 1);
  const total = slots.reduce((sum, s) => sum + s.count, 0);
  const peakIndex = slots.findIndex((s) => s.count === max);
  const readout = selected !== null ? slots[selected] : null;

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <ThemedText type="small" themeColor="textSecondary">
          Events per hour — last 24 h
        </ThemedText>
        {readout ? (
          <ThemedText type="smallBold" themeColor="accent">
            {readout.hourLabel} · {readout.count} event{readout.count === 1 ? '' : 's'}
          </ThemedText>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {total} total
          </ThemedText>
        )}
      </View>

      <View style={styles.plot}>
        {slots.map((slot, index) => {
          const isSelected = selected === index;
          const isPeak = index === peakIndex && slot.count > 0;
          return (
            <Pressable
              key={index}
              style={styles.barSlot}
              onPress={() => setSelected((prev) => (prev === index ? null : index))}>
              {isPeak && !readout && (
                <ThemedText type="code" themeColor="accent" style={styles.peakLabel}>
                  {slot.count}
                </ThemedText>
              )}
              <View
                style={[
                  styles.bar,
                  {
                    height: slot.count === 0 ? 2 : Math.max((slot.count / max) * PLOT_HEIGHT, 4),
                    backgroundColor:
                      slot.count === 0 ? theme.border : isSelected ? theme.text : theme.accent,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.baseline, { backgroundColor: theme.border }]} />

      <View style={styles.axisRow}>
        {slots.map((slot, index) => (
          <View key={index} style={styles.barSlot}>
            {(index % 6 === 0 || index === slots.length - 1) && (
              <ThemedText type="code" themeColor="textSecondary" style={styles.axisLabel}>
                {slot.hourLabel}
              </ThemedText>
            )}
          </View>
        ))}
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        Each bar is one hour of activity across all devices. Tap a bar for details.
      </ThemedText>
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
    alignItems: 'center',
  },
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: PLOT_HEIGHT + 18,
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
  peakLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  baseline: {
    height: StyleSheet.hairlineWidth,
    marginTop: -Spacing.two,
  },
  axisRow: {
    flexDirection: 'row',
    gap: 3,
  },
  axisLabel: {
    fontSize: 10,
  },
  hint: {
    fontSize: 11,
  },
});
