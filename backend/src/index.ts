import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { config } from './config';
import { db } from './lib/db';
import { startTelegramBot } from './services/telegram-bot';

// Routes
import ingestRoutes from './routes/ingest';
import measurementRoutes from './routes/measurements';
import deviceRoutes from './routes/devices';
import predictionRoutes from './routes/predictions';
import healthRoutes from './routes/health';
import publicRoutes from './routes/public';
import alertsRoutes from './routes/alerts';

const server = Fastify({
  logger: {
    level: config.logLevel,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
});

async function start() {
  try {
    // Security plugins
    await server.register(helmet, {
      contentSecurityPolicy: false, // Customize per deployment
    });

    await server.register(cors, {
      origin: config.corsOrigin.split(','),
      credentials: true,
    });

    await server.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
    });

    await server.register(jwt, {
      secret: config.jwtSecret,
    });

    // Health check
    server.get('/health', async () => {
      const dbStatus = await db.$queryRaw`SELECT 1 as alive`;
      return {
        status: 'ok',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        database: dbStatus ? 'connected' : 'disconnected',
      };
    });

    // Register routes
    server.register(ingestRoutes, { prefix: '/api/v1/ingest' });
    server.register(measurementRoutes, { prefix: '/api/v1/measurements' });
    server.register(deviceRoutes, { prefix: '/api/v1/devices' });
    server.register(predictionRoutes, { prefix: '/api/v1/predictions' });
    server.register(healthRoutes, { prefix: '/api/v1/health' });
    server.register(publicRoutes, { prefix: '/api/v1/public' });
    server.register(alertsRoutes, { prefix: '/api/v1/alerts' });

    // Start server
    await server.listen({ port: config.port, host: '0.0.0.0' });
    server.log.info(`🚀 AeroGuard AI Backend running on port ${config.port}`);

    // Start Telegram bot (optional, non-blocking)
    startTelegramBot();

    // Start background jobs (if not using separate workers)
    if (config.enableJobs) {
      const { startAggregator } = await import('./jobs/aggregator');
      const { startForecaster } = await import('./jobs/forecaster');
      const { startAlerts } = await import('./jobs/alerts');

      startAggregator();
      startForecaster();
      startAlerts();
      server.log.info('📊 Background jobs started');
    }

  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
const shutdown = async (signal: string) => {
  server.log.info(`Received ${signal}, shutting down gracefully...`);
  await server.close();
  await db.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
