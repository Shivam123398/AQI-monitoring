import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db';
import { generateAPIKey } from '../lib/hmac';
import { config } from '../config';

// Convert BigInt fields in nested measurements for JSON safety
function serializeMeasurement(m: any) {
  return {
    ...m,
    uptime: m.uptime != null ? Number(m.uptime) : null,
  };
}

const deviceRoutes: FastifyPluginAsync = async (server) => {
  // List devices with minimal fields and latest measurement
  server.get('/', async (request, reply) => {
    const devices = await db.device.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        areaName: true,
        active: true,
        lastSeen: true,
        firmwareVersion: true,
        measurements: {
          orderBy: { measuredAt: 'desc' },
          take: 1,
          select: {
            id: true,
            measuredAt: true,
            aqiCalculated: true,
            iaqScore: true,
            temperature: true,
            humidity: true,
            pressureHpa: true,
            uptime: true,
          },
        },
      },
    });

    const data = devices.map((d) => {
      const latest = (d as any).measurements?.[0];
      return {
        id: d.id,
        name: d.name,
        latitude: d.latitude,
        longitude: d.longitude,
        areaName: d.areaName,
        active: d.active,
        lastSeen: d.lastSeen ?? latest?.measuredAt ?? null,
        firmwareVersion: d.firmwareVersion,
        currentAqi: latest?.aqiCalculated ?? null,
        currentIaq: latest?.iaqScore ?? null,
        temperature: latest?.temperature ?? null,
        humidity: latest?.humidity ?? null,
      };
    });

    return reply.send({ count: data.length, data });
  });

  // Get device details with latest 100 measurements
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

    const serialized = {
      ...device,
      measurements: (device.measurements || []).map(serializeMeasurement),
    } as any;

    return reply.send(serialized);
  });

  // Register new device (admin-lite; add auth in production)
  server.post('/register', async (request, reply) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        areaName: z.string().optional(),
      });

      // Accept numbers or strings for lat/lon
      const raw = request.body as any;
      const parsed = schema.parse({
        name: raw?.name,
        latitude: raw?.latitude != null ? Number(raw.latitude) : undefined,
        longitude: raw?.longitude != null ? Number(raw.longitude) : undefined,
        areaName: raw?.areaName,
      });

      const deviceKey = generateAPIKey(parsed.name, config.apiKeySalt);

      const device = await db.device.create({
        data: {
          name: parsed.name,
          deviceKey,
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          areaName: parsed.areaName,
          lastSeen: new Date(),
          active: true,
        },
      });

      return reply.code(201).send({
        message: 'Device registered successfully',
        device_id: device.id,
        device_key: deviceKey,
        name: device.name,
      });
    } catch (err: any) {
      server.log.error(err);
      return reply.code(400).send({ error: err?.message || 'Invalid request' });
    }
  });
};

export default deviceRoutes;
