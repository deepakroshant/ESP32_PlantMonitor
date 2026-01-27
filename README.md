# ESP32 Plant Monitor System

Professional embedded plant monitoring system for ESP32-DevKitC with automated watering control.

## Hardware Configuration

### Pin Mapping
- **BME280 (I2C)**: 
  - SDA → GPIO 33
  - SCL → GPIO 32
  - VCC → 3.3V
  - GND → GND

- **Light Sensor (Digital)**: 
  - Signal → GPIO 35
  - VCC → 3.3V or 5V (depending on module)
  - GND → GND
  - **Note**: LOW = Bright, HIGH = Dark (with internal pull-up)

- **Soil Moisture Sensor (Analog)**: 
  - Signal → GPIO 34
  - VCC → 5V
  - GND → GND

- **5V Relay (Low-Level Trigger)**: 
  - IN → GPIO 25
  - VCC → 5V
  - GND → GND
  - **Note**: LOW = Relay ON, HIGH = Relay OFF

## System Behavior

### Boot Safety
- On startup, relay is immediately set to HIGH (OFF) to prevent accidental watering
- All hardware is initialized before entering main loop

### Sensor Reading
- Sensors are read every 3 seconds
- BME280 provides temperature and humidity
- Light sensor provides digital bright/dark status
- Soil sensor provides analog reading (0-4095 on ESP32)

### Optimal Conditions
- **Temperature**: 18-30°C
- **Light**: LOW (Bright)
- **Soil**: 1500-2800 (analog reading)

### Watering Logic
- **Trigger**: Soil reading > 3000
- **Duration**: 3 seconds
- **Lockout**: 1 minute after watering completes
- Relay activates (LOW) for 3 seconds, then returns to HIGH (OFF)

## Serial Dashboard

Serial output at 115200 baud shows:
```
Time(ms) | Temp(°C) | Hum(%) | Light    | Soil  | Relay
---------|----------|--------|----------|-------|------
12345    | 23.5     | 55.2   | Bright   | 2500  | OFF
  [STATUS] Conditions: OPTIMAL
```

## Building and Uploading

1. Open project in PlatformIO
2. Connect ESP32 via USB
3. Build: `pio run`
4. Upload: `pio run --target upload`
5. Monitor: `pio device monitor`

## Libraries

- Adafruit BME280 Library
- Adafruit Unified Sensor
- Adafruit BusIO

## Safety Features

- Boot safety: Relay OFF on startup
- Lockout period prevents over-watering
- Hardware initialization checks
- Error handling for sensor failures
