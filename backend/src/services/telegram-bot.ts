import { Telegraf } from 'telegraf';
import { config } from '../config';
import { db } from '../lib/db';

const bot = new Telegraf(config.telegramBotToken);

// Bot commands
bot.start(async (ctx) => {
  const telegramId = ctx.from.id.toString();
  
  await ctx.reply(
    '🌬️ Welcome to AeroGuard AI!\n\n' +
    'I will send you real-time air quality alerts.\n\n' +
    'Commands:\n' +
    '/register <email> - Link your account\n' +
    '/status - Check current air quality\n' +
    '/forecast - See 24-hour prediction\n' +
    '/health - View health risk report\n' +
    '/stop - Unsubscribe from alerts'
  );
});

bot.command('register', async (ctx) => {
  const email = ctx.message.text.split(' ')[1];
  
  if (!email) {
    return ctx.reply('Usage: /register your.email@example.com');
  }

  const telegramId = ctx.from.id.toString();

  try {
    await db.user.update({
      where: { email },
      data: { telegramId },
    });

    await ctx.reply('✅ Account linked! You will now receive alerts on Telegram.');
  } catch (error) {
    await ctx.reply('❌ Email not found. Please sign up on the web dashboard first.');
  }
});

bot.command('status', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const user = await db.user.findUnique({ where: { telegramId } });

  if (!user) {
    return ctx.reply('Please register first: /register your.email@example.com');
  }

  // Get user's nearest device or subscribed device
  const subscription = await db.alertSubscription.findFirst({
    where: { userId: user.id },
    include: { device: true },
  });

  if (!subscription?.device) {
    return ctx.reply('No device found. Please configure alerts in the dashboard.');
  }

  const latest = await db.measurement.findFirst({
    where: { deviceId: subscription.deviceId! },
    orderBy: { measuredAt: 'desc' },
  });

  if (!latest) {
    return ctx.reply('No recent data available.');
  }

  const emoji = getAQIEmoji(latest.aqiCalculated || 0);
  
  await ctx.reply(
    `${emoji} Current Air Quality - ${subscription.device.name}\n\n` +
    `🔢 AQI: ${latest.aqiCalculated}\n` +
    `📊 Category: ${latest.aqiCategory?.replace('_', ' ').toUpperCase()}\n` +
    `🌡️ Temperature: ${latest.temperature}°C\n` +
    `💧 Humidity: ${latest.humidity}%\n` +
    `⏰ Updated: ${latest.measuredAt.toLocaleString()}`
  );
});

bot.command('forecast', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const user = await db.user.findUnique({ where: { telegramId } });

  if (!user) {
    return ctx.reply('Please register first: /register your.email@example.com');
  }

  const subscription = await db.alertSubscription.findFirst({
    where: { userId: user.id },
    include: { device: true },
  });

  if (!subscription?.deviceId) {
    return ctx.reply('No device configured.');
  }

  const predictions = await db.prediction.findMany({
    where: {
      deviceId: subscription.deviceId,
      predictedFor: { gte: new Date() },
    },
    orderBy: { predictedFor: 'asc' },
    take: 24,
  });

  if (predictions.length === 0) {
    return ctx.reply('No forecast available yet. Check back in an hour.');
  }

  let message = `📈 24-Hour AQI Forecast - ${subscription.device?.name}\n\n`;

  predictions.slice(0, 6).forEach((p, i) => {
    const hour = new Date(p.predictedFor).getHours();
    const emoji = getAQIEmoji(p.aqiForecast);
    message += `${emoji} ${hour}:00 - AQI ${Math.round(p.aqiForecast)} (${p.aqiCategory})\n`;
  });

  message += `\n💡 Confidence: ${Math.round(predictions[0].confidence * 100)}%`;

  await ctx.reply(message);
});

// Launch bot
bot.launch();
console.log('✅ Telegram bot running');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Helper: Send alert to user
export async function sendTelegramAlert(telegramId: string, message: string, measurement: any) {
  try {
    const emoji = getAQIEmoji(measurement.aqiCalculated || 0);
    const fullMessage = `${emoji} ${message}\n\n🔗 View details: https://app.aeroguard.ai`;
    
    await bot.telegram.sendMessage(telegramId, fullMessage);
  } catch (error) {
    console.error('Telegram send error:', error);
  }
}

function getAQIEmoji(aqi: number): string {
  if (aqi <= 50) return '✅';
  if (aqi <= 100) return '⚠️';
  if (aqi <= 150) return '🟠';
  if (aqi <= 200) return '🔴';
  if (aqi <= 300) return '🟣';
  return '🟤';
}