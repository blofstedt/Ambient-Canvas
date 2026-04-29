#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <ESPmDNS.h>
#include <WiFiManager.h>
#include <Preferences.h>
#include "Adafruit_TCS34725.h"

WebServer server(80);
Adafruit_TCS34725 tcs = Adafruit_TCS34725(TCS34725_INTEGRATIONTIME_50MS, TCS34725_GAIN_4X);
Preferences preferences;

const int motionPin = 27;

uint16_t currentLux = 0;
uint16_t currentTemp = 0;
bool isMotion = false;
unsigned long lastReadTime = 0;
unsigned long lastSerialPrint = 0;

String macAddress = "";
String hostName = "";
String roomName = "New Sensor";
String pairedTvId = "";

String buildBroadcastName(const String &baseName) {
  String trimmed = baseName;
  trimmed.trim();
  trimmed.replace("\"", "");
  trimmed.replace("\\", "");
  if (trimmed.length() == 0) trimmed = "New Sensor";
  if (trimmed.length() > 24) trimmed = trimmed.substring(0, 24);
  return trimmed + " - ambient tv sensor";
}

void sendCors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

void handleOptions() {
  sendCors();
  server.send(204);
}

void handleRoot() {
  sendCors();
  String json = "{";
  json += "\"id\":\"" + macAddress + "\",";
  json += "\"name\":\"" + roomName + "\",";
  json += "\"lux\":" + String(currentLux) + ",";
  json += "\"temp\":" + String(currentTemp) + ",";
  json += "\"motion\":" + String(isMotion ? "true" : "false") + ",";
  json += "\"hostname\":\"" + hostName + "\",";
  json += "\"paired\":" + String(pairedTvId.length() > 0 ? "true" : "false") + ",";
  json += "\"pairedTvId\":\"" + pairedTvId + "\"";
  json += "}";
  server.send(200, "application/json", json);
}


String getJsonValue(const String &body, const String &key) {
  int keyIndex = body.indexOf("\"" + key + "\"");
  if (keyIndex < 0) return "";
  int firstQuote = body.indexOf('"', body.indexOf(':', keyIndex) + 1);
  int secondQuote = body.indexOf('"', firstQuote + 1);
  if (firstQuote < 0 || secondQuote < 0 || secondQuote <= firstQuote) return "";
  return body.substring(firstQuote + 1, secondQuote);
}

void handleRename() {
  sendCors();

  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"ok\":false,\"error\":\"missing body\"}");
    return;
  }

  String body = server.arg("plain");
  String requestedName = getJsonValue(body, "name");
  if (requestedName.length() == 0) {
    server.send(400, "application/json", "{\"ok\":false,\"error\":\"missing name field\"}");
    return;
  }
  roomName = buildBroadcastName(requestedName);
  preferences.putString("room", roomName);
  String payload = "{\"ok\":true,\"name\":\"" + roomName + "\"}";
  server.send(200, "application/json", payload);

  Serial.print("[RENAME] Updated sensor name: ");
  Serial.println(roomName);
}


void handlePair() {
  sendCors();
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"ok\":false,\"error\":\"missing body\"}");
    return;
  }

  String body = server.arg("plain");
  String tvId = getJsonValue(body, "tvId");
  if (tvId.length() == 0) {
    server.send(400, "application/json", "{\"ok\":false,\"error\":\"missing tvId\"}");
    return;
  }

  if (pairedTvId.length() > 0 && pairedTvId != tvId) {
    server.send(409, "application/json", "{\"ok\":false,\"error\":\"already paired\"}");
    return;
  }

  pairedTvId = tvId;
  preferences.putString("pairedTvId", pairedTvId);
  server.send(200, "application/json", "{\"ok\":true,\"paired\":true}");
}

void setupNetwork() {
  WiFi.mode(WIFI_AP_STA);

  WiFiManager wm;
  wm.setConfigPortalTimeout(180);

  WiFiManagerParameter custom_room_name("room", "Sensor Location (e.g., Living Room)", roomName.c_str(), 24);
  wm.addParameter(&custom_room_name);

  String customCSS = "<style>"
    "body { background-color: #000000; color: #EAE6DA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; letter-spacing: 0.05em; }"
    ".wrap { max-width: 450px; margin: 40px auto; padding: 30px; background: rgba(26, 29, 20, 0.9); border-radius: 16px; box-shadow: 0 20px 50px rgba(0,0,0,0.8); border: 1px solid rgba(255,255,255,0.1); text-align: center; }"
    "h1 { font-weight: 700; letter-spacing: 0.3em; text-transform: uppercase; color: #D4CDA4; font-size: 20px; margin-bottom: 25px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px; }"
    "button { background: rgba(212, 205, 164, 0.1); border: 1px solid #D4CDA4; color: #D4CDA4; padding: 14px 24px; border-radius: 8px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.2em; cursor: pointer; transition: all 0.3s ease; width: 100%; margin-top: 15px; }"
    "button:hover { background: rgba(212, 205, 164, 0.2); color: #ffffff; }"
    "input[type=text], input[type=password] { background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); color: #EAE6DA; padding: 14px; width: 100%; box-sizing: border-box; margin-bottom: 15px; border-radius: 8px; font-size: 14px; font-family: monospace; }"
    "input::placeholder { color: rgba(255,255,255,0.3); }"
    "input:focus { outline: none; border-color: rgba(212, 205, 164, 0.5); }"
    "div.c { background: rgba(255,255,255,0.03); padding: 15px; border-radius: 8px; margin-bottom: 15px; text-align: left; border: 1px solid rgba(255,255,255,0.05); }"
    "div.q { float: right; color: #A3B18A; font-family: monospace; }"
    "a { color: #A3B18A; text-decoration: none; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: bold; }"
    "a:hover { color: #D4CDA4; }"
    "div.msg { margin-bottom: 20px; color: #A3B18A; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; }"
    "</style>";
  wm.setCustomHeadElement(customCSS.c_str());

  bool res = wm.autoConnect("Ambient Setup");

  if (!res) {
    Serial.println("Failed to connect... restarting.");
    ESP.restart();
  }

  roomName = buildBroadcastName(String(custom_room_name.getValue()));
  preferences.putString("room", roomName);

  String apSsid = roomName;
  if (apSsid.length() > 31) apSsid = apSsid.substring(0, 31);
  WiFi.softAP(apSsid.c_str());

  Serial.println("\n--- CONNECTED! ---");
  Serial.print("Room Name Saved As: ");
  Serial.println(roomName);
  Serial.print("WiFi STA IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("WiFi AP SSID: ");
  Serial.println(apSsid);
  Serial.print("WiFi AP IP: ");
  Serial.println(WiFi.softAPIP());
}

void setupMdns() {
  macAddress = WiFi.macAddress();
  hostName = "ambient-" + macAddress;
  hostName.replace(":", "");
  hostName.toLowerCase();

  if (MDNS.begin(hostName.c_str())) {
    MDNS.addService("http", "tcp", 80);
    MDNS.addServiceTxt("http", "tcp", "id", macAddress.c_str());
    MDNS.addServiceTxt("http", "tcp", "name", roomName.c_str());
    Serial.print("mDNS: http://");
    Serial.print(hostName);
    Serial.println(".local");
  } else {
    Serial.println("mDNS failed to start");
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(motionPin, INPUT_PULLDOWN);

  if (tcs.begin()) {
    Serial.println("Found TCS34725 Color Sensor");
  } else {
    Serial.println("TCS34725 not detected");
  }

  preferences.begin("ambient-app", false);
  roomName = buildBroadcastName(preferences.getString("room", "New Sensor"));

  pairedTvId = preferences.getString("pairedTvId", "");

  setupNetwork();
  setupMdns();

  server.on("/", HTTP_GET, handleRoot);
  server.on("/api/name", HTTP_POST, handleRename);
  server.on("/api/pair", HTTP_POST, handlePair);
  server.on("/", HTTP_OPTIONS, handleOptions);
  server.on("/api/name", HTTP_OPTIONS, handleOptions);
  server.on("/api/pair", HTTP_OPTIONS, handleOptions);
  server.begin();
}

void loop() {
  server.handleClient();
  MDNS.update();

  if (millis() - lastReadTime > 500) {
    uint16_t r, g, b, c;
    tcs.getRawData(&r, &g, &b, &c);
    currentLux = tcs.calculateLux(r, g, b);
    currentTemp = (currentLux > 1) ? tcs.calculateColorTemperature(r, g, b) : 0;
    isMotion = (digitalRead(motionPin) == HIGH);
    lastReadTime = millis();
  }

  if (millis() - lastSerialPrint > 2000) {
    lastSerialPrint = millis();
    Serial.print("[TELEMETRY] lux=");
    Serial.print(currentLux);
    Serial.print(" tempK=");
    Serial.print(currentTemp);
    Serial.print(" motion=");
    Serial.println(isMotion ? "1" : "0");
  }
}
