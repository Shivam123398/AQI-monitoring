'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AQIMap } from '@/components/map/AQIMap';
import { AQICard } from '@/components/cards/AQICard';
import { apiClient } from '@/lib/api';
import { MapPin, TrendingUp, Activity, AlertTriangle } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import map to avoid SSR issues
const DynamicMap = dynamic(() => import('@/components/map/AQIMap').then((mod) => mod.AQIMap), {
  ssr: false,
  loading: () => <div className="w-full h-[600px] bg-gray-200 animate-pulse rounded-xl" />,
});

export default function HomePage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cityStats, setCityStats] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [devicesRes, measurementsRes] = await Promise.all([
        apiClient.getDevices(),
        apiClient.getMeasurements({ limit: 100 }),
      ]);

      const devicesData = devicesRes.data.data;
      const measurementsData = measurementsRes.data.data;

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
        setSelectedDevice(enrichedDevices[0]);
      }

      // Calculate city-wide stats
      const aqiValues = enrichedDevices
        .map((d: any) => d.currentAqi)
        .filter((aqi: any) => aqi !== undefined);

      setCityStats({
        avgAqi: aqiValues.reduce((a: number, b: number) => a + b, 0) / aqiValues.length || 0,
        maxAqi: Math.max(...aqiValues, 0),
        minAqi: Math.min(...aqiValues, 999),
        deviceCount: enrichedDevices.length,
      });

      setLoading(false);
    } catch (error) {
      console.error('Failed to load data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
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
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <h1 className="text-5xl font-bold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
          AeroGuard AI
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          Predict the air. Protect your health.
        </p>
      </motion.div>

      {/* City Stats */}
      {cityStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            icon={Activity}
            label="Average AQI"
            value={Math.round(cityStats.avgAqi)}
            color="text-blue-500"
          />
          <StatCard
            icon={TrendingUp}
            label="Peak AQI"
            value={Math.round(cityStats.maxAqi)}
            color="text-red-500"
          />
          <StatCard
            icon={MapPin}
            label="Active Devices"
            value={cityStats.deviceCount}
            color="text-green-500"
          />
          <StatCard
            icon={AlertTriangle}
            label="Alerts Today"
            value="3"
            color="text-orange-500"
          />
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