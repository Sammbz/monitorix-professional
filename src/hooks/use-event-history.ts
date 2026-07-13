import { useCallback, useEffect, useState } from 'react';

import type { EventWithDevice } from '@/components/dashboard/event-row';
import { supabase } from '@/lib/supabase';

export type HistoryRange = '24h' | '7d' | '30d' | 'all';

export const HISTORY_RANGES: { key: HistoryRange; label: string }[] = [
  { key: '24h', label: '24 h' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'all', label: 'All time' },
];

const PAGE_SIZE = 50;
const EXPORT_LIMIT = 5000;

function rangeStartIso(range: HistoryRange): string | null {
  if (range === 'all') return null;
  const hours = range === '24h' ? 24 : range === '7d' ? 24 * 7 : 24 * 30;
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

/** Paginated, searchable event history. Unlike the live dashboard feed,
 * results are a stable snapshot — no realtime prepends — so page offsets
 * stay coherent while the user reads. */
export function useEventHistory({ search, range }: { search: string; range: HistoryRange }) {
  const [events, setEvents] = useState<EventWithDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (offset: number, limit: number = PAGE_SIZE) => {
      let query = supabase
        .from('events')
        .select('*, devices(name)')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const start = rangeStartIso(range);
      if (start) query = query.gte('created_at', start);

      const term = search.trim();
      if (term) {
        // Escape LIKE wildcards, and strip characters that PostgREST's
        // .or() filter grammar treats as separators.
        const escaped = term.replace(/[%_]/g, (m) => `\\${m}`).replace(/[,()]/g, ' ');
        query = query.or(`message.ilike.%${escaped}%,event_type.ilike.%${escaped}%,metadata->>path.ilike.%${escaped}%`);
      }

      return query;
    },
    [search, range]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data, error: queryError } = await fetchPage(0);
      if (cancelled) return;

      if (queryError) {
        setError(queryError.message);
        setEvents([]);
        setHasMore(false);
      } else {
        setError(null);
        const rows = (data as EventWithDevice[]) ?? [];
        setEvents(rows);
        setHasMore(rows.length === PAGE_SIZE);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    const { data, error: queryError } = await fetchPage(events.length);
    if (queryError) {
      setError(queryError.message);
    } else {
      const rows = (data as EventWithDevice[]) ?? [];
      setEvents((prev) => [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
    }
    setLoadingMore(false);
  }, [fetchPage, events.length, hasMore, loadingMore]);

  /** Everything matching the current filters (capped at EXPORT_LIMIT), for
   * CSV export — independent of what's paginated into the list. */
  const fetchAllForExport = useCallback(async (): Promise<EventWithDevice[] | null> => {
    const { data, error: queryError } = await fetchPage(0, EXPORT_LIMIT);
    if (queryError) {
      setError(queryError.message);
      return null;
    }
    return (data as EventWithDevice[]) ?? [];
  }, [fetchPage]);

  return { events, loading, loadingMore, hasMore, error, loadMore, fetchAllForExport };
}
