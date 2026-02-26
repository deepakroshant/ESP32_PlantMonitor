/**
 * Smart Plant Pro – Firebase RTDB Node
 * ESP32 plant monitor with BMP280 temperature, soil sensor, LDR and relay-controlled
 * water pump. Three FreeRTOS tasks:
 *  - taskReadSensors  (Core 1, 5 s): update shared SensorState.
 *  - taskFirebaseSync (Core 0, 10 s): push SensorState + health to RTDB.
 *  - taskPumpControl  (Core 0): listen for pumpRequest and run pulse watering.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <Wire.h>
#include <WiFiManager.h>
#include <ArduinoOTA.h>
#include <Preferences.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BMP280.h>
#include <Firebase_ESP_Client.h>

// -----------------------------------------------------------------------------
// Hardware configuration
// -----------------------------------------------------------------------------
static constexpr uint8_t I2C_SDA_PIN      = 33;
static constexpr uint8_t I2C_SCL_PIN      = 32;
static constexpr uint8_t BMP280_I2C_ADDR  = 0x77;
static constexpr uint8_t SOIL_SENSOR_PIN  = 34;  // ADC
static constexpr uint8_t LIGHT_SENSOR_PIN = 35;  // Digital
static constexpr uint8_t RELAY_PIN        = 25;  // Active LOW: LOW = pump ON

// -----------------------------------------------------------------------------
// WiFi: from WiFiManager (first boot = AP "SmartPlantPro", then from flash).
// Firebase: from portal (NVS) if user filled the form at 192.168.4.1, else these defaults.
// -----------------------------------------------------------------------------
#define API_KEY "AIzaSyCZBClU2J2bV9b3Tm9uvuPteQhNF0nwJQ4"
#define DB_URL  "https://esw-plantmonitor-default-rtdb.firebaseio.com/"

// Firebase Auth (recommended: create a dedicated user for the device)
// If you leave these empty, RTDB will only work if your database rules allow unauthenticated access.
const char *FIREBASE_USER_EMAIL = "deepakroshan73@gmail.com";
const char *FIREBASE_USER_PASSWORD = "123456";

// -----------------------------------------------------------------------------
// Timing and defaults
// -----------------------------------------------------------------------------
static constexpr uint32_t SENSOR_READ_INTERVAL_MS   = 5000;   // 5 s
static constexpr uint32_t FIREBASE_SYNC_INTERVAL_MS = 10000;  // 10 s
static constexpr TickType_t PUMP_PULSE_MS  = pdMS_TO_TICKS(1000);
static constexpr TickType_t PUMP_SOAK_MS   = pdMS_TO_TICKS(5000);
static constexpr TickType_t PUMP_IDLE_MS   = pdMS_TO_TICKS(500);

// -----------------------------------------------------------------------------
// WiFiManager (global so we can call resetSettings() when app requests re-provision)
// -----------------------------------------------------------------------------
WiFiManager wm;

// Firebase config from NVS (portal) or compile-time defaults; buffers must outlive setup()
static char nvs_fb_api_key[80];
static char nvs_fb_db_url[130];
static char nvs_fb_email[72];
static char nvs_fb_password[72];

static const char* NVS_NAMESPACE = "fb";
static const char* PREF_API = "apik";
static const char* PREF_URL = "url";
static const char* PREF_EM = "em";
static const char* PREF_PW = "pw";

// -----------------------------------------------------------------------------
// Firebase globals
// -----------------------------------------------------------------------------
FirebaseData fbClient;
FirebaseData fbStream;
FirebaseAuth fbAuth;
FirebaseConfig fbConfig;

String deviceId;  // WiFi.macAddress()

// -----------------------------------------------------------------------------
// Sensor state shared between tasks
// -----------------------------------------------------------------------------
struct SensorState {
  float    temperatureC;
  uint16_t soilRaw;
  bool     lightBright;
  bool     pumpRunning;
};

SensorState gState{};
SemaphoreHandle_t gStateMutex;
SemaphoreHandle_t gFirebaseMutex;
volatile bool gPumpRequest = false;

// -----------------------------------------------------------------------------
// Sensor objects
// -----------------------------------------------------------------------------
Adafruit_BMP280 bmp;
bool bmp280Found = false;

// -----------------------------------------------------------------------------
// Forward declarations
// -----------------------------------------------------------------------------
void initializeHardware();
void taskReadSensors(void *pv);
void taskFirebaseSync(void *pv);
void taskPumpControl(void *pv);
void updateRelay(bool on);
String readingsPath();
String healthStatus(const SensorState &s);
uint16_t fetchTargetSoil();
bool fetchResetProvisioning();
void streamCallback(FirebaseStream data);
void streamTimeoutCallback(bool timeout);
void clearFirebaseNVS();
void loadFirebaseFromNVSAndApply();

// -----------------------------------------------------------------------------
// Setup
// -----------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(500);

  // Safety: pump OFF first
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);

  Serial.println("\n========================================");
  Serial.println("Smart Plant Pro – Firebase RTDB");
  Serial.println("========================================\n");

  initializeHardware();

  // WiFi + optional Firebase via WiFiManager portal (192.168.4.1)
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);

  WiFiManagerParameter p_fb_api("fb_apikey", "Firebase API Key", API_KEY, 79);
  WiFiManagerParameter p_fb_url("fb_dburl", "Firebase DB URL", DB_URL, 129);
  WiFiManagerParameter p_fb_email("fb_email", "Firebase user email", FIREBASE_USER_EMAIL, 71);
  WiFiManagerParameter p_fb_pw("fb_password", "Firebase user password", FIREBASE_USER_PASSWORD, 71);
  wm.addParameter(&p_fb_api);
  wm.addParameter(&p_fb_url);
  wm.addParameter(&p_fb_email);
  wm.addParameter(&p_fb_pw);

  if (!wm.autoConnect("SmartPlantPro")) {
    Serial.println("WiFiManager failed to connect, restarting...");
    delay(3000);
    ESP.restart();
  }

  // Save Firebase fields from portal to NVS if user filled them
  const char* api = p_fb_api.getValue();
  const char* url = p_fb_url.getValue();
  const char* em = p_fb_email.getValue();
  const char* pw = p_fb_pw.getValue();
  if (api && url && em && pw && strlen(api) > 0 && strlen(url) > 0) {
    Preferences prefs;
    if (prefs.begin(NVS_NAMESPACE, false)) {
      prefs.putString(PREF_API, api);
      prefs.putString(PREF_URL, url);
      prefs.putString(PREF_EM, em);
      prefs.putString(PREF_PW, pw);
      prefs.end();
      Serial.println("Firebase config saved to NVS from portal.");
    }
  }

  Serial.print("WiFi connected, IP: ");
  Serial.println(WiFi.localIP());

  // Sync real-time clock via NTP so timestamps are Unix epoch, not uptime
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("Waiting for NTP time sync");
  time_t now = time(nullptr);
  int ntpRetries = 0;
  while (now < 1000000000L && ntpRetries < 40) {
    delay(250);
    now = time(nullptr);
    ntpRetries++;
    Serial.print('.');
  }
  Serial.println();
  if (now >= 1000000000L) {
    Serial.printf("NTP synced: %ld\n", (long)now);
  } else {
    Serial.println("NTP sync failed; timestamps will be inaccurate.");
  }

  deviceId = WiFi.macAddress(); // e.g. "24:6F:28:AA:BB:CC"
  Serial.print("Device ID (MAC): ");
  Serial.println(deviceId);

  // OTA: upload firmware over WiFi (e.g. PlatformIO: upload_port = <device-IP>, upload_protocol = espota)
  ArduinoOTA.setHostname("SmartPlantPro");
  ArduinoOTA.begin();
  Serial.println("ArduinoOTA ready.");

  // Firebase init: use NVS if present, else compile-time defaults
  loadFirebaseFromNVSAndApply();
  Firebase.begin(&fbConfig, &fbAuth);
  Firebase.reconnectWiFi(true);

  // Wait briefly for Firebase auth/token to be ready so that
  // the initial stream connection does not immediately fail.
  Serial.print("Waiting for Firebase auth");
  unsigned long fbStart = millis();
  while (!Firebase.ready() && (millis() - fbStart) < 15000) {
    Serial.print('.');
    delay(250);
  }
  Serial.println();
  if (!Firebase.ready()) {
    Serial.println("Firebase not ready after 15s. Check API key, DB_URL, email and password.");
  } else {
    Serial.println("Firebase is ready.");
  }

  // Shared state mutex
  gStateMutex = xSemaphoreCreateMutex();
  gFirebaseMutex = xSemaphoreCreateMutex();

  // Stream listener for pumpRequest
  String streamPath = "devices/" + deviceId + "/control/pumpRequest";
  Firebase.RTDB.setStreamCallback(&fbStream, streamCallback, streamTimeoutCallback);
  if (!Firebase.RTDB.beginStream(&fbStream, streamPath.c_str())) {
    Serial.print("Stream begin failed: ");
    Serial.println(fbStream.errorReason());
  } else {
    Serial.println("Firebase stream started.");
  }

  // Create tasks
  // Run networking/Firebase work on Core 1 so the Core 0 idle task
  // can still run and avoid watchdog resets even if SSL blocks.
  xTaskCreatePinnedToCore(taskReadSensors,  "taskReadSensors",  4096, nullptr, 1, nullptr, 0);
  xTaskCreatePinnedToCore(taskFirebaseSync, "taskFirebaseSync", 6144, nullptr, 1, nullptr, 1);
  xTaskCreatePinnedToCore(taskPumpControl,  "taskPumpControl",  4096, nullptr, 1, nullptr, 1);
}

void loop() {
  ArduinoOTA.handle();
  vTaskDelay(pdMS_TO_TICKS(100));
}

// -----------------------------------------------------------------------------
// Firebase NVS: load and apply to fbConfig/fbAuth; clear on re-provision
// -----------------------------------------------------------------------------
void loadFirebaseFromNVSAndApply() {
  Preferences prefs;
  bool haveNvs = false;
  if (prefs.begin(NVS_NAMESPACE, true)) {
    String apik = prefs.getString(PREF_API, "");
    String url = prefs.getString(PREF_URL, "");
    String em = prefs.getString(PREF_EM, "");
    String pw = prefs.getString(PREF_PW, "");
    prefs.end();
    if (apik.length() > 0 && url.length() > 0) {
      apik.toCharArray(nvs_fb_api_key, sizeof(nvs_fb_api_key));
      url.toCharArray(nvs_fb_db_url, sizeof(nvs_fb_db_url));
      em.toCharArray(nvs_fb_email, sizeof(nvs_fb_email));
      pw.toCharArray(nvs_fb_password, sizeof(nvs_fb_password));
      fbConfig.api_key = nvs_fb_api_key;
      fbConfig.database_url = nvs_fb_db_url;
      fbAuth.user.email = nvs_fb_email;
      fbAuth.user.password = nvs_fb_password;
      haveNvs = true;
      Serial.println("Using Firebase config from NVS.");
    }
  }
  if (!haveNvs) {
    strncpy(nvs_fb_api_key, API_KEY, sizeof(nvs_fb_api_key) - 1);
    nvs_fb_api_key[sizeof(nvs_fb_api_key) - 1] = '\0';
    strncpy(nvs_fb_db_url, DB_URL, sizeof(nvs_fb_db_url) - 1);
    nvs_fb_db_url[sizeof(nvs_fb_db_url) - 1] = '\0';
    strncpy(nvs_fb_email, FIREBASE_USER_EMAIL, sizeof(nvs_fb_email) - 1);
    nvs_fb_email[sizeof(nvs_fb_email) - 1] = '\0';
    strncpy(nvs_fb_password, FIREBASE_USER_PASSWORD, sizeof(nvs_fb_password) - 1);
    nvs_fb_password[sizeof(nvs_fb_password) - 1] = '\0';
    fbConfig.api_key = nvs_fb_api_key;
    fbConfig.database_url = nvs_fb_db_url;
    fbAuth.user.email = nvs_fb_email;
    fbAuth.user.password = nvs_fb_password;
    Serial.println("Using Firebase config from compile-time defaults.");
  }
}

void clearFirebaseNVS() {
  Preferences prefs;
  if (prefs.begin(NVS_NAMESPACE, false)) {
    prefs.clear();
    prefs.end();
  }
}

// -----------------------------------------------------------------------------
// Hardware init
// -----------------------------------------------------------------------------
void initializeHardware() {
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(100000);
  delay(200);

  if (bmp.begin(BMP280_I2C_ADDR)) {
    float t = bmp.readTemperature();
    if (!isnan(t) && t > -50 && t < 100) {
      bmp280Found = true;
    }
  }
  if (!bmp280Found) {
    Serial.println("BMP280 not found at 0x77. Check wiring.");
  }

  pinMode(LIGHT_SENSOR_PIN, INPUT_PULLUP);
  pinMode(SOIL_SENSOR_PIN, INPUT);
  digitalWrite(RELAY_PIN, HIGH); // OFF
}

// -----------------------------------------------------------------------------
// Task: Read sensors (Core 1, 5 s)
// -----------------------------------------------------------------------------
void taskReadSensors(void *pv) {
  const TickType_t period = pdMS_TO_TICKS(SENSOR_READ_INTERVAL_MS);

  while (true) {
    SensorState local{};

    if (bmp280Found) {
      local.temperatureC = bmp.readTemperature();
    } else {
      local.temperatureC = NAN;
    }

    local.soilRaw = analogRead(SOIL_SENSOR_PIN);
    local.lightBright = (digitalRead(LIGHT_SENSOR_PIN) == LOW);
    local.pumpRunning = (digitalRead(RELAY_PIN) == LOW);

    if (xSemaphoreTake(gStateMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
      gState = local;
      xSemaphoreGive(gStateMutex);
    }

    vTaskDelay(period);
  }
}

// -----------------------------------------------------------------------------
// Task: Firebase sync (Core 0, 10 s)
// -----------------------------------------------------------------------------
String readingsPath() {
  return "devices/" + deviceId + "/readings";
}

String healthStatus(const SensorState &s) {
  if (s.pumpRunning && s.soilRaw > 3000) {
    return "Pump running, soil still dry";
  }
  if (!isnan(s.temperatureC) && s.temperatureC > 45.0f) {
    return "Overheat";
  }
  return "OK";
}

void taskFirebaseSync(void *pv) {
  const TickType_t period = pdMS_TO_TICKS(FIREBASE_SYNC_INTERVAL_MS);

  while (true) {
    SensorState s{};
    if (xSemaphoreTake(gStateMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
      s = gState;
      xSemaphoreGive(gStateMutex);
    }

    if (Firebase.ready() && xSemaphoreTake(gFirebaseMutex, pdMS_TO_TICKS(500)) == pdTRUE) {
      FirebaseJson json;
      if (!isnan(s.temperatureC)) {
        json.set("temperature", s.temperatureC);
      }
      json.set("soilRaw", s.soilRaw);
      json.set("lightBright", s.lightBright);
      json.set("pumpRunning", s.pumpRunning);
      json.set("health", healthStatus(s));
      json.set("timestamp", (int)time(nullptr));
      json.set("wifiSSID", WiFi.SSID());
      json.set("wifiRSSI", WiFi.RSSI());

      if (!Firebase.RTDB.updateNode(&fbClient, readingsPath().c_str(), &json)) {
        Serial.print("RTDB update failed: ");
        Serial.println(fbClient.errorReason());
      }
      // So the app can list "available" devices and show online status
      String deviceListPath = "deviceList/" + deviceId + "/lastSeen";
      if (!Firebase.RTDB.setInt(&fbClient, deviceListPath.c_str(), (int)time(nullptr))) {
        // non-fatal
      }
      // Alerts: when health is not OK, write lastAlert for dashboard / future FCM
      String h = healthStatus(s);
      if (h != "OK") {
        String alertPath = "devices/" + deviceId + "/alerts/lastAlert";
        FirebaseJson alertJson;
        alertJson.set("timestamp", (int)time(nullptr));
        alertJson.set("type", "health");
        alertJson.set("message", h);
        Firebase.RTDB.updateNode(&fbClient, alertPath.c_str(), &alertJson);
      }
      xSemaphoreGive(gFirebaseMutex);
    }

    // Re-provisioning: app set devices/<MAC>/control/resetProvisioning = true → clear WiFi, reboot
    if (Firebase.ready() && fetchResetProvisioning()) {
      String path = "devices/" + deviceId + "/control/resetProvisioning";
      if (xSemaphoreTake(gFirebaseMutex, pdMS_TO_TICKS(1000)) == pdTRUE) {
        Firebase.RTDB.setBool(&fbClient, path.c_str(), false);
        xSemaphoreGive(gFirebaseMutex);
      }
      Serial.println("Re-provision requested: clearing WiFi and Firebase NVS, restarting...");
      clearFirebaseNVS();
      wm.resetSettings();
      delay(500);
      ESP.restart();
    }

    vTaskDelay(period);
  }
}

// -----------------------------------------------------------------------------
// Task: Pump control (Core 0) – pulse watering on pumpRequest
// -----------------------------------------------------------------------------
void updateRelay(bool on) {
  digitalWrite(RELAY_PIN, on ? LOW : HIGH);
}

uint16_t fetchTargetSoil() {
  String path = "devices/" + deviceId + "/control/targetSoil";
  if (xSemaphoreTake(gFirebaseMutex, pdMS_TO_TICKS(500)) == pdTRUE) {
    bool ok = Firebase.RTDB.getInt(&fbClient, path.c_str());
    int val = ok ? fbClient.intData() : -1;
    xSemaphoreGive(gFirebaseMutex);
    if (ok && val >= 0) {
      return static_cast<uint16_t>(val);
    }
  }
  // Default threshold if not set
  return 2800;
}

bool fetchResetProvisioning() {
  String path = "devices/" + deviceId + "/control/resetProvisioning";
  if (xSemaphoreTake(gFirebaseMutex, pdMS_TO_TICKS(500)) != pdTRUE) return false;
  bool ok = Firebase.RTDB.getBool(&fbClient, path.c_str());
  bool val = ok && fbClient.boolData();
  xSemaphoreGive(gFirebaseMutex);
  return val;
}

void taskPumpControl(void *pv) {
  while (true) {
    if (!gPumpRequest) {
      updateRelay(false);
      vTaskDelay(PUMP_IDLE_MS);
      continue;
    }

    uint16_t target = fetchTargetSoil();

    SensorState s{};
    if (xSemaphoreTake(gStateMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
      s = gState;
      xSemaphoreGive(gStateMutex);
    }

    if (s.soilRaw <= target) {
      // Target reached: clear request
      String reqPath = "devices/" + deviceId + "/control/pumpRequest";
      if (xSemaphoreTake(gFirebaseMutex, pdMS_TO_TICKS(500)) == pdTRUE) {
        Firebase.RTDB.setBool(&fbClient, reqPath.c_str(), false);
        xSemaphoreGive(gFirebaseMutex);
      }
      gPumpRequest = false;
      updateRelay(false);
      vTaskDelay(PUMP_IDLE_MS);
      continue;
    }

    // Pulse: 1 s ON
    updateRelay(true);
    vTaskDelay(PUMP_PULSE_MS);

    // Soak: 5 s OFF
    updateRelay(false);
    vTaskDelay(PUMP_SOAK_MS);
  }
}

// -----------------------------------------------------------------------------
// Firebase stream callbacks
// -----------------------------------------------------------------------------
void streamCallback(FirebaseStream data) {
  if (data.dataType() == "boolean") {
    gPumpRequest = data.boolData();
  } else if (data.dataType() == "int") {
    gPumpRequest = (data.intData() != 0);
  }
  Serial.print("pumpRequest updated from stream: ");
  Serial.println(gPumpRequest ? "true" : "false");
}

void streamTimeoutCallback(bool timeout) {
  if (timeout) {
    Serial.println("Firebase stream timeout, resuming...");
  }
}
