import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { generateAPIKey } from '../src/lib/hmac';

const prisma = new PrismaClient();

async function main() {
  const name = process.env.DEVICE_NAME || 'ROURKELA station';
  const latitude = process.env.DEVICE_LAT ? Number(process.env.DEVICE_LAT) : null;
  const longitude = process.env.DEVICE_LNG ? Number(process.env.DEVICE_LNG) : null;
  const areaName = process.env.DEVICE_AREA || 'Rourkela';
  const salt = process.env.API_KEY_SALT || 'dev-salt';

  // If a device with the same name exists, reuse it
  const existing = await prisma.device.findFirst({ where: { name } });
  if (existing) {
    console.log(JSON.stringify({
      message: 'Device already exists',
      device_id: existing.id,
      device_key: existing.deviceKey,
      name: existing.name,
    }, null, 2));
    return;
  }

  const deviceKey = generateAPIKey(name, salt);
  const created = await prisma.device.create({
    data: {
      name,
      deviceKey,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
      areaName,
      active: true,
    },
  });

  console.log(JSON.stringify({
    message: 'Device registered successfully',
    device_id: created.id,
    device_key: deviceKey,
    name: created.name,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
