import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // Database
  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL,

  // Security
  jwtSecret: process.env.JWT_SECRET!,
  apiKeySalt: process.env.API_KEY_SALT!,

  // External APIs (optional for demo)
  openWeatherApiKey: process.env.OPENWEATHER_API_KEY, // made optional
  airVisualApiKey: process.env.AIRVISUAL_API_KEY,

  // Email/Alerts
  resendApiKey: process.env.RESEND_API_KEY, // optional if Gmail/SMTP provided
  gmailUser: process.env.GMAIL_USER,
  gmailPass: process.env.GMAIL_PASS,
  smtpHost: process.env.SMTP_HOST,
  smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined,
  smtpSecure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : undefined,
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  emailFrom: process.env.EMAIL_FROM,
  appUrl: process.env.APP_URL || 'http://localhost:3000',

  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN, // optional
  telegramAlertChatId: process.env.TELEGRAM_ALERT_CHAT_ID,
  enableTelegram: process.env.ENABLE_TELEGRAM !== 'false',

  // ML
  mlModelPath: process.env.ML_MODEL_PATH || './models',
  enableMlPredictions: process.env.ENABLE_ML_PREDICTIONS === 'true',

  // Jobs
  enableJobs: process.env.ENABLE_JOBS !== 'false',
};

// Validation (relaxed: only core secrets are required)
const required = ['databaseUrl', 'jwtSecret', 'apiKeySalt'] as const;
for (const key of required) {
  if (!config[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}
