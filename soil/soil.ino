#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ArduinoJson.h>
#include <WiFiClient.h>
#include <ESP8266HTTPClient.h>

#define BUZZER1 D5
#define BUZZER2 D7

const char* ssid = "Bibek";
const char* password = "Bankim@2004--indranil";
ESP8266WebServer server(80);

const char* weatherUrl = "http://api.weatherapi.com/v1/current.json?key=4e8068c62ffc4034a07163742262401&q=22.5,88.4";

// Weather variables
float tempC = 0;
int humidity = 0;
float windKph = 0;
float pressure = 0;
float feelsLike = 0;
float pressure_mb = 0;
float windchill_c = 0;
String lastUpdate = "";
unsigned long lastWeatherFetch = 0;

// Buzzer variable - simple on/off
bool buzzerState = false;

// Function to add CORS headers
void addCORSHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
}

// Function to handle OPTIONS requests (preflight)
void handleOptions() {
  addCORSHeaders();
  server.send(200, "text/plain", "");
}

void handleSoil() {
  int rawValue = analogRead(A0);
  int moisturePercent = map(rawValue, 1023, 300, 0, 100);
  moisturePercent = constrain(moisturePercent, 0, 100);

  String status = (moisturePercent < 40) ? "DRY" : "WET";

  DynamicJsonDocument doc(256);
  doc["raw"] = rawValue;
  doc["moisture"] = moisturePercent;
  doc["status"] = status;

  String json;
  serializeJson(doc, json);
  
  addCORSHeaders();
  server.send(200, "application/json", json);
}

void fetchWeather() {
  if (millis() - lastWeatherFetch < 60000) return;
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  WiFiClient client;

  http.begin(client, weatherUrl);
  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();
    DynamicJsonDocument doc(2048);
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      tempC = doc["current"]["temp_c"];
      humidity = doc["current"]["humidity"];
      windKph = doc["current"]["wind_kph"];
      pressure = doc["current"]["pressure_mb"];
      feelsLike = doc["current"]["feelslike_c"];
      lastUpdate = doc["current"]["last_updated"].as<String>();
      pressure_mb = doc["current"]["pressure_mb"];
      windchill_c = doc["current"]["windchill_c"];
      
      Serial.println("Weather updated at: " + lastUpdate);
    } else {
      Serial.println("JSON parsing error: " + String(error.c_str()));
    }
  } else {
    Serial.println("HTTP error: " + String(httpCode));
  }

  http.end();
  lastWeatherFetch = millis();
}

// Simple function to control buzzer
void controlBuzzer(bool state) {
  if (state) {
    // For passive buzzer, generate tone at fixed frequency
    tone(BUZZER1, 1000);  // Fixed 1000Hz tone
    tone(BUZZER2, 1000);  // Fixed 1000Hz tone
    Serial.println("Buzzer ON");
  } else {
    // Stop tone
    noTone(BUZZER1);
    noTone(BUZZER2);
    Serial.println("Buzzer OFF");
  }
  
  buzzerState = state;
}

void handleData() {
  fetchWeather();

  int raw = analogRead(A0);
  int moisture = map(raw, 1023, 300, 0, 100);
  moisture = constrain(moisture, 0, 100);

  DynamicJsonDocument doc(1024);

  // Soil data
  doc["soil"]["moisture"] = moisture;
  doc["soil"]["status"] = moisture < 40 ? "LOW" : "OK";
  doc["soil"]["raw"] = raw;

  // Weather data
  doc["weather"]["city"] = "Ballygunge";
  doc["weather"]["temp_c"] = tempC;
  doc["weather"]["humidity"] = humidity;
  doc["weather"]["wind_kph"] = windKph;
  doc["weather"]["pressure_mb"] = pressure;
  doc["weather"]["feelslike_c"] = feelsLike;
  doc["weather"]["lastUpdate"] = lastUpdate;
  doc["weather"]["pressure_mb"] = pressure_mb;
  doc["weather"]["windchill_c"] = windchill_c;
  
  // Buzzer state
  doc["buzzer"]["state"] = buzzerState ? "ON" : "OFF";
  doc["buzzer"]["value"] = buzzerState;

  String json;
  serializeJson(doc, json);
  
  addCORSHeaders();
  server.send(200, "application/json", json);
}

void handleStartBeep() {
  controlBuzzer(true);
  
  DynamicJsonDocument doc(128);
  doc["status"] = "success";
  doc["message"] = "Buzzer started";
  doc["buzzer_state"] = "ON";
  
  String json;
  serializeJson(doc, json);
  
  addCORSHeaders();
  server.send(200, "application/json", json);
}

void handleStopBeep() {
  controlBuzzer(false);
  
  DynamicJsonDocument doc(128);
  doc["status"] = "success";
  doc["message"] = "Buzzer stopped";
  doc["buzzer_state"] = "OFF";
  
  String json;
  serializeJson(doc, json);
  
  addCORSHeaders();
  server.send(200, "application/json", json);
}

void handleToggleBeep() {
  controlBuzzer(!buzzerState);
  
  String state = buzzerState ? "ON" : "OFF";
  Serial.println("Buzzer toggled to: " + state);
  
  DynamicJsonDocument doc(128);
  doc["status"] = "success";
  doc["message"] = "Buzzer toggled";
  doc["buzzer_state"] = state;
  doc["buzzer_value"] = buzzerState;
  
  String json;
  serializeJson(doc, json);
  
  addCORSHeaders();
  server.send(200, "application/json", json);
}

void handleBuzzerStatus() {
  DynamicJsonDocument doc(128);
  doc["buzzer_state"] = buzzerState ? "ON" : "OFF";
  doc["buzzer_value"] = buzzerState;
  
  String json;
  serializeJson(doc, json);
  
  addCORSHeaders();
  server.send(200, "application/json", json);
}

// Legacy beep endpoint
void handleBeep() {
  if (server.hasArg("on")) {
    int state = server.arg("on").toInt();
    controlBuzzer(state == 1);
  }
  
  DynamicJsonDocument doc(128);
  doc["status"] = "success";
  doc["buzzer_state"] = buzzerState ? "ON" : "OFF";
  
  String json;
  serializeJson(doc, json);
  
  addCORSHeaders();
  server.send(200, "application/json", json);
}


void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n\n=== Plant Monitoring API Server ===");
  Serial.println("CORS enabled for all origins");
  
  // Initialize buzzer pins
  pinMode(BUZZER1, OUTPUT);
  pinMode(BUZZER2, OUTPUT);
  
  // Ensure buzzers are off initially
  digitalWrite(BUZZER1, LOW);
  digitalWrite(BUZZER2, LOW);
  buzzerState = false;
  
  pinMode(A0, INPUT);

  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi Connected!");
    Serial.print("📶 IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n❌ WiFi Connection Failed!");
  }

  // Set up web server routes with CORS
  server.on("/", HTTP_OPTIONS, handleOptions);
  server.on("/", handleRoot);
  
  server.on("/soil", HTTP_OPTIONS, handleOptions);
  server.on("/soil", handleSoil);
  
  server.on("/data", HTTP_OPTIONS, handleOptions);
  server.on("/data", handleData);
  
  server.on("/beep", HTTP_OPTIONS, handleOptions);
  server.on("/beep", handleBeep);
  
  server.on("/buzzer/start", HTTP_OPTIONS, handleOptions);
  server.on("/buzzer/start", HTTP_POST, handleStartBeep);
  
  server.on("/buzzer/stop", HTTP_OPTIONS, handleOptions);
  server.on("/buzzer/stop", HTTP_POST, handleStopBeep);
  
  server.on("/buzzer/toggle", HTTP_OPTIONS, handleOptions);
  server.on("/buzzer/toggle", HTTP_POST, handleToggleBeep);
  
  server.on("/buzzer/status", HTTP_OPTIONS, handleOptions);
  server.on("/buzzer/status", handleBuzzerStatus);
  
  // Handle preflight CORS requests for all other endpoints
  server.onNotFound([]() {
    if (server.method() == HTTP_OPTIONS) {
      handleOptions();
    } else {
      addCORSHeaders();
      server.send(404, "application/json", "{\"error\":\"Not Found\"}");
    }
  });
  
  // Start server
  server.begin();
  Serial.println("✅ HTTP server started with CORS support");
  Serial.println("=========================================");
}

void loop() {
  server.handleClient();
}