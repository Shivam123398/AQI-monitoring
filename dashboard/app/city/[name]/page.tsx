'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { MapPin, TrendingUp, AlertTriangle, Download, Share2, Clock, RadioTower } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import map to avoid SSR issues
const DynamicMap = dynamic(() => import('@/components/map/AQIMap').then((m) => m.AQIMap), {
  ssr: false,
});

import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart';
import { AQICard } from '@/components/cards/AQICard';
import { apiClient } from '@/lib/api';
import { getAQICategory } from '@/lib/aqi-utils';

/**
 * Public City View Page
 * Accessible without authentication for public transparency
 */
export default function CityPage() {
  const params = useParams();
  const cityName = params.name as string;

  const [cityData, setCityData] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => {
    loadCityData();
  }, [cityName, timeRange]);

  const loadCityData = async () => {
    try {
      setLoading(true);

      // Fetch city overview
      const cityRes = await apiClient.getCityData(decodeURIComponent(cityName));
      setCityData(cityRes.data);
      setDevices(cityRes.data.devices || []);

    } catch (error) {
      console.error('Error loading city data:', error);
      // Use mock data for demo
      setCityData(generateMockCityData(cityName));
      setDevices(generateMockDevices());
    } finally {
      setLoading(false);
    }
  };

  const generateMockCityData = (city: string) => ({
    city: decodeURIComponent(city),
    deviceCount: 8,
    avgAqi: 78,
    maxAqi: 145,
    minAqi: 42,
    lastUpdated: new Date().toISOString(),
    trendDirection: 'stable'
  });

  const generateMockDevices = () => {
    return Array.from({ length: 8 }, (_, i) => ({
      id: `device-${i + 1}`,
      name: `Station ${i + 1}`,
      latitude: 28.6139 + (Math.random() - 0.5) * 0.1,
      longitude: 77.2090 + (Math.random() - 0.5) * 0.1,
      currentAqi: Math.floor(Math.random() * 150) + 30,
      lastSeen: new Date()
    }));
  };

  const exportData = () => {
    const csv = [
      ['Device', 'AQI', 'Location', 'Last Updated'].join(','),
      ...devices.map(d =>
        [d.name, d.currentAqi, `${d.latitude},${d.longitude}`, new Date(d.lastSeen).toLocaleString()].join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cityName}-air-quality-${Date.now()}.csv`;
    a.click();
  };

  const shareCity = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({
        title: `Air Quality in ${decodeURIComponent(cityName)}`,
        text: `Current AQI: ${cityData?.avgAqi}. Check out real-time air quality data!`,
        url
      });
    } else {
      navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading city data...</p>
        </div>
      </div>
    );
  }

  const category = getAQICategory(cityData?.avgAqi || 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <MapPin className="w-8 h-8 text-purple-600" />
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                  {decodeURIComponent(cityName)}
                </h1>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Real-time air quality monitoring • Public transparency dashboard
              </p>
              <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
                <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Updated {new Date(cityData?.lastUpdated).toLocaleTimeString()}</span>
                <span className="flex items-center gap-2"><RadioTower className="w-4 h-4" /> {cityData?.deviceCount} monitoring stations</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={shareCity}
                className="p-3 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                title="Share"
              >
                <Share2 className="w-5 h-5" />
              </button>
              <button
                onClick={exportData}
                className="p-3 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                title="Export CSV"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Average AQI */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">City Average</p>
                <h2 className="text-5xl font-bold" style={{ color: category.color }}>
                  {cityData?.avgAqi}
                </h2>
                <p className="text-sm text-gray-500 mt-1">AQI</p>
              </div>
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl`}
                   style={{ backgroundColor: `${category.color}20` }}>
                {category.icon}
              </div>
            </div>
            <div className={`px-4 py-2 rounded-lg text-white text-center font-semibold`}
                 style={{ backgroundColor: category.color }}>
              {category.name}
            </div>
          </motion.div>

          {/* Range */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6"
          >
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">AQI Range</p>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-gray-600">Lowest</span>
                  <span className="text-lg font-bold text-green-600">{cityData?.minAqi}</span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                  <div className="h-full bg-green-500 rounded-full"
                       style={{ width: `${(cityData?.minAqi / 200) * 100}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-gray-600">Highest</span>
                  <span className="text-lg font-bold text-red-600">{cityData?.maxAqi}</span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                  <div className="h-full bg-red-500 rounded-full"
                       style={{ width: `${(cityData?.maxAqi / 200) * 100}%` }}></div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Trend */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6"
          >
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">24h Trend</p>
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                cityData?.trendDirection === 'up' ? 'bg-red-100' :
                cityData?.trendDirection === 'down' ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                <TrendingUp className={`w-8 h-8 ${
                  cityData?.trendDirection === 'up' ? 'text-red-600' :
                  cityData?.trendDirection === 'down' ? 'text-green-600 rotate-180' : 'text-gray-600'
                }`} />
              </div>
              <div>
                <div className="text-2xl font-bold capitalize">
                  {cityData?.trendDirection || 'Stable'}
                </div>
                <div className="text-sm text-gray-500">
                  Compared to yesterday
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Map & Devices */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Monitoring Stations</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setTimeRange('24h')}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    timeRange === '24h' 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600'
                  }`}
                >
                  24h
                </button>
                <button
                  onClick={() => setTimeRange('7d')}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    timeRange === '7d' 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600'
                  }`}
                >
                  7d
                </button>
              </div>
            </div>
            <div className="h-96 rounded-xl overflow-hidden">
              <DynamicMap devices={devices} />
            </div>
          </motion.div>

          {/* Device List */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6"
          >
            <h3 className="text-xl font-bold mb-4">Active Stations</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {devices.map((device, index) => {
                const deviceCategory = getAQICategory(device.currentAqi || 0);
                return (
                  <motion.div
                    key={device.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className="p-4 rounded-lg border-2 hover:border-purple-300 transition-all cursor-pointer"
                    style={{ borderColor: `${deviceCategory.color}40` }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{device.name}</h4>
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-3xl font-bold" style={{ color: deviceCategory.color }}>
                        {Math.round(device.currentAqi)}
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">AQI</div>
                        <div className="text-xs font-semibold" style={{ color: deviceCategory.color }}>
                          {deviceCategory.name}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Health Advisory */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl shadow-lg p-6 border-2 border-blue-200 dark:border-blue-800"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-2">Health Advisory</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                {category.healthTip}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <div className="font-semibold mb-1">General Public</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {cityData?.avgAqi > 100 ? 'Reduce prolonged outdoor exertion' : 'Normal activities OK'}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <div className="font-semibold mb-1">Sensitive Groups</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {cityData?.avgAqi > 50 ? 'Limit outdoor activities' : 'Normal activities OK'}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <div className="font-semibold mb-1">High Risk</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {cityData?.avgAqi > 100 ? 'Stay indoors, use air purifiers' : 'Take usual precautions'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 py-4">
          <p>Data provided by AeroGuard AI • Updated every 5 minutes</p>
          <p className="mt-2">
            <a href="/api/v1/public/openapi.yaml" className="text-purple-600 hover:underline">
              API Documentation
            </a>
            {' • '}
            <a href="#" className="text-purple-600 hover:underline">
              About This Project
            </a>
            {' • '}
            <a href="#" className="text-purple-600 hover:underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
