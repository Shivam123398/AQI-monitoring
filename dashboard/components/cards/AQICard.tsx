'use client';

import { motion } from 'framer-motion';
import { getAQICategory, formatAQI, aqiToPM25 } from '@/lib/aqi-utils';
import { Wind, Droplets, Thermometer, Activity, Gauge, Cloud } from 'lucide-react';

interface AQICardProps {
  aqi: number;
  iaq?: number;
  temperature?: number;
  humidity?: number;
  pressure?: number;
  co2Equiv?: number;
  pm25?: number;
  timestamp?: Date | string;
  deviceName?: string;
  externalData?: any;
}

export function AQICard({ 
  aqi, 
  iaq, 
  temperature, 
  humidity, 
  pressure,
  co2Equiv,
  pm25,
  timestamp, 
  deviceName,
  externalData 
}: AQICardProps) {
  const category = getAQICategory(aqi);
  
  // Get health message and color from externalData if available
  const healthMessage = externalData?.esp_data?.health_message ?? category.healthTip;
  const aqiColor = externalData?.esp_data?.aqi_color ?? category.color;
  
  // Estimate PM2.5 if not provided
  const estimatedPM25 = pm25 ?? aqiToPM25(aqi);

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
          background: `radial-gradient(circle at top right, ${aqiColor}, transparent)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        {deviceName && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{deviceName}</h3>
            <span className="text-xs text-gray-500">
              {timestamp ? new Date(timestamp).toLocaleString() : 'Live'}
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
            <div 
              className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-opacity-20"
              style={{ backgroundColor: `${aqiColor}20` }}
            >
              <span className="text-lg">{category.icon}</span>
              <span className="text-sm font-semibold" style={{ color: aqiColor }}>{category.name}</span>
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
                stroke={aqiColor}
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

        {/* Sensor readings grid */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {temperature !== undefined && (
            <div className="flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-red-500" />
              <div>
                <div className="text-xs text-gray-500">Temp</div>
                <div className="text-sm font-semibold">{temperature.toFixed(1)} °C</div>
              </div>
            </div>
          )}
          {humidity !== undefined && (
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-cyan-500" />
              <div>
                <div className="text-xs text-gray-500">Humidity</div>
                <div className="text-sm font-semibold">{humidity.toFixed(1)} %</div>
              </div>
            </div>
          )}
          {pressure !== undefined && (
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-purple-500" />
              <div>
                <div className="text-xs text-gray-500">Pressure</div>
                <div className="text-sm font-semibold">{pressure.toFixed(1)} hPa</div>
              </div>
            </div>
          )}
        </div>

        {/* Additional readings */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {co2Equiv !== undefined && (
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-gray-500" />
              <div>
                <div className="text-xs text-gray-500">CO2eq</div>
                <div className="text-sm font-semibold">{co2Equiv.toFixed(1)} ppm</div>
              </div>
            </div>
          )}
          {iaq !== undefined && (
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4 text-blue-500" />
              <div>
                <div className="text-xs text-gray-500">IAQ</div>
                <div className="text-sm font-semibold">{iaq.toFixed(1)}</div>
              </div>
            </div>
          )}
          {estimatedPM25 > 0 && (
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-500" />
              <div>
                <div className="text-xs text-gray-500">PM2.5</div>
                <div className="text-sm font-semibold">{estimatedPM25.toFixed(2)} µg/m³</div>
              </div>
            </div>
          )}
        </div>

        {/* Health tip */}
        <div className="mt-4 p-3 rounded-lg border" style={{ 
          backgroundColor: `${aqiColor}10`,
          borderColor: `${aqiColor}40`
        }}>
          <p className="text-xs font-medium" style={{ color: aqiColor }}>
            💡 {healthMessage}
          </p>
        </div>
      </div>
    </motion.div>
  );
}