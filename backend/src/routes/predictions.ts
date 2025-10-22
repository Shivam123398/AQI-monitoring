import { FastifyPluginAsync } from 'fastify';
import { db } from '../lib/db';
import { aqiForecaster } from '../ml/aqi-forecast-model';

const predictionRoutes: FastifyPluginAsync = async (server) => {
  // Get predictions for a device
  server.get('/:deviceId', async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };

    const predictions = await db.prediction.findMany({
      where: {
        deviceId,
        predictedFor: { gte: new Date() },
      },
      orderBy: { predictedFor: 'asc' },
      take: 24,
    });

    return reply.send({ count: predictions.length, data: predictions });
  });

  // Generate forecast on-demand
  server.post('/:deviceId/forecast', async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };

    const forecast = await aqiForecaster.forecast({ deviceId });

    if (!forecast) {
      return reply.code(400).send({ error: 'Insufficient data for forecast' });
    }

    return reply.send(forecast);
  });
};

export default predictionRoutes;