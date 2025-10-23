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

 function resolveLiveBase(): string {
  const envBase = process.env.NEXT_PUBLIC_API_URL;
  if (envBase && envBase.trim().length > 0) return envBase;
  if (typeof window !== 'undefined') return '/api/v1';
  return 'http://backend:3000/api/v1';
}

const API_BASE_URL = resolveLiveBase();

export function openLiveStream(): EventSource {
  const url = `${API_BASE_URL}/public/live`;
  return new EventSource(url);
}
