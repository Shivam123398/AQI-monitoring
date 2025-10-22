-- ================================================
-- AQI Monitoring System - Full Schema + Seed Data
-- ================================================

-- 0) Create Database (if not exists)
-- NOTE: Skip if already connected to 'aqi' database.
-- \c aqi

-- ================================================
-- 1) TABLE DEFINITIONS
-- ================================================

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
                                       id VARCHAR(50) PRIMARY KEY,
    device_key VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    area_name VARCHAR(255),
    altitude INT,
    active BOOLEAN DEFAULT TRUE,
    last_seen TIMESTAMP,
    firmware_version VARCHAR(50),
    metadata JSONB
    );

-- Measurements table
CREATE TABLE IF NOT EXISTS measurements (
                                            id SERIAL PRIMARY KEY,
                                            device_id VARCHAR(50) REFERENCES devices(id) ON DELETE CASCADE,
    measured_at TIMESTAMP NOT NULL,
    iaq_score NUMERIC,
    co2_equiv NUMERIC,
    temperature NUMERIC,
    humidity NUMERIC,
    pressure_hpa NUMERIC,
    pm25_api NUMERIC,
    aqi_calculated INT,
    aqi_category VARCHAR(50),
    external_data JSONB,
    quality_flags JSONB,
    rssi INT,
    altitude_m INT
    );

-- Users table
CREATE TABLE IF NOT EXISTS users (
                                     id SERIAL PRIMARY KEY,
                                     email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    active BOOLEAN DEFAULT TRUE,
    units VARCHAR(20) DEFAULT 'metric',
    aqi_standard VARCHAR(50) DEFAULT 'us_epa',
    role VARCHAR(50) DEFAULT 'user'
    );

-- Alert Subscriptions table
CREATE TABLE IF NOT EXISTS alert_subscriptions (
                                                   id SERIAL PRIMARY KEY,
                                                   user_id INT REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(50) REFERENCES devices(id) ON DELETE CASCADE,
    alert_type VARCHAR(50),
    thresholds JSONB,
    channels JSONB,
    cooldown_min INT,
    quiet_hours JSONB,
    active BOOLEAN DEFAULT TRUE
    );

-- Predictions table
CREATE TABLE IF NOT EXISTS predictions (
                                           id SERIAL PRIMARY KEY,
                                           device_id VARCHAR(50) REFERENCES devices(id) ON DELETE CASCADE,
    predicted_for TIMESTAMP,
    aqi_forecast INT,
    aqi_category VARCHAR(50),
    confidence NUMERIC,
    model_version VARCHAR(50),
    features JSONB
    );

-- ================================================
-- 2) INSERT SEED DATA
-- ================================================

-- Devices
INSERT INTO devices (id, device_key, name, description, latitude, longitude,
                     area_name, altitude, active, last_seen, firmware_version, metadata)
VALUES
    ('AERO-001', 'demo_key_001', 'Connaught Place Station',
     'AeroGuard AI monitoring station at Connaught Place',
     28.6315, 77.2167, 'Central Delhi', 216, TRUE, NOW(), '1.2.0',
     '{"installDate":"2024-01-10","maintainer":"Demo Maintainer"}'),
    ('AERO-002', 'demo_key_002', 'Dwarka Station',
     'AeroGuard AI monitoring station at Dwarka',
     28.5921, 77.0460, 'West Delhi', 220, TRUE, NOW(), '1.2.0',
     '{"installDate":"2024-02-15","maintainer":"Demo Maintainer"}');

-- ================================================
-- Measurements (AERO-001)
WITH hours AS (
    SELECT generate_series(NOW() - INTERVAL '23 hours', NOW(), INTERVAL '1 hour') AS ts
),
     base AS (
         SELECT ts,
                GREATEST(5.0, 35.0 + 12.0 * SIN(EXTRACT(EPOCH FROM ts)/3600.0)
                    + 8.0 * COS(EXTRACT(EPOCH FROM ts)/7200.0))::numeric AS pm25
         FROM hours
     ),
     aqi_calc AS (
         SELECT ts, pm25,
                CASE
                    WHEN pm25 <= 12.0 THEN ROUND((50.0/12.0) * pm25)
                    WHEN pm25 <= 35.4 THEN ROUND(50 + ((100-50)/(35.4-12.1)) * (pm25-12.1))
                    WHEN pm25 <= 55.4 THEN ROUND(100 + ((150-100)/(55.4-35.5)) * (pm25-35.5))
                    WHEN pm25 <= 150.4 THEN ROUND(150 + ((200-150)/(150.4-55.5)) * (pm25-55.5))
                    WHEN pm25 <= 250.4 THEN ROUND(200 + ((300-200)/(250.4-150.5)) * (pm25-150.5))
                    ELSE ROUND(300 + ((500-300)/(500.4-250.5)) * (pm25-250.5))
                    END AS aqi,
                CASE
                    WHEN pm25 <= 12.0 THEN 'good'
                    WHEN pm25 <= 35.4 THEN 'moderate'
                    WHEN pm25 <= 55.4 THEN 'unhealthy_sensitive'
                    WHEN pm25 <= 150.4 THEN 'unhealthy'
                    WHEN pm25 <= 250.4 THEN 'very_unhealthy'
                    ELSE 'hazardous'
                    END AS aqi_category
         FROM base
     )
INSERT INTO measurements (
    device_id, measured_at, iaq_score, co2_equiv, temperature, humidity,
    pressure_hpa, pm25_api, aqi_calculated, aqi_category,
    external_data, quality_flags, rssi, altitude_m
)
SELECT
    'AERO-001',
    ts,
    GREATEST(50, aqi * 1.5),
    (400 + aqi * 6),
    (22 + SIN(EXTRACT(EPOCH FROM ts)/3600.0)*4),
    (55 + COS(EXTRACT(EPOCH FROM ts)/3600.0)*8),
    1013,
    pm25,
    aqi,
    aqi_category,
    jsonb_build_object('source','sql_seed','note','demo data'),
    jsonb_build_object('sensor_warmed_up',true,'overall_valid',true),
    -55,
    216
FROM aqi_calc
ORDER BY ts;

-- ================================================
-- Measurements (AERO-002)
WITH hours AS (
    SELECT generate_series(NOW() - INTERVAL '23 hours', NOW(), INTERVAL '1 hour') AS ts
),
     base AS (
         SELECT ts,
                GREATEST(5.0, 28.0 + 10.0 * COS(EXTRACT(EPOCH FROM ts)/3600.0)
                    + 6.0 * SIN(EXTRACT(EPOCH FROM ts)/5400.0))::numeric AS pm25
         FROM hours
     ),
     aqi_calc AS (
         SELECT ts, pm25,
                CASE
                    WHEN pm25 <= 12.0 THEN ROUND((50.0/12.0) * pm25)
                    WHEN pm25 <= 35.4 THEN ROUND(50 + ((100-50)/(35.4-12.1)) * (pm25-12.1))
                    WHEN pm25 <= 55.4 THEN ROUND(100 + ((150-100)/(55.4-35.5)) * (pm25-35.5))
                    WHEN pm25 <= 150.4 THEN ROUND(150 + ((200-150)/(150.4-55.5)) * (pm25-55.5))
                    WHEN pm25 <= 250.4 THEN ROUND(200 + ((300-200)/(250.4-150.5)) * (pm25-150.5))
                    ELSE ROUND(300 + ((500-300)/(500.4-250.5)) * (pm25-250.5))
                    END AS aqi,
                CASE
                    WHEN pm25 <= 12.0 THEN 'good'
                    WHEN pm25 <= 35.4 THEN 'moderate'
                    WHEN pm25 <= 55.4 THEN 'unhealthy_sensitive'
                    WHEN pm25 <= 150.4 THEN 'unhealthy'
                    WHEN pm25 <= 250.4 THEN 'very_unhealthy'
                    ELSE 'hazardous'
                    END AS aqi_category
         FROM base
     )
INSERT INTO measurements (
    device_id, measured_at, iaq_score, co2_equiv, temperature, humidity,
    pressure_hpa, pm25_api, aqi_calculated, aqi_category,
    external_data, quality_flags, rssi, altitude_m
)
SELECT
    'AERO-002',
    ts,
    GREATEST(50, aqi * 1.5),
    (400 + aqi * 6),
    (24 + SIN(EXTRACT(EPOCH FROM ts)/3600.0 + 0.7)*3),
    (50 + COS(EXTRACT(EPOCH FROM ts)/3600.0 + 0.5)*7),
    1012,
    pm25,
    aqi,
    aqi_category,
    jsonb_build_object('source','sql_seed','note','demo data'),
    jsonb_build_object('sensor_warmed_up',true,'overall_valid',true),
    -58,
    220
FROM aqi_calc
ORDER BY ts;

-- ================================================
-- Users & Alert Subscriptions
INSERT INTO users (email, name, active, units, aqi_standard, role)
VALUES ('shivamkumarjsradp9@gmail.com', 'Shivam Kumar', TRUE, 'metric', 'us_epa', 'user');

INSERT INTO alert_subscriptions (
    user_id, device_id, alert_type, thresholds, channels,
    cooldown_min, quiet_hours, active
)
SELECT id, 'AERO-001', 'threshold',
       '{"aqi": 120, "pm25": 35.4, "iaq": 150}'::jsonb,
    '["email"]'::jsonb,
    60,
       '{"start":"22:00","end":"07:00"}'::jsonb,
    TRUE
FROM users
WHERE email = 'shivamkumarjsradp9@gmail.com';

-- ================================================
-- Predictions (24 hours)
WITH latest AS (
    SELECT d.id AS device_id, m.aqi_calculated AS base_aqi
    FROM devices d
             LEFT JOIN LATERAL (
        SELECT aqi_calculated
        FROM measurements
        WHERE device_id = d.id
        ORDER BY measured_at DESC
            LIMIT 1
    ) m ON TRUE
WHERE d.id IN ('AERO-001', 'AERO-002')
    ),
    future AS (
SELECT
    device_id,
    (NOW() + (i || ' hour')::interval) AS predicted_for,
    GREATEST(10, LEAST(300, COALESCE(base_aqi, 70) + (RANDOM()-0.5)*20))::int AS aqi
FROM latest, generate_series(1,24) AS g(i)
    )
INSERT INTO predictions (
    device_id, predicted_for, aqi_forecast, aqi_category,
    confidence, model_version, features
)
SELECT
    device_id,
    predicted_for,
    aqi,
    CASE
        WHEN aqi <= 50 THEN 'good'
        WHEN aqi <= 100 THEN 'moderate'
        WHEN aqi <= 150 THEN 'unhealthy_sensitive'
        WHEN aqi <= 200 THEN 'unhealthy'
        WHEN aqi <= 300 THEN 'very_unhealthy'
        ELSE 'hazardous'
        END,
    0.80,
    'SQL-Seed-v1',
    '{"source":"sql_seed","lookback_hours":24}'::jsonb
FROM future;

-- ✅ Done
