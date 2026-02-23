# Smart Plant Pro – Firebase RTDB (Capstone)

ESP32 plant monitor with **Firebase Realtime Database (RTDB)** for multi-user support + unique device pairing:

- BMP280 temperature (I2C)
- Capacitive soil moisture (ADC)
- LDR light sensor (digital)
- Relay-controlled water pump (active-low)

The device writes readings to `devices/<MAC_ADDRESS>/...` and the web app uses Firebase Auth + RTDB to claim devices and display dashboards.

---

## 1. What you must fill in (required setup)

Open `src/main.cpp` and replace these placeholders:

```cpp
const char *WIFI_SSID = "YOUR_WIFI_SSID";
const char *WIFI_PASS = "YOUR_WIFI_PASSWORD";

#define API_KEY "YOUR_FIREBASE_WEB_API_KEY"
#define DB_URL  "https://<your-project-id>.firebaseio.com/"

const char *FIREBASE_USER_EMAIL = "YOUR_DEVICE_USER_EMAIL";
const char *FIREBASE_USER_PASSWORD = "YOUR_DEVICE_USER_PASSWORD";
```

### Where to get each value

- **WIFI_SSID / WIFI_PASS**: your Wi‑Fi network credentials.
- **API_KEY**: Firebase Project → Project Settings → General → “Web API Key”.
- **DB_URL**: Firebase Realtime Database → copy the database URL, e.g. `https://your-project-id-default-rtdb.firebaseio.com/`
- **FIREBASE_USER_EMAIL / FIREBASE_USER_PASSWORD** (recommended):
  - Firebase Auth → enable Email/Password
  - create a dedicated “device user” (or use your own during development)

If you leave email/password empty, **RTDB writes will only work if your RTDB rules allow unauthenticated access** (not recommended).

---

## 2. ESP32 firmware architecture (what it does)

The ESP32 runs three independent FreeRTOS tasks:

- **taskReadSensors** (Core 1, every 5s)
  - reads BMP280 temperature, soil ADC, and LDR
  - stores values in a shared `SensorState` struct

- **taskFirebaseSync** (Core 0, every 10s)
  - pushes `devices/<MAC>/readings`:
    - `temperature`, `soilRaw`, `lightBright`, `pumpRunning`, `health`, `timestamp`
  - `health` example: pump running but soil remains dry

- **taskPumpControl** (Core 0, stream-driven)
  - listens to `devices/<MAC>/control/pumpRequest` using an RTDB stream
  - runs **pulse watering**:
    - pump ON for 1s
    - wait 5s to soak
    - repeat until `soilRaw <= targetSoil`

Important: RTDB calls are protected by a mutex so tasks don’t corrupt the Firebase client.

---

## 3. RTDB paths (schema)

Device identity is the **MAC address** from `WiFi.macAddress()` and is used as:

```text
devices/<MAC_ADDRESS>/
  readings/
    temperature: number | null
    soilRaw: number
    lightBright: boolean
    pumpRunning: boolean
    health: string
    timestamp: number
  control/
    pumpRequest: boolean
    targetSoil: number
  calibration/
    boneDry: number
    submerged: number
users/<uid>/devices/<MAC_ADDRESS>: true
```

To test quickly, create these defaults in RTDB for your device:

```text
devices/<MAC_ADDRESS>/control/pumpRequest = false
devices/<MAC_ADDRESS>/control/targetSoil = 2800
```

---

## 4. Hardware wiring (verified pins)

| Function | GPIO | Notes |
|----------|------|--------|
| I2C SDA | 33 | BMP280 data |
| I2C SCL | 32 | BMP280 clock |
| Soil (analog) | 34 | ~1325 wet, ~3000 dry |
| Light (digital) | 35 | LOW = bright, HIGH = dark (with pull-up) |
| Relay (pump) | 25 | **Active LOW**: LOW = pump ON, HIGH = pump OFF |

- **BMP280**: I2C address **0x77** (temperature only; humidity is not used).
- **Relay**: Ensure the relay module is **active-low**; the code drives **LOW** to turn the pump ON and **HIGH** to turn it OFF.

---

## 5. Safety

- In **`setup()`**, the relay is set to **HIGH (OFF)** before any other init or the RainMaker agent. The pump stays off until the app turns it on or auto-watering runs.
- Pulse watering is handled in `taskPumpControl`.

---

## 6. Build, upload, and monitor

**Requirements**: PlatformIO (VS Code extension or CLI).

1. Open the project in PlatformIO.
2. Connect the ESP32 via USB.
3. **Build**: `pio run` (or **Build** in the PlatformIO IDE).
4. **Upload**: `pio run --target upload` (or **Upload**).
5. **Serial Monitor**: `pio device monitor` (or **Monitor**), at **115200** baud.

Once credentials are filled, you should see:

- Wi‑Fi connect logs + IP
- `Device ID (MAC): <...>`
- RTDB update results (or error reasons)

---

## 7. Web app (React + Tailwind + Firebase)

The frontend lives in **`frontend/`** (Vite + React + TypeScript + Tailwind).

### One-time setup

1. **Firebase Web config**  
   Firebase Console → Project settings → General → “Your apps” → add a Web app (or use existing). Copy the `firebaseConfig` object.

2. **Env file**  
   In `frontend/`, copy `.env.example` to `.env.local` and fill in the Web app values:

   ```bash
   cd frontend
   cp .env.example .env.local
   # Edit .env.local: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN,
   # VITE_FIREBASE_DATABASE_URL, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID
   ```

3. **Install and run**

   ```bash
   npm install
   npm run dev
   ```

   Open the URL shown (e.g. `http://localhost:5173`).

### What the app does

- **Login** (`/login`): Email/password sign-in or sign-up (Firebase Auth).
- **Claim device** (`/claim`): Enter device MAC (from Serial Monitor “Device ID (MAC): …”). Writes `users/<uid>/devices/<MAC>` so the dashboard can list your devices.
- **Dashboard** (`/`): Device dropdown, live readings from `devices/<MAC>/readings` (temperature, soil raw, soil status Soggy/Ideal/Dry/Very dry, light, health), and target moisture (raw threshold) with Save. Pump control is optional (no hardware required for dashboard to work).

### Build for production

```bash
cd frontend
npm run build
```

Output is in `frontend/dist/`. Serve with any static host or Firebase Hosting.

### Deploy to Vercel (no localhost)

1. **Push your project to GitHub** (if not already), including the `frontend/` folder.

2. **Go to [vercel.com](https://vercel.com)** → Sign in → **Add New** → **Project** → Import your repo.

3. **Configure the project**:
   - **Root Directory**: set to `frontend` (so Vercel builds from that folder).
   - **Build Command**: `npm run build` (default).
   - **Output Directory**: `dist` (Vite default).
   - **Install Command**: `npm install` (default).

4. **Environment variables** (Vercel → Project → Settings → Environment Variables). Add these for **Production** (and Preview if you want):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_DATABASE_URL`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_APP_ID`  
   Use the same values as in your `frontend/.env.local`. Vercel will inject them at build time.

5. **Deploy**: Click **Deploy**. Vercel will build and give you a URL (e.g. `https://your-project.vercel.app`). All routes (`/`, `/login`, `/claim`) work because `frontend/vercel.json` rewrites them to `index.html`.

**Optional**: Connect a custom domain in Vercel → Project → Settings → Domains.

---

## 8. Next steps (improvements & capstone)

- **Calibration wizard**: UI to set “bone dry” and “submerged” soil values; store in `devices/<MAC>/calibration` and optionally use them to map raw → percentage in the dashboard.
- **Plant profiles**: Dropdown (e.g. Cactus, Monstera, Fern) that sets a suggested `targetSoil` (or presets) per device.
- **Manual pump toggle**: Button in the dashboard to set `devices/<MAC>/control/pumpRequest` to `true` for on-demand watering (when you have relay hardware).
- **Stricter Firebase rules**: When you lock down auth, restrict RTDB so users can only read/write their own `users/<uid>/devices` and the corresponding `devices/<MAC>` nodes (e.g. by checking `auth.uid` and a `users/<uid>/devices/<MAC>` claim).
- **Deploy frontend**: `npm run build` in `frontend/`, then deploy `frontend/dist/` to Firebase Hosting or another static host and point your domain at it.

---

## 9. Security note

Do **not** commit real Wi‑Fi passwords or Firebase credentials to a public repo. For team projects, move secrets into a private `include/secrets.h` (gitignored) or CI secrets.
# Plant-Monitor
