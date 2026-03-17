# Smart Plant Pro

An IoT plant monitoring and automated watering system built with an ESP32 microcontroller, Firebase Realtime Database, and a React web dashboard.

Smart Plant Pro reads environmental data (temperature, pressure, humidity, soil moisture, light) from sensors wired to an ESP32, syncs readings to Firebase every 3 seconds, and displays them in a real-time web dashboard. It can automatically water your plants on a schedule or on demand, using pulse watering (1s on, 5s soak) to prevent overwatering.

The system supports multiple devices and users. Each ESP32 identifies itself by its MAC address, and users claim devices through the dashboard. No hardcoded credentials — WiFi and Firebase config are entered through a captive portal on first boot.

---

## Features

**Hardware & Firmware**
- Auto-detected BME280 (temp + pressure + humidity) or BMP280 (temp + pressure) via I2C
- Capacitive soil moisture sensor (ADC)
- Digital LDR light sensor
- Relay-controlled water pump with active-low safety (defaults OFF on boot)
- Fake BME280 clone detection (auto-downgrades to BMP280 mode)
- Three concurrent FreeRTOS tasks for sensor reading, Firebase sync, and pump control
- Guest/captive WiFi network blocking (prevents connecting to non-functional networks)

**Dashboard**
- Real-time sensor readings with live/delayed/offline status indicator
- Circular soil moisture gauge with per-device calibration
- 6/12/24-hour history charts (temperature, pressure, humidity, soil)
- Manual "Water Now" button with cooldown
- Automated watering schedule (time-based, soil hysteresis, daily cap, cooldown)
- Plant profiles with custom thresholds per device
- Health alerts with browser push notifications
- Multi-device support with device naming and room assignment
- Watering log and diagnostics panel
- Dark mode
- Responsive design (mobile, tablet, desktop)

**Setup & Security**
- One-time WiFi setup via captive portal (no reflashing needed)
- Optional Firebase credentials via same portal (PIN-gated)
- Remote WiFi reset from dashboard
- Input sanitization and rate limiting
- Credentials stored in NVS (flash), never in source code

---

## Architecture

```
┌─────────────────────┐       WiFi        ┌──────────────────┐       HTTPS       ┌─────────────────────┐
│     ESP32 Device    │ ────────────────── │  Firebase RTDB   │ ◄──────────────── │   React Dashboard   │
│                     │    push every 3s   │  + Firebase Auth │   real-time       │   (Vite + Tailwind) │
│  BME280/BMP280      │                    │                  │   onValue()       │                     │
│  Soil sensor (ADC)  │                    │  devices/{MAC}/  │   listeners       │  Hosted on Vercel   │
│  LDR (digital)      │                    │  users/{uid}/    │                   │                     │
│  Relay (pump)       │                    │  deviceList/     │                   │                     │
└─────────────────────┘                    └──────────────────┘                   └─────────────────────┘
```

**Data flow:** Sensors → ESP32 (FreeRTOS tasks) → Firebase RTDB → React dashboard (real-time listeners)

**Control flow:** Dashboard → Firebase RTDB (`control/*` paths) → ESP32 polls every 1s → executes command

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Firmware** | ESP32 (Arduino framework), FreeRTOS, PlatformIO |
| **Sensors** | Adafruit BME280/BMP280, capacitive soil, LDR |
| **Networking** | WiFiManager (captive portal), Firebase-ESP-Client, ArduinoOTA (stubbed) |
| **Backend** | Firebase Realtime Database, Firebase Authentication |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Recharts, Framer Motion |
| **Deployment** | Vercel (frontend), Firebase (backend) |

---

## Quick Start

### 1. Flash the firmware

```bash
# Install PlatformIO CLI or VS Code extension
# Clone the repo and connect your ESP32 via USB

# For ESP32-D (DevKit):
pio run -e esp32dev -t upload

# For ESP32-S3 Zero (Waveshare):
pio run -e esp32-s3-zero -t upload

# Monitor serial output:
pio device monitor -b 115200
```

### 2. Configure WiFi

1. On first boot, the ESP32 creates an AP named **SmartPlantPro_XXXXXX** (last 6 hex of MAC)
2. Join the AP from your phone or laptop
3. Open **http://192.168.4.1** in a browser
4. Enter your home WiFi SSID and password
5. (Optional) Enter Firebase credentials behind the PIN gate (PIN: `1234`)
6. Click Save — the device connects and starts syncing

### 3. Set up the dashboard

```bash
cd frontend
cp .env.example .env.local
# Fill in Firebase config from Firebase Console → Project Settings → Your Apps → Web App

npm install
npm run dev
# Open http://localhost:5173
```

1. Create an account (sign up with email/password)
2. Click **Claim Device** and enter your device's MAC address (shown in serial monitor)
3. View live readings on the dashboard

For detailed setup instructions, see the [User Manual](docs/user-manual.md).

---

## Hardware

### Supported Boards

| Board | PlatformIO Environment | Notes |
|-------|----------------------|-------|
| ESP32-D (DevKit) | `esp32dev` | Standard 38-pin devkit |
| ESP32-S3 Zero (Waveshare) | `esp32-s3-zero` | Compact, 4MB flash |

### Sensors & Components

| Component | Purpose |
|-----------|---------|
| BME280 or BMP280 | Temperature, pressure (+ humidity if BME280) via I2C |
| Capacitive soil moisture sensor | Soil moisture via ADC (higher = drier) |
| LDR light sensor module | Ambient light (digital: LOW = bright) |
| Relay module (active-low) | Water pump control |
| Water pump + tubing | Automated watering |

For wiring diagrams and pin assignments per board, see [Hardware Assembly](docs/user-manual.md#2-hardware-assembly) in the User Manual.

---

## Project Structure

```
ESP32_PlantMonitor/
├── src/
│   ├── main.cpp                  # All firmware logic (FreeRTOS tasks, WiFi, Firebase)
│   ├── firebase_defaults.h       # Compile-time Firebase credential fallbacks
│   └── secrets.h.example         # Template for gitignored secrets.h
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Router (login, claim, dashboard, overview)
│   │   ├── pages/                # LoginPage, ClaimDevicePage, DashboardPage, OverviewPage
│   │   ├── components/           # UI components (gauges, charts, grids, icons)
│   │   ├── context/              # AuthContext, ThemeContext
│   │   ├── utils/                # soil.ts, deviceStatus.ts, sanitize.ts, profileTips.ts
│   │   ├── lib/                  # Firebase init, motion helpers
│   │   └── types.ts              # TypeScript type definitions
│   ├── .env.example              # Firebase config template
│   └── vercel.json               # SPA rewrite rule for Vercel
├── platformio.ini                # Build config, board environments, library deps
├── PLAN.md                       # Feature roadmap and implementation status
├── SECURITY.md                   # Credential handling guidelines
└── docs/
    ├── user-manual.md            # End-to-end usage guide
    └── developer-guide.md        # Codebase walkthrough and handoff guide
```

---

## Documentation

- **[User Manual](docs/user-manual.md)** — Hardware assembly, firmware flashing, WiFi setup, dashboard usage, watering, calibration, troubleshooting
- **[Developer Guide](docs/developer-guide.md)** — Architecture deep-dive, firmware walkthrough, Firebase schema, frontend structure, common task recipes, gotchas
- **[PLAN.md](PLAN.md)** — Feature roadmap and implementation status
- **[SECURITY.md](SECURITY.md)** — Credential handling and rotation procedures
