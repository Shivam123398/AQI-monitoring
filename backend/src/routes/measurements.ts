import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db';

const querySchema = z.object({
  device_id: z.string().optional(),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  limit: z.string().transform(Number).optional(),
});

const measurementRoutes: FastifyPluginAsync = async (server) => {
  server.get('/', async (request, reply) => {
    try {
      const query = querySchema.parse(request.query);

      const measurements = await db.measurement.findMany({
        where: {
          deviceId: query.device_id,
          measuredAt: {
            gte: query.start ? new Date(query.start) : undefined,
            lte: query.end ? new Date(query.end) : undefined,
          },
        },
        orderBy: { measuredAt: 'desc' },
        take: query.limit || 100,
        include: {
          device: {
            select: {
              id: true,
              name: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      });

      return reply.send({
        count: measurements.length,
        data: measurements,
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.code(400).send({ error: error.message });
    }
  });

  server.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const measurement = await db.measurement.findUnique({
      where: { id },
      include: { device: true },
    });

    if (!measurement) {
      return reply.code(404).send({ error: 'Measurement not found' });
    }

    return reply.send(measurement);
  });

  // CSV Export
  server.get('/export/csv', async (request, reply) => {
    const query = querySchema.parse(request.query);

    const measurements = await db.measurement.findMany({
      where: {
        deviceId: query.device_id,
        measuredAt: {
          gte: query.start ? new Date(query.start) : undefined,
          lte: query.end ? new Date(query.end) : undefined,
        },
      },
      orderBy: { measuredAt: 'asc' },
      take: query.limit || 10000,
    });

    // Build CSV
    const headers = [
      'timestamp',
      'device_id',
      'iaq_score',
      'co2_equiv',
      'temperature',
      'humidity',
      'pressure_hpa',
      'pm25_api',
      'aqi_calculated',
      'aqi_category',
    ];

    const rows = measurements.map((m) => [
      m.measuredAt.toISOString(),
      m.deviceId,
      m.iaqScore ?? '',
      m.co2Equiv ?? '',
      m.temperature ?? '',
      m.humidity ?? '',
      m.pressureHpa ?? '',
      m.pm25Api ?? '',
      m.aqiCalculated ?? '',
      m.aqiCategory ?? '',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="aeroguard-export.csv"');
    return reply.send(csv);
  });
};

export default measurementRoutes;