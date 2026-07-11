export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue | undefined }
  | JsonValue[];

export type Organization = {
  id: string;
  name: string;
  created_at: string;
};

export type Device = {
  id: string;
  organization_id: string;
  name: string;
  created_at: string;
  last_seen_at: string | null;
};

export type EnrollmentToken = {
  id: string;
  organization_id: string;
  token: string;
  revoked: boolean;
  created_at: string;
};

export type MonitoringEvent = {
  id: string;
  device_id: string;
  event_type: string;
  message: string;
  metadata: JsonValue;
  created_at: string;
};
