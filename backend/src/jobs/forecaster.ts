/**
 * Forecaster Job
 * Runs ML predictions every hour for all active devices
 */

import cron from 'node-cron';
import { db } from '../lib/db';
import { aqiForecaster } from '../ml/aqi-forecast-model';

export function startForecaster() {
  // Run every hour at :30
  cron.schedule('30 * * * *', async () => {
    console.log('[FORECASTER] Running AQI predictions...');
    await generateForecasts();
  });

  console.log('✅ Forecaster job scheduled');
}

async function generateForecasts() {
  try {
    const devices = await db.device.findMany({
      where: {
        active: true,
        lastSeen: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Active in last 24h
        },
      },
    });

    let successCount = 0;

    for (const device of devices) {
      try {
        const forecast = await aqiForecaster.forecast({ deviceId: device.id });

        if (!forecast) continue;

        // Store predictions
        for (const pred of forecast.predictions) {
          await db.prediction.create({
            data: {
              deviceId: device.id,
              predictedFor: pred.timestamp,
              aqiForecast: pred.aqi,
              aqiCategory: pred.category,
              confidence: forecast.confidence,
              modelVersion: forecast.modelVersion,
              features: {
                lookback_hours: 24,
              },
            },
          });
        }

        successCount++;
      } catch (error) {
        console.error(`[FORECASTER] Error for device ${device.id}:`, error);
      }
    }

    console.log(`[FORECASTER] Generated forecasts for ${successCount}/${devices.length} devices`);
  } catch (error) {
    console.error('[FORECASTER] Error in forecast job:', error);
  }
}