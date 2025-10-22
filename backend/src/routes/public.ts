import { FastifyPluginAsync } from 'fastify';
import { db } from '../lib/db';

const publicRoutes: FastifyPluginAsync = async (server) => {
  // Public city-wide dashboard data
  server.get('/city/:cityName', async (request, reply) => {
    const { cityName } = request.params as { cityName: string };

    const devices = await db.device.findMany({
      where: {
        areaName: { contains: cityName, mode: 'insensitive' },
        active: true,
      },
    });

    const deviceIds = devices.map((d) => d.id);

    const latestMeasurements = await Promise.all(
      deviceIds.map((id) =>
        db.measurement.findFirst({
          where: { deviceId: id },
          orderBy: { measuredAt: 'desc' },
        })
      )
    );

    const aqiValues = latestMeasurements
      .filter((m) => m?.aqiCalculated)
      .map((m) => m!.aqiCalculated!);

    const avgAqi = aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length || 0;

    return reply.send({
      city: cityName,
      deviceCount: devices.length,
      avgAqi: Math.round(avgAqi),
      maxAqi: Math.max(...aqiValues, 0),
      minAqi: Math.min(...aqiValues, 0),
      devices: devices.map((d, i) => ({
        id: d.id,
        name: d.name,
        latitude: d.latitude,
        longitude: d.longitude,
        currentAqi: latestMeasurements[i]?.aqiCalculated,
      })),
    });
  });

  // OpenAPI spec
  server.get('/openapi.yaml', async (request, reply) => {
    const spec = `
openapi: 3.0.0
info:
  title: AeroGuard AI Public API
  version: 1.0.0
  description: Municipal air quality integration API
servers:
  - url: https://api.aeroguard.ai/api/v1
paths:
  /public/city/{cityName}:
    get:
      summary: Get city-wide air quality summary
      parameters:
        - name: cityName
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  city:
                    type: string
                  avgAqi:
                    type: number
                  deviceCount:
                    type: integer
    `;

    reply.header('Content-Type', 'text/yaml');
    return reply.send(spec);
  });
};

export default publicRoutes;