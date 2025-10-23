'use client';

export type LiveMeasurement = {
  deviceId: string;
  deviceName?: string | null;
  measuredAt: string;
  aqiCalculated: number | null;
  iaqScore: number | null;
  temperature: number | null;
  humidity: number | null;
  pressureHpa: number | null;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export function openLiveStream(): EventSource {
  const url = `${API_BASE_URL}/public/live`;
  return new EventSource(url);
}
