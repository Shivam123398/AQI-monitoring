import { EventEmitter } from 'node:events';

export const events = new EventEmitter();
// Allow many listeners (SSE clients)
events.setMaxListeners(0);

export type MeasurementEvent = {
  deviceId: string;
  deviceName?: string | null;
  measuredAt: string; // ISO string
  aqiCalculated: number | null;
  iaqScore: number | null;
  temperature: number | null;
  humidity: number | null;
  pressureHpa: number | null;
};
