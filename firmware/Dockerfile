# Firmware Dockerfile using PlatformIO Core
FROM ghcr.io/platformio/platformio-core:latest
WORKDIR /workspace

# Copy firmware sources
COPY . /workspace

# Pre-fetch dependencies and build
RUN pio pkg update && pio run

# Default command rebuilds (can be overridden)
CMD ["pio", "run"]
# Backend environment sample

# Server
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:3001

# Database
DATABASE_URL=postgresql://aqi:aqi_password@localhost:5432/aqi_db?schema=public
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=change_me_jwt
API_KEY_SALT=change_me_salt

# External APIs
OPENWEATHER_API_KEY=your_openweather_api_key
AIRVISUAL_API_KEY=

# Alerts
RESEND_API_KEY=your_resend_api_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_ALERT_CHAT_ID=

# ML
ML_MODEL_PATH=./models
ENABLE_ML_PREDICTIONS=false

# Jobs
ENABLE_JOBS=true

