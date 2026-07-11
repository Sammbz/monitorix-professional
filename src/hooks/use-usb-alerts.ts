import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import { categorizeEvent } from '@/lib/event-categories';
import type { MonitoringEvent } from '@/types/monitoring';

const STORAGE_KEY = 'monitorix.usb-alerts';

type NotificationCtor = new (title: string, options?: { body?: string }) => unknown & {
  requestPermission?: unknown;
};

// Web Notifications API — present in browsers and the Electron shell, absent
// on native mobile (which would need expo-notifications, a later phase).
function getNotification(): (NotificationCtor & { requestPermission(): Promise<string> }) | null {
  const candidate = (globalThis as Record<string, unknown>).Notification;
  return typeof candidate === 'function' ? (candidate as never) : null;
}

/** System notifications for USB events arriving over realtime. Off by
 * default; the preference persists per device/browser. */
export function useUsbAlerts() {
  const [enabled, setEnabled] = useState(false);
  const enabledRef = useRef(false);
  const supported = getNotification() !== null;

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      const on = value === 'true';
      enabledRef.current = on;
      setEnabled(on);
    });
  }, []);

  const toggle = useCallback(async () => {
    const Notification = getNotification();
    if (!Notification) return;

    const next = !enabledRef.current;
    if (next) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
    }
    enabledRef.current = next;
    setEnabled(next);
    AsyncStorage.setItem(STORAGE_KEY, String(next));
  }, []);

  const handleEvent = useCallback((event: MonitoringEvent & { devices: { name: string } | null }) => {
    if (!enabledRef.current) return;
    if (categorizeEvent(event.event_type) !== 'usb') return;
    const Notification = getNotification();
    if (!Notification) return;
    new Notification(`Monitorix — ${event.devices?.name ?? 'Unknown device'}`, { body: event.message });
  }, []);

  return { supported, enabled, toggle, handleEvent };
}
