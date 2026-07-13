import { getEventIcon } from '@/lib/event-icons';

describe('getEventIcon', () => {
  it('picks a file-type icon from the extension', () => {
    expect(getEventIcon('FILE_CREATED', { path: 'a/photo.png' })).toBe('file-image-outline');
    expect(getEventIcon('FILE_CREATED', { path: 'a/report.pdf' })).toBe('file-pdf-box');
    expect(getEventIcon('FILE_MODIFIED', { path: 'a/main.ts' })).toBe('file-code-outline');
  });

  it('uses a dedicated glyph for file deletion and directories', () => {
    expect(getEventIcon('FILE_DELETED', { path: 'a/x.txt' })).toBe('file-remove-outline');
    expect(getEventIcon('DIRECTORY_CREATED', { path: 'a/dir' })).toBe('folder-outline');
  });

  it('maps known apps to brand icons and unknown apps to a generic one', () => {
    expect(getEventIcon('APP_OPENED', { exe: 'C:/Program Files/Google/chrome.exe' })).toBe('google-chrome');
    expect(getEventIcon('APP_CLOSED', { name: 'somerandomtool.exe' })).toBe('application-outline');
  });

  it('has glyphs for USB and agent lifecycle events', () => {
    expect(getEventIcon('USB_INSERTED', {})).toBe('usb-flash-drive-outline');
    expect(getEventIcon('AGENT_STARTED', {})).toBe('shield-check-outline');
  });

  it('falls back gracefully for unknown extensions and event types', () => {
    expect(getEventIcon('FILE_CREATED', { path: 'a/file.unknownext' })).toBe('file-outline');
    expect(getEventIcon('MYSTERY_EVENT', {})).toBe('pulse');
  });
});
