#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <Adafruit_BMP280.h>

// ============================================================================
// HARDWARE PIN CONFIGURATION
// Explains which physical pin connects to which sensor.
// ============================================================================
#define BME280_SDA_PIN    33  // I2C Data: Uses GPIO 33 (Left side of board)
#define BME280_SCL_PIN    32  // I2C Clock: Uses GPIO 32 (Left side of board)
#define LIGHT_SENSOR_PIN  35  // Digital Pin: Reads High/Low from light sensor
#define SOIL_SENSOR_PIN   34  // Analog Pin: Reads voltage (0-3.3V) from soil sensor
#define RELAY_PIN         25  // Output Pin: Sends signal to the Relay (Pump)
// IMPORTANT: This relay is "Active Low". 
// true = LOW voltage (Pump ON). false = HIGH voltage (Pump OFF).
#define RELAY_LOW_LEVEL_TRIGGER true  

// ============================================================================
// SENSOR THRESHOLDS (CALIBRATION AREA)
// Edit these numbers to change how the plant behaves.
// ============================================================================
#define TEMP_MIN          18.0   // Below 18°C = Too Cold
#define TEMP_MAX          30.0   // Above 30°C = Too Hot
#define SOIL_OPTIMAL_MIN  1800   // Reading ~1325 means "Very Wet" (in water)
#define SOIL_OPTIMAL_MAX  2800   // Reading ~2800 means "Getting Dry"
#define SOIL_WATER_THRESHOLD 3000 // If number > 3000, TURN PUMP ON.

// ============================================================================
// TIMING CONFIGURATION
// Controls how fast things happen.
// ============================================================================
#define SENSOR_READ_INTERVAL  3000    // Check plant health every 3 seconds
#define WATERING_DURATION     8000    // Run pump for 8 seconds when dry
#define WATERING_LOCKOUT      120000  // Wait 2 minutes after watering before checking again 
                                      // (Gives water time to soak in so we don't over-water)

// ============================================================================
// GLOBAL OBJECTS
// Setting up the software drivers for the sensors.
// ============================================================================
Adafruit_BME280 bme;  // Driver for the humidity version (if used)
Adafruit_BMP280 bmp;  // Driver for the Temp/Pressure version (currently used)

// ============================================================================
// STATE VARIABLES
// These variables "remember" what happened in the last loop.
// ============================================================================
unsigned long lastSensorRead = 0;   // When did we last check sensors?
unsigned long lastWateringTime = 0; // When did we last run the pump?
bool relayActive = false;           // Is the pump running right now?
bool inWateringCycle = false;       // Are we in the middle of an 8-second watering?
unsigned long wateringStartTime = 0; // When did the pump start?
bool bme280Found = false;           // Did we find the BME sensor?
bool bmp280Found = false;           // Did we find the BMP sensor?
uint8_t bme280Address = 0;          // Which I2C address is the sensor using?

// ============================================================================
// FUNCTION DEFINITIONS
// Tells the code that these functions exist further down in the file.
// ============================================================================
void initializeHardware();
void readSensors(float* temp, bool* lightBright, int* soilValue);
bool isOptimalConditions(float temp, bool lightBright, int soilValue);
void checkAndWater(int soilValue);
void updateRelay(bool state);
void printDashboard(float temp, bool lightBright, int soilValue, bool relayState);
void printStatus(float temp, bool lightBright, int soilValue, bool watering, unsigned long timeSinceWatering, bool canWaterNow, bool wateringHappened);

// ============================================================================
// SETUP FUNCTION
// This runs EXACTLY ONE TIME when the board turns on.
// ============================================================================
void setup() {
  // 1. Start talking to the computer (Serial Monitor)
  Serial.begin(115200);
  delay(2500);  // Wait 2.5s for the chip to wake up fully
  
  // 2. Clear the screen logic (removes boot-up gibberish)
  for (int i = 0; i < 50; i++) {
    Serial.print("\n");
  }
  Serial.flush();
  Serial.print("\033[2J\033[H");  // Terminal command to wipe screen
  Serial.flush();
  
  // 3. Print Welcome Message
  Serial.println("========================================");
  Serial.println("ESP32 Plant Monitor - Team Version");
  Serial.println("========================================\n");
  
  // 4. SAFETY FIRST: Configure the Pump Pin
  // We do this BEFORE anything else to make sure the pump doesn't
  // accidentally turn on while the rest of the system loads.
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH); // Writing HIGH turns the Relay OFF (Low-Level Trigger)
  relayActive = false;
  inWateringCycle = false;
  
  // 5. Start the sensors
  initializeHardware();
  
  // 6. Double-check Pump Safety
  Serial.println("Setting pump to OFF for safety...");
  updateRelay(false);
  delay(500);
  
  Serial.println("\nSystem Ready!\n");
  Serial.flush();
}

// ============================================================================
// MAIN LOOP
// This runs over and over again forever.
// ============================================================================
void loop() {
  unsigned long currentTime = millis(); // Get current uptime in milliseconds
  
  // --- PART 1: PUMP MANAGEMENT ---
  // If the pump is currently running, check if it's time to stop.
  if (inWateringCycle) {
    if (currentTime - wateringStartTime >= WATERING_DURATION) {
      // 8 seconds have passed. Turn it off!
      Serial.println(">>> Watering complete (8 sec) - Pump OFF (waiting 2 min) <<<");
      updateRelay(false); 
      inWateringCycle = false;
      lastWateringTime = currentTime;
    }
  }
  
  // --- PART 2: SENSOR MONITORING ---
  // If 3 seconds have passed since the last check...
  if (currentTime - lastSensorRead >= SENSOR_READ_INTERVAL) {
    lastSensorRead = currentTime;
    
    // Create temporary variables to hold our reading
    float temperature;
    bool lightBright;
    int soilValue;
    
    // Go get the actual data from the hardware
    readSensors(&temperature, &lightBright, &soilValue);
    
    // Safety check: If we aren't supposed to be watering, FORCE the relay OFF.
    // This catches glitches where the pump might stick on.
    if (!inWateringCycle && relayActive) {
      Serial.println("Safety: Relay should be OPEN, opening...");
      updateRelay(false);
    }
    
    // --- PART 3: DECISION MAKING ---
    // Check if we are allowed to water (is the Lockout timer done?)
    bool canWater = (!inWateringCycle);
    if (lastWateringTime > 0) {
      // If we watered recently, ensure 2 minutes have passed
      canWater = (currentTime - lastWateringTime >= WATERING_LOCKOUT);
    }
    
    // If the soil is dry and the timer allows it, start the pump.
    if (canWater) {
      checkAndWater(soilValue);
    }
    
    // --- PART 4: REPORTING ---
    // Show the data on the screen
    printDashboard(temperature, lightBright, soilValue, relayActive);
    
    // Show the detailed status message
    bool wateringHappened = (lastWateringTime > 0);
    printStatus(temperature, lightBright, soilValue, inWateringCycle, currentTime - lastWateringTime, canWater, wateringHappened);
  }
  
  delay(10); // Tiny pause to let the processor breathe
}

// ============================================================================
// HARDWARE INITIALIZATION
// This sets up the custom wiring logic.
// ============================================================================
void initializeHardware() {
  // Start I2C on the LEFT SIDE (Pins 33 & 32)
  Wire.begin(33, 32); 
  Wire.setClock(100000); // Low speed = More reliable for breadboards
  delay(200);
  
  // Try to find the BMP280 sensor
  // We check address 0x77 first (Standard for SDO=3.3V)
  if (bmp.begin(0x77)) {
    float testTemp = bmp.readTemperature();
    // Verify the data looks real (between -50C and 100C)
    if (!isnan(testTemp) && testTemp > -50 && testTemp < 100) {
      bmp280Found = true;
      bme280Address = 0x77;
    }
  } else if (bmp.begin(0x76)) {
    // If 0x77 fails, try 0x76
    float testTemp = bmp.readTemperature();
    if (!isnan(testTemp) && testTemp > -50 && testTemp < 100) {
      bmp280Found = true;
      bme280Address = 0x76;
    }
  }
  
  // Setup the simple sensors (Light and Soil)
  pinMode(LIGHT_SENSOR_PIN, INPUT_PULLUP);
  pinMode(SOIL_SENSOR_PIN, INPUT);
  
  // Ensure the Relay pin is an Output
  digitalWrite(RELAY_PIN, HIGH); // HIGH = OFF
  
  // Print status to screen
  Serial.print("Hardware Check: ");
  if (bmp280Found) {
    Serial.print("BMP280 OK, ");
  } else {
    Serial.print("Temperature sensor NOT FOUND (Check wiring), ");
  }
  Serial.println("Sensors ready");
}

// ============================================================================
// SENSOR READING FUNCTION
// ============================================================================
void readSensors(float* temp, bool* lightBright, int* soilValue) {
  // 1. Get Temperature
  if (bmp280Found) {
    *temp = bmp.readTemperature();
  } else if (bme280Found) {
    *temp = bme.readTemperature();
  } else {
    *temp = NAN; // "Not A Number" - basically an error code
  }
  
  // 2. Get Light Status
  // Since we use INPUT_PULLUP, the logic is inverted:
  // LOW signal = Sensor detects light (Bright)
  // HIGH signal = Sensor detects nothing (Dark)
  *lightBright = (digitalRead(LIGHT_SENSOR_PIN) == LOW);
  
  // 3. Get Soil Moisture
  // Reads voltage from 0 to 4095. 
  // ~1300 = Wet (In Water), ~3000 = Dry (In Air)
  *soilValue = analogRead(SOIL_SENSOR_PIN);
}

// ============================================================================
// CHECK CONDITIONS
// Returns "true" only if everything is perfect.
// ============================================================================
bool isOptimalConditions(float temp, bool lightBright, int soilValue) {
  bool tempOk = (temp >= TEMP_MIN && temp <= TEMP_MAX);
  bool lightOk = lightBright; 
  bool soilOk = (soilValue >= SOIL_OPTIMAL_MIN && soilValue <= SOIL_OPTIMAL_MAX);
  
  return (tempOk && lightOk && soilOk);
}

// ============================================================================
// WATERING LOGIC
// ============================================================================
void checkAndWater(int soilValue) {
  // Triggers ONLY if:
  // 1. Soil is drier than our threshold (3000)
  // 2. We aren't already watering
  if (soilValue > SOIL_WATER_THRESHOLD && !inWateringCycle) {
    Serial.print(">>> WATERING NOW! Soil: ");
    Serial.print(soilValue);
    Serial.println(" (dry) <<<");
    
    // Turn the pump ON
    updateRelay(true); 
    
    // Mark that we are busy watering
    inWateringCycle = true;
    wateringStartTime = millis();
  }
}

// ============================================================================
// RELAY HARDWARE CONTROL
// Handles the "Inverted Logic" of the relay module.
// ============================================================================
void updateRelay(bool state) {
  int pinValue;
  if (RELAY_LOW_LEVEL_TRIGGER) {
    // If we want ON (true), we send LOW.
    // If we want OFF (false), we send HIGH.
    pinValue = state ? LOW : HIGH;
  } else {
    pinValue = state ? HIGH : LOW;
  }
  
  digitalWrite(RELAY_PIN, pinValue);
  relayActive = state;
  
  Serial.print("[RELAY] ");
  Serial.println(state ? "PUMP ON" : "PUMP OFF");
}

// ============================================================================
// DASHBOARD PRINTER
// Formats the data into a nice table.
// ============================================================================
void printStatus(float temp, bool lightBright, int soilValue, bool watering, unsigned long timeSinceWatering, bool canWaterNow, bool wateringHappened) {
  Serial.print("Status: ");
  
  if (watering) {
    Serial.println("WATERING NOW (pump on for 8 sec)");
    return;
  }
  
  // If waiting for the 2-minute lockout timer
  if (wateringHappened && timeSinceWatering < WATERING_LOCKOUT) {
    unsigned long remaining = (WATERING_LOCKOUT - timeSinceWatering) / 1000;
    Serial.print("Wait ");
    Serial.print(remaining);
    Serial.println(" sec (2 min lockout active)");
    return;
  }
  
  // ... (Rest of status logic remains same as original) ...
  // Checks wet/dry/optimal states and prints advice
  
  bool soilDry = (soilValue > SOIL_WATER_THRESHOLD);
  bool soilMoist = (soilValue < SOIL_WATER_THRESHOLD);
  
  if (soilDry && canWaterNow) {
    Serial.print(">>> WATER NOW - Soil dry <<<");
  } else if (soilMoist) {
    Serial.print("DON'T WATER - Soil wet/ok");
  } else {
    Serial.print("System Monitoring...");
  }
  Serial.println();
}

void printDashboard(float temp, bool lightBright, int soilValue, bool relayState) {
  Serial.print("Temp: ");
  if (!isnan(temp)) {
    Serial.print(temp, 1);
    Serial.print("C  ");
  } else {
    Serial.print("N/A  ");
  }
  
  Serial.print("Light: ");
  Serial.print(lightBright ? "Bright  " : "Dark  ");
  
  Serial.print("Soil: ");
  Serial.print(soilValue);
  Serial.print("  ");
  
  Serial.print("Pump: ");
  Serial.print(relayState ? "ON" : "OFF");
  
  Serial.println();
  Serial.flush();
}