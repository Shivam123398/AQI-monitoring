'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AQICard } from '@/components/cards/AQICard';
import { apiClient } from '@/lib/api';
import { openLiveStream, type LiveMeasurement } from '@/lib/live';
import { MapPin, TrendingUp, Activity, AlertTriangle, RefreshCw, Play } from 'lucide-react';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart';

// Dynamically import map to avoid SSR issues
const DynamicMap = dynamic(() => import('@/components/map/AQIMap').then((mod) => mod.AQIMap), {
  ssr: false,
  loading: () => <div className="w-full h-[600px] bg-gray-200 animate-pulse rounded-xl" />,
});

export default function HomePage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cityStats, setCityStats] = useState<any>(null);
  const [range, setRange] = useState<'24h' | '7d'>('24h');
  const [series, setSeries] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  // Live updates via SSE
  useEffect(() => {
    const es = openLiveStream();
    es.onmessage = (ev) => {
      try {
        const data: LiveMeasurement = JSON.parse(ev.data);
        setDevices((prev) => {
          const idx = prev.findIndex((d) => d.id === data.deviceId);
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            currentAqi: data.aqiCalculated ?? next[idx].currentAqi,
            currentIaq: data.iaqScore ?? next[idx].currentIaq,
            temperature: data.temperature ?? next[idx].temperature,
            humidity: data.humidity ?? next[idx].humidity,
            lastSeen: data.measuredAt ?? next[idx].lastSeen,
          };
          return next;
        });

        if (selectedDeviceId && data.deviceId === selectedDeviceId) {
          setSeries((prev) => {
            const appended = [...prev, { measuredAt: data.measuredAt, aqiCalculated: data.aqiCalculated }];
            // keep last 500 points
            return appended.slice(-500);
          });
        }
      } catch {}
    };
    es.onerror = () => {
      // Allow reconnection by closing; browser will reconnect on next effect if remounted
    };
    return () => es.close();
  }, [selectedDeviceId]);

  useEffect(() => {
    const d = devices.find((x) => x.id === selectedDeviceId) || null;
    setSelectedDevice(d || (devices[0] || null));
  }, [devices, selectedDeviceId]);

  useEffect(() => {
    if (selectedDevice) {
      loadSeries(selectedDevice.id, range);
    }
  }, [selectedDevice, range]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [devicesRes, measurementsRes] = await Promise.all([
        apiClient.getDevices(),
        apiClient.getMeasurements({ limit: 300 }),
      ]);

      const devicesData = devicesRes.data.data || [];
      const measurementsData = measurementsRes.data.data || [];

      // Attach latest measurement to each device
      const enrichedDevices = devicesData.map((device: any) => {
        const latestMeasurement = measurementsData
          .filter((m: any) => m.deviceId === device.id)
          .sort((a: any, b: any) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())[0];

        return {
          ...device,
          currentAqi: latestMeasurement?.aqiCalculated,
          currentIaq: latestMeasurement?.iaqScore,
          temperature: latestMeasurement?.temperature,
          humidity: latestMeasurement?.humidity,
          lastSeen: latestMeasurement?.measuredAt,
        };
      });

      setDevices(enrichedDevices);
      if (enrichedDevices.length > 0) {
        setSelectedDeviceId(enrichedDevices[0].id);
      }

      // Calculate city-wide stats
      const aqiValues = enrichedDevices
        .map((d: any) => d.currentAqi)
        .filter((aqi: any) => typeof aqi === 'number');

      setCityStats({
        avgAqi: aqiValues.length ? aqiValues.reduce((a: number, b: number) => a + b, 0) / aqiValues.length : 0,
        maxAqi: aqiValues.length ? Math.max(...aqiValues) : 0,
        minAqi: aqiValues.length ? Math.min(...aqiValues) : 0,
        deviceCount: enrichedDevices.length,
      });
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load devices. Using demo data.');
      const demo = Array.from({ length: 6 }, (_, i) => ({
        id: `demo-${i + 1}`,
        name: `Demo Station ${i + 1}`,
        latitude: 28.6139 + (Math.random() - 0.5) * 0.1,
        longitude: 77.209 + (Math.random() - 0.5) * 0.1,
        currentAqi: Math.floor(40 + Math.random() * 120),
        currentIaq: Math.floor(80 + Math.random() * 200),
        temperature: 24 + Math.random() * 4,
        humidity: 40 + Math.random() * 20,
        lastSeen: new Date().toISOString(),
      }));
      setDevices(demo);
      setSelectedDeviceId(demo[0].id);
      setCityStats({ avgAqi: 78, maxAqi: 156, minAqi: 38, deviceCount: demo.length });
    } finally {
      setLoading(false);
    }
  };

  const loadSeries = async (deviceId: string, r: '24h' | '7d') => {
    try {
      // Provide synthetic series when using demo devices
      if (deviceId.startsWith('demo')) {
        const end = new Date();
        const start = new Date(end);
        if (r === '24h') start.setHours(start.getHours() - 24);
        else start.setDate(start.getDate() - 7);

        const points: any[] = [];
        const stepMinutes = r === '24h' ? 30 : 120; // denser for 24h
        const totalMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60)));
        const steps = Math.ceil(totalMinutes / stepMinutes);
        const base = 60 + Math.random() * 20;
        for (let i = 0; i <= steps; i++) {
          const t = new Date(start.getTime() + i * stepMinutes * 60 * 1000);
          // smooth daily pattern + noise
          const dayPhase = Math.sin((i / steps) * Math.PI * 2) * 15;
          const rush = (t.getHours() >= 7 && t.getHours() <= 9) || (t.getHours() >= 17 && t.getHours() <= 19) ? 20 : 0;
          const noise = (Math.random() - 0.5) * 8;
          const aqi = Math.max(10, Math.min(250, Math.round(base + dayPhase + rush + noise)));
          points.push({ measuredAt: t.toISOString(), aqiCalculated: aqi });
        }
        setSeries(points);
        return;
      }

      const end = new Date();
      const start = new Date();
      if (r === '24h') start.setHours(start.getHours() - 24);
      else start.setDate(start.getDate() - 7);
      const res = await apiClient.getMeasurements({
        device_id: deviceId,
        start: start.toISOString(),
        end: end.toISOString(),
        limit: 500,
      });
      setSeries(res.data.data || []);
    } catch (e) {
      setSeries([]);
    }
  };

  const onRefresh = async () => {
    await loadData();
    if (selectedDeviceId) await loadSeries(selectedDeviceId, range);
    toast.success('Refreshed');
  };

  const simulateSpike = async () => {
    if (!selectedDeviceId || selectedDeviceId.startsWith('demo')) {
      toast.error('Select a real device to simulate.');
      return;
    }
    try {
      await apiClient.simulateSpike(selectedDeviceId, 180);
      toast.success('Simulated high AQI sent');
      await loadSeries(selectedDeviceId, range);
    } catch (e) {
      toast.error('Failed to simulate');
    }
  };

  const selectedSeries = useMemo(() => {
    const rows = (series || [])
      .filter((m: any) => typeof m.aqiCalculated === 'number' && m.measuredAt)
      .sort((a: any, b: any) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime())
      .map((m: any) => ({ timestamp: m.measuredAt, aqi: Math.round(m.aqiCalculated) }));
    return rows;
  }, [series]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 bg-gray-200 dark:bg-gray-800 animate-pulse rounded" />
          <div className="h-8 w-24 bg-gray-200 dark:bg-gray-800 animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-xl" />
          ))}
        </div>
        <div className="w-full h-[600px] bg-gray-200 dark:bg-gray-800 animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="text-left space-y-2">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
            AeroGuard AI
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Predict the air. Protect your health.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
            aria-label="Select device"
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <button onClick={onRefresh} className="px-3 py-2 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-700" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={simulateSpike} className="px-3 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1" title="Simulate spike">
            <Play className="w-4 h-4" />
            <span>Simulate</span>
          </button>
        </div>
      </motion.div>

      {/* City Stats */}
      {cityStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard icon={Activity} label="Average AQI" value={Math.round(cityStats.avgAqi)} color="text-blue-500" />
          <StatCard icon={TrendingUp} label="Peak AQI" value={Math.round(cityStats.maxAqi)} color="text-red-500" />
          <StatCard icon={MapPin} label="Active Devices" value={cityStats.deviceCount} color="text-green-500" />
          <StatCard icon={AlertTriangle} label="Alerts Today" value="—" color="text-orange-500" />
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <MapPin className="w-6 h-6 text-primary-500" />
              Live Air Quality Map
            </h2>
            <div className="h-[600px]">
              <DynamicMap devices={devices} />
            </div>
          </div>
        </div>

        {/* Selected Device Details */}
        <div className="space-y-6">
          {selectedDevice && (
            <>
              <AQICard
                aqi={selectedDevice.currentAqi || 0}
                iaq={selectedDevice.currentIaq}
                temperature={selectedDevice.temperature}
                humidity={selectedDevice.humidity}
                timestamp={selectedDevice.lastSeen}
                deviceName={selectedDevice.name}
              />

              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">Trend Preview</h3>
                  <div className="flex gap-2">
                    {(['24h', '7d'] as const).map((r) => (
                      <button key={r}
                        onClick={() => setRange(r)}
                        className={`px-3 py-1 rounded-lg text-sm ${range === r ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
                      >{r.toUpperCase()}</button>
                    ))}
                  </div>
                </div>
                <TimeSeriesChart data={selectedSeries} />
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <a
                    href={`/devices/${selectedDevice.id}`}
                    className="block w-full text-center bg-primary-500 hover:bg-primary-600 text-white py-3 px-4 rounded-lg transition-colors font-medium"
                  >
                    View Detailed Analytics
                  </a>
                  <a
                    href="/forecast"
                    className="block w-full text-center bg-secondary-500 hover:bg-secondary-600 text-white py-3 px-4 rounded-lg transition-colors font-medium"
                  >
                    24-Hour Forecast
                  </a>
                  <a
                    href="/health"
                    className="block w-full text-center border-2 border-primary-500 text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 py-3 px-4 rounded-lg transition-colors font-medium"
                  >
                    Health Risk Report
                  </a>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</div>
          <div className="text-3xl font-bold">{value}</div>
        </div>
        <Icon className={`w-12 h-12 ${color} opacity-80`} />
      </div>
    </motion.div>
  );
}
