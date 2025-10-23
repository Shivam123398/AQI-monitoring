import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db';
import { verifyHMAC } from '../lib/hmac';
import { calculateAQI, getAQICategory } from '../lib/aqi';
import { events } from '../lib/events';
import { fetchOpenWeatherAirQuality } from '../lib/external-api';

// Coerce a possibly unit-suffixed string into a number, otherwise return null
function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    // Extract first number incl. sign and decimal
    const match = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const n = Number(match[0]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// Flexible ingest schema: many fields optional because devices may send slightly different shapes
const ingestSchema = z.object({
  device_id: z.string().optional(),
  deviceId: z.string().optional(),
  firmware_version: z.string().optional(),
  timestamp: z.union([z.number(), z.string()]).optional(),
  measuredAt: z.string().optional(),
  measurement_id: z.string().optional(),
  id: z.string().optional(),
  sensors: z.record(z.any()).optional(),
  // also allow top-level metrics if device sends flat payload
  iaq_score: z.union([z.number(), z.string()]).optional(),
  iaq: z.union([z.number(), z.string()]).optional(),
  co2_equiv: z.union([z.number(), z.string()]).optional(),
  co2: z.union([z.number(), z.string()]).optional(),
  temperature: z.union([z.number(), z.string()]).optional(),
  humidity: z.union([z.number(), z.string()]).optional(),
  pressure_hpa: z.union([z.number(), z.string()]).optional(),
  pressure: z.union([z.number(), z.string()]).optional(),
  altitude_m: z.union([z.number(), z.string()]).optional(),
  pm25_api: z.union([z.number(), z.string()]).optional(),
  pm25: z.union([z.number(), z.string()]).optional(),
  meta: z.record(z.any()).optional(),
  signature: z.string().optional(),
});

const ingestRoutes: FastifyPluginAsync = async (server) => {
  server.post('/', async (request, reply) => {
    try {
      const body = ingestSchema.parse(request.body || {});

      const deviceId = body.device_id || body.deviceId;
      if (!deviceId) {
        return reply.code(400).send({ error: 'device_id is required' });
      }

      // Verify device exists
      const device = await db.device.findFirst({ where: { id: deviceId } });
      if (!device) {
        return reply.code(404).send({ error: 'Device not found' });
      }

      // Optional HMAC verification if signature is provided
      if (body.signature) {
        const { signature, ...payloadWithoutSig } = body as any;
        const payloadStr = JSON.stringify(payloadWithoutSig);
        const valid = verifyHMAC(payloadStr, signature, device.deviceKey);
        if (!valid) {
          return reply.code(401).send({ error: 'Invalid signature' });
        }
      }

      // Resolve measuredAt (accept measuredAt ISO, numeric/string timestamp in seconds or ms)
      let measuredAtDate: Date;
      if (body.measuredAt) {
        measuredAtDate = new Date(body.measuredAt);
      } else if (body.timestamp !== undefined) {
        const tsRaw = typeof body.timestamp === 'string' && /^[0-9]+$/.test(body.timestamp)
          ? Number(body.timestamp)
          : body.timestamp;
        if (typeof tsRaw === 'number') {
          measuredAtDate = tsRaw > 1e12 ? new Date(tsRaw) : new Date(tsRaw * 1000);
        } else {
          measuredAtDate = new Date(String(body.timestamp));
        }
      } else {
        measuredAtDate = new Date();
      }
      if (Number.isNaN(measuredAtDate.getTime())) measuredAtDate = new Date();

      // External data (optional)
      let externalData: any = {};
      let pm25Api: number | null = null;
      if (device.latitude && device.longitude) {
        const owData = await fetchOpenWeatherAirQuality(device.latitude, device.longitude);
        if (owData) {
          externalData.openweather = owData;
          pm25Api = owData.pm2_5 || null;
        }
      }

      // Normalize sensor values from multiple possible keys and unit-suffixed strings
      const sensors = body.sensors || {};
      const iaq = num((sensors as any).iaq_score ?? (sensors as any).iaq ?? (body as any).iaq_score ?? (body as any).iaq);
      const co2 = num((sensors as any).co2_equiv ?? (sensors as any).co2 ?? (body as any).co2_equiv ?? (body as any).co2);
      const temp = num((sensors as any).temperature ?? (body as any).temperature);
      const humidity = num((sensors as any).humidity ?? (body as any).humidity);
      const pressure = num((sensors as any).pressure_hpa ?? (sensors as any).pressure ?? (body as any).pressure_hpa ?? (body as any).pressure);
      const altitude =
        num((sensors as any).altitude_m ?? (body as any).altitude_m) ??
        (typeof device.altitude === 'number' ? device.altitude : null);
      const mq135Raw = num((sensors as any).mq135_raw ?? (sensors as any).mq135Raw);
      const pm25 = num((sensors as any).pm25_api ?? (sensors as any).pm25Api ?? (sensors as any).pm25 ?? (body as any).pm25_api ?? (body as any).pm25);

      // Calculate AQI - prefer API PM2.5, fallback to provided pm25, then estimate from IAQ
      let aqiCalculated: number | null = null;
      let aqiCategory: string | null = null;
      if (pm25Api !== null) {
        aqiCalculated = calculateAQI(pm25Api, 'pm25');
      } else if (pm25 !== null) {
        aqiCalculated = calculateAQI(pm25, 'pm25');
      } else if (iaq !== null) {
        const estimatedPM25 = Math.max(0, (Number(iaq) - 50) * 0.5);
        aqiCalculated = calculateAQI(estimatedPM25, 'pm25');
      }
      if (aqiCalculated !== null) {
        const cat = getAQICategory(aqiCalculated);
        aqiCategory = cat.name.toLowerCase().replace(/\s+/g, '_');
      }

      // Quality flags
      const qualityFlags = {
        sensor_warmed_up: true,
        dht22_valid: temp !== null && humidity !== null,
        bmp180_valid: pressure !== null,
        mq135_in_range: iaq !== null ? iaq >= 10 && iaq <= 500 : false,
        overall_valid: true,
      };

      // Uptime handling (accept ms)
      let uptimeBigInt: bigint | null = null;
      const uptimeMs = num((sensors as any).uptime_ms ?? (body as any).meta?.uptime_ms ?? (body as any).meta?.uptime);
      if (uptimeMs !== null && uptimeMs !== undefined) {
        if (!Number.isNaN(uptimeMs)) uptimeBigInt = BigInt(Math.floor(uptimeMs));
      }

      // Optional measurement id to avoid duplicates
      const measurementId = (body as any).measurement_id ?? (body as any).id ?? undefined;

      const measurementPayload: any = {
        deviceId: device.id,
        measuredAt: measuredAtDate,
        mq135Raw: mq135Raw ?? undefined,
        iaqScore: iaq ?? undefined,
        co2Equiv: co2 ?? undefined,
        temperature: temp ?? undefined,
        humidity: humidity ?? undefined,
        pressureHpa: pressure ?? undefined,
        altitudeM: altitude ?? undefined,
        pm25Api: pm25Api ?? pm25 ?? undefined,
        aqiCalculated: aqiCalculated ?? undefined,
        aqiCategory: aqiCategory ?? undefined,
        externalData: externalData,
        qualityFlags: qualityFlags,
        rssi: num((sensors as any).rssi ?? (body as any).meta?.rssi) ?? undefined,
        uptime: uptimeBigInt,
      };

      // Insert measurement with upsert if client-supplied id
      let measurement: any;
      if (measurementId) {
        try {
          measurement = await db.measurement.upsert({
            where: { id: measurementId },
            update: measurementPayload,
            create: { id: measurementId, ...measurementPayload },
          });
        } catch (err) {
          server.log.warn({ err }, 'Upsert failed; creating measurement with auto id');
          measurement = await db.measurement.create({ data: measurementPayload });
        }
      } else {
        measurement = await db.measurement.create({ data: measurementPayload });
      }

      // Update device last seen and firmware
      try {
        await db.device.update({
          where: { id: device.id },

          data: {
            lastSeen: measuredAtDate,
            firmwareVersion: body.firmware_version ?? device.firmwareVersion,
            active: true,
          },
        });
      } catch (e) {
        server.log.warn({ err: e }, 'Failed to update device lastSeen');
      }

      const responsePayload = {
        success: true,
        measurement_id: measurement.id,
        measuredAt: (measurement.measuredAt ?? measuredAtDate).toISOString(),
        aqi: measurement.aqiCalculated ?? aqiCalculated,
        category: measurement.aqiCategory ?? aqiCategory,
      };

      // Emit live update event (non-blocking)
      try {
        events.emit('measurement:new', {
          deviceId: device.id,
          deviceName: device.name,
          measuredAt: (measurement.measuredAt ?? measuredAtDate).toISOString(),
          aqiCalculated: measurement.aqiCalculated ?? aqiCalculated ?? null,
          iaqScore: measurement.iaqScore ?? iaq ?? null,
          temperature: measurement.temperature ?? temp ?? null,
          humidity: measurement.humidity ?? humidity ?? null,
          pressureHpa: measurement.pressureHpa ?? pressure ?? null,
        });
      } catch (e) {
        server.log.warn({ err: e }, 'Failed to emit live measurement event');
      }

      return reply.code(201).send(responsePayload);

    } catch (error) {
      server.log.error(error);
      if ((error as any).name === 'ZodError') {
        return reply.code(400).send({ error: 'Invalid payload', details: (error as any).errors });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};

export default ingestRoutes;
