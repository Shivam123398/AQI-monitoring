/**
 * Database Seeding Script
 * Populates database with realistic sample data
 */

import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

// Sample locations in Delhi NCR
const LOCATIONS = [
  { name: 'Connaught Place', lat: 28.6315, lng: 77.2167, area: 'Central Delhi' },
  { name: 'Mayur Vihar', lat: 28.6096, lng: 77.2956, area: 'East Delhi' },
  { name: 'Dwarka', lat: 28.5921, lng: 77.0460, area: 'West Delhi' },
  { name: 'Rohini', lat: 28.7496, lng: 77.0669, area: 'North Delhi' },
  { name: 'Lajpat Nagar', lat: 28.5677, lng: 77.2435, area: 'South Delhi' },
  { name: 'Nehru Place', lat: 28.5494, lng: 77.2501, area: 'South Delhi' },
  { name: 'ITO', lat: 28.6289, lng: 77.2416, area: 'Central Delhi' },
  { name: 'Lodhi Garden', lat: 28.5934, lng: 77.2186, area: 'Central Delhi' },
];

/**
 * Generate device key
 */
function generateDeviceKey(deviceId: string): string {
  const crypto = require('crypto');
  return crypto
    .createHash('sha256')
    .update(deviceId + Date.now() + Math.random())
    .digest('hex')
    .substring(0, 32);
}

/**
 * Calculate AQI from PM2.5
 */
function calculateAQI(pm25: number): number {
  if (pm25 <= 12.0) return Math.round((50 / 12.0) * pm25);
  if (pm25 <= 35.4) return Math.round(50 + ((100 - 50) / (35.4 - 12.1)) * (pm25 - 12.1));
  if (pm25 <= 55.4) return Math.round(100 + ((150 - 100) / (55.4 - 35.5)) * (pm25 - 35.5));
  if (pm25 <= 150.4) return Math.round(150 + ((200 - 150) / (150.4 - 55.5)) * (pm25 - 55.5));
  if (pm25 <= 250.4) return Math.round(200 + ((300 - 200) / (250.4 - 150.5)) * (pm25 - 150.5));
  return Math.round(300 + ((500 - 300) / (500.4 - 250.5)) * (pm25 - 250.5));
}

/**
 * Get AQI category
 */
function getAQICategory(aqi: number): string {
  if (aqi <= 50) return 'good';
  if (aqi <= 100) return 'moderate';
  if (aqi <= 150) return 'unhealthy_sensitive';
  if (aqi <= 200) return 'unhealthy';
  if (aqi <= 300) return 'very_unhealthy';
  return 'hazardous';
}

/**
 * Seed devices
 */
async function seedDevices() {
  console.log('📡 Seeding devices...');
  
  const devices = [];
  
  for (let i = 0; i < LOCATIONS.length; i++) {
    const loc = LOCATIONS[i];
    const deviceId = `AERO-${String(i + 1).padStart(3, '0')}`;
    
    const device = await prisma.device.create({
      data: {
        id: deviceId,
        deviceKey: generateDeviceKey(deviceId),
        name: `${loc.name} Station`,
        description: `AeroGuard AI monitoring station at ${loc.name}`,
        latitude: loc.lat,
        longitude: loc.lng,
        areaName: loc.area,
        altitude: 216 + Math.random() * 50, // Delhi altitude ~216m
        active: true,
        firmwareVersion: '1.2.0',
        lastSeen: new Date(),
        metadata: {
          installDate: faker.date.past({ years: 1 }),
          maintainer: faker.person.fullName(),
          notes: 'Initial deployment'
        }
      }
    });
    
    devices.push(device);
    console.log(`  ✓ Created device: ${device.name} (${device.id})`);
  }
  
  return devices;
}

/**
 * Seed measurements (last 7 days)
 */
async function seedMeasurements(devices: any[]) {
  console.log('\n📊 Seeding measurements (7 days)...');
  
  const now = Date.now();
  const DAYS = 7;
  const INTERVAL_MINUTES = 5; // One measurement every 5 minutes
  const measurementsPerDay = (24 * 60) / INTERVAL_MINUTES;
  const totalMeasurements = DAYS * measurementsPerDay * devices.length;
  
  console.log(`  Generating ${totalMeasurements} measurements...`);
  
  let count = 0;
  const batchSize = 100;
  let batch: any[] = [];
  
  for (let day = DAYS - 1; day >= 0; day--) {
    for (let device of devices) {
      // Each device has a base pollution level
      const basePM25 = 20 + Math.random() * 40; // 20-60 µg/m³
      
      for (let interval = 0; interval < measurementsPerDay; interval++) {
        const timestamp = new Date(now - day * 24 * 60 * 60 * 1000 - interval * INTERVAL_MINUTES * 60 * 1000);
        const hour = timestamp.getHours();
        
        // Diurnal pattern
        let hourlyFactor = 1.0;
        if (hour >= 7 && hour <= 9) hourlyFactor = 1.4;
        else if (hour >= 17 && hour <= 19) hourlyFactor = 1.5;
        else if (hour >= 0 && hour <= 5) hourlyFactor = 0.7;
        
        const pm25 = Math.max(5, basePM25 * hourlyFactor + (Math.random() - 0.5) * 15);
        const aqi = calculateAQI(pm25);
        const iaq = Math.max(50, aqi * 1.5 + (Math.random() - 0.5) * 30);
        const co2 = 400 + (aqi - 50) * 8 + (Math.random() - 0.5) * 100;
        
        const temp = 15 + 10 * Math.sin((hour - 6) * Math.PI / 12) + (Math.random() - 0.5) * 3;
        const humidity = 40 + 20 * Math.sin((hour - 3) * Math.PI / 12) + (Math.random() - 0.5) * 10;
        const pressure = 1013 + (Math.random() - 0.5) * 20;
        
        batch.push({
          deviceId: device.id,
          measuredAt: timestamp,
          mq135Raw: 150 / (iaq / 100) + (Math.random() - 0.5) * 5,
          iaqScore: iaq,
          co2Equiv: co2,
          temperature: temp,
          humidity: humidity,
          pressureHpa: pressure,
          altitudeM: device.altitude,
          pm25Api: pm25,
          aqiCalculated: aqi,
          aqiCategory: getAQICategory(aqi),
          externalData: {
            source: 'openweather',
            pm10: pm25 * 1.5,
            no2: 20 + Math.random() * 30,
            o3: 30 + Math.random() * 40
          },
          qualityFlags: {
            sensor_warmed_up: true,
            dht22_valid: true,
            bmp180_valid: true,
            mq135_in_range: true,
            overall_valid: true
          },
          rssi: -45 - Math.floor(Math.random() * 30),
          uptime: BigInt(Math.floor(Math.random() * 86400000))
        });
        
        count++;
        
        // Insert in batches
        if (batch.length >= batchSize) {
          await prisma.measurement.createMany({ data: batch });
          batch = [];
          process.stdout.write(`\r  Progress: ${count}/${totalMeasurements} (${Math.round(count / totalMeasurements * 100)}%)`);
        }
      }
    }
  }
  
  // Insert remaining
  if (batch.length > 0) {
    await prisma.measurement.createMany({ data: batch });
  }
  
  console.log(`\n  ✓ Created ${count} measurements`);
}

/**
 * Seed users
 */
async function seedUsers() {
  console.log('\n👥 Seeding users...');
  
  const users = [];
  
  for (let i = 0; i < 5; i++) {
    const user = await prisma.user.create({
      data: {
        email: faker.internet.email(),
        name: faker.person.fullName(),
        telegramId: String(100000000 + Math.floor(Math.random() * 900000000)),
        healthProfile: {
          age: 25 + Math.floor(Math.random() * 40),
          conditions: faker.helpers.arrayElements(['asthma', 'allergies', 'none'], 1)
        },
        homeLatitude: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)].lat,
        homeLongitude: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)].lng,
        units: 'metric',
        aqiStandard: 'us_epa',
        active: true
      }
    });
    
    users.push(user);
    console.log(`  ✓ Created user: ${user.name} (${user.email})`);
  }
  
  return users;
}

/**
 * Seed alert subscriptions
 */
async function seedAlertSubscriptions(users: any[], devices: any[]) {
  console.log('\n🔔 Seeding alert subscriptions...');
  
  for (const user of users) {
    const device = faker.helpers.arrayElement(devices);
    
    const subscription = await prisma.alertSubscription.create({
      data: {
        userId: user.id,
        deviceId: device.id,
        alertType: 'threshold',
        thresholds: {
          aqi: 100,
          pm25: 35.4,
          iaq: 150
        },
        channels: ['email', 'telegram'],
        cooldownMin: 60,
        quietHours: {
          start: '22:00',
          end: '07:00'
        },
        active: true
      }
    });
    
    console.log(`  ✓ Subscribed ${user.name} to ${device.name}`);
  }
}

/**
 * Seed predictions
 */
async function seedPredictions(devices: any[]) {
  console.log('\n🔮 Seeding predictions...');
  
  const now = new Date();
  
  for (const device of devices) {
    // Get latest AQI
    const latest = await prisma.measurement.findFirst({
      where: { deviceId: device.id },
      orderBy: { measuredAt: 'desc' }
    });
    
    const baseAqi = latest?.aqiCalculated || 60;
    
    // Create 24-hour forecast
    for (let hour = 1; hour <= 24; hour++) {
      const predictedFor = new Date(now.getTime() + hour * 60 * 60 * 1000);
      const variation = (Math.random() - 0.5) * 20;
      const forecast = Math.max(10, Math.min(300, baseAqi + variation));
      
      await prisma.prediction.create({
        data: {
          deviceId: device.id,
          predictedFor,
          aqiForecast: forecast,
          aqiCategory: getAQICategory(forecast),
          confidence: 0.75 + Math.random() * 0.2,
          modelVersion: 'LSTM-v1.0',
          features: {
            lookback_hours: 24,
            features_used: ['aqi', 'temp', 'humidity', 'hour', 'day']
          }
        }
      });
    }
    
    console.log(`  ✓ Created 24h forecast for ${device.name}`);
  }
}

/**
 * Main seed function
 */
async function main() {
  console.log('🌱 Starting database seed...\n');
  
  try {
    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await prisma.alert.deleteMany();
    await prisma.alertSubscription.deleteMany();
    await prisma.prediction.deleteMany();
    await prisma.healthRisk.deleteMany();
    await prisma.measurement.deleteMany();
    await prisma.aggregate.deleteMany();
    await prisma.user.deleteMany();
    await prisma.device.deleteMany();
    console.log('  ✓ Cleared\n');
    
    // Seed in order
    const devices = await seedDevices();
    await seedMeasurements(devices);
    const users = await seedUsers();
    await seedAlertSubscriptions(users, devices);
    await seedPredictions(devices);
    
    console.log('\n✅ Database seeding completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   Devices: ${devices.length}`);
    console.log(`   Users: ${users.length}`);
    console.log(`   Measurements: ~${devices.length * 7 * 288} (7 days, 5-min interval)`);
    console.log(`   Predictions: ${devices.length * 24} (24h forecast per device)`);
    console.log('');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();