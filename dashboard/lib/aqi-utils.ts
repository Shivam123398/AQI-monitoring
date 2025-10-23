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

// PM2.5 breakpoints (µg/m³ to AQI) - US EPA Standard
const PM25_BREAKPOINTS = [
  { cLow: 0.0, cHigh: 12.0, iLow: 0, iHigh: 50 },       // Good
  { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100 },    // Moderate
  { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },   // Unhealthy for Sensitive Groups
  { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200 },  // Unhealthy
  { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 }, // Very Unhealthy
  { cLow: 250.5, cHigh: 500.4, iLow: 301, iHigh: 500 }, // Hazardous
];

/**
 * Convert AQI to approximate PM2.5 (reverse calculation)
 */
export function aqiToPM25(aqi: number): number {
  for (const bp of PM25_BREAKPOINTS) {
    if (aqi >= bp.iLow && aqi <= bp.iHigh) {
      const pm25 = ((aqi - bp.iLow) / (bp.iHigh - bp.iLow)) * (bp.cHigh - bp.cLow) + bp.cLow;
      return Math.round(pm25 * 100) / 100;
    }
  }
  return 0;
}
