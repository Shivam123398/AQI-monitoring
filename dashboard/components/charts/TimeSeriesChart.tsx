'use client';

import { Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
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

interface ParsedPoint {
  ts: number;
  aqi?: number;
  iaq?: number;
  temperature?: number;
}

interface ForecastPoint {
  ts: number;
  forecast?: number;
  confidence?: number;
}

export function TimeSeriesChart({ data, showForecast, forecastData }: TimeSeriesChartProps) {
  // Parse, sanitize, and sort input data by time ascending
  const parsed: ParsedPoint[] = (data || [])
    .map((d: any): ParsedPoint | null => {
      const ts: string | number | Date = (d as any).timestamp || (d as any).measuredAt;
      const date = new Date(ts);
      if (Number.isNaN(date.getTime())) return null;
      const aqiRaw = (d as any).aqi ?? (d as any).aqiCalculated;
      const iaqRaw = (d as any).iaq ?? (d as any).iaqScore;
      return {
        ts: date.getTime(),
        aqi: typeof aqiRaw === 'number' && !Number.isNaN(aqiRaw) ? Math.round(aqiRaw) : undefined,
        iaq: typeof iaqRaw === 'number' && !Number.isNaN(iaqRaw) ? Math.round(iaqRaw) : undefined,
        temperature: typeof (d as any).temperature === 'number' ? (d as any).temperature : undefined,
      };
    })
    .filter((x): x is ParsedPoint => x !== null)
    .sort((a, b) => a.ts - b.ts);

  // Determine appropriate time label format based on span
  const firstTs = parsed[0]?.ts ?? 0;
  const lastTs = parsed.length ? parsed[parsed.length - 1].ts : firstTs;
  const spanMs = lastTs - firstTs;
  const spanDays = spanMs / (1000 * 60 * 60 * 24);
  const timeFmt = spanDays >= 2 ? 'MMM d' : 'HH:mm';

  const chartData = parsed.map((p) => ({
    time: format(new Date(p.ts), timeFmt),
    ts: p.ts,
    aqi: p.aqi,
    iaq: p.iaq,
    temperature: p.temperature,
  }));

  const parsedForecast: ForecastPoint[] = (forecastData || [])
    .map((d: any): ForecastPoint | null => {
      const ts: string | number | Date = (d as any).timestamp || (d as any).predictedFor;
      const date = new Date(ts);
      if (Number.isNaN(date.getTime())) return null;
      const aqiRaw = (d as any).aqi ?? (d as any).aqiForecast;
      return {
        ts: date.getTime(),
        forecast: typeof aqiRaw === 'number' && !Number.isNaN(aqiRaw) ? Math.round(aqiRaw) : undefined,
        confidence: typeof (d as any).confidence === 'number' ? Math.round((d as any).confidence * 100) : undefined,
      };
    })
    .filter((x): x is ForecastPoint => x !== null)
    .sort((a, b) => a.ts - b.ts)
    .map((p) => ({
      time: format(new Date(p.ts), timeFmt),
      ts: p.ts,
      forecast: p.forecast,
      confidence: p.confidence,
    }));

  const combinedData = showForecast && parsedForecast.length
    ? [...chartData, ...parsedForecast]
    : chartData;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;

    const tsVal = payload?.[0]?.payload?.ts;
    const label = tsVal ? format(new Date(tsVal), 'MMM d, HH:mm') : payload[0].payload?.time;

    return (
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-semibold mb-2">{label}</p>
        {payload.map((entry: any, index: number) => {
          const category = typeof entry.value === 'number' ? getAQICategory(entry.value) : null;
          return (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="font-medium">{entry.name}:</span>
              <span className={category ? category.textColor : ''}>{entry.value ?? '—'}</span>
            </div>
          );
        })}
      </div>
    );
  };

  if (!combinedData.length) {
    return (
      <div className="w-full h-80 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        No data available for the selected range.
      </div>
    );
  }

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
