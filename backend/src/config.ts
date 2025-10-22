import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3001',

  // Database
  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL,

  // Security
  jwtSecret: process.env.JWT_SECRET!,
  apiKeySalt: process.env.API_KEY_SALT!,

  // External APIs
  openWeatherApiKey: process.env.OPENWEATHER_API_KEY!,
  airVisualApiKey: process.env.AIRVISUAL_API_KEY,

  // Alerts
  resendApiKey: process.env.RESEND_API_KEY!,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN!,
  telegramAlertChatId: process.env.TELEGRAM_ALERT_CHAT_ID,

  // ML
  mlModelPath: process.env.ML_MODEL_PATH || './models',
  enableMlPredictions: process.env.ENABLE_ML_PREDICTIONS === 'true',

  // Jobs
  enableJobs: process.env.ENABLE_JOBS !== 'false', // Default true unless explicitly disabled
};

// Validation
const required = ['databaseUrl', 'jwtSecret', 'apiKeySalt', 'openWeatherApiKey', 'resendApiKey', 'telegramBotToken'];
for (const key of required) {
  if (!config[key as keyof typeof config]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}