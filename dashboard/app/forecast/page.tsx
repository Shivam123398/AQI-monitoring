'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ForecastChart } from '@/components/charts/ForecastChart';
import { apiClient } from '@/lib/api';
import { Calendar, TrendingUp } from 'lucide-react';

export default function ForecastPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    if (selectedDeviceId) {
      loadPredictions(selectedDeviceId);
    }
  }, [selectedDeviceId]);

  const loadDevices = async () => {
    try {
      const res = await apiClient.getDevices();
      const devicesData = res.data.data;
      setDevices(devicesData);
      if (devicesData.length > 0) {
        setSelectedDeviceId(devicesData[0].id);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to load devices:', error);
      setLoading(false);
    }
  };

  const loadPredictions = async (deviceId: string) => {
    try {
      const res = await apiClient.getPredictions(deviceId);
      setPredictions(res.data.data);
    } catch (error) {
      console.error('Failed to load predictions:', error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <TrendingUp className="w-10 h-10 text-primary-500" />
            24-Hour AQI Forecast
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            AI-powered predictions using LSTM model
          </p>
        </div>

        {/* Device Selector */}
        <select
          value={selectedDeviceId}
          onChange={(e) => setSelectedDeviceId(e.target.value)}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.name}
            </option>
          ))}
        </select>
      </motion.div>

      {/* Forecast Chart */}
      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
        {predictions.length > 0 ? (
          <ForecastChart
            predictions={predictions.map((p) => ({
              hour: new Date(p.predictedFor).getHours(),
              aqi: p.aqiForecast,
              category: p.aqiCategory,
              timestamp: new Date(p.predictedFor),
            }))}
            confidence={predictions[0]?.confidence}
          />
        ) : (
          <div className="text-center py-12 text-gray-500">
            No forecast data available. Predictions are generated hourly.
          </div>
        )}
      </div>
    </div>
  );
}