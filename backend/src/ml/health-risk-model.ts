/**
 * Health Risk Analyzer
 * Calculates personalized disease risk scores based on exposure patterns
 */

import { db } from '../lib/db';

interface HealthRiskInput {
  deviceId?: string;
  userId?: string;
  periodDays?: number;
}

interface DiseaseRisk {
  asthma_risk: number;
  copd_risk: number;
  cardiovascular_risk: number;
  allergy_risk: number;
}

interface HealthRiskOutput {
  exposureScore: number;
  diseaseRisks: DiseaseRisk;
  recommendations: string[];
  stats: {
    avgAqi: number;
    peakAqi: number;
    hoursUnhealthy: number;
    periodDays: number;
  };
}

export async function analyzeHealthRisk(input: HealthRiskInput): Promise<HealthRiskOutput | null> {
  const periodDays = input.periodDays || 7;
  const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  // Fetch measurements
  const measurements = await db.measurement.findMany({
    where: {
      deviceId: input.deviceId,
      measuredAt: { gte: startDate },
      aqiCalculated: { not: null },
    },
    orderBy: { measuredAt: 'asc' },
  });

  if (measurements.length === 0) return null;

  // Calculate exposure metrics
  const aqiValues = measurements.map((m) => m.aqiCalculated!);
  const avgAqi = aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length;
  const peakAqi = Math.max(...aqiValues);
  const hoursUnhealthy = measurements.filter((m) => m.aqiCalculated! > 100).length;

  // Exposure score (0-100)
  const exposureScore = Math.min(100, avgAqi * 0.5 + (hoursUnhealthy / measurements.length) * 100);

  // Calculate disease risks (WHO-based correlations)
  const diseaseRisks = calculateDiseaseRisks({
    avgPm25: avgAqi / 2, // Rough PM2.5 estimate from AQI
    peakPm25: peakAqi / 2,
    hoursUnhealthy,
    durationDays: periodDays,
  });

  // Generate recommendations
  const recommendations = generateRecommendations(exposureScore, diseaseRisks, avgAqi);

  return {
    exposureScore: Math.round(exposureScore),
    diseaseRisks,
    recommendations,
    stats: {
      avgAqi: Math.round(avgAqi),
      peakAqi,
      hoursUnhealthy,
      periodDays,
    },
  };
}

function calculateDiseaseRisks(exposure: {
  avgPm25: number;
  peakPm25: number;
  hoursUnhealthy: number;
  durationDays: number;
}): DiseaseRisk {
  const { avgPm25, peakPm25, hoursUnhealthy } = exposure;

  // Asthma: Strong PM2.5 correlation
  const asthmaBase = Math.min(100, (avgPm25 / 35.0) * 50);
  const asthmaPeakFactor = 1 + (peakPm25 / 100.0) * 0.5;
  const asthma_risk = Math.min(100, asthmaBase * asthmaPeakFactor);

  // COPD: Long-term exposure
  const copd_risk = Math.min(100, (avgPm25 / 50.0) * 40 + (hoursUnhealthy / 720.0) * 30);

  // Cardiovascular: Acute + chronic
  const cardiovascular_risk = Math.min(100, (avgPm25 / 40.0) * 35 + (peakPm25 / 150.0) * 40);

  // Allergy: Moderate correlation
  const allergy_risk = Math.min(100, (avgPm25 / 30.0) * 30);

  return {
    asthma_risk: Math.round(asthma_risk * 10) / 10,
    copd_risk: Math.round(copd_risk * 10) / 10,
    cardiovascular_risk: Math.round(cardiovascular_risk * 10) / 10,
    allergy_risk: Math.round(allergy_risk * 10) / 10,
  };
}

function generateRecommendations(exposureScore: number, risks: DiseaseRisk, avgAqi: number): string[] {
  const recs: string[] = [];

  // General air quality
  if (avgAqi > 150) {
    recs.push('🚨 URGENT: Air quality is hazardous. Stay indoors with air purifier running.');
    recs.push('Close all windows and seal gaps. Avoid all outdoor activities.');
  } else if (avgAqi > 100) {
    recs.push('⚠️ Air quality is unhealthy. Limit outdoor time, especially strenuous activity.');
    recs.push('Consider wearing N95/KN95 mask if you must go outside.');
  } else if (avgAqi > 50) {
    recs.push('👤 Sensitive groups should reduce prolonged outdoor exertion.');
  }

  // Disease-specific
  if (risks.asthma_risk > 60) {
    recs.push('🫁 High asthma risk detected. Ensure rescue inhaler is accessible. Consult pulmonologist if symptoms worsen.');
  } else if (risks.asthma_risk > 40) {
    recs.push('Keep asthma medication handy. Monitor for wheezing or chest tightness.');
  }

  if (risks.cardiovascular_risk > 50) {
    recs.push('❤️ Elevated cardiovascular risk. Avoid strenuous exercise outdoors. Monitor blood pressure.');
  }

  if (risks.copd_risk > 50) {
    recs.push('🫁 COPD risk elevated. Use prescribed oxygen therapy as directed. Seek medical advice.');
  }

  if (risks.allergy_risk > 40) {
    recs.push('🤧 Allergy risk increased. Consider antihistamines. Keep windows closed during peak pollution hours.');
  }

  // Indoor air quality
  recs.push('🏠 Use HEPA air purifiers indoors. Maintain humidity between 30-50%.');

  // Nutrition (evidence-based)
  if (exposureScore > 60) {
    recs.push('🥗 Increase antioxidant intake: berries, green leafy vegetables, vitamin C & E.');
    recs.push('💧 Stay well-hydrated to help your body flush out pollutants.');
  }

  return recs;
}