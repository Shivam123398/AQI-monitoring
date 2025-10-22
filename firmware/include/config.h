#ifndef CONFIG_H
#define CONFIG_H

// ============================================================================
// AEROGUARD AI - Configuration Header
// ============================================================================

// Device Identity
#define DEVICE_ID "AERO-NODE-001"  // Unique per device
#define DEVICE_KEY "your-device-secret-key-32chars"  // Provision from backend
#define FIRMWARE_VERSION "1.2.0"

// WiFi Provisioning (WiFiManager will override if not configured)
#define WIFI_SSID ""  // Leave empty for captive portal
#define WIFI_PASSWORD ""

// Backend Endpoints (choose one primary)
#define USE_MQTT true  // Set false to use HTTPS POST only

#if USE_MQTT
  #define MQTT_BROKER "your-hivemq-instance.hivemq.cloud"
  #define MQTT_PORT 8883  // TLS
  #define MQTT_USER "aeroguard"
  #define MQTT_PASS "your-mqtt-password"
  #define MQTT_TOPIC_PUB "aeroguard/measurements"
  #define MQTT_TOPIC_SUB "aeroguard/commands"
#else
  #define API_ENDPOINT "https://api.aeroguard.app/api/v1/ingest"
  #define API_TIMEOUT 10000  // ms
#endif

// Pin Definitions
#define PIN_MQ135 34        // ADC1_CH6 (analog only)
#define PIN_DHT22 4         // Digital GPIO
#define PIN_STATUS_LED 2    // Onboard LED
#define PIN_SDA 21          // I2C Data (BMP180 + LCD)
#define PIN_SCL 22          // I2C Clock

// I2C Addresses
#define LCD_I2C_ADDR 0x27   // Common: 0x27 or 0x3F
#define BMP180_I2C_ADDR 0x77

// Sensor Configuration
#define MQ135_RL 10.0           // Load resistance (kΩ) - measure yours!
#define MQ135_R0_CLEAN_AIR 76.63  // Calibrate in fresh air (see README)
#define MQ135_WARMUP_MS 180000   // 3 min preheat on cold boot
#define DHT_TYPE DHT22
#define SAMPLING_INTERVAL_MS 60000  // 1 minute between readings
#define MEDIAN_FILTER_SIZE 5
#define EMA_ALPHA 0.3

// Data Quality
#define IAQ_MIN 10.0
#define IAQ_MAX 500.0
#define TEMP_MIN -40.0
#define TEMP_MAX 80.0
#define HUM_MIN 0.0
#define HUM_MAX 100.0
#define PRESSURE_MIN 800.0  // hPa
#define PRESSURE_MAX 1100.0

// Power Management (optional deep sleep)
#define ENABLE_DEEP_SLEEP false
#define SLEEP_DURATION_SEC 300  // 5 min

// Security
#define ENABLE_HMAC true  // Sign payloads with HMAC-SHA256

// NTP
#define NTP_SERVER "pool.ntp.org"
#define GMT_OFFSET_SEC 19800  // IST = UTC+5:30 = 19800 sec
#define DAYLIGHT_OFFSET_SEC 0

// Retry Logic
#define MAX_RETRIES 3
#define RETRY_DELAY_MS 5000

// Local Storage (ring buffer for offline)
#define OFFLINE_BUFFER_SIZE 50

// Display
#define LCD_COLS 16
#define LCD_ROWS 2
#define LCD_REFRESH_MS 5000  // Update every 5 sec

#endif