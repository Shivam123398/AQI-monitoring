// ============================================================================
// AEROGUARD AI - ESP32 Firmware
// Multi-sensor air quality node with ML-ready data pipeline
// ============================================================================

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <DHT.h>
#include <Adafruit_BMP085.h>
#include <LiquidCrystal_I2C.h>
#include <mbedtls/md.h>
#include "config.h"

// ============================================================================
// SENSOR INSTANCES
// ============================================================================
DHT dht(PIN_DHT22, DHT_TYPE);
Adafruit_BMP085 bmp;
LiquidCrystal_I2C lcd(LCD_I2C_ADDR, LCD_COLS, LCD_ROWS);

// ============================================================================
// NETWORKING
// ============================================================================
WiFiClientSecure wifiClient;
#if USE_MQTT
  PubSubClient mqttClient(wifiClient);
#endif
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, NTP_SERVER, GMT_OFFSET_SEC, 60000);

// ============================================================================
// GLOBAL STATE
// ============================================================================
struct SensorData {
  float mq135_raw;
  float iaq_score;
  float co2_equiv;
  float temperature;
  float humidity;
  float pressure_hpa;
  float altitude_m;
  unsigned long timestamp;
  bool valid;
};

SensorData currentReading;
float mq135_baseline = MQ135_R0_CLEAN_AIR;
unsigned long lastSampleTime = 0;
unsigned long bootTime = 0;
bool isWarmedUp = false;
int failedTransmissions = 0;

// Offline buffer (simple ring buffer)
SensorData offlineBuffer[OFFLINE_BUFFER_SIZE];
int bufferHead = 0;
int bufferCount = 0;

// ============================================================================
// MQ135 CALIBRATION & IAQ CALCULATION
// ============================================================================

float readMQ135Resistance() {
  int raw = analogRead(PIN_MQ135);
  float voltage = (raw / 4095.0) * 3.3;  // ESP32 ADC is 12-bit, Vref 3.3V
  // Note: MQ135 runs on 5V; use voltage divider if needed or measure actual Vcc
  float rs = ((5.0 * MQ135_RL) / voltage) - MQ135_RL;
  return rs;
}

float calculateIAQ(float rs_r0_ratio, float temp, float hum) {
  // Simplified IAQ model (georgezhao2010/MQ135 library logic)
  // IAQ = f(Rs/R0, T, H)
  // This is NOT precise CO2/CO/NO2; it's an indoor air quality proxy
  
  // Temperature & humidity compensation (empirical)
  float tempFactor = 1.0 + 0.02 * (temp - 20.0);
  float humFactor = 1.0 + 0.01 * (hum - 33.0);
  float ratio_compensated = rs_r0_ratio / (tempFactor * humFactor);
  
  // Convert to IAQ score (0-500 scale, higher = worse)
  // Baseline: Rs/R0 in clean air ~1.0 → IAQ ~50
  // Polluted air: Rs/R0 << 1.0 → IAQ > 200
  float iaq = 50.0 + (1.0 - ratio_compensated) * 200.0;
  iaq = constrain(iaq, IAQ_MIN, IAQ_MAX);
  return iaq;
}

float estimateCO2(float rs_r0_ratio) {
  // Rough CO2 equivalent (ppm) using power-law fit
  // WARNING: MQ135 is NOT a calibrated CO2 sensor; use SCD40/41 for accuracy
  // Formula: ppm = a * (Rs/R0)^b  (example coefficients)
  float a = 116.6020682;
  float b = -2.769034857;
  float ppm = a * pow(rs_r0_ratio, b);
  return constrain(ppm, 300, 5000);
}

// ============================================================================
// MEDIAN FILTER & EMA SMOOTHING
// ============================================================================
float medianFilter(float *values, int size) {
  float sorted[size];
  memcpy(sorted, values, size * sizeof(float));
  for (int i = 0; i < size - 1; i++) {
    for (int j = i + 1; j < size; j++) {
      if (sorted[i] > sorted[j]) {
        float temp = sorted[i];
        sorted[i] = sorted[j];
        sorted[j] = temp;
      }
    }
  }
  return sorted[size / 2];
}

float emaFilter(float newValue, float oldValue, float alpha) {
  return alpha * newValue + (1.0 - alpha) * oldValue;
}

// ============================================================================
// HMAC-SHA256 SIGNATURE
// ============================================================================
String hmacSHA256(String message, String key) {
  byte hmacResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;

  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1);
  mbedtls_md_hmac_starts(&ctx, (const unsigned char*)key.c_str(), key.length());
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)message.c_str(), message.length());
  mbedtls_md_hmac_finish(&ctx, hmacResult);
  mbedtls_md_free(&ctx);

  String signature = "";
  for (int i = 0; i < 32; i++) {
    char hex[3];
    sprintf(hex, "%02x", hmacResult[i]);
    signature += hex;
  }
  return signature;
}

// ============================================================================
// SENSOR READING
// ============================================================================
SensorData readSensors() {
  SensorData data;
  data.valid = true;
  data.timestamp = timeClient.getEpochTime();

  // DHT22: Temperature & Humidity
  data.temperature = dht.readTemperature();
  data.humidity = dht.readHumidity();
  if (isnan(data.temperature) || isnan(data.humidity)) {
    Serial.println("[ERROR] DHT22 read failed");
    data.valid = false;
    data.temperature = 0;
    data.humidity = 0;
  }

  // BMP180: Pressure & Altitude
  data.pressure_hpa = bmp.readPressure() / 100.0;  // Pa to hPa
  data.altitude_m = bmp.readAltitude(101325);  // Sea-level standard
  if (data.pressure_hpa < PRESSURE_MIN || data.pressure_hpa > PRESSURE_MAX) {
    Serial.println("[ERROR] BMP180 pressure out of range");
    data.valid = false;
  }

  // MQ135: Air Quality (median of 5 samples)
  float mq135_samples[MEDIAN_FILTER_SIZE];
  for (int i = 0; i < MEDIAN_FILTER_SIZE; i++) {
    mq135_samples[i] = readMQ135Resistance();
    delay(100);
  }
  float rs_median = medianFilter(mq135_samples, MEDIAN_FILTER_SIZE);
  data.mq135_raw = rs_median;

  // Calculate IAQ and CO2 equivalent
  float rs_r0_ratio = rs_median / mq135_baseline;
  data.iaq_score = calculateIAQ(rs_r0_ratio, data.temperature, data.humidity);
  data.co2_equiv = estimateCO2(rs_r0_ratio);

  // Outlier rejection
  if (data.temperature < TEMP_MIN || data.temperature > TEMP_MAX) data.valid = false;
  if (data.humidity < HUM_MIN || data.humidity > HUM_MAX) data.valid = false;

  return data;
}

// ============================================================================
// LCD DISPLAY UPDATE
// ============================================================================
void updateLCD(SensorData &data) {
  lcd.clear();
  
  if (!data.valid) {
    lcd.setCursor(0, 0);
    lcd.print("Sensor Error!");
    return;
  }

  // Line 1: AQI category + IAQ score
  lcd.setCursor(0, 0);
  String category = "GOOD";
  if (data.iaq_score > 150) category = "POOR";
  else if (data.iaq_score > 100) category = "FAIR";
  lcd.print(category + " IAQ:" + String((int)data.iaq_score));

  // Line 2: Temp + Humidity
  lcd.setCursor(0, 1);
  lcd.print(String(data.temperature, 1) + "C ");
  lcd.print(String((int)data.humidity) + "% ");
  lcd.print(String((int)data.pressure_hpa) + "hPa");
}

// ============================================================================
// DATA TRANSMISSION
// ============================================================================
bool transmitData(SensorData &data) {
  if (!data.valid) {
    Serial.println("[WARN] Skipping transmission of invalid data");
    return false;
  }

  // Build JSON payload
  StaticJsonDocument<1024> doc;
  doc["device_id"] = DEVICE_ID;
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["timestamp"] = data.timestamp;
  
  JsonObject sensors = doc.createNestedObject("sensors");
  sensors["mq135_raw"] = data.mq135_raw;
  sensors["iaq_score"] = data.iaq_score;
  sensors["co2_equiv"] = data.co2_equiv;
  sensors["temperature"] = data.temperature;
  sensors["humidity"] = data.humidity;
  sensors["pressure_hpa"] = data.pressure_hpa;
  sensors["altitude_m"] = data.altitude_m;

  JsonObject meta = doc.createNestedObject("meta");
  meta["uptime_ms"] = millis();
  meta["rssi"] = WiFi.RSSI();
  meta["free_heap"] = ESP.getFreeHeap();

  String payload;
  serializeJson(doc, payload);

#if ENABLE_HMAC
  String signature = hmacSHA256(payload, DEVICE_KEY);
  doc["signature"] = signature;
  payload = "";
  serializeJson(doc, payload);
#endif

  Serial.println("[DATA] " + payload);

#if USE_MQTT
  // MQTT Publish
  if (!mqttClient.connected()) {
    Serial.println("[MQTT] Reconnecting...");
    if (!mqttClient.connect(DEVICE_ID, MQTT_USER, MQTT_PASS)) {
      Serial.println("[ERROR] MQTT connection failed");
      return false;
    }
  }
  bool success = mqttClient.publish(MQTT_TOPIC_PUB, payload.c_str(), false);
  if (success) {
    Serial.println("[MQTT] Published successfully");
  } else {
    Serial.println("[ERROR] MQTT publish failed");
  }
  return success;
#else
  // HTTPS POST
  WiFiClientSecure client;
  client.setInsecure();  // For demo; use cert pinning in production
  HTTPClient http;
  http.begin(client, API_ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", DEVICE_KEY);
  http.setTimeout(API_TIMEOUT);

  int httpCode = http.POST(payload);
  http.end();

  if (httpCode == 200 || httpCode == 201) {
    Serial.println("[HTTPS] POST success: " + String(httpCode));
    return true;
  } else {
    Serial.println("[ERROR] HTTPS POST failed: " + String(httpCode));
    return false;
  }
#endif
}

// ============================================================================
// OFFLINE BUFFER MANAGEMENT
// ============================================================================
void bufferData(SensorData &data) {
  offlineBuffer[bufferHead] = data;
  bufferHead = (bufferHead + 1) % OFFLINE_BUFFER_SIZE;
  if (bufferCount < OFFLINE_BUFFER_SIZE) bufferCount++;
  Serial.println("[BUFFER] Stored offline (" + String(bufferCount) + "/" + String(OFFLINE_BUFFER_SIZE) + ")");
}

void flushBuffer() {
  if (bufferCount == 0) return;
  Serial.println("[BUFFER] Flushing " + String(bufferCount) + " records...");
  
  int flushed = 0;
  for (int i = 0; i < bufferCount; i++) {
    int idx = (bufferHead - bufferCount + i + OFFLINE_BUFFER_SIZE) % OFFLINE_BUFFER_SIZE;
    if (transmitData(offlineBuffer[idx])) {
      flushed++;
    }
    delay(500);  // Rate limit
  }
  
  bufferCount = 0;
  bufferHead = 0;
  Serial.println("[BUFFER] Flushed " + String(flushed) + " records");
}

// ============================================================================
// WIFI & MQTT SETUP
// ============================================================================
void setupWiFi() {
  WiFiManager wm;
  wm.setConfigPortalTimeout(180);  // 3 min timeout
  
  if (!wm.autoConnect("AeroGuard-Setup")) {
    Serial.println("[ERROR] WiFi provisioning failed, restarting...");
    delay(3000);
    ESP.restart();
  }

  Serial.println("[WiFi] Connected: " + WiFi.localIP().toString());
  Serial.println("[WiFi] RSSI: " + String(WiFi.RSSI()) + " dBm");
}

void setupMQTT() {
#if USE_MQTT
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setKeepAlive(60);
  mqttClient.setSocketTimeout(10);
  
  Serial.println("[MQTT] Connecting to " + String(MQTT_BROKER) + "...");
  if (mqttClient.connect(DEVICE_ID, MQTT_USER, MQTT_PASS)) {
    Serial.println("[MQTT] Connected");
    mqttClient.subscribe(MQTT_TOPIC_SUB);
  } else {
    Serial.println("[ERROR] MQTT connection failed, state: " + String(mqttClient.state()));
  }
#endif
}

// ============================================================================
// MQ135 CALIBRATION ROUTINE
// ============================================================================
void calibrateMQ135() {
  Serial.println("\n========================================");
  Serial.println("MQ135 CALIBRATION");
  Serial.println("Place sensor in FRESH AIR for 60 seconds");
  Serial.println("========================================\n");

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Calibrating...");
  lcd.setCursor(0, 1);
  lcd.print("Fresh air 60s");

  delay(5000);  // Give user time to read

  float sum = 0;
  int samples = 20;
  for (int i = 0; i < samples; i++) {
    float rs = readMQ135Resistance();
    sum += rs;
    Serial.print(".");
    delay(3000);  // 3 sec per sample = 60 sec total
  }

  mq135_baseline = sum / samples;
  Serial.println("\n[CAL] R0 baseline: " + String(mq135_baseline) + " kΩ");
  Serial.println("[CAL] Store this value in config.h for future boots");

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("R0=" + String(mq135_baseline, 1));
  lcd.setCursor(0, 1);
  lcd.print("Calibrated!");
  delay(3000);
}

// ============================================================================
// SETUP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n");
  Serial.println("========================================");
  Serial.println("   AEROGUARD AI - Node Initializing");
  Serial.println("   Firmware: " + String(FIRMWARE_VERSION));
  Serial.println("   Device: " + String(DEVICE_ID));
  Serial.println("========================================\n");

  // GPIO Setup
  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, HIGH);  // Indicate boot

  // LCD Init
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("AeroGuard AI");
  lcd.setCursor(0, 1);
  lcd.print("Booting...");

  // WiFi
  setupWiFi();

  // NTP
  timeClient.begin();
  timeClient.update();
  Serial.println("[NTP] Time synced: " + timeClient.getFormattedTime());

  // I2C Sensors
  Wire.begin(PIN_SDA, PIN_SCL);
  
  if (!bmp.begin()) {
    Serial.println("[ERROR] BMP180 init failed!");
    lcd.setCursor(0, 1);
    lcd.print("BMP180 FAIL");
    while (1) delay(1000);
  }
  Serial.println("[BMP180] Initialized");

  dht.begin();
  Serial.println("[DHT22] Initialized");

  // MQ135 Warmup
  Serial.println("[MQ135] Warming up for " + String(MQ135_WARMUP_MS / 1000) + " seconds...");
  lcd.setCursor(0, 1);
  lcd.print("Sensor warmup..");
  
  unsigned long warmupStart = millis();
  while (millis() - warmupStart < MQ135_WARMUP_MS) {
    digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));  // Blink
    delay(500);
  }
  isWarmedUp = true;
  digitalWrite(PIN_STATUS_LED, LOW);
  Serial.println("[MQ135] Warmup complete");

  // Optional: Calibrate MQ135 (comment out after first run)
  // calibrateMQ135();

  // MQTT
#if USE_MQTT
  setupMQTT();
#endif

  bootTime = millis();
  Serial.println("\n[READY] AeroGuard node is online\n");
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("System Ready");
  delay(2000);
}

// ============================================================================
// LOOP
// ============================================================================
void loop() {
  unsigned long now = millis();

  // Keep MQTT alive
#if USE_MQTT
  if (!mqttClient.connected()) {
    setupMQTT();
  }
  mqttClient.loop();
#endif

  // Time sync
  timeClient.update();

  // Sample sensors at interval
  if (now - lastSampleTime >= SAMPLING_INTERVAL_MS) {
    lastSampleTime = now;

    Serial.println("\n[SAMPLE] Reading sensors...");
    digitalWrite(PIN_STATUS_LED, HIGH);
    
    currentReading = readSensors();
    
    if (currentReading.valid) {
      Serial.println("[SAMPLE] Valid reading:");
      Serial.println("  IAQ: " + String(currentReading.iaq_score));
      Serial.println("  CO2eq: " + String(currentReading.co2_equiv) + " ppm");
      Serial.println("  Temp: " + String(currentReading.temperature) + " °C");
      Serial.println("  Humidity: " + String(currentReading.humidity) + " %");
      Serial.println("  Pressure: " + String(currentReading.pressure_hpa) + " hPa");
      
      updateLCD(currentReading);

      // Transmit
      bool success = transmitData(currentReading);
      if (success) {
        failedTransmissions = 0;
        flushBuffer();  // Send any buffered data
      } else {
        failedTransmissions++;
        bufferData(currentReading);
      }
    } else {
      Serial.println("[SAMPLE] Invalid reading, skipped");
    }

    digitalWrite(PIN_STATUS_LED, LOW);
  }

  // Heartbeat blink
  static unsigned long lastBlink = 0;
  if (now - lastBlink > 2000) {
    lastBlink = now;
    digitalWrite(PIN_STATUS_LED, HIGH);
    delay(50);
    digitalWrite(PIN_STATUS_LED, LOW);
  }

  delay(100);
}