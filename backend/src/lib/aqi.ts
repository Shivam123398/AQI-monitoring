/**
 * AQI Calculations and Utilities
 * Implements US EPA and WHO Air Quality Index standards
 */

export interface AQIBreakpoint {
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
}

// PM2.5 breakpoints (µg/m³ to AQI) - US EPA Standard
const PM25_BREAKPOINTS: AQIBreakpoint[] = [
  { cLow: 0.0, cHigh: 12.0, iLow: 0, iHigh: 50 },       // Good
  { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100 },    // Moderate
  { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },   // Unhealthy for Sensitive Groups
  { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200 },  // Unhealthy
  { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 }, // Very Unhealthy
  { cLow: 250.5, cHigh: 500.4, iLow: 301, iHigh: 500 }, // Hazardous
];

// PM10 breakpoints
const PM10_BREAKPOINTS: AQIBreakpoint[] = [
  { cLow: 0, cHigh: 54, iLow: 0, iHigh: 50 },
  { cLow: 55, cHigh: 154, iLow: 51, iHigh: 100 },
  { cLow: 155, cHigh: 254, iLow: 101, iHigh: 150 },
  { cLow: 255, cHigh: 354, iLow: 151, iHigh: 200 },
  { cLow: 355, cHigh: 424, iLow: 201, iHigh: 300 },
  { cLow: 425, cHigh: 604, iLow: 301, iHigh: 500 },
];

// O3 (Ozone) breakpoints - 8-hour average (ppm)
const O3_8HOUR_BREAKPOINTS: AQIBreakpoint[] = [
  { cLow: 0.000, cHigh: 0.054, iLow: 0, iHigh: 50 },
  { cLow: 0.055, cHigh: 0.070, iLow: 51, iHigh: 100 },
  { cLow: 0.071, cHigh: 0.085, iLow: 101, iHigh: 150 },
  { cLow: 0.086, cHigh: 0.105, iLow: 151, iHigh: 200 },
  { cLow: 0.106, cHigh: 0.200, iLow: 201, iHigh: 300 },
];

// CO (Carbon Monoxide) breakpoints - 8-hour average (ppm)
const CO_BREAKPOINTS: AQIBreakpoint[] = [
  { cLow: 0.0, cHigh: 4.4, iLow: 0, iHigh: 50 },
  { cLow: 4.5, cHigh: 9.4, iLow: 51, iHigh: 100 },
  { cLow: 9.5, cHigh: 12.4, iLow: 101, iHigh: 150 },
  { cLow: 12.5, cHigh: 15.4, iLow: 151, iHigh: 200 },
  { cLow: 15.5, cHigh: 30.4, iLow: 201, iHigh: 300 },
  { cLow: 30.5, cHigh: 50.4, iLow: 301, iHigh: 500 },
];

// NO2 (Nitrogen Dioxide) breakpoints - 1-hour average (ppb)
const NO2_BREAKPOINTS: AQIBreakpoint[] = [
  { cLow: 0, cHigh: 53, iLow: 0, iHigh: 50 },
  { cLow: 54, cHigh: 100, iLow: 51, iHigh: 100 },
  { cLow: 101, cHigh: 360, iLow: 101, iHigh: 150 },
  { cLow: 361, cHigh: 649, iLow: 151, iHigh: 200 },
  { cLow: 650, cHigh: 1249, iLow: 201, iHigh: 300 },
  { cLow: 1250, cHigh: 2049, iLow: 301, iHigh: 500 },
];

/**
 * Calculate AQI from pollutant concentration
 */
export function calculateAQI(
  concentration: number,
  pollutant: 'pm25' | 'pm10' | 'o3' | 'co' | 'no2' | 'so2'
): number {
  let breakpoints: AQIBreakpoint[];

  switch (pollutant) {
    case 'pm25':
      breakpoints = PM25_BREAKPOINTS;
      break;
    case 'pm10':
      breakpoints = PM10_BREAKPOINTS;
      break;
    case 'o3':
      breakpoints = O3_8HOUR_BREAKPOINTS;
      break;
    case 'co':
      breakpoints = CO_BREAKPOINTS;
      break;
    case 'no2':
      breakpoints = NO2_BREAKPOINTS;
      break;
    default:
      throw new Error(`Unsupported pollutant: ${pollutant}`);
  }

  // Find applicable breakpoint
  for (const bp of breakpoints) {
    if (concentration >= bp.cLow && concentration <= bp.cHigh) {
      const aqi = ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (concentration - bp.cLow) + bp.iLow;
      return Math.round(aqi);
    }
  }

  // Out of range
  if (concentration > 500.4) return 500;
  if (concentration < 0) return 0;

  // If between breakpoints, use last applicable
  const lastBP = breakpoints[breakpoints.length - 1];
  if (concentration > lastBP.cHigh) {
    return lastBP.iHigh;
  }

  return 0;
}

/**
 * Get AQI category and metadata
 */
export function getAQICategory(aqi: number): {
  level: number;
  name: string;
  color: string;
  textColor: string;
  description: string;
  healthImplications: string;
  cautionaryStatement: string;
} {
  if (aqi <= 50) {
    return {
      level: 1,
      name: 'Good',
      color: '#00E400',
      textColor: '#000000',
      description: 'Air quality is satisfactory',
      healthImplications: 'Air quality is satisfactory, and air pollution poses little or no risk.',
      cautionaryStatement: 'None',
    };
  }

  if (aqi <= 100) {
    return {
      level: 2,
      name: 'Moderate',
      color: '#FFFF00',
      textColor: '#000000',
      description: 'Acceptable for most people',
      healthImplications:
        'Air quality is acceptable. However, there may be a risk for some people, particularly those who are unusually sensitive to air pollution.',
      cautionaryStatement:
        'Active children and adults, and people with respiratory disease, such as asthma, should limit prolonged outdoor exertion.',
    };
  }

  if (aqi <= 150) {
    return {
      level: 3,
      name: 'Unhealthy for Sensitive Groups',
      color: '#FF7E00',
      textColor: '#000000',
      description: 'Sensitive groups may experience health effects',
      healthImplications:
        'Members of sensitive groups may experience health effects. The general public is less likely to be affected.',
      cautionaryStatement:
        'Active children and adults, and people with respiratory disease, such as asthma, should limit prolonged outdoor exertion.',
    };
  }

  if (aqi <= 200) {
    return {
      level: 4,
      name: 'Unhealthy',
      color: '#FF0000',
      textColor: '#FFFFFF',
      description: 'Everyone may begin to experience health effects',
      healthImplications:
        'Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects.',
      cautionaryStatement:
        'Active children and adults, and people with respiratory disease, such as asthma, should avoid prolonged outdoor exertion; everyone else, especially children, should limit prolonged outdoor exertion.',
    };
  }

  if (aqi <= 300) {
    return {
      level: 5,
      name: 'Very Unhealthy',
      color: '#8F3F97',
      textColor: '#FFFFFF',
      description: 'Health alert: everyone may experience serious health effects',
      healthImplications:
        'Health alert: The risk of health effects is increased for everyone.',
      cautionaryStatement:
        'Active children and adults, and people with respiratory disease, such as asthma, should avoid all outdoor exertion; everyone else, especially children, should limit outdoor exertion.',
    };
  }

  return {
    level: 6,
    name: 'Hazardous',
    color: '#7E0023',
    textColor: '#FFFFFF',
    description: 'Health warning of emergency conditions',
    healthImplications:
      'Health warning of emergency conditions: everyone is more likely to be affected.',
    cautionaryStatement:
      'Everyone should avoid all outdoor exertion.',
  };
}

/**
 * Get health tip based on AQI category
 */
export function getHealthTip(category: string): string {
  const tips: Record<string, string> = {
    good: '✅ Air quality is good. Enjoy your outdoor activities!',
    moderate:
      '⚠️ Air quality is acceptable. Unusually sensitive individuals should consider limiting prolonged outdoor exertion.',
    unhealthy_sensitive:
      '🟠 Sensitive groups (children, elderly, people with respiratory or heart conditions) should reduce prolonged or heavy outdoor exertion.',
    unhealthy:
      '🔴 Everyone should reduce prolonged or heavy outdoor exertion. Sensitive groups should avoid it entirely.',
    very_unhealthy:
      '🟣 Health alert! Everyone should avoid prolonged or heavy outdoor exertion. Sensitive groups should remain indoors.',
    hazardous:
      '🟤 HEALTH EMERGENCY: Everyone should avoid all physical activity outdoors. Remain indoors and keep activity levels low.',
  };

  return tips[category] || 'Air quality data unavailable.';
}

/**
 * WHO Air Quality Guidelines (2021)
 */
export function getWHOCompliance(pm25: number): {
  compliant: boolean;
  guideline: string;
  exceedance: number;
} {
  const WHO_ANNUAL = 5; // µg/m³
  const WHO_24H = 15; // µg/m³

  if (pm25 <= WHO_ANNUAL) {
    return {
      compliant: true,
      guideline: 'WHO 2021 Annual Guideline',
      exceedance: 0,
    };
  }

  if (pm25 <= WHO_24H) {
    return {
      compliant: false,
      guideline: 'WHO 2021 24-hour Guideline',
      exceedance: Math.round(((pm25 - WHO_ANNUAL) / WHO_ANNUAL) * 100),
    };
  }

  return {
    compliant: false,
    guideline: 'Exceeds WHO Guidelines',
    exceedance: Math.round(((pm25 - WHO_24H) / WHO_24H) * 100),
  };
}

/**
 * Convert AQI to approximate PM2.5 (reverse calculation)
 */
export function aqiToPM25(aqi: number): number {
  for (const bp of PM25_BREAKPOINTS) {
    if (aqi >= bp.iLow && aqi <= bp.iHigh) {
      const pm25 = ((aqi - bp.iLow) / (bp.iHigh - bp.iLow)) * (bp.cHigh - bp.cLow) + bp.cLow;
      return Math.round(pm25 * 10) / 10;
    }
  }
  return 0;
}

/**
 * Calculate dominant pollutant (for multi-pollutant AQI)
 */
export function calculateDominantPollutant(pollutants: {
  pm25?: number;
  pm10?: number;
  o3?: number;
  co?: number;
  no2?: number;
}): { aqi: number; pollutant: string } {
  const aqis: { value: number; name: string }[] = [];

  if (pollutants.pm25 !== undefined) {
    aqis.push({ value: calculateAQI(pollutants.pm25, 'pm25'), name: 'PM2.5' });
  }
  if (pollutants.pm10 !== undefined) {
    aqis.push({ value: calculateAQI(pollutants.pm10, 'pm10'), name: 'PM10' });
  }
  if (pollutants.o3 !== undefined) {
    aqis.push({ value: calculateAQI(pollutants.o3, 'o3'), name: 'O₃' });
  }
  if (pollutants.co !== undefined) {
    aqis.push({ value: calculateAQI(pollutants.co, 'co'), name: 'CO' });
  }
  if (pollutants.no2 !== undefined) {
    aqis.push({ value: calculateAQI(pollutants.no2, 'no2'), name: 'NO₂' });
  }

  if (aqis.length === 0) {
    return { aqi: 0, pollutant: 'None' };
  }

  // Return highest AQI
  aqis.sort((a, b) => b.value - a.value);
  return { aqi: aqis[0].value, pollutant: aqis[0].name };
}

/**
 * Validate AQI value
 */
export function validateAQI(aqi: number): { valid: boolean; message?: string } {
  if (aqi < 0) {
    return { valid: false, message: 'AQI cannot be negative' };
  }

  if (aqi > 500) {
    return { valid: false, message: 'AQI exceeds maximum value of 500' };
  }

  if (!Number.isFinite(aqi)) {
    return { valid: false, message: 'AQI must be a finite number' };
  }

  return { valid: true };
}