'use client';

import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, addHours } from 'date-fns';
import { getAQICategory } from '@/lib/aqi-utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ForecastChartProps {
  predictions: Array<{
    hour: number;
    aqi: number;
    category: string;
    timestamp: Date;
  }>;
  confidence?: number;
}

export function ForecastChart({ predictions, confidence }: ForecastChartProps) {
  const chartData = predictions.slice(0, 12).map((p) => ({
    hour: format(new Date(p.timestamp), 'ha'),
    aqi: p.aqi,
    category: p.category,
  }));

  // Trend calculation
  const currentAQI = predictions[0]?.aqi || 0;
  const futureAQI = predictions[predictions.length - 1]?.aqi || 0;
  const trend = futureAQI > currentAQI ? 'up' : futureAQI < currentAQI ? 'down' : 'stable';
  const trendPercent = Math.abs(((futureAQI - currentAQI) / currentAQI) * 100);

  return (
    <div className="space-y-4">
      {/* Trend indicator */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800">
        <div>
          <div className="text-sm text-gray-600 dark:text-gray-400">24-Hour Trend</div>
          <div className="flex items-center gap-2 mt-1">
            {trend === 'up' && <TrendingUp className="w-5 h-5 text-red-500" />}
            {trend === 'down' && <TrendingDown className="w-5 h-5 text-green-500" />}
            {trend === 'stable' && <Minus className="w-5 h-5 text-gray-500" />}
            <span className="text-lg font-semibold">
              {trend === 'up' ? 'Worsening' : trend === 'down' ? 'Improving' : 'Stable'}
            </span>
            <span className="text-sm text-gray-500">({trendPercent.toFixed(1)}%)</span>
          </div>
        </div>
        {confidence !== undefined && (
          <div className="text-right">
            <div className="text-sm text-gray-600 dark:text-gray-400">Confidence</div>
            <div className="text-2xl font-bold text-primary-600">{Math.round(confidence * 100)}%</div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 12, fill: 'currentColor' }}
              className="text-gray-600 dark:text-gray-400"
            />
            <YAxis
              tick={{ fontSize: 12, fill: 'currentColor' }}
              className="text-gray-600 dark:text-gray-400"
            />
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.1)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0].payload;
                const category = getAQICategory(data.aqi);
                return (
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border">
                    <div className="text-sm font-semibold">{data.hour}</div>
                    <div className={`text-lg font-bold ${category.textColor}`}>
                      AQI {data.aqi}
                    </div>
                    <div className="text-xs text-gray-500">{category.name}</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="aqi" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => {
                const category = getAQICategory(entry.aqi);
                return <Cell key={`cell-${index}`} fill={category.color} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Hourly breakdown */}
      <div className="grid grid-cols-6 gap-2">
        {predictions.slice(0, 6).map((p, i) => {
          const category = getAQICategory(p.aqi);
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
            >
              <div className="text-xs text-gray-500 mb-1">{format(new Date(p.timestamp), 'ha')}</div>
              <div className={`text-xl font-bold ${category.textColor}`}>{p.aqi}</div>
              <div className="text-xs mt-1">{category.icon}</div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}