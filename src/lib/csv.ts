import type { EventWithDevice } from '@/components/dashboard/event-row';
import { categorizeEvent } from '@/lib/event-categories';

// RFC 4180: quote any field containing a comma, quote, or newline; double
// the quotes inside.
function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function eventsToCsv(events: EventWithDevice[]): string {
  const header = ['date', 'device', 'event_type', 'category', 'message', 'metadata'];
  const rows = events.map((event) =>
    [
      new Date(event.created_at).toISOString(),
      event.devices?.name ?? event.device_id,
      event.event_type,
      categorizeEvent(event.event_type),
      event.message,
      JSON.stringify(event.metadata ?? {}),
    ]
      .map(csvField)
      .join(',')
  );
  return [header.join(','), ...rows].join('\r\n');
}

/** Triggers a browser download. Web-only — callers hide the export button on
 * native, where there is no document. */
export function downloadCsv(filename: string, csv: string): void {
  const doc = (globalThis as Record<string, unknown>).document as Document | undefined;
  if (!doc) return;

  // BOM so Excel opens UTF-8 accents correctly.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = url;
  link.download = filename;
  doc.body.appendChild(link);
  link.click();
  doc.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function isCsvDownloadSupported(): boolean {
  return typeof (globalThis as Record<string, unknown>).document !== 'undefined';
}
