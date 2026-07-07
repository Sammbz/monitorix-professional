export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue | undefined }
  | JsonValue[];

export type Device = {
  id: string;
  user_id: string;
  name: string;
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
