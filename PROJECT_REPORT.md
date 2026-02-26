# Smart Plant Pro — Full Project Report

> **Purpose of this document:** Provide complete context about the Smart Plant Pro project — architecture, tech stack, data flow, features, file structure, Firebase schema, and current state — so that any AI assistant or developer can immediately understand and continue work on it.

---

## 1. Project Overview

**Smart Plant Pro** is a full-stack IoT plant monitoring system. An ESP32 microcontroller reads environmental sensors (temperature, soil moisture, light) and pushes real-time data to Firebase Realtime Database every 3 seconds. A React web dashboard displays live readings, device status, historical charts, and allows remote control of a water pump — all synced through Firebase.

### High-level architecture

```
┌──────────────────┐       WiFi        ┌──────────────────────┐       HTTPS        ┌──────────────────────┐
│   ESP32 Device   │ ──────────────▶   │  Firebase RTDB       │ ◀──────────────▶   │  React Web Dashboard │
│  (Sensors+Pump)  │   Push JSON       │  (Cloud NoSQL DB)    │   onValue listener │  (Vercel hosted)     │
└──────────────────┘   every 3s        └──────────────────────┘                    └──────────────────────┘
                                                │
                                       Firebase Auth (email/pass)
                                       Used by both ESP32 and web app
```

### Key principles
- **Free tier only** — No Cloud Functions, no paid services. Everything runs on Firebase Spark (free) plan.
- **Real-time** — 3-second sync interval; dashboard updates live via Firebase `onValue` listeners.
- **No hardcoded WiFi** — WiFiManager captive portal for first-time setup; credentials stored in ESP32 NVS flash.
- **FreeRTOS multitasking** — Three concurrent tasks on the ESP32's dual cores for sensors, Firebase sync, and pump control.

---

## 2. Tech Stack

### 2.1 Firmware (ESP32)

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **MCU** | ESP32 (dual-core Xtensa LX6, 240 MHz, 520 KB SRAM) | Runs FreeRTOS, reads sensors, controls pump |
| **Framework** | Arduino (via PlatformIO) | Hardware abstraction layer |
| **Build system** | PlatformIO | Dependency management, compilation, upload |
| **RTOS** | FreeRTOS (built into ESP-IDF/Arduino) | Task scheduling, mutexes, semaphores |
| **WiFi provisioning** | WiFiManager (tzapu v2.0.16) | Captive portal AP "SmartPlantPro" for first-time WiFi setup |
| **Cloud sync** | Firebase-ESP-Client (mobizt) | HTTPS JSON push to Firebase RTDB |
| **OTA updates** | ArduinoOTA | Over-the-air firmware upload via WiFi |
| **NVS storage** | Preferences library | Persists Firebase config, WiFi credentials in flash |
| **Time sync** | NTP (pool.ntp.org) | Accurate Unix epoch timestamps |

**Sensors:**
| Sensor | Pin | Type | What it measures |
|--------|-----|------|-----------------|
| BMP280 | I2C (SDA=33, SCL=32) | Temperature | Air temperature in °C |
| Capacitive soil probe | GPIO 34 (ADC) | Soil moisture | Raw ADC 0–4095 (lower = wetter) |
| LDR module | GPIO 35 (Digital) | Light | Bright (LOW) / Dim (HIGH) |
| Relay | GPIO 25 | Output (active LOW) | Controls water pump on/off |

### 2.2 Frontend (Web Dashboard)

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **UI framework** | React | 19.2 | Component-based UI |
| **Language** | TypeScript | 5.9 | Type safety |
| **Bundler** | Vite | 7.3 | Fast dev server + production builds |
| **Styling** | Tailwind CSS | 3.4 | Utility-first CSS with custom design tokens |
| **Animations** | Framer Motion | 12.34 | Smooth transitions, mount/unmount animations |
| **Charts** | Recharts | 3.7 | Line charts for historical sensor data |
| **Routing** | React Router DOM | 7.13 | SPA routing (Login, Dashboard, Claim Device) |
| **Backend** | Firebase Auth + Realtime Database | 12.9 | Authentication + real-time data sync |
| **Hosting** | Vercel | — | Auto-deploys from GitHub on push to `main` |

### 2.3 Cloud / Backend

| Service | Plan | Purpose |
|---------|------|---------|
| Firebase Realtime Database | Spark (free) | Stores all device data, readings, profiles, alerts |
| Firebase Authentication | Free | Email/password auth for web users AND ESP32 device |
| Vercel | Hobby (free) | Hosts the React frontend, auto-deploys from GitHub |
| GitHub | Free | Source control, two remotes (personal + org) |

---

## 3. FreeRTOS Task Architecture

The ESP32 has two CPU cores. Tasks are pinned to specific cores to avoid blocking:

```
Core 0                              Core 1
┌─────────────────────┐            ┌─────────────────────┐
│ taskReadSensors     │            │ taskFirebaseSync    │
│ (every 2s)          │            │ (every 3s)          │
│ - Read BMP280 temp  │            │ - Push JSON to RTDB │
│ - Read soil ADC     │  shared    │ - Update deviceList │
│ - Read LDR          │◀─mutex──▶ │ - Write alerts      │
│ - Write gState      │           │ - Push history (5m)  │
│ - Set gSensorReady  │            │ - Check reprovision │
└─────────────────────┘            ├─────────────────────┤
                                   │ taskPumpControl     │
                                   │ (event-driven)      │
                                   │ - Listen pumpRequest│
                                   │ - Pulse relay on/off│
                                   │ - Check target soil │
                                   └─────────────────────┘
```

### Synchronization
- **`gStateMutex`** — Protects the shared `SensorState` struct between sensor read and Firebase sync tasks.
- **`gFirebaseMutex`** — Serializes all Firebase API calls (sync, pump, alerts) to prevent concurrent HTTPS requests.
- **`gSensorReady`** — Volatile flag; Firebase sync waits until the first real sensor reading before pushing, preventing garbage default values (0°C, 0 soil) from reaching the dashboard.
- **`gPumpRequest`** — Set by Firebase stream callback when the user taps "Water now" in the dashboard.

### Data flow (sensor → dashboard)
1. `taskReadSensors` reads BMP280, soil ADC, LDR every 2 seconds → writes to `gState`
2. `taskFirebaseSync` reads `gState` every 3 seconds → builds JSON → `Firebase.RTDB.updateNode()` to `devices/{MAC}/readings`
3. Firebase RTDB stores the JSON
4. React dashboard has `onValue(ref(firebaseDb, 'devices/{MAC}/readings'))` listener → state update → re-render

---

## 4. Firebase Realtime Database Schema

```
root/
├── deviceList/
│   └── {MAC}/
│       ├── lastSeen: 1738500000          // Unix epoch, updated every sync
│       └── claimedBy: "uid_abc123"       // UID of claiming user (or null)
│
├── devices/
│   └── {MAC}/
│       ├── readings/
│       │   ├── temperature: 24.8         // °C from BMP280
│       │   ├── soilRaw: 2150             // ADC 0–4095
│       │   ├── lightBright: true         // LDR digital
│       │   ├── pumpRunning: false        // relay state
│       │   ├── health: "OK"             // "OK" | "Overheat" | "Pump running, soil still dry"
│       │   ├── timestamp: 1738500000     // Unix epoch (NTP)
│       │   ├── wifiSSID: "TELUS8180"     // connected network name
│       │   └── wifiRSSI: -35             // signal strength dBm
│       │
│       ├── control/
│       │   ├── targetSoil: 2800          // pump stops when soilRaw <= this
│       │   ├── pumpRequest: false        // true = user wants manual water pulse
│       │   └── resetProvisioning: false  // true = clear WiFi+NVS, reboot to AP
│       │
│       ├── calibration/
│       │   ├── boneDry: 3500             // user-marked dry reading
│       │   └── submerged: 1200           // user-marked wet reading
│       │
│       ├── alerts/
│       │   └── lastAlert/
│       │       ├── timestamp: 1738499500
│       │       ├── type: "health"
│       │       ├── message: "Overheat"
│       │       └── ackAt: 1738499600     // set when user dismisses
│       │
│       └── history/
│           └── {epoch}/                  // pushed every ~5 min
│               ├── t: 24.8              // temperature
│               ├── s: 2150              // soilRaw
│               └── l: 1                 // light (1=bright, 0=dim)
│
└── users/
    └── {uid}/
        ├── devices/
        │   └── {MAC}/
        │       └── claimedAt: 1738400000
        │
        ├── plantProfiles/
        │   └── {pushId}/
        │       ├── name: "Living Room Monstera"
        │       ├── type: "Monstera"
        │       └── createdAt: 1738400000
        │
        ├── devicePlant/
        │   └── {MAC}: "{pushId}"         // links a device to a plant profile
        │
        └── invites/
            └── {emailKey}/
                ├── email: "friend@example.com"
                └── at: 1738400000
```

---

## 5. File Structure

```
ESP32_PlantMonitor/
├── platformio.ini                    # PlatformIO config (ESP32, libs, OTA settings)
├── src/
│   └── main.cpp                      # ALL firmware code (~594 lines)
│
├── frontend/                         # React web app (Vercel root directory)
│   ├── package.json                  # Dependencies: react, firebase, recharts, framer-motion
│   ├── tailwind.config.js            # Design tokens: colors, fonts, shadows, animations
│   ├── index.html                    # Entry HTML (Google Fonts: Inter, Plus Jakarta Sans)
│   ├── src/
│   │   ├── main.tsx                  # React entry point, wraps App in AuthProvider
│   │   ├── App.tsx                   # Router: /login, /claim, / (dashboard)
│   │   ├── App.css                   # (empty, unused)
│   │   ├── index.css                 # Global styles, Tailwind layers, component classes
│   │   │
│   │   ├── lib/
│   │   │   └── firebase.ts           # Firebase init from env vars (VITE_FIREBASE_*)
│   │   │
│   │   ├── context/
│   │   │   └── AuthContext.tsx        # React context: signIn, signUp, signOut, user state
│   │   │
│   │   ├── utils/
│   │   │   └── soil.ts               # soilStatus, soilRawToGauge, soilRawToGaugeCalibrated
│   │   │
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx          # Email/pass login + signup, glassmorphism card
│   │   │   ├── ClaimDevicePage.tsx     # Discover devices (online/claimed/available), manual MAC entry
│   │   │   └── DashboardPage.tsx      # Main dashboard (~1250 lines): sensors, status, charts, pump, profiles
│   │   │
│   │   └── components/
│   │       ├── CircularGauge.tsx       # SVG circular gauge for soil moisture %
│   │       ├── HistoryChart.tsx        # Recharts line chart (temp + soil, 6/12/24h range tabs)
│   │       ├── ProtectedRoute.tsx      # Auth guard + loading skeleton
│   │       └── icons/                  # SVG icon components (Plant, Sun, Thermometer, etc.)
│   │
│   └── public/
│       └── plant-icon.svg             # Notification icon
│
├── PLAN.md                            # Master improvement plan with status tracking
├── TEST_AND_OVERVIEW.md               # Testing guide
├── PROJECT_REPORT.md                  # This file
└── .gitignore                         # Ignores .pio, node_modules, .DS_Store, .env files
```

---

## 6. Features (Complete List)

### 6.1 Firmware Features
| Feature | Description |
|---------|-------------|
| **WiFiManager provisioning** | First boot creates AP "SmartPlantPro"; user connects and enters WiFi + optional Firebase creds via captive portal at 192.168.4.1 |
| **Branded portal** | Custom CSS injection: green brand bar, plant emoji, styled buttons/inputs matching the web app theme |
| **WiFi validation** | 3 connection retries with 15s timeout; portal stays open on failure instead of rebooting |
| **Firebase NVS storage** | API key, DB URL, email, password saved in ESP32 flash; survives reboots; cleared on re-provision |
| **NTP time sync** | Real Unix epoch timestamps (not uptime); syncs from pool.ntp.org on boot |
| **Sensor ready gate** | `gSensorReady` flag prevents pushing default/zero values before first real sensor read |
| **Health monitoring** | Computes health string: "OK", "Overheat" (>45°C), "Pump running, soil still dry" |
| **Alert writing** | Writes `lastAlert` to RTDB when health != OK |
| **History snapshots** | Pushes compact {t, s, l} JSON to `history/{epoch}` every ~5 minutes for charting |
| **WiFi info reporting** | Pushes `wifiSSID` and `wifiRSSI` with every sync for dashboard display |
| **Remote re-provisioning** | Listens for `control/resetProvisioning` flag; clears NVS + WiFi, reboots to AP mode |
| **Pump control** | Stream listener for `pumpRequest`; pulse watering (1s on, 5s soak) until soil target reached |
| **OTA updates** | ArduinoOTA enabled; set `upload_port` in platformio.ini to device IP for wireless flashing |

### 6.2 Frontend Features
| Feature | Description |
|---------|-------------|
| **Authentication** | Email/password sign-in and sign-up via Firebase Auth |
| **Device discovery** | Lists all devices from `deviceList/`; shows online/offline/claimed/available status |
| **Device claiming** | One-click claim from discovery list or manual MAC entry |
| **6-state device status** | Live (green pulse), Delayed (amber), Offline (red), Syncing (blue), Resetting (amber), No data (grey) |
| **Real-time sensor cards** | Temperature (°C), Soil moisture (circular gauge with %), Light (Bright/Dim) — all animate on update |
| **Circular soil gauge** | SVG gauge with gradient color (red→amber→green based on %), supports user calibration |
| **Soil calibration** | "Mark as dry" / "Mark as wet" buttons; gauge recalculates % based on user's actual sensor range |
| **History chart** | Recharts line chart with temperature + soil raw; 6h/12h/24h range selector tabs |
| **Target moisture slider** | Drag slider (0–4095) to set pump activation threshold; saved to RTDB |
| **Manual pump control** | "Water now" button with 8s cooldown; live pump status indicator |
| **Plant profiles** | Create/edit/delete named plant profiles (e.g., "Living Room Monstera", type: "Monstera") |
| **Example plants dropdown** | Preset plants (Mint/2000, Sunflower/2400, Herb/2200, Succulent/1800, Tomato/2600) auto-set type + target moisture |
| **Device-profile linking** | Link a plant profile to a device; shows plant name/type in hero section |
| **WiFi status display** | Shows connected SSID + RSSI when live; "Last WiFi: X" when stale/offline |
| **Offline detection** | Stale after 12s (amber), offline after 30s (red); sensor cards blur + "Data frozen" overlay |
| **Offline troubleshooting** | Banner with hints: "Check power supply", "Check WiFi range", "Try resetting WiFi" |
| **Reset WiFi flow** | Button sends `resetProvisioning` to RTDB; 5-step guided reconnection flow; phased sync detection |
| **Alert display** | Shows last alert with timestamp and "Dismiss" button (writes `ackAt`) |
| **Browser notifications** | Toggle switch; uses Notification API to show native OS notification when health drops |
| **Pro tips** | Context-aware tips (e.g., "Temperature above 28°C, consider adjusting moisture target") |
| **Invite users** | Copy app URL; add emails to invite list |
| **Loading skeleton** | Branded loading screen while auth state resolves |
| **Responsive design** | Mobile-first; works on phones, tablets, desktops |

### 6.3 Design System
| Token | Value | Usage |
|-------|-------|-------|
| Primary (green) | `#22C55E` (+ scale 50–800) | Buttons, badges, active states |
| Forest (dark green) | `#14332A` | Text, dark accents |
| Mint | `#ECFDF5` | Light green backgrounds |
| Terracotta (red) | `#EF4444` | Alerts, errors, offline states |
| Surface | `#F7FAF8` | Page background |
| Font: sans | Inter | Body text |
| Font: display | Plus Jakarta Sans | Headings, large numbers |
| Font: mono | JetBrains Mono | MAC addresses, code |
| Cards | Glassmorphism (blur + white/80 + subtle border) | All content cards |
| Animations | Framer Motion (fade-in, slide-up, scale) | Page transitions, card mounts |

---

## 7. Data Flow Diagrams

### 7.1 First-time device setup
```
1. Power on ESP32 (no WiFi saved)
2. ESP32 starts WiFiManager AP: "SmartPlantPro"
3. User connects phone/laptop to "SmartPlantPro" WiFi
4. Captive portal opens at 192.168.4.1 (branded UI)
5. User selects home WiFi SSID, enters password
6. (Optional) User enters Firebase API key, DB URL, email, password
7. ESP32 saves to NVS, connects to WiFi
8. ESP32 syncs NTP time, initializes Firebase, starts 3 FreeRTOS tasks
9. Sensors begin reading; after first real read, Firebase sync starts pushing
```

### 7.2 Normal operation loop (every 3 seconds)
```
ESP32:
  taskReadSensors → read BMP280/soil/LDR → update gState (mutex)
  taskFirebaseSync → read gState (mutex) → build JSON → HTTPS PUT to Firebase RTDB
    → also: update deviceList/{MAC}/lastSeen
    → also: if health != OK → write alerts/lastAlert
    → also: every 100 cycles (~5 min) → push to history/{epoch}

Dashboard (React):
  onValue listener fires → setReadings(data) → React re-renders
  useEffect ticks nowSec every 2s → updates "last seen" counter + status detection
```

### 7.3 Remote WiFi reset
```
1. User clicks "Reset WiFi" in dashboard
2. Frontend writes: control/resetProvisioning = true, readings = null
3. Dashboard shows "Reconnecting device…" guide with 5 steps
4. ESP32 taskFirebaseSync detects flag → clears NVS + WiFi → reboots
5. ESP32 enters AP mode ("SmartPlantPro")
6. User connects to AP, enters new WiFi
7. ESP32 connects, resumes syncing
8. Dashboard detects new timestamp > resetRequestedAt → phased sync:
   idle → wifi-connected (SSID appears) → synced (sensor data arrives)
```

### 7.4 Manual pump control
```
1. User clicks "Water now" in dashboard
2. Frontend writes: control/pumpRequest = true
3. ESP32 Firebase stream callback sets gPumpRequest = true
4. taskPumpControl: relay ON (1s pulse) → relay OFF (5s soak) → check soil
5. If soilRaw <= targetSoil → clear pumpRequest, stop
6. If not → repeat pulse/soak cycle
7. Dashboard shows live pumpRunning state from readings
```

---

## 8. Environment & Configuration

### 8.1 Firmware (compile-time defaults in main.cpp)
```cpp
#define API_KEY "AIzaSyCZBClU2J2bV9b3Tm9uvuPteQhNF0nwJQ4"
#define DB_URL  "https://esw-plantmonitor-default-rtdb.firebaseio.com/"
const char *FIREBASE_USER_EMAIL = "deepakroshan73@gmail.com";
const char *FIREBASE_USER_PASSWORD = "123456";
```
These are overridden by NVS values if the user enters custom Firebase credentials in the WiFiManager portal.

### 8.2 Frontend (environment variables)
The React app reads from `frontend/.env.local` (not committed to git):
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```
These same values must be set in Vercel's Environment Variables for production builds.

### 8.3 PlatformIO (platformio.ini)
```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200
lib_deps = 
    adafruit/Adafruit Unified Sensor@^1.1.9
    adafruit/Adafruit BusIO@^1.14.5
    adafruit/Adafruit BMP280 Library@^2.6.6
    https://github.com/mobizt/Firebase-ESP-Client.git
    tzapu/WiFiManager@^2.0.16
```

---

## 9. Timing Configuration

| Parameter | Value | Where |
|-----------|-------|-------|
| Sensor read interval | 2 seconds | `SENSOR_READ_INTERVAL_MS` in main.cpp |
| Firebase sync interval | 3 seconds | `FIREBASE_SYNC_INTERVAL_MS` in main.cpp |
| History snapshot interval | ~5 minutes (100 cycles × 3s) | `histCycles >= 100` in main.cpp |
| Frontend stale threshold | 12 seconds | `isStale = secondsAgo > 12` in DashboardPage.tsx |
| Frontend offline threshold | 30 seconds | `isOffline = secondsAgo > 30` in DashboardPage.tsx |
| Frontend status tick | 2 seconds | `setInterval` in DashboardPage.tsx |
| Pump pulse duration | 1 second on | `PUMP_PULSE_MS` in main.cpp |
| Pump soak duration | 5 seconds off | `PUMP_SOAK_MS` in main.cpp |
| Pump cooldown (UI) | 8 seconds | `setTimeout` in DashboardPage.tsx |

---

## 10. Deployment

### GitHub
Two remotes configured:
- `origin` → `https://github.com/eswubc/ESP32_PlantMonitor.git` (organization)
- `personal` → `https://github.com/deepakroshant/ESP32_PlantMonitor.git` (personal, linked to Vercel)

Push to both: `git push personal main && git push origin main`

### Vercel
- Connected to `deepakroshant/ESP32_PlantMonitor`
- **Root directory:** `frontend`
- **Framework:** Vite
- **Build command:** `npm run build`
- **Output:** `dist`
- Auto-deploys on every push to `main`

### Firmware upload
- **USB:** `pio run --target upload` (or PlatformIO IDE button)
- **OTA (WiFi):** Set `upload_port = <device-IP>` and `upload_protocol = espota` in platformio.ini

---

## 11. Current State & Known Limitations

### What's done (22/22 planned items complete)
All items from PLAN.md are implemented except two that require paid services or hardware changes:
- Per-device auth (needs Cloud Functions → paid billing)
- Multi-slot (needs additional hardware: multiple soil probes + relays)

### Flash usage
- **RAM:** 16.8% (55 KB / 328 KB)
- **Flash:** 97.1% (1.27 MB / 1.31 MB) — tight; future features may need partition table changes

### Known limitations
1. **Flash is nearly full (97%)** — Adding significant new firmware features may require switching to a larger partition scheme or optimizing the Firebase-ESP-Client library usage.
2. **Single Firebase user for device auth** — All ESP32 devices share one Firebase email/password. Proper per-device tokens would require Cloud Functions (paid).
3. **No push notifications when dashboard is closed** — Browser Notification API only works when the tab is open. True background push would need a Service Worker + FCM (which needs Cloud Functions for the server key).
4. **History data grows unbounded** — The `history/` node accumulates forever. A cleanup mechanism (e.g., client-side deletion of entries older than 7 days) should be added.
5. **No multi-device pump hardware** — Pump control assumes one relay per ESP32 board.
6. **Firebase RTDB rules** — Currently using relatively open rules for development; should be tightened for production.

---

## 12. How to Set Up From Scratch

### Prerequisites
- ESP32 dev board with BMP280, capacitive soil sensor, LDR, relay
- Node.js (18+), npm
- PlatformIO CLI or VS Code extension
- Firebase project (Spark/free plan)

### Steps
1. **Clone:** `git clone https://github.com/deepakroshant/ESP32_PlantMonitor.git`
2. **Firmware:** Open in PlatformIO; edit default Firebase credentials in `src/main.cpp` if needed; `pio run --target upload`
3. **First boot:** Connect to "SmartPlantPro" AP → enter WiFi + Firebase creds at 192.168.4.1
4. **Frontend:** `cd frontend && cp .env.example .env.local` → fill Firebase config → `npm install && npm run dev`
5. **Web login:** Sign up at the login page
6. **Claim device:** Go to "Add device" → device appears in list → click "Claim"
7. **Dashboard:** Live data appears within 3 seconds

---

## 13. Summary of Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Firebase RTDB over Firestore | Lower latency for real-time sensor data; simpler JSON structure; better ESP32 library support |
| FreeRTOS tasks over loop() | Prevents blocking (SSL handshakes block for 1-2s); sensor reads stay consistent regardless of network |
| Firebase sync on Core 1 | Keeps Core 0's idle task running to prevent watchdog timer resets during long SSL operations |
| WiFiManager over hardcoded WiFi | Users can change networks without reflashing; supports field deployment |
| NTP over millis() | Accurate timestamps that work across device reboots and match the frontend's Date.now() |
| Recharts over Chart.js | Better React integration, tree-shakeable, composable API |
| Tailwind over CSS modules | Faster iteration, consistent design tokens, responsive utilities built-in |
| Vercel over Firebase Hosting | Zero-config React deploys, automatic HTTPS, preview deployments on PR |
| 3s sync interval | Near-real-time feel; well within Firebase free tier limits (~0.5 GB/month); no ESP32 performance impact |
| `gSensorReady` gate | Prevents dashboard from briefly showing 0°C / 0% when device first boots |

---

*Last updated: February 2026*
