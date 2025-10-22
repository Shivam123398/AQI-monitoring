/**
 * Health Analyzer Job
 * Calculates weekly health risk reports for subscribed users
 */

import cron from 'node-cron';
import { db } from '../lib/db';
import { analyzeHealthRisk } from '../ml/health-risk-model';

export function startHealthAnalyzer() {
  // Run daily at 06:00
  cron.schedule('0 6 * * *', async () => {
    console.log('[HEALTH] Analyzing health risks...');
    await generateHealthReports();
  });

  console.log('✅ Health analyzer job scheduled');
}

async function generateHealthReports() {
  try {
    // Get all users with active alert subscriptions
    const users = await db.user.findMany({
      where: { active: true },
      include: {
        alertSubs: {
          where: { active: true, alertType: 'health_risk' },
          include: { device: true },
        },
      },
    });

    let reportCount = 0;

    for (const user of users) {
      for (const sub of user.alertSubs) {
        if (!sub.deviceId) continue;

        const analysis = await analyzeHealthRisk({
          deviceId: sub.deviceId,
          userId: user.id,
          periodDays: 7,
        });

        if (!analysis) continue;

        // Store health risk report
        await db.healthRisk.create({
          data: {
            deviceId: sub.deviceId,
            userId: user.id,
            periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            periodEnd: new Date(),
            exposureScore: analysis.exposureScore,
            asthmaRisk: analysis.diseaseRisks.asthma_risk,
            copdRisk: analysis.diseaseRisks.copd_risk,
            cardiovascularRisk: analysis.diseaseRisks.cardiovascular_risk,
            allergyRisk: analysis.diseaseRisks.allergy_risk,
            recommendations: analysis.recommendations,
            avgAqi: analysis.stats.avgAqi,
            peakAqi: analysis.stats.peakAqi,
            hoursUnhealthy: analysis.stats.hoursUnhealthy,
          },
        });

        reportCount++;
      }
    }

    console.log(`[HEALTH] Generated ${reportCount} health reports`);
  } catch (error) {
    console.error('[HEALTH] Error in health analyzer:', error);
  }
}