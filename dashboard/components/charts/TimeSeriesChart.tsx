'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { format } from 'date-fns';
import { getAQICategory } from '@/lib/aqi-utils';

interface TimeSeriesChartProps {
  data: Array<{
    timestamp: string;
    aqi: number;
    iaq?: number;
    temperature?: number;
  }>;
  showForecast?: boolean;
  forecastData?: Array<{
    timestamp: string;
    aqi: number;
    confidence?: number;
  }>;
}

export function TimeSeriesChart({ data, showForecast, forecastData }: TimeSeriesChartProps) {
  const chartData = data.map((d) => ({
    time: format(new Date(d.timestamp), 'HH:mm'),
    aqi: Math.round(d.aqi),
    iaq: d.iaq ? Math.round(d.iaq) : undefined,
    temperature: d.temperature,
  }));

  const combinedData = showForecast && forecastData
    ? [
        ...chartData,
        ...forecastData.map((d) => ({
          time: format(new Date(d.timestamp), 'HH:mm'),
          forecast: Math.round(d.aqi),
          confidence: d.confidence ? Math.round(d.confidence * 100) : undefined,
        })),
      ]
    : chartData;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-semibold mb-2">{payload[0].payload.time}</p>
        {payload.map((entry: any, index: number) => {
          const category = entry.value ? getAQICategory(entry.value) : null;
          return (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="font-medium">{entry.name}:</span>
              <span className={category ? category.textColor : ''}>{entry.value}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={combinedData}>
          <defs>
            <linearGradient id="aqiGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#667eea" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#667eea" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 12, fill: 'currentColor' }}
            className="text-gray-600 dark:text-gray-400"
          />
          <YAxis
            tick={{ fontSize: 12, fill: 'currentColor' }}
            className="text-gray-600 dark:text-gray-400"
            label={{ value: 'AQI', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '14px' }} />
          
          {/* Historical AQI */}
          <Area
            type="monotone"
            dataKey="aqi"
            stroke="#667eea"
            strokeWidth={2}
            fill="url(#aqiGradient)"
            name="AQI"
          />

          {/* Forecast */}
          {showForecast && (
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="#764ba2"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Forecast"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}