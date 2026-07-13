import type { EventWithDevice } from '@/components/dashboard/event-row';
import { eventsToCsv } from '@/lib/csv';

function event(overrides: Partial<EventWithDevice>): EventWithDevice {
  return {
    id: 'e1',
    device_id: 'd1',
    event_type: 'FILE_CREATED',
    message: 'File created',
    metadata: {},
    created_at: '2026-07-13T10:00:00.000Z',
    devices: { name: 'PC-1' },
    ...overrides,
  };
}

describe('eventsToCsv', () => {
  it('starts with a header row', () => {
    const csv = eventsToCsv([]);
    expect(csv).toBe('date,device,event_type,category,message,metadata');
  });

  it('emits one row per event with the derived category', () => {
    const csv = eventsToCsv([event({ event_type: 'APP_OPENED', message: 'Chrome' })]);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('APP_OPENED');
    expect(lines[1]).toContain('software');
    expect(lines[1]).toContain('PC-1');
  });

  it('quotes fields containing commas, quotes, or newlines (RFC 4180)', () => {
    const csv = eventsToCsv([event({ message: 'a, b "c"' })]);
    // comma → field quoted; inner quotes doubled
    expect(csv).toContain('"a, b ""c"""');
  });

  it('falls back to the device id when the device name is missing', () => {
    const csv = eventsToCsv([event({ devices: null, device_id: 'dev-xyz' })]);
    expect(csv).toContain('dev-xyz');
  });
});
