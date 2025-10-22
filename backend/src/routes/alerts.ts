import { FastifyPluginAsync } from 'fastify';
import { db } from '../lib/db';
import { sendEmailAlert } from '../services/email-service';

const alertsRoutes: FastifyPluginAsync = async (server) => {
  // Send a test alert email to verify SMTP/Gmail config
  server.post('/test-email', async (request, reply) => {
    try {
      const { to, deviceId } = request.body as { to: string; deviceId?: string };
      if (!to) {
        return reply.code(400).send({ error: 'Missing required field: to' });
      }

      // Find the latest measurement (optionally per device)
      const measurement = await db.measurement.findFirst({
        where: deviceId ? { deviceId } : {},
        orderBy: { measuredAt: 'desc' },
      });

      const m = measurement || {
        aqiCalculated: 135,
        aqiCategory: 'unhealthy_sensitive',
        temperature: 27,
        humidity: 48,
      };

      const subject = measurement
        ? `AQI ${Math.round(measurement.aqiCalculated || 0)} at your station`
        : 'Test alert from AeroGuard AI';

      await sendEmailAlert(to, subject, m);
      return reply.send({ success: true });
    } catch (err: any) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Failed to send test email', details: err.message });
    }
  });
};

export default alertsRoutes;

