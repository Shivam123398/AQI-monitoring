import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

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

  // Public
  getCityData: (cityName: string) =>
    api.get(`/public/city/${cityName}`),
};