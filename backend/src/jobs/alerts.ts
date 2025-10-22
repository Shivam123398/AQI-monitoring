/**
 * Alert Engine
 * Evaluates thresholds and sends notifications via configured channels
 */

import cron from 'node-cron';
import { db } from '../lib/db';
import { sendTelegramAlert } from '../services/telegram-bot';
import { sendEmailAlert } from '../services/email-service';

interface AlertRule {
  id: string;
  userId: string;
  deviceId: string;
  thresholds: {
    aqi?: number;
    pm25?: number;
    iaq?: number;
  };
  channels: string[];
  cooldownMin: number;
  lastAlertTime?: Date;
}

export function startAlerts() {
  // Check every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await evaluateAlerts();
  });

  console.log('✅ Alert engine scheduled');
}

async function evaluateAlerts() {
  try {
    const subscriptions = await db.alertSubscription.findMany({
      where: { active: true, alertType: 'threshold' },
      include: { user: true, device: true },
    });

    for (const sub of subscriptions) {
      // Check cooldown
      const lastAlert = await db.alert.findFirst({
        where: { subscriptionId: sub.id },
        orderBy: { sentAt: 'desc' },
      });

      if (lastAlert) {
        const minutesSinceLastAlert = (Date.now() - lastAlert.sentAt.getTime()) / 1000 / 60;
        if (minutesSinceLastAlert < sub.cooldownMin) continue;
      }

      // Get latest measurement
      const latestMeasurement = await db.measurement.findFirst({
        where: { deviceId: sub.deviceId! },
        orderBy: { measuredAt: 'desc' },
      });

      if (!latestMeasurement) continue;

      // Evaluate thresholds
      const thresholds = sub.thresholds as any;
      let triggered = false;
      let message = '';
      let severity = 'info';

      if (thresholds.aqi && latestMeasurement.aqiCalculated! > thresholds.aqi) {
        triggered = true;
        severity = latestMeasurement.aqiCalculated! > 200 ? 'emergency' : 'alert';
        message = `🚨 AQI Alert: Current AQI is ${latestMeasurement.aqiCalculated} (threshold: ${thresholds.aqi}) at ${sub.device?.name || 'your location'}`;
      }

      if (!triggered) continue;

      // Send alert via configured channels
      const channels = sub.channels as string[];

      if (channels.includes('telegram') && sub.user.telegramId) {
        await sendTelegramAlert(sub.user.telegramId, message, latestMeasurement);
      }

      if (channels.includes('email') && sub.user.email) {
        await sendEmailAlert(sub.user.email, message, latestMeasurement);
      }

      // Log alert
      await db.alert.create({
        data: {
          measurementId: latestMeasurement.id,
          subscriptionId: sub.id,
          severity,
          message,
          payload: {
            aqi: latestMeasurement.aqiCalculated,
            category: latestMeasurement.aqiCategory,
            deviceName: sub.device?.name,
          },
        },
      });
    }
  } catch (error) {
    console.error('[ALERTS] Error evaluating alerts:', error);
  }
}