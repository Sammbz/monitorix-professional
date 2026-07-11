import { DeviceOnlineThresholdMs } from '@/constants/theme';
import type { Device } from '@/types/monitoring';

export function isDeviceOnline(device: Device, nowMs: number): boolean {
  if (!device.last_seen_at) return false;
  return nowMs - new Date(device.last_seen_at).getTime() < DeviceOnlineThresholdMs;
}
