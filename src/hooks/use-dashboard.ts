import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import type { Device, MonitoringEvent } from '@/types/monitoring';

type EventWithDevice = MonitoringEvent & { devices: { name: string } | null };

type DashboardFilters = {
  deviceId: string | null;
  categoryEventTypes: string[] | null;
};

const RECENT_EVENTS_LIMIT = 50;

export function useDashboard({ deviceId, categoryEventTypes }: DashboardFilters) {
  const { session } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [events, setEvents] = useState<EventWithDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const devicesRef = useRef<Device[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      let eventsQuery = supabase
        .from('events')
        .select('*, devices(name)')
        .order('created_at', { ascending: false })
        .limit(RECENT_EVENTS_LIMIT);
      if (deviceId) eventsQuery = eventsQuery.eq('device_id', deviceId);
      if (categoryEventTypes) eventsQuery = eventsQuery.in('event_type', categoryEventTypes);

      const [devicesResult, eventsResult] = await Promise.all([
        supabase.from('devices').select('*').order('created_at', { ascending: false }),
        eventsQuery,
      ]);

      if (cancelled) return;

      if (devicesResult.error) {
        setError(devicesResult.error.message);
      } else if (eventsResult.error) {
        setError(eventsResult.error.message);
      } else {
        setError(null);
        devicesRef.current = devicesResult.data ?? [];
        setDevices(devicesResult.data ?? []);
        setEvents((eventsResult.data as EventWithDevice[]) ?? []);
      }
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel('dashboard-events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events' },
        (payload) => {
          const newEvent = payload.new as MonitoringEvent;
          if (deviceId && newEvent.device_id !== deviceId) return;
          if (categoryEventTypes && !categoryEventTypes.includes(newEvent.event_type)) return;

          const device = devicesRef.current.find((d) => d.id === newEvent.device_id);
          setEvents((prev) =>
            [{ ...newEvent, devices: device ? { name: device.name } : null }, ...prev].slice(0, RECENT_EVENTS_LIMIT)
          );
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [session?.user.id, deviceId, categoryEventTypes]);

  return { devices, events, loading, error };
}
