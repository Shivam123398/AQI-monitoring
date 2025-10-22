# AeroGuard AI - ESP32 Firmware

## Quick Start

### 1. Hardware Assembly
- Connect sensors per pinout in `include/config.h`
- Verify I2C addresses: `i2cdetect` or run LCD/BMP180 test sketches
- Power via USB (5V/2A recommended)

### 2. Configuration
- Edit `include/config.h`:
  - Set `DEVICE_ID` (unique per node)
  - Set `DEVICE_KEY` (provision from backend)
  - Configure MQTT broker OR API endpoint
  - Adjust `MQ135_R0_CLEAN_AIR` after calibration

### 3. Flash Firmware
```bash
pio run -t upload
pio device monitor