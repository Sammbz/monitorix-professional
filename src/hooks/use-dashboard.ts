import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Device, MonitoringEvent } from '@/types/monitoring';
import { useAuth } from '@/hooks/use-auth';

type EventWithDevice = MonitoringEvent & { devices: { name: string } | null };

const RECENT_EVENTS_LIMIT = 50;

export function useDashboard() {
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
      const [devicesResult, eventsResult] = await Promise.all([
        supabase.from('devices').select('*').order('created_at', { ascending: false }),
        supabase
          .from('events')
          .select('*, devices(name)')
          .order('created_at', { ascending: false })
          .limit(RECENT_EVENTS_LIMIT),
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
          const device = devicesRef.current.find((d) => d.id === newEvent.device_id);
          setEvents((prev) => [{ ...newEvent, devices: device ? { name: device.name } : null }, ...prev].slice(0, RECENT_EVENTS_LIMIT));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [session?.user.id]);

  return { devices, events, loading, error };
}
