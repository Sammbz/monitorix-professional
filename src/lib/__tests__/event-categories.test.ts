import { categorizeEvent, eventTypesForCategory, getEventDetail } from '@/lib/event-categories';

describe('categorizeEvent', () => {
  it('maps file/directory events to the file category', () => {
    expect(categorizeEvent('FILE_CREATED')).toBe('file');
    expect(categorizeEvent('FILE_DELETED')).toBe('file');
    expect(categorizeEvent('DIRECTORY_MOVED')).toBe('file');
  });

  it('maps app events to software and USB events to usb', () => {
    expect(categorizeEvent('APP_OPENED')).toBe('software');
    expect(categorizeEvent('APP_CLOSED')).toBe('software');
    expect(categorizeEvent('USB_INSERTED')).toBe('usb');
    expect(categorizeEvent('USB_DEVICE_CONNECTED')).toBe('usb');
  });

  it('falls back to "other" for unknown or lifecycle events', () => {
    expect(categorizeEvent('AGENT_STARTED')).toBe('other');
    expect(categorizeEvent('SOMETHING_NEW')).toBe('other');
  });
});

describe('eventTypesForCategory', () => {
  it('returns the concrete event types for a category', () => {
    expect(eventTypesForCategory('software')).toEqual(['APP_OPENED', 'APP_CLOSED']);
    expect(eventTypesForCategory('file')).toContain('FILE_CREATED');
  });
});

describe('getEventDetail', () => {
  it('returns the basename of a single path', () => {
    expect(getEventDetail({ path: 'C:\\Users\\sam\\Desktop\\report.pdf' })).toBe('report.pdf');
    expect(getEventDetail({ path: '/home/sam/notes.txt' })).toBe('notes.txt');
  });

  it('shows a rename as "from → to" using basenames', () => {
    expect(getEventDetail({ src_path: '/a/old.txt', dest_path: '/a/new.txt' })).toBe('old.txt → new.txt');
  });

  it('returns null when metadata carries no path', () => {
    expect(getEventDetail({})).toBeNull();
    expect(getEventDetail(null)).toBeNull();
    expect(getEventDetail('not an object')).toBeNull();
    expect(getEventDetail({ pid: 1234 })).toBeNull();
  });
});
