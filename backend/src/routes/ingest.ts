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
  timestamp: z.number().optional(), // Make optional, will use server time if not provided
  sensors: z.object({
    mq135_raw: z.number().optional(),
    iaq_score: z.number().optional(),
    co2_equiv: z.number().optional(),
    temperature: z.number().optional(),
    humidity: z.number().optional(),
    pressure_hpa: z.number().optional(),
    altitude_m: z.number().optional(),
  }).optional(),
  // Direct sensor fields (alternative format for ESP)
  temperature: z.number().optional(),
  humidity: z.number().optional(),
  pressure: z.number().optional(),
  co2eq: z.number().optional(),
  iaq: z.number().optional(),
  aqi: z.number().optional(),
  aqiColor: z.string().optional(),
  pm25: z.number().optional(),
  healthMessage: z.string().optional(),
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

      // Merge direct fields and nested sensors fields
      const sensors = {
        mq135_raw: body.sensors?.mq135_raw,
        iaq_score: body.sensors?.iaq_score ?? body.iaq,
        co2_equiv: body.sensors?.co2_equiv ?? body.co2eq,
        temperature: body.sensors?.temperature ?? body.temperature,
        humidity: body.sensors?.humidity ?? body.humidity,
        pressure_hpa: body.sensors?.pressure_hpa ?? body.pressure,
        altitude_m: body.sensors?.altitude_m,
      };

      // Use timestamp from payload or default to server time
      const timestamp = body.timestamp ? new Date(body.timestamp * 1000) : new Date();

      // Verify device exists, or create it if not
      let device = await db.device.findFirst({
        where: { id: body.device_id },
      });

      if (!device) {
        // Auto-register device with basic info
        server.log.info(`Auto-registering new device: ${body.device_id}`);
        device = await db.device.create({
          data: {
            id: body.device_id,
            deviceKey: body.device_id, // Use device_id as key for auto-registered devices
            name: `Device ${body.device_id}`,
            description: 'Auto-registered device',
            active: true,
            firmwareVersion: body.firmware_version,
            lastSeen: new Date(),
          },
        });
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

      // Use PM2.5 from device if provided, otherwise from API
      const pm25 = body.pm25 ?? pm25Api;

      // Calculate AQI (use device AQI if provided, otherwise calculate)
      let aqiCalculated: number | null = body.aqi ?? null;
      let aqiCategory: string | null = null;

      if (aqiCalculated === null && pm25 !== null) {
        aqiCalculated = calculateAQI(pm25, 'pm25');
      } else if (aqiCalculated === null && sensors.iaq_score) {
        // Rough IAQ → AQI mapping (not scientifically accurate!)
        const estimatedPM25 = Math.max(0, (sensors.iaq_score - 50) * 0.5);
        aqiCalculated = calculateAQI(estimatedPM25, 'pm25');
      }

      if (aqiCalculated !== null) {
        const cat = getAQICategory(aqiCalculated);
        // Store category as slug string matching schema comment
        aqiCategory = ['','good','moderate','unhealthy_sensitive','unhealthy','very_unhealthy','hazardous'][cat.level] || cat.name.toLowerCase();
        
        // Add AQI color and health message to externalData if provided
        if (body.aqiColor || body.healthMessage) {
          externalData.esp_data = {
            aqi_color: body.aqiColor ?? cat.color,
            health_message: body.healthMessage ?? cat.cautionaryStatement,
          };
        } else {
          externalData.esp_data = {
            aqi_color: cat.color,
            health_message: cat.cautionaryStatement,
          };
        }
      }

      // Insert measurement with upsert behavior (ignore duplicates)
      const measurement = await db.measurement.upsert({
        where: {
          deviceId_measuredAt: {
            deviceId: device.id,
            measuredAt: timestamp,
          },
        },
        update: {
          // Update existing measurement if found
          mq135Raw: sensors.mq135_raw,
          iaqScore: sensors.iaq_score,
          co2Equiv: sensors.co2_equiv,
          temperature: sensors.temperature,
          humidity: sensors.humidity,
          pressureHpa: sensors.pressure_hpa,
          altitudeM: sensors.altitude_m,
          pm25Api: pm25,
          pm25Estimated: pm25,
          aqiCalculated: aqiCalculated,
          aqiCategory: aqiCategory,
          externalData: externalData,
          qualityFlags: {
            sensor_warmed_up: true,
            dht22_valid: sensors.temperature !== null && sensors.temperature !== undefined,
            bmp180_valid: sensors.pressure_hpa !== null && sensors.pressure_hpa !== undefined,
            mq135_in_range: sensors.iaq_score ? sensors.iaq_score >= 10 && sensors.iaq_score <= 500 : false,
            overall_valid: true,
          },
          rssi: body.meta?.rssi,
          uptime: body.meta?.uptime_ms ? BigInt(body.meta.uptime_ms) : null,
        },
        create: {
          deviceId: device.id,
          measuredAt: timestamp,
          mq135Raw: sensors.mq135_raw,
          iaqScore: sensors.iaq_score,
          co2Equiv: sensors.co2_equiv,
          temperature: sensors.temperature,
          humidity: sensors.humidity,
          pressureHpa: sensors.pressure_hpa,
          altitudeM: sensors.altitude_m,
          pm25Api: pm25,
          pm25Estimated: pm25,
          aqiCalculated: aqiCalculated,
          aqiCategory: aqiCategory,
          externalData: externalData,
          qualityFlags: {
            sensor_warmed_up: true,
            dht22_valid: sensors.temperature !== null && sensors.temperature !== undefined,
            bmp180_valid: sensors.pressure_hpa !== null && sensors.pressure_hpa !== undefined,
            mq135_in_range: sensors.iaq_score ? sensors.iaq_score >= 10 && sensors.iaq_score <= 500 : false,
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