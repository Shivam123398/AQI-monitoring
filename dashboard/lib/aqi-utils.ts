export interface AQICategory {
  name: string;
  color: string;
  bgColor: string;
  textColor: string;
  healthTip: string;
  icon: string;
}

export const AQI_CATEGORIES: Record<string, AQICategory> = {
  good: {
    name: 'Good',
    color: '#00E400',
    bgColor: 'bg-green-500',
    textColor: 'text-green-700',
    healthTip: 'Air quality is satisfactory. Enjoy outdoor activities!',
    icon: '✅',
  },
  moderate: {
    name: 'Moderate',
    color: '#FFFF00',
    bgColor: 'bg-yellow-400',
    textColor: 'text-yellow-700',
    healthTip: 'Acceptable air quality. Sensitive individuals should limit prolonged outdoor exertion.',
    icon: '⚠️',
  },
  unhealthy_sensitive: {
    name: 'Unhealthy for Sensitive Groups',
    color: '#FF7E00',
    bgColor: 'bg-orange-500',
    textColor: 'text-orange-700',
    healthTip: 'Sensitive groups should reduce outdoor activity.',
    icon: '🟠',
  },
  unhealthy: {
    name: 'Unhealthy',
    color: '#FF0000',
    bgColor: 'bg-red-500',
    textColor: 'text-red-700',
    healthTip: 'Everyone should reduce prolonged outdoor exertion.',
    icon: '🔴',
  },
  very_unhealthy: {
    name: 'Very Unhealthy',
    color: '#8F3F97',
    bgColor: 'bg-purple-600',
    textColor: 'text-purple-700',
    healthTip: 'Health alert! Avoid outdoor activities.',
    icon: '🟣',
  },
  hazardous: {
    name: 'Hazardous',
    color: '#7E0023',
    bgColor: 'bg-rose-900',
    textColor: 'text-rose-900',
    healthTip: 'EMERGENCY: Stay indoors. Seek medical help if experiencing symptoms.',
    icon: '🟤',
  },
};

export function getAQICategory(aqi: number): AQICategory {
  if (aqi <= 50) return AQI_CATEGORIES.good;
  if (aqi <= 100) return AQI_CATEGORIES.moderate;
  if (aqi <= 150) return AQI_CATEGORIES.unhealthy_sensitive;
  if (aqi <= 200) return AQI_CATEGORIES.unhealthy;
  if (aqi <= 300) return AQI_CATEGORIES.very_unhealthy;
  return AQI_CATEGORIES.hazardous;
}

export function formatAQI(aqi: number | null | undefined): string {
  if (aqi === null || aqi === undefined || Number.isNaN(aqi as any)) return 'N/A';
  return Math.round(aqi).toString();
}

export function getWHOCompliance(pm25: number): { badge: string; color: string } {
  if (pm25 <= 5) return { badge: 'WHO 2021 Annual', color: 'text-green-600' };
  if (pm25 <= 15) return { badge: 'WHO 2021 24h', color: 'text-green-500' };
  if (pm25 <= 25) return { badge: 'WHO IT-3', color: 'text-yellow-600' };
  if (pm25 <= 35) return { badge: 'WHO IT-2', color: 'text-orange-500' };
  if (pm25 <= 75) return { badge: 'WHO IT-1', color: 'text-red-500' };
  return { badge: 'Exceeds WHO', color: 'text-red-700' };
}
