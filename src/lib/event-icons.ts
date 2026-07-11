import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import type { JsonValue } from '@/types/monitoring';

export type EventIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// File-type icon by extension. Grouped by what a user recognizes at a
// glance, not by MIME exhaustiveness.
const EXTENSION_ICONS: Record<string, EventIconName> = {
  // images
  png: 'file-image-outline',
  jpg: 'file-image-outline',
  jpeg: 'file-image-outline',
  gif: 'file-image-outline',
  webp: 'file-image-outline',
  svg: 'file-image-outline',
  bmp: 'file-image-outline',
  ico: 'file-image-outline',
  // video
  mp4: 'file-video-outline',
  avi: 'file-video-outline',
  mkv: 'file-video-outline',
  mov: 'file-video-outline',
  webm: 'file-video-outline',
  // audio
  mp3: 'file-music-outline',
  wav: 'file-music-outline',
  flac: 'file-music-outline',
  ogg: 'file-music-outline',
  m4a: 'file-music-outline',
  // documents
  pdf: 'file-pdf-box',
  doc: 'file-word-outline',
  docx: 'file-word-outline',
  odt: 'file-word-outline',
  rtf: 'file-word-outline',
  xls: 'file-excel-outline',
  xlsx: 'file-excel-outline',
  csv: 'file-excel-outline',
  ppt: 'file-powerpoint-outline',
  pptx: 'file-powerpoint-outline',
  txt: 'file-document-outline',
  md: 'file-document-outline',
  // archives
  zip: 'zip-box',
  rar: 'zip-box',
  '7z': 'zip-box',
  tar: 'zip-box',
  gz: 'zip-box',
  // code
  js: 'file-code-outline',
  ts: 'file-code-outline',
  tsx: 'file-code-outline',
  jsx: 'file-code-outline',
  py: 'file-code-outline',
  java: 'file-code-outline',
  c: 'file-code-outline',
  cpp: 'file-code-outline',
  cs: 'file-code-outline',
  html: 'file-code-outline',
  css: 'file-code-outline',
  json: 'file-code-outline',
  xml: 'file-code-outline',
  sql: 'file-code-outline',
  sh: 'file-code-outline',
  ps1: 'file-code-outline',
  // executables / installers
  exe: 'application-outline',
  msi: 'application-outline',
};

// Recognizable brands get their own glyph; anything else falls back to a
// generic app icon. Keys are matched as substrings of the process name.
const APP_ICONS: [string, EventIconName][] = [
  ['chrome', 'google-chrome'],
  ['firefox', 'firefox'],
  ['msedge', 'microsoft-edge'],
  ['edge', 'microsoft-edge'],
  ['winword', 'microsoft-word'],
  ['excel', 'microsoft-excel'],
  ['powerpnt', 'microsoft-powerpoint'],
  ['outlook', 'microsoft-outlook'],
  ['teams', 'microsoft-teams'],
  ['code', 'microsoft-visual-studio-code'],
  ['spotify', 'spotify'],
  ['steam', 'steam'],
  ['whatsapp', 'whatsapp'],
];

function asRecord(metadata: JsonValue): Record<string, JsonValue | undefined> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  return metadata as Record<string, JsonValue | undefined>;
}

function extensionOf(path: string): string {
  const name = path.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? '';
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function getEventIcon(eventType: string, metadata: JsonValue): EventIconName {
  const record = asRecord(metadata);

  if (eventType.startsWith('DIRECTORY_')) {
    return eventType === 'DIRECTORY_DELETED' ? 'folder-remove-outline' : 'folder-outline';
  }

  if (eventType.startsWith('FILE_')) {
    const path =
      (typeof record.dest_path === 'string' && record.dest_path) ||
      (typeof record.src_path === 'string' && record.src_path) ||
      (typeof record.path === 'string' && record.path) ||
      '';
    if (eventType === 'FILE_DELETED') return 'file-remove-outline';
    return EXTENSION_ICONS[extensionOf(path)] ?? 'file-outline';
  }

  if (eventType === 'APP_OPENED' || eventType === 'APP_CLOSED') {
    const processName = [record.exe, record.name, record.file_name]
      .filter((value): value is string => typeof value === 'string')
      .join(' ')
      .toLowerCase();
    const match = APP_ICONS.find(([needle]) => processName.includes(needle));
    return match ? match[1] : 'application-outline';
  }

  if (eventType === 'USB_INSERTED' || eventType === 'USB_REMOVED') {
    return 'usb-flash-drive-outline';
  }
  if (eventType.startsWith('USB_')) {
    return 'usb';
  }

  if (eventType === 'AGENT_STARTED') return 'shield-check-outline';
  if (eventType === 'AGENT_STOPPED') return 'shield-off-outline';

  return 'pulse';
}
