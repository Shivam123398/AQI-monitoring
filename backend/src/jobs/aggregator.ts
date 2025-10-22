/**
 * Data Aggregation Job
 * Creates time-series rollups for efficient querying
 * Runs: Every 15 minutes, hourly, daily
 */

import cron from 'node-cron';
import { db } from '../lib/db';

/**
 * Start all aggregation cron jobs
 */
export function startAggregator() {
  console.log('📊 Starting aggregation jobs...');

  // 15-minute rollup (every 15 minutes)
  cron.schedule('*/15 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running 15-min aggregation...`);
    await aggregate15MinRollup();
  });

  // Hourly rollup (at :05 of each hour)
  cron.schedule('5 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running hourly aggregation...`);
    await aggregateHourlyRollup();
  });

  // Daily rollup (at 00:10 every day)
  cron.schedule('10 0 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running daily aggregation...`);
    await aggregateDailyRollup();
  });

  console.log('✅ Aggregation jobs scheduled');
}

/**
 * 15-Minute Aggregation
 * Aggregates measurements into 15-minute buckets per area/device
 */
async function aggregate15MinRollup() {
  try {
    const now = new Date();
    const periodStart = new Date(Math.floor(now.getTime() / (15 * 60 * 1000)) * (15 * 60 * 1000));
    const periodEnd = new Date(periodStart.getTime() + 15 * 60 * 1000);

    // Get all active devices
    const devices = await db.device.findMany({
      where: { active: true },
      select: { id: true, latitude: true, longitude: true, areaName: true },
    });

    let aggregatedCount = 0;

    for (const device of devices) {
      const measurements = await db.measurement.findMany({
        where: {
          deviceId: device.id,
          measuredAt: {
            gte: periodStart,
            lt: periodEnd,
          },
          aqiCalculated: { not: null },
        },
        select: {
          aqiCalculated: true,
          temperature: true,
          humidity: true,
          pressureHpa: true,
        },
      });

      if (measurements.length === 0) continue;

      // Calculate statistics
      const aqiValues = measurements.map(m => m.aqiCalculated!).sort((a, b) => a - b);
      const tempValues = measurements.map(m => m.temperature).filter(t => t !== null) as number[];
      const humValues = measurements.map(m => m.humidity).filter(h => h !== null) as number[];
      const pressValues = measurements.map(m => m.pressureHpa).filter(p => p !== null) as number[];

      const avgAqi = aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length;
      const maxAqi = Math.max(...aqiValues);
      const minAqi = Math.min(...aqiValues);
      const medianAqi = aqiValues[Math.floor(aqiValues.length / 2)];

      const avgTemp = tempValues.length > 0 ? tempValues.reduce((a, b) => a + b, 0) / tempValues.length : null;
      const avgHumidity = humValues.length > 0 ? humValues.reduce((a, b) => a + b, 0) / humValues.length : null;
      const avgPressure = pressValues.length > 0 ? pressValues.reduce((a, b) => a + b, 0) / pressValues.length : null;

      // Determine area grid (use areaName or lat/lng grid)
      const areaGrid = device.areaName || `${device.latitude?.toFixed(2)},${device.longitude?.toFixed(2)}`;

      // Upsert aggregate
      await db.aggregate.upsert({
        where: {
          areaGrid_periodStart_intervalType: {
            areaGrid,
            periodStart,
            intervalType: '15min',
          },
        },
        create: {
          areaGrid,
          periodStart,
          intervalType: '15min',
          avgAqi,
          maxAqi,
          minAqi,
          medianAqi,
          avgTemp,
          avgHumidity,
          avgPressure,
          deviceCount: 1,
          stats: {
            measurements: measurements.length,
            deviceIds: [device.id],
            stdDeviation: calculateStdDev(aqiValues, avgAqi),
          },
        },
        update: {
          avgAqi,
          maxAqi,
          minAqi,
          medianAqi,
          avgTemp,
          avgHumidity,
          avgPressure,
          stats: {
            measurements: measurements.length,
            deviceIds: [device.id],
            stdDeviation: calculateStdDev(aqiValues, avgAqi),
          },
        },
      });

      aggregatedCount++;
    }

    console.log(`✓ 15-min aggregation completed: ${aggregatedCount} devices processed`);
  } catch (error) {
    console.error('❌ Error in 15-min aggregation:', error);
  }
}

/**
 * Hourly Aggregation
 */
async function aggregateHourlyRollup() {
  try {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - 1, 0, 0);
    const periodEnd = new Date(periodStart.getTime() + 60 * 60 * 1000);

    const devices = await db.device.findMany({
      where: { active: true },
      select: { id: true, areaName: true, latitude: true, longitude: true },
    });

    let aggregatedCount = 0;

    for (const device of devices) {
      const measurements = await db.measurement.findMany({
        where: {
          deviceId: device.id,
          measuredAt: {
            gte: periodStart,
            lt: periodEnd,
          },
          aqiCalculated: { not: null },
        },
        select: {
          aqiCalculated: true,
          temperature: true,
          humidity: true,
          pressureHpa: true,
        },
      });

      if (measurements.length === 0) continue;

      const aqiValues = measurements.map(m => m.aqiCalculated!).sort((a, b) => a - b);
      const avgAqi = aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length;
      const maxAqi = Math.max(...aqiValues);
      const minAqi = Math.min(...aqiValues);
      const medianAqi = aqiValues[Math.floor(aqiValues.length / 2)];

      const areaGrid = device.areaName || `${device.latitude?.toFixed(2)},${device.longitude?.toFixed(2)}`;

      await db.aggregate.upsert({
        where: {
          areaGrid_periodStart_intervalType: {
            areaGrid,
            periodStart,
            intervalType: '1hour',
          },
        },
        create: {
          areaGrid,
          periodStart,
          intervalType: '1hour',
          avgAqi,
          maxAqi,
          minAqi,
          medianAqi,
          deviceCount: 1,
          stats: {
            measurements: measurements.length,
            hour: periodStart.getHours(),
          },
        },
        update: {
          avgAqi,
          maxAqi,
          minAqi,
          medianAqi,
        },
      });

      aggregatedCount++;
    }

    console.log(`✓ Hourly aggregation completed: ${aggregatedCount} devices processed`);
  } catch (error) {
    console.error('❌ Error in hourly aggregation:', error);
  }
}

/**
 * Daily Aggregation
 */
async function aggregateDailyRollup() {
  try {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
    const periodEnd = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000);

    const devices = await db.device.findMany({
      where: { active: true },
      select: { id: true, areaName: true, latitude: true, longitude: true },
    });

    let aggregatedCount = 0;

    for (const device of devices) {
      const measurements = await db.measurement.findMany({
        where: {
          deviceId: device.id,
          measuredAt: {
            gte: periodStart,
            lt: periodEnd,
          },
          aqiCalculated: { not: null },
        },
        select: {
          aqiCalculated: true,
          temperature: true,
          humidity: true,
          pressureHpa: true,
        },
      });

      if (measurements.length === 0) continue;

      const aqiValues = measurements.map(m => m.aqiCalculated!).sort((a, b) => a - b);
      const avgAqi = aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length;
      const maxAqi = Math.max(...aqiValues);
      const minAqi = Math.min(...aqiValues);
      const medianAqi = aqiValues[Math.floor(aqiValues.length / 2)];

      // Calculate percentiles
      const p25 = aqiValues[Math.floor(aqiValues.length * 0.25)];
      const p75 = aqiValues[Math.floor(aqiValues.length * 0.75)];
      const p95 = aqiValues[Math.floor(aqiValues.length * 0.95)];

      const areaGrid = device.areaName || `${device.latitude?.toFixed(2)},${device.longitude?.toFixed(2)}`;

      await db.aggregate.upsert({
        where: {
          areaGrid_periodStart_intervalType: {
            areaGrid,
            periodStart,
            intervalType: '1day',
          },
        },
        create: {
          areaGrid,
          periodStart,
          intervalType: '1day',
          avgAqi,
          maxAqi,
          minAqi,
          medianAqi,
          deviceCount: 1,
          stats: {
            measurements: measurements.length,
            percentiles: { p25, p75, p95 },
            stdDeviation: calculateStdDev(aqiValues, avgAqi),
          },
        },
        update: {
          avgAqi,
          maxAqi,
          minAqi,
          medianAqi,
          stats: {
            measurements: measurements.length,
            percentiles: { p25, p75, p95 },
            stdDeviation: calculateStdDev(aqiValues, avgAqi),
          },
        },
      });

      aggregatedCount++;
    }

    console.log(`✓ Daily aggregation completed: ${aggregatedCount} devices processed`);

    // Cleanup old aggregates (keep last 90 days)
    await cleanupOldAggregates();

  } catch (error) {
    console.error('❌ Error in daily aggregation:', error);
  }
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[], mean: number): number {
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Cleanup old aggregate data
 */
async function cleanupOldAggregates() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  const deleted = await db.aggregate.deleteMany({
    where: {
      periodStart: {
        lt: cutoffDate,
      },
    },
  });

  console.log(`✓ Cleaned up ${deleted.count} old aggregate records`);
}