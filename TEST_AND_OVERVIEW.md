# Smart Plant Pro – Brief Overview & How to Test

## 1. What the project is (brief overview)

**Smart Plant Pro** is an **IoT plant monitor**: one ESP32 per plant (or zone) that reads sensors, sends data to the cloud, and can run a water pump. A **web app** lets you claim devices, see live readings, set targets, and manage plant profiles.

- **Device (ESP32):** Reads temperature (BMP280), soil moisture (ADC), and light (LDR). Sends readings to **Firebase Realtime Database** every few seconds. Listens for “water now” and runs a relay (pump) in short pulses until soil is wet enough. **No WiFi or Firebase in code** after first setup: you configure both once via a **captive portal** (phone/laptop at 192.168.4.1).
- **Cloud (Firebase):** One Realtime Database holds all devices and users. Data lives under `devices/<MAC>/...` (readings, control, calibration, alerts) and `users/<uid>/...` (claimed devices, plant profiles). Device and app both talk to the same database.
- **Web app (React):** Login with email/password, **claim** a device (by MAC), then use the **dashboard** for that device: live soil/temp/light, circular gauge, plant name/type, target moisture slider, **calibrate soil** (mark dry/wet), **reset device WiFi**, plant profiles, example plants, and alerts when health is bad.

So the flow is: **ESP32 → WiFi (provisioned once) → Firebase ← Web app**. You see the same plant data in the dashboard that the ESP32 is writing.

---

## 2. How provisioning will look (step by step)

### First time you power the ESP32 (no WiFi saved)

1. **Serial (optional):** Plug USB, open Serial Monitor (115200). You’ll see:
   - `Smart Plant Pro – Firebase RTDB`
   - Then the ESP32 starts an **access point** named **SmartPlantPro** (no WiFi credentials in flash yet).

2. **On your phone or laptop:** Open Wi‑Fi settings and join the network **SmartPlantPro** (no password).

3. **Captive portal:** Often a browser will open automatically. If not, open a browser and go to **http://192.168.4.1**.

4. **What you see:** A WiFiManager page with:
   - **WiFi SSID** (dropdown or text)
   - **WiFi Password**
   - **Firebase API Key** (text)
   - **Firebase DB URL** (text)
   - **Firebase user email** (text)
   - **Firebase user password** (text)

5. **What to enter:**
   - Your home **WiFi name** and **password** (required).
   - **Either** leave Firebase fields empty (device will use the defaults compiled in `main.cpp`) **or** fill all four Firebase fields so this device uses that project/account and nothing is hardcoded.

6. **Save:** Click the button to save. The ESP32:
   - Saves WiFi (and Firebase, if you filled them) to NVS.
   - Connects to your WiFi.
   - Connects to Firebase and starts sending readings.
   - Serial will show: `WiFi connected, IP: ...`, `Device ID (MAC): ...`, `ArduinoOTA ready.`, `Firebase is ready.`, `Firebase stream started.`

7. **Next boots:** The ESP32 will connect straight to your WiFi and Firebase using saved NVS data. You won’t see the portal again unless you **reset** (see below).

### Changing WiFi or Firebase later (“re-provisioning”)

1. Open the **web app** → **Dashboard**.
2. Select the **device** (by MAC) in the dropdown.
3. Click **“Reset device WiFi”**.
4. The ESP32 sees the flag in Firebase, **clears** both WiFi and Firebase data from NVS, and **restarts**.
5. It comes back up with **no** saved WiFi, so it starts the **SmartPlantPro** AP again.
6. Join **SmartPlantPro**, open **http://192.168.4.1**, and enter the **new** WiFi (and optionally new Firebase). Save. From then on it uses the new config.

So: **first time = power on → join SmartPlantPro → 192.168.4.1 → fill form → save**. Later: **app → Reset device WiFi → device restarts in AP → same portal again.**

---

## 3. How to test this much

### Prerequisites

- ESP32 board, USB cable.
- WiFi network and (if you use the app) Firebase project with Realtime Database and Auth (Email/Password) set up.
- **Option A:** Use Firebase defaults in `main.cpp` (edit API_KEY, DB_URL, email, password once and flash).  
- **Option B:** Leave defaults as-is for first flash, then at 192.168.4.1 enter your Firebase details so the device uses them from NVS.

### Step 1: Build and flash the ESP32

1. Open the project in PlatformIO (e.g. in VS Code).
2. Set Firebase defaults in `src/main.cpp` if you’re not using the portal for Firebase (see README).
3. Build: **PlatformIO: Build** (or `pio run`).
4. Connect the ESP32 via USB and upload: **PlatformIO: Upload** (or `pio run -t upload`).
5. Open **Serial Monitor** (115200) to watch logs.

### Step 2: First boot – WiFiManager portal

1. Power or reset the ESP32. Serial should show it starting the **SmartPlantPro** AP.
2. On your phone/laptop, join Wi‑Fi **SmartPlantPro**.
3. In a browser, go to **http://192.168.4.1**.
4. Enter your **WiFi SSID** and **password**.  
   - To test “Firebase from portal”: fill **Firebase API Key**, **DB URL**, **email**, **password** and save.  
   - To test “defaults in code”: leave Firebase fields empty and save.
5. After Save, Serial should show WiFi connected, device ID (MAC), Firebase ready, stream started.

### Step 3: Run the web app

1. In the repo: `cd frontend`, then `npm install` and `npm run dev`.
2. Open the URL shown (e.g. http://localhost:5173).
3. **Sign up or log in** (Firebase Auth).
4. Go to **Claim device**. Your ESP32 should appear in **Discover devices** (it writes `deviceList/<MAC>/lastSeen`). Claim it (or add the MAC manually if needed).
5. Open the **Dashboard**. Select your device. You should see:
   - **Last reading** (or “Last seen X ago” if the device is offline).
   - **Hero:** plant name/type, **Overall health** pill.
   - **Temperature**, **Soil moisture** gauge, **Light**.
   - **Target moisture** slider, **Calibrate soil sensor**, **Plant profiles**, **Reset device WiFi**.

### Step 4: Test calibration

1. With the device selected and live readings, open **“Calibrate soil sensor”**.
2. Put the soil sensor in **dry** soil (or air), click **“Mark as dry”**.
3. Put it in **wet** soil (or water), click **“Mark as wet”**.
4. The gauge should now use that range (you should see **Dry: X · Wet: Y** and the gauge percentage reflect it).

### Step 5: Test “Reset device WiFi”

1. In the dashboard, with the device selected, click **“Reset device WiFi”**.
2. Within a short time (one sync interval, e.g. 10 s), the ESP32 should restart. Serial will show something like: re-provision requested, clearing NVS, restarting.
3. The ESP32 comes back in AP mode. Join **SmartPlantPro** again and open **http://192.168.4.1** to confirm the portal appears and you can re-enter WiFi (and Firebase).

### Step 6: (Optional) OTA update

1. Note the ESP32’s IP from Serial (or your router).
2. In `platformio.ini`, uncomment and set:
   - `upload_protocol = espota`
   - `upload_port = 192.168.1.XXX` (your ESP32 IP).
3. Use **PlatformIO: Upload**. The firmware should upload over WiFi without USB.

---

## 4. One-page “how it all fits together”

```
┌─────────────────────────────────────────────────────────────────────────┐
│  YOU (phone/laptop)                                                       │
│  • First time: join Wi‑Fi "SmartPlantPro" → open http://192.168.4.1       │
│  • Enter: WiFi SSID/password + (optional) Firebase API key, URL, email/pw │
│  • Save → ESP32 stores in NVS and connects                                │
│  • Later: "Reset device WiFi" in app → device clears NVS and shows AP again│
└─────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ESP32 (Smart Plant Pro)                                                  │
│  • Sensors: BMP280 (temp), soil ADC, LDR (light)                          │
│  • Tasks: read sensors (5s) → sync to Firebase (10s) → pump on request    │
│  • Writes: devices/<MAC>/readings, deviceList/<MAC>/lastSeen, alerts        │
│  • Reads:  devices/<MAC>/control/targetSoil, pumpRequest, resetProvisioning│
│  • Auth: from NVS (portal) or compile-time defaults                       │
└─────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Firebase (Realtime Database + Auth)                                     │
│  • devices/<MAC>/readings, control, calibration, alerts                   │
│  • deviceList/<MAC>/lastSeen, claimedBy                                   │
│  • users/<uid>/devices, plantProfiles, devicePlant, invites               │
└─────────────────────────────────────────────────────────────────────────┘
                    ▲
                    │
┌─────────────────────────────────────────────────────────────────────────┐
│  Web app (React, Vite, Tailwind, Firebase Auth + RTDB)                   │
│  • Login → Claim device → Dashboard per device                            │
│  • Live readings, gauge, calibration (mark dry/wet), plant profiles       │
│  • Reset device WiFi, target moisture, last alert                         │
└─────────────────────────────────────────────────────────────────────────┘
```

After first provisioning, the **only** time you see the **SmartPlantPro** Wi‑Fi and **192.168.4.1** is when the device has no saved WiFi (first boot or after “Reset device WiFi”). Normal operation is: ESP32 on your home WiFi → Firebase ← you in the browser on the same Firebase project.
