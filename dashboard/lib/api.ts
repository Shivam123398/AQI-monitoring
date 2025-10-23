import axios from 'axios';

// Resolve API base URL at runtime
function resolveApiBase(): string {
  const envBase = process.env.NEXT_PUBLIC_API_URL;
  if (envBase && envBase.trim().length > 0) return envBase;
  // In the browser, prefer same-origin so Next.js rewrites proxy to backend
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/v1`;
  }
  // On the server (SSR), default to backend service name inside Docker network
  return 'http://backend:3000/api/v1';
}

const API_BASE_URL = resolveApiBase();

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// API methods
export const apiClient = {
  // Measurements
  getMeasurements: (params?: { device_id?: string; start?: string; end?: string; limit?: number }) =>
    api.get('/measurements', { params }),

  getMeasurement: (id: string) =>
    api.get(`/measurements/${id}`),

  exportCSV: (params?: { device_id?: string; start?: string; end?: string }) =>
    api.get('/measurements/export/csv', { params, responseType: 'blob' }),

  // Devices
  getDevices: () =>
    api.get('/devices'),

  getDevice: (id: string) =>
    api.get(`/devices/${id}`),

  registerDevice: (data: { name: string; latitude?: number; longitude?: number; areaName?: string }) =>
    api.post('/devices/register', data),

  // Predictions
  getPredictions: (deviceId: string) =>
    api.get(`/predictions/${deviceId}`),

  generateForecast: (deviceId: string) =>
    api.post(`/predictions/${deviceId}/forecast`),

  // Health
  getHealthRisk: (userId: string) =>
    api.get(`/health/risk/${userId}`),

  analyzeHealth: (data: { deviceId?: string; userId?: string; periodDays?: number }) =>
    api.post('/health/analyze', data),

  // Ingest (for simulator/testing)
  ingest: (payload: {
    device_id: string;
    firmware_version?: string;
    timestamp: number; // seconds epoch
    sensors: {
      mq135_raw?: number;
      iaq_score?: number;
      co2_equiv?: number;
      temperature?: number;
      humidity?: number;
      pressure_hpa?: number;
      altitude_m?: number;
    };
    meta?: { uptime_ms?: number; rssi?: number; free_heap?: number };
    signature?: string;
  }) => api.post('/ingest', payload),

  simulateSpike: async (deviceId: string, aqiTarget = 180) => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      device_id: deviceId,
      timestamp: now,
      sensors: {
        iaq_score: 300, // high IAQ -> high estimated PM2.5
        temperature: 26,
        humidity: 45,
        pressure_hpa: 1010,
      },
      meta: { rssi: -60 },
    };
    return api.post('/ingest', payload);
  },

  // Public
  getCityData: (cityName: string) =>
    api.get(`/public/city/${cityName}`),
};
