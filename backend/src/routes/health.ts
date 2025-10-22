import { FastifyPluginAsync } from 'fastify';
import { db } from '../lib/db';
import { analyzeHealthRisk } from '../ml/health-risk-model';

const healthRoutes: FastifyPluginAsync = async (server) => {
  // Get health risk report for user
  server.get('/risk/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };

    const reports = await db.healthRisk.findMany({
      where: { userId },
      orderBy: { periodEnd: 'desc' },
      take: 30,
    });

    return reply.send({ count: reports.length, data: reports });
  });

  // Generate health risk analysis
  server.post('/analyze', async (request, reply) => {
    const { deviceId, userId, periodDays } = request.body as any;

    const analysis = await analyzeHealthRisk({ deviceId, userId, periodDays });

    if (!analysis) {
      return reply.code(400).send({ error: 'Insufficient data' });
    }

    return reply.send(analysis);
  });
};

export default healthRoutes;