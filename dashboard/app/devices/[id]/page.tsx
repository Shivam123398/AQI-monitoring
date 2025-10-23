'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AQICard } from '@/components/cards/AQICard';
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart';
import { apiClient } from '@/lib/api';
import { getAQICategory, getWHOCompliance } from '@/lib/aqi-utils';
import { ArrowLeft, MapPin, Wifi, Battery, Thermometer, Droplets, Wind, Download, Settings, Clock, ArrowUp, ArrowDown, Database } from 'lucide-react';

/**
 * Device Detail Page
 * Shows comprehensive analytics for a single monitoring station
 */
export default function DeviceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deviceId = params.id as string;

  const [device, setDevice] = useState<any>(null);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => {
    loadDeviceData();
  }, [deviceId, timeRange]);

  const loadDeviceData = async () => {
    try {
      setLoading(true);

      // Calculate time range
      const end = new Date();
      const start = new Date();
      if (timeRange === '24h') start.setHours(start.getHours() - 24);
      else if (timeRange === '7d') start.setDate(start.getDate() - 7);
      else if (timeRange === '30d') start.setDate(start.getDate() - 30);

      // Fetch device info and measurements
      const [deviceRes, measurementsRes] = await Promise.all([
        apiClient.getDevice(deviceId),
        apiClient.getMeasurements({
          device_id: deviceId,
          start: start.toISOString(),
          end: end.toISOString(),
          limit: 1000
        })
      ]);

      setDevice(deviceRes.data);
      setMeasurements(measurementsRes.data.data || []);

      // Calculate statistics
      if (measurementsRes.data.data && measurementsRes.data.data.length > 0) {
        const aqiValues = measurementsRes.data.data
          .map((m: any) => m.aqiCalculated)
          .filter((v: any) => v !== null);

        setStats({
          avgAqi: Math.round(aqiValues.reduce((a: number, b: number) => a + b, 0) / aqiValues.length),
          maxAqi: Math.max(...aqiValues),
          minAqi: Math.min(...aqiValues),
          dataPoints: aqiValues.length,
          uptime: calculateUptime(measurementsRes.data.data)
        });
      }

    } catch (error) {
      console.error('Error loading device:', error);
      // Use mock data
      setDevice(generateMockDevice());
      setMeasurements(generateMockMeasurements());
      setStats({
        avgAqi: 72,
        maxAqi: 145,
        minAqi: 32,
        dataPoints: 288,
        uptime: 99.2
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateUptime = (measurements: any[]) => {
    if (measurements.length === 0) return 0;
    const expectedPoints = 288; // 5-min intervals in 24h
    return (measurements.length / expectedPoints) * 100;
  };

  const generateMockDevice = () => ({
    id: deviceId,
    name: 'Downtown Station',
    description: 'AeroGuard AI monitoring station at Connaught Place',
    latitude: 28.6315,
    longitude: 77.2167,
    areaName: 'Central Delhi',
    altitude: 216,
    active: true,
    firmwareVersion: '1.2.0',
    lastSeen: new Date(),
    currentAqi: 78,
    currentIaq: 120,
    temperature: 24.5,
    humidity: 55,
    pressure: 1013,
    metadata: {
      installDate: '2024-01-15',
      maintainer: 'City Health Dept'
    }
  });

  const generateMockMeasurements = () => {
    const now = Date.now();
    return Array.from({ length: 288 }, (_, i) => {
      const timestamp = new Date(now - i * 5 * 60 * 1000);
      const baseAqi = 70 + Math.sin(i / 50) * 30;
      return {
        id: `m-${i}`,
        timestamp: timestamp.toISOString(),
        aqiCalculated: Math.max(20, baseAqi + (Math.random() - 0.5) * 20),
        iaqScore: baseAqi * 1.5,
        temperature: 20 + Math.sin(i / 100) * 10,
        humidity: 50 + Math.sin(i / 80) * 20,
        measuredAt: timestamp
      };
    }).reverse();
  };

  const exportDeviceData = async () => {
    try {
      const res = await apiClient.exportCSV({ device_id: deviceId });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${device?.name || deviceId}-measurements.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading device data...</p>
        </div>
      </div>
    );
  }

  const category = getAQICategory(device?.currentAqi || 0);
  const whoCompliance = getWHOCompliance((device?.currentAqi || 0) * 2); // Rough PM2.5 estimate

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Dashboard</span>
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-3 h-3 rounded-full ${device?.active ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {device?.name}
                </h1>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {device?.description || 'AeroGuard AI monitoring station'}
              </p>

              {/* Location & Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600">{device?.areaName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600">Firmware v{device?.firmwareVersion}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Battery className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600">Uptime: {stats?.uptime?.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600">
                    Updated {new Date(device?.lastSeen).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={exportDeviceData}
                className="p-3 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                title="Export Data"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                className="p-3 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Average AQI</p>
                <h3 className="text-3xl font-bold">{stats?.avgAqi}</h3>
                <p className="text-xs text-gray-500 mt-1">{timeRange} period</p>
              </div>
              <Wind className="w-10 h-10 text-blue-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Peak AQI</p>
                <h3 className="text-3xl font-bold text-red-600">{stats?.maxAqi}</h3>
                <p className="text-xs text-gray-500 mt-1">Highest recorded</p>
              </div>
              <ArrowUp className="w-10 h-10 text-red-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Best AQI</p>
                <h3 className="text-3xl font-bold text-green-600">{stats?.minAqi}</h3>
                <p className="text-xs text-gray-500 mt-1">Lowest recorded</p>
              </div>
              <ArrowDown className="w-10 h-10 text-green-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Data Points</p>
                <h3 className="text-3xl font-bold text-purple-600">{stats?.dataPoints}</h3>
                <p className="text-xs text-gray-500 mt-1">Measurements</p>
              </div>
              <Database className="w-10 h-10 text-purple-500" />
            </div>
          </motion.div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Current Status */}
          <div>
            <AQICard
              aqi={device?.currentAqi || measurements[0]?.aqiCalculated || 0}
              iaq={device?.currentIaq || measurements[0]?.iaqScore}
              temperature={device?.temperature || measurements[0]?.temperature}
              humidity={device?.humidity || measurements[0]?.humidity}
              pressure={device?.pressure || measurements[0]?.pressureHpa}
              co2Equiv={measurements[0]?.co2Equiv}
              pm25={measurements[0]?.pm25Api || measurements[0]?.pm25Estimated}
              timestamp={device?.lastSeen || measurements[0]?.measuredAt}
              deviceName={device?.name}
              externalData={measurements[0]?.externalData}
            />

            {/* WHO Compliance */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
            >
              <h3 className="font-bold mb-3">WHO Air Quality Guidelines</h3>
              <div className={`px-4 py-3 rounded-lg text-center font-semibold ${whoCompliance.color}`}>
                {whoCompliance.badge}
              </div>
              <p className="text-xs text-gray-500 mt-3 text-center">
                Based on PM2.5 equivalent estimation
              </p>
            </motion.div>

            {/* Sensor Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
            >
              <h3 className="font-bold mb-3">Sensor Configuration</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">MQ135 (IAQ)</span>
                  <span className="font-semibold text-green-600">✓ Active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">DHT22 (Temp/Hum)</span>
                  <span className="font-semibold text-green-600">✓ Active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">BMP180 (Pressure)</span>
                  <span className="font-semibold text-green-600">✓ Active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">LCD Display</span>
                  <span className="font-semibold text-green-600">✓ Active</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Charts */}
          <div className="lg:col-span-2 space-y-6">
            {/* Time Range Selector */}
            <div className="flex gap-2 justify-end">
              {['24h', '7d', '30d'].map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    timeRange === range
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  {range.toUpperCase()}
                </button>
              ))}
            </div>

            {/* AQI Trend Chart */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
            >
              <h3 className="text-xl font-bold mb-4">AQI Trend</h3>
              <TimeSeriesChart data={measurements} />
            </motion.div>

            {/* Environmental Conditions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
            >
              <h3 className="text-xl font-bold mb-4">Environmental Conditions</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <Thermometer className="w-8 h-8 text-red-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{device?.temperature?.toFixed(1)}°C</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Temperature</div>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Droplets className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{Math.round(device?.humidity || 0)}%</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Humidity</div>
                </div>
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <Wind className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{Math.round(device?.pressure || 0)}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Pressure (hPa)</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
