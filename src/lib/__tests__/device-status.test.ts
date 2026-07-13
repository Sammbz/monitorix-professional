import { DeviceOnlineThresholdMs } from '@/constants/theme';
import { isDeviceOnline } from '@/lib/device-status';
import type { Device } from '@/types/monitoring';

function device(lastSeen: string | null): Device {
  return {
    id: 'd1',
    organization_id: 'o1',
    name: 'PC-1',
    created_at: '2026-07-13T00:00:00.000Z',
    last_seen_at: lastSeen,
  };
}

describe('isDeviceOnline', () => {
  const now = Date.now();

  it('is offline when the device has never been seen', () => {
    expect(isDeviceOnline(device(null), now)).toBe(false);
  });

  it('is online when the last heartbeat is within the threshold', () => {
    const recent = new Date(now - (DeviceOnlineThresholdMs - 1000)).toISOString();
    expect(isDeviceOnline(device(recent), now)).toBe(true);
  });

  it('is offline once the last heartbeat is older than the threshold', () => {
    const stale = new Date(now - (DeviceOnlineThresholdMs + 1000)).toISOString();
    expect(isDeviceOnline(device(stale), now)).toBe(false);
  });
});
