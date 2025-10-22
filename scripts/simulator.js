/**
 * AeroGuard AI - Sensor Data Simulator
 * Generates realistic sensor data for testing without hardware
 */

const axios = require('axios');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000/api/v1';
const DEVICE_ID = process.env.DEVICE_ID || 'SIMULATOR-001';
const DEVICE_KEY = process.env.DEVICE_KEY || 'simulator-test-key-12345678';
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS || '30000'); // 30 seconds
const LOCATION = {
  latitude: parseFloat(process.env.LAT || '28.6139'),
  longitude: parseFloat(process.env.LNG || '77.2090'),
};

console.log('🌬️  AeroGuard AI Simulator Starting...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📍 Location: ${LOCATION.latitude}, ${LOCATION.longitude}`);
console.log(`🔗 API URL: ${API_URL}`);
console.log(`⏱️  Interval: ${INTERVAL_MS / 1000}s`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// State management
let baseAQI = 60;
let trendDirection = 1;
let eventActive = false;
let measurementCount = 0;

/**
 * Generate realistic sensor data with temporal patterns
 */
function generateSensorData() {
  const now = new Date();
  const hour = now.getHours();
  
  // Diurnal pattern (higher pollution in morning/evening rush hours)
  let hourlyFactor = 1.0;
  if (hour >= 7 && hour <= 9) hourlyFactor = 1.4; // Morning rush
  else if (hour >= 17 && hour <= 19) hourlyFactor = 1.5; // Evening rush
  else if (hour >= 0 && hour <= 5) hourlyFactor = 0.7; // Night (cleaner)
  
  // Random events (pollution spikes)
  if (Math.random() < 0.05 && !eventActive) {
    eventActive = true;
    console.log('⚠️  EVENT: Pollution spike triggered!');
  }
  
  const eventFactor = eventActive ? 1.8 : 1.0;
  if (eventActive && Math.random() < 0.3) {
    eventActive = false;
    console.log('✅ EVENT: Pollution spike ended');
  }
  
  // Gradual trend change
  baseAQI += trendDirection * (Math.random() * 3);
  if (baseAQI > 150) trendDirection = -1;
  if (baseAQI < 30) trendDirection = 1;
  
  // Calculate final AQI
  const aqi = Math.max(10, Math.min(300, baseAQI * hourlyFactor * eventFactor + (Math.random() - 0.5) * 10));
  
  // Derive other pollutants from AQI
  const iaq = Math.max(50, aqi * 1.5 + (Math.random() - 0.5) * 30);
  const co2_equiv = Math.max(400, 400 + (aqi - 50) * 8 + (Math.random() - 0.5) * 100);
  
  // Environmental sensors
  const temperature = 15 + 10 * Math.sin((hour - 6) * Math.PI / 12) + (Math.random() - 0.5) * 3;
  const humidity = 40 + 20 * Math.sin((hour - 3) * Math.PI / 12) + (Math.random() - 0.5) * 10;
  const pressure_hpa = 1013 + (Math.random() - 0.5) * 20;
  
  // MQ135 raw resistance (inverse relationship with pollution)
  const mq135_raw = 150 / (iaq / 100) + (Math.random() - 0.5) * 5;
  
  return {
    mq135_raw: parseFloat(mq135_raw.toFixed(2)),
    iaq_score: parseFloat(iaq.toFixed(1)),
    co2_equiv: parseFloat(co2_equiv.toFixed(0)),
    temperature: parseFloat(temperature.toFixed(2)),
    humidity: parseFloat(humidity.toFixed(1)),
    pressure_hpa: parseFloat(pressure_hpa.toFixed(1)),
    altitude_m: 216.5, // Delhi average
    // Quality flags
    sensor_warmed_up: true,
    dht22_valid: true,
    bmp180_valid: true,
    mq135_in_range: iaq >= 50 && iaq <= 500
  };
}

/**
 * Create HMAC signature (simplified - use crypto in production)
 */
function createSignature(payload, key) {
  const crypto = require('crypto');
  return crypto
    .createHmac('sha256', key)
    .update(JSON.stringify(payload))
    .digest('hex');
}

/**
 * Send measurement to API
 */
async function sendMeasurement() {
  measurementCount++;
  
  const sensors = generateSensorData();
  const timestamp = Math.floor(Date.now() / 1000);
  
  const payload = {
    device_id: DEVICE_ID,
    firmware_version: 'SIMULATOR-1.0.0',
    timestamp,
    sensors,
    meta: {
      uptime_ms: Date.now(),
      rssi: -45 - Math.floor(Math.random() * 30),
      free_heap: 200000 + Math.floor(Math.random() * 50000),
    }
  };
  
  // Add signature
  payload.signature = createSignature(payload, DEVICE_KEY);
  
  try {
    const response = await axios.post(`${API_URL}/ingest`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': DEVICE_KEY
      },
      timeout: 10000
    });
    
    const aqiCategory = getAQICategory(response.data.aqi || sensors.iaq_score / 2);
    
    console.log(`[${new Date().toLocaleTimeString()}] #${measurementCount} ${aqiCategory.icon} ` +
                `AQI: ${Math.round(response.data.aqi || sensors.iaq_score / 2)} | ` +
                `IAQ: ${sensors.iaq_score.toFixed(0)} | ` +
                `Temp: ${sensors.temperature.toFixed(1)}°C | ` +
                `Status: ✓ Sent`);
    
  } catch (error) {
    if (error.response) {
      console.error(`❌ API Error: ${error.response.status} - ${error.response.data.error || 'Unknown'}`);
    } else if (error.request) {
      console.error(`❌ Network Error: Cannot reach ${API_URL}`);
      console.log(`💡 Tip: Make sure backend is running on ${API_URL}`);
    } else {
      console.error(`❌ Error: ${error.message}`);
    }
  }
}

/**
 * Get AQI category for console output
 */
function getAQICategory(aqi) {
  if (aqi <= 50) return { name: 'Good', icon: '✅' };
  if (aqi <= 100) return { name: 'Moderate', icon: '⚠️' };
  if (aqi <= 150) return { name: 'Unhealthy (Sensitive)', icon: '🟠' };
  if (aqi <= 200) return { name: 'Unhealthy', icon: '🔴' };
  if (aqi <= 300) return { name: 'Very Unhealthy', icon: '🟣' };
  return { name: 'Hazardous', icon: '🟤' };
}

/**
 * Main loop
 */
async function start() {
  console.log('▶️  Simulator running. Press Ctrl+C to stop.\n');
  
  // Send first measurement immediately
  await sendMeasurement();
  
  // Then send at intervals
  setInterval(sendMeasurement, INTERVAL_MS);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 Session Summary:`);
  console.log(`   Total measurements sent: ${measurementCount}`);
  console.log(`   Duration: ${Math.floor(measurementCount * INTERVAL_MS / 60000)} minutes`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👋 Simulator stopped. Goodbye!\n');
  process.exit(0);
});

// Start the simulator
start();