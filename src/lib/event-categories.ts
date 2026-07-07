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

export const EVENT_CATEGORY_TABS: { key: 'all' | Exclude<EventCategory, 'other'>; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'file', label: 'Files' },
  { key: 'software', label: 'Software' },
  { key: 'usb', label: 'USB' },
];
