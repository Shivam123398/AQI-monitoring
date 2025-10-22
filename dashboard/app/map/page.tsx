'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { MapPin, RefreshCw } from 'lucide-react';

const DynamicMap = dynamic(() => import('@/components/map/AQIMap').then(m => m.AQIMap), {
  ssr: false,
  loading: () => <div className="w-full h-[70vh] bg-gray-200 dark:bg-gray-800 animate-pulse rounded-xl" />,
});

export default function MapPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [city, setCity] = useState('');

  useEffect(() => {
    loadDevices();
  }, []);

  async function loadDevices() {
    try {
      const [devRes, measRes] = await Promise.all([
        apiClient.getDevices(),
        apiClient.getMeasurements({ limit: 500 }),
      ]);
      const list = devRes.data.data || [];
      const measurements = measRes.data.data || [];
      // attach latest per device
      const byDevice: Record<string, any[]> = {};
      for (const m of measurements) {
        const id = m.deviceId;
        (byDevice[id] ||= []).push(m);
      }
      const enriched = list.map((d: any) => {
        const latest = (byDevice[d.id] || []).sort((a,b)=> new Date(b.measuredAt).getTime()-new Date(a.measuredAt).getTime())[0];
        return {
          ...d,
          currentAqi: latest?.aqiCalculated ?? d.currentAqi,
          lastSeen: latest?.measuredAt ?? d.lastSeen,
        };
      });
      setDevices(enriched);
    } catch (e) {
      // fallback demo devices
      setDevices(Array.from({ length: 6 }, (_, i) => ({
        id: `demo-${i + 1}`,
        name: `Demo Station ${i + 1}`,
        latitude: 28.6139 + (Math.random() - 0.5) * 0.1,
        longitude: 77.209 + (Math.random() - 0.5) * 0.1,
        currentAqi: Math.floor(40 + Math.random() * 120),
        lastSeen: new Date().toISOString(),
      })));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-6 h-6 text-purple-600" />
          <h1 className="text-2xl font-bold">Air Quality Map</h1>
        </div>
        <div className="flex gap-2">
          <input
            placeholder="Search city (uses public view)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
          />
          <a
            href={city ? `/city/${encodeURIComponent(city)}` : '#'}
            className={`px-4 py-2 rounded-lg text-white ${city ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-400 cursor-not-allowed'}`}
            aria-disabled={!city}
          >
            Open City View
          </a>
          <button onClick={loadDevices} className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Stations" value={devices.length} />
        <Stat label="Avg AQI" value={avg(devices.map((d) => d.currentAqi || 0))} />
        <Stat label="Updated" value={new Date().toLocaleTimeString()} />
      </div>

      <div className="h-[70vh]">
        <DynamicMap devices={devices} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold">{typeof value === 'number' ? Math.round(value) : value}</div>
    </div>
  );
}

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
