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
// WiFi / Firebase configuration (fill these in)
// -----------------------------------------------------------------------------
const char *WIFI_SSID = "TELUS8180";
const char *WIFI_PASS = "gordfather";

#define API_KEY "AIzaSyCZBClU2J2bV9b3Tm9uvuPteQhNF0nwJQ4"
#define DB_URL  "https://esw-plantmonitor-default-rtdb.firebaseio.com/"

// Firebase Auth (recommended: create a dedicated user for the device)
// If you leave these eimage.pngmpty, RTDB will only work if your database rules allow unauthenticated access.
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
void streamCallback(FirebaseStream data);
void streamTimeoutCallback(bool timeout);

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

  // WiFi
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(250);
    Serial.print('.');
  }
  Serial.print("\nWiFi connected, IP: ");
  Serial.println(WiFi.localIP());

  deviceId = WiFi.macAddress(); // e.g. "24:6F:28:AA:BB:CC"
  Serial.print("Device ID (MAC): ");
  Serial.println(deviceId);

  // Firebase init
  fbAuth.user.email = FIREBASE_USER_EMAIL;
  fbAuth.user.password = FIREBASE_USER_PASSWORD;
  fbConfig.api_key = API_KEY;
  fbConfig.database_url = DB_URL;
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
  // All work is done in FreeRTOS tasks.
  vTaskDelay(pdMS_TO_TICKS(1000));
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
      json.set("timestamp", (int)(millis() / 1000));

      if (!Firebase.RTDB.updateNode(&fbClient, readingsPath().c_str(), &json)) {
        Serial.print("RTDB update failed: ");
        Serial.println(fbClient.errorReason());
      }
      xSemaphoreGive(gFirebaseMutex);
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
