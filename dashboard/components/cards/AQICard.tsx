'use client';

import { motion } from 'framer-motion';
import { getAQICategory, formatAQI } from '@/lib/aqi-utils';
import { Wind, Droplets, Thermometer, Activity } from 'lucide-react';

interface AQICardProps {
  aqi: number;
  iaq?: number;
  temperature?: number;
  humidity?: number;
  timestamp?: Date;
  deviceName?: string;
}

export function AQICard({ aqi, iaq, temperature, humidity, timestamp, deviceName }: AQICardProps) {
  const category = getAQICategory(aqi);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-xl p-6 border border-gray-200 dark:border-gray-700"
    >
      {/* Background gradient based on AQI */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          background: `radial-gradient(circle at top right, ${category.color}, transparent)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        {deviceName && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{deviceName}</h3>
            <span className="text-xs text-gray-500">
              {timestamp ? new Date(timestamp).toLocaleTimeString() : 'Live'}
            </span>
          </div>
        )}

        {/* AQI Value */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-bold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
                {formatAQI(aqi)}
              </span>
              <span className="text-2xl text-gray-400">AQI</span>
            </div>
            <div className={`mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full ${category.bgColor} bg-opacity-20`}>
              <span className="text-lg">{category.icon}</span>
              <span className={`text-sm font-semibold ${category.textColor}`}>{category.name}</span>
            </div>
          </div>

          {/* Circular gauge */}
          <div className="relative w-24 h-24">
            <svg className="transform -rotate-90 w-24 h-24">
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                className="text-gray-200 dark:text-gray-700"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke={category.color}
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={`${(aqi / 500) * 251.2} 251.2`}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Activity className="w-8 h-8 text-gray-400 aqi-pulse" />
            </div>
          </div>
        </div>

        {/* Secondary metrics */}
        <div className="grid grid-cols-3 gap-4">
          {iaq !== undefined && (
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4 text-blue-500" />
              <div>
                <div className="text-xs text-gray-500">IAQ</div>
                <div className="text-sm font-semibold">{Math.round(iaq)}</div>
              </div>
            </div>
          )}
          {temperature !== undefined && (
            <div className="flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-red-500" />
              <div>
                <div className="text-xs text-gray-500">Temp</div>
                <div className="text-sm font-semibold">{temperature.toFixed(1)}°C</div>
              </div>
            </div>
          )}
          {humidity !== undefined && (
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-cyan-500" />
              <div>
                <div className="text-xs text-gray-500">Humidity</div>
                <div className="text-sm font-semibold">{Math.round(humidity)}%</div>
              </div>
            </div>
          )}
        </div>

        {/* Health tip */}
        <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-800 dark:text-blue-300">{category.healthTip}</p>
        </div>
      </div>
    </motion.div>
  );
}