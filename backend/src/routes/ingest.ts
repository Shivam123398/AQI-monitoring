import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db';
import { verifyHMAC } from '../lib/hmac';
import { calculateAQI, getAQICategory } from '../lib/aqi';
import { events } from '../lib/events';
import { fetchOpenWeatherAirQuality } from '../lib/external-api';

const ingestSchema = z.object({
  device_id: z.string(),
  firmware_version: z.string().optional(),
  timestamp: z.number(),
  sensors: z.object({
    mq135_raw: z.number().optional(),
    iaq_score: z.number().optional(),
    co2_equiv: z.number().optional(),
    temperature: z.number().optional(),
    humidity: z.number().optional(),
    pressure_hpa: z.number().optional(),
    altitude_m: z.number().optional(),
  }),
  meta: z.object({
    uptime_ms: z.number().optional(),
    rssi: z.number().optional(),
    free_heap: z.number().optional(),
  }).optional(),
  signature: z.string().optional(),
});

const ingestRoutes: FastifyPluginAsync = async (server) => {
  server.post('/', async (request, reply) => {
    try {
      const body = ingestSchema.parse(request.body);

      // Verify device exists
      const device = await db.device.findFirst({
        where: { id: body.device_id },
      });

      if (!device) {
        return reply.code(404).send({ error: 'Device not found' });
      }

      // Verify HMAC signature if enabled
      if (body.signature) {
        const payloadWithoutSig = { ...body };
        delete (payloadWithoutSig as any).signature;
        const payloadStr = JSON.stringify(payloadWithoutSig);
        
        const valid = verifyHMAC(payloadStr, body.signature, device.deviceKey);
        if (!valid) {
          return reply.code(401).send({ error: 'Invalid signature' });
        }
      }

      // Fetch external air quality data (if device has location)
      let externalData: any = {};
      let pm25Api: number | null = null;

      if (device.latitude && device.longitude) {
        const owData = await fetchOpenWeatherAirQuality(device.latitude, device.longitude);
        if (owData) {
          externalData.openweather = owData;
          pm25Api = owData.pm2_5 || null;
        }
      }

      // Calculate AQI (use API PM2.5 if available, otherwise estimate from IAQ)
  let aqiCalculated: number | null = null;
  let aqiCategory: string | null = null;

      if (pm25Api !== null) {
        aqiCalculated = calculateAQI(pm25Api, 'pm25');
        const cat = getAQICategory(aqiCalculated);
        // Store category as slug string matching schema comment
        aqiCategory = ['','good','moderate','unhealthy_sensitive','unhealthy','very_unhealthy','hazardous'][cat.level] || cat.name.toLowerCase();
      } else if (body.sensors.iaq_score) {
        // Rough IAQ → AQI mapping (not scientifically accurate!)
        const estimatedPM25 = Math.max(0, (body.sensors.iaq_score - 50) * 0.5);
        aqiCalculated = calculateAQI(estimatedPM25, 'pm25');
        const cat = getAQICategory(aqiCalculated);
        aqiCategory = ['','good','moderate','unhealthy_sensitive','unhealthy','very_unhealthy','hazardous'][cat.level] || cat.name.toLowerCase();
      }

      // Insert measurement
      const measurement = await db.measurement.create({
        data: {
          deviceId: device.id,
          measuredAt: new Date(body.timestamp * 1000),
          mq135Raw: body.sensors.mq135_raw,
          iaqScore: body.sensors.iaq_score,
          co2Equiv: body.sensors.co2_equiv,
          temperature: body.sensors.temperature,
          humidity: body.sensors.humidity,
          pressureHpa: body.sensors.pressure_hpa,
          altitudeM: body.sensors.altitude_m,
          pm25Api: pm25Api,
          aqiCalculated: aqiCalculated,
          aqiCategory: aqiCategory,
          externalData: externalData,
          qualityFlags: {
            sensor_warmed_up: true,
            dht22_valid: body.sensors.temperature !== null,
            bmp180_valid: body.sensors.pressure_hpa !== null,
            mq135_in_range: body.sensors.iaq_score ? body.sensors.iaq_score >= 10 && body.sensors.iaq_score <= 500 : false,
            overall_valid: true,
          },
          rssi: body.meta?.rssi,
          uptime: body.meta?.uptime_ms ? BigInt(body.meta.uptime_ms) : null,
        },
      });

      // Update device last seen
      await db.device.update({
        where: { id: device.id },
        data: {
          lastSeen: new Date(),
          firmwareVersion: body.firmware_version,
        },
      });

      const responsePayload = {
        success: true,
        measurement_id: measurement.id,
        aqi: aqiCalculated,
        category: aqiCategory,
      };

      // Emit live update event (non-blocking)
      try {
        events.emit('measurement:new', {
          deviceId: device.id,
          deviceName: device.name,
          measuredAt: measurement.measuredAt.toISOString(),
          aqiCalculated: measurement.aqiCalculated ?? null,
          iaqScore: measurement.iaqScore ?? null,
          temperature: measurement.temperature ?? null,
          humidity: measurement.humidity ?? null,
          pressureHpa: measurement.pressureHpa ?? null,
        });
      } catch (e) {
        server.log.warn({ err: e }, 'Failed to emit live measurement event');
      }

      return reply.code(201).send(responsePayload);

    } catch (error: any) {
      server.log.error(error);
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Invalid payload', details: error.errors });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};

export default ingestRoutes;