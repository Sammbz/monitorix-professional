import type { JsonValue } from '@/types/monitoring';

export type EventCategory = 'file' | 'software' | 'usb' | 'other';

const CATEGORY_EVENT_TYPES: Record<Exclude<EventCategory, 'other'>, string[]> = {
  file: [
    'FILE_CREATED',
    'FILE_DELETED',
    'FILE_MODIFIED',
    'FILE_MOVED',
    'DIRECTORY_CREATED',
    'DIRECTORY_DELETED',
    'DIRECTORY_MOVED',
  ],
  software: ['APP_OPENED', 'APP_CLOSED'],
  usb: ['USB_INSERTED', 'USB_REMOVED', 'USB_DEVICE_CONNECTED', 'USB_DEVICE_DISCONNECTED'],
};

const EVENT_TYPE_TO_CATEGORY = new Map<string, EventCategory>();
for (const [category, eventTypes] of Object.entries(CATEGORY_EVENT_TYPES)) {
  for (const eventType of eventTypes) {
    EVENT_TYPE_TO_CATEGORY.set(eventType, category as EventCategory);
  }
}

export function categorizeEvent(eventType: string): EventCategory {
  return EVENT_TYPE_TO_CATEGORY.get(eventType) ?? 'other';
}

export function eventTypesForCategory(category: Exclude<EventCategory, 'other'>): string[] {
  return CATEGORY_EVENT_TYPES[category];
}

function basename(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : path;
}

/**
 * A specific, human-readable detail for an event — e.g. the file name for
 * file/folder events — pulled out of its metadata. Falls back to null when
 * metadata doesn't carry a path (e.g. software/USB events already name the
 * app/device in their message).
 */
export function getEventDetail(metadata: JsonValue): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const record = metadata as Record<string, JsonValue | undefined>;

  const srcPath = typeof record.src_path === 'string' ? record.src_path : null;
  const destPath = typeof record.dest_path === 'string' ? record.dest_path : null;
  if (srcPath && destPath) {
    return `${basename(srcPath)} → ${basename(destPath)}`;
  }

  const path = typeof record.path === 'string' ? record.path : null;
  return path ? basename(path) : null;
}

export const EVENT_CATEGORY_TABS: { key: 'all' | Exclude<EventCategory, 'other'>; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'file', label: 'Files' },
  { key: 'software', label: 'Software' },
  { key: 'usb', label: 'USB' },
];
