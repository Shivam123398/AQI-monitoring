import { FastifyPluginAsync } from 'fastify';
import { db } from '../lib/db';
import { generateAPIKey } from '../lib/hmac';
import { config } from '../config';

const deviceRoutes: FastifyPluginAsync = async (server) => {
  // List all devices
  server.get('/', async (request, reply) => {
    const devices = await db.device.findMany({
      where: { active: true },
      orderBy: { lastSeen: 'desc' },
      include: {
        measurements: {
          orderBy: { measuredAt: 'desc' },
          take: 1,
        },
      },
    });

    // Transform to include current AQI
    const devicesWithAQI = devices.map((device) => ({
      ...device,
      currentAqi: device.measurements[0]?.aqiCalculated ?? null,
      latestMeasurement: device.measurements[0] ?? null,
      measurements: undefined, // Remove the measurements array from response
    }));

    return reply.send({ count: devicesWithAQI.length, data: devicesWithAQI });
  });

  // Get device details
  server.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const device = await db.device.findUnique({
      where: { id },
      include: {
        measurements: {
          orderBy: { measuredAt: 'desc' },
          take: 100,
        },
      },
    });

    if (!device) {
      return reply.code(404).send({ error: 'Device not found' });
    }

    return reply.send(device);
  });

  // Register new device (admin only - add JWT auth in production)
  server.post('/register', async (request, reply) => {
    const { name, latitude, longitude, areaName } = request.body as any;

    const deviceKey = generateAPIKey(name, config.apiKeySalt);

    const device = await db.device.create({
      data: {
        name,
        deviceKey,
        latitude,
        longitude,
        areaName,
        active: true,
      },
    });

    return reply.code(201).send({
      device_id: device.id,
      device_key: deviceKey,
      message: 'Device registered successfully. Store the device_key securely.',
    });
  });
};

export default deviceRoutes;