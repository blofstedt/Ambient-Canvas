#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <ESPmDNS.h>
#include <WiFiManager.h>
#include <Preferences.h>
#include <Update.h>
#include <esp_ota_ops.h>
#include "mbedtls/sha256.h"
#include "Adafruit_TCS34725.h"

WebServer server(80);
Adafruit_TCS34725 tcs = Adafruit_TCS34725(TCS34725_INTEGRATIONTIME_50MS, TCS34725_GAIN_4X);
Preferences preferences;

const int motionPin = 27;
const int sensorLedPin = 14; // Connect a wire from the sensor's 'LED' pin to ESP32 pin 14

uint16_t currentLux = 0;
uint16_t currentTemp = 0;
bool isMotion = false;
unsigned long lastReadTime = 0;
unsigned long lastSerialPrint = 0;

String macAddress = "";
String hostName = "";
String roomName = "New Sensor";
String pairedTvId = "";
String adminPassword = "";
const char* adminUser = "admin";
const char* defaultAdminPassword = "changeme";
const char* firmwareVersion = "phase4-ota-v1";
const size_t minAdminPasswordLength = 10;
const char* setupPortalSsid = "Ambient Setup";
const int resetButtonPin = 26;
const unsigned long resetHoldMs = 8000;

int failedAuthCount = 0;
unsigned long authLockUntilMs = 0;
unsigned long resetPressStartMs = 0;
bool otaChecksumActive = false;
char otaSha256Expected[65] = {0};
unsigned char otaSha256Digest[32] = {0};
mbedtls_sha256_context otaSha256Ctx;

bool isDefaultPasswordActive() {
  return adminPassword == defaultAdminPassword;
}

bool requireAdminAuth() {
  unsigned long now = millis();
  if (authLockUntilMs > now) {
    sendCors();
    server.send(429, "application/json", "{\"ok\":false,\"error\":\"auth temporarily locked\"}");
    return false;
  }

  if (!server.authenticate(adminUser, adminPassword.c_str())) {
    failedAuthCount++;
    if (failedAuthCount >= 5) {
      authLockUntilMs = now + 60000;
      failedAuthCount = 0;
    }
    server.requestAuthentication();
    return false;
  }
  failedAuthCount = 0;
  return true;
}

bool requirePasswordRotationForSensitiveWrite() {
  if (!isDefaultPasswordActive()) return true;
  sendCors();
  server.send(428, "application/json", "{\"ok\":false,\"error\":\"change default admin password first\"}");
  return false;
}

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
  String origin = server.header("Origin");
  if (origin.length() > 0) {
    String localIp = WiFi.localIP().toString();
    bool sameHostOrigin = origin.indexOf(localIp) >= 0 || origin.indexOf(hostName) >= 0 || origin.indexOf(hostName + ".local") >= 0;
    if (sameHostOrigin) {
      server.sendHeader("Access-Control-Allow-Origin", origin);
      server.sendHeader("Vary", "Origin");
    }
  }
  server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type,X-Firmware-Version,X-Firmware-SHA256,Authorization");
}

void handleOptions() {
  sendCors();
  server.send(204);
}

String buildStatusJson() {
  String json = "{";
  json += "\"id\":\"" + macAddress + "\",";
  json += "\"name\":\"" + roomName + "\",";
  json += "\"lux\":" + String(currentLux) + ",";
  json += "\"temp\":" + String(currentTemp) + ",";
  json += "\"motion\":" + String(isMotion ? "true" : "false") + ",";
  json += "\"hostname\":\"" + hostName + "\",";
  json += "\"paired\":" + String(pairedTvId.length() > 0 ? "true" : "false") + ",";
  json += "\"pairedTvId\":\"" + pairedTvId + "\",";
  json += "\"firmwareVersion\":\"" + String(firmwareVersion) + "\",";
  json += "\"authRequired\":true,";
  json += "\"adminUser\":\"" + String(adminUser) + "\",";
  json += "\"adminUiPath\":\"/ui\",";
  json += "\"setupPortalSsid\":\"" + String(setupPortalSsid) + "\",";
  json += "\"passwordMinLength\":" + String(minAdminPasswordLength) + ",";
  json += "\"passwordNeedsChange\":" + String(isDefaultPasswordActive() ? "true" : "false");
  json += "}";
  return json;
}

String buildAdminPageHtml() {
  String html = "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<title>Ambient Sensor Admin</title><style>";
  html += "body{background:radial-gradient(1200px 700px at 20% -10%,#303727 0%,#0d0f0b 45%,#080906 100%);color:#eae6da;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;padding:24px;line-height:1.45}";
  html += ".card{max-width:760px;margin:0 auto;background:linear-gradient(180deg,rgba(33,37,28,.95),rgba(20,23,16,.95));border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:24px;box-shadow:0 18px 60px rgba(0,0,0,.55)}";
  html += "h1{font-size:20px;letter-spacing:.16em;text-transform:uppercase;color:#d4cda4;margin:0 0 8px}";
  html += ".muted{opacity:.74;font-size:13px;margin-bottom:16px}.row{display:grid;grid-template-columns:185px 1fr;align-items:center;gap:14px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.07)}";
  html += ".k{opacity:.75;text-transform:uppercase;font-size:11px;letter-spacing:.12em}.v{font-family:monospace;font-size:14px;text-align:right;word-break:break-all;justify-self:end;max-width:100%}";
  html += ".actions{margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px}.btn{background:rgba(212,205,164,.12);border:1px solid #d4cda4;color:#d4cda4;padding:11px 12px;border-radius:10px;cursor:pointer;text-transform:uppercase;font-size:11px;letter-spacing:.12em}";
  html += ".btn:hover{background:rgba(212,205,164,.2);color:#fff}.ok{color:#a3b18a;font-size:12px;margin-top:10px;min-height:18px}.err{color:#e58b8b}";
  html += "input{width:100%;box-sizing:border-box;margin-top:8px;background:rgba(0,0,0,.35);color:#eae6da;border:1px solid rgba(255,255,255,.18);padding:11px;border-radius:10px}";
  html += "a{color:#a3b18a}</style></head><body><div class='card'>";
  html += "<h1>Ambient Sensor</h1><div class='muted'>Phase 1 admin UI foundation (local network access).</div>";
  html += "<div class='muted' style='background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);padding:10px;border-radius:8px;margin-bottom:12px'>";
  html += "Access: <b>/ui</b> for admin, <b>/api/status</b> for JSON. If unreachable, rejoin Wi-Fi setup SSID <b>Ambient Setup</b>. Default login: <b>admin / changeme</b> (must change before pairing/OTA/reset).";
  html += "</div>";
  html += "<div class='row'><div class='k'>Sensor Name</div><div class='v' id='name'>-</div></div>";
  html += "<div class='row'><div class='k'>Sensor ID</div><div class='v' id='id'>-</div></div>";
  html += "<div class='row'><div class='k'>Hostname</div><div class='v' id='host'>-</div></div>";
  html += "<div class='row'><div class='k'>Paired</div><div class='v' id='paired'>-</div></div>";
  html += "<div class='row'><div class='k'>Paired TV ID</div><div class='v' id='tvid'>-</div></div>";
  html += "<div class='row'><div class='k'>Firmware</div><div class='v' id='fw'>-</div></div>";
  html += "<div class='row'><div class='k'>Admin Password</div><div class='v' id='pwstate'>-</div></div>";
  html += "<div class='row'><div class='k'>Lux / Temp / Motion</div><div class='v' id='telemetry'>-</div></div>";
  html += "<div style='margin-top:14px'><div class='k'>Change Admin Password</div><input id='passwordInput' type='password' maxlength='64' placeholder='Enter new password'/></div>";
  html += "<div style='margin-top:14px'><div class='k'>Rename Sensor</div><input id='renameInput' maxlength='24' placeholder='Living Room'/></div>";
  html += "<div class='actions'><button class='btn' id='renameBtn'>Save Name</button><button class='btn' id='refreshBtn'>Refresh</button></div>";
  html += "<div class='actions'><button class='btn' id='unpairBtn'>Unpair TV</button><button class='btn' id='resetBtn'>Factory Reset</button></div>";
  html += "<div style='margin-top:14px'><div class='k'>Firmware OTA (.bin)</div><input id='otaFile' type='file' accept='.bin,application/octet-stream'/></div>";
  html += "<div class='actions'><button class='btn' id='otaBtn'>Upload Firmware</button><button class='btn' id='otaInfoBtn'>OTA Notes</button></div>";
  html += "<div id='msg' class='ok'></div><div class='muted' style='margin-top:8px'>JSON endpoints: <a href='/api/status'>/api/status</a> and <a href='/'>/</a>.</div>";
  html += "</div><script>";
  html += "const $=id=>document.getElementById(id);";
  html += "const msg=(t,e=false)=>{$('msg').textContent=t;$('msg').className=e?'ok err':'ok';};";
  html += "async function load(){try{const r=await fetch('/api/status');const d=await r.json();$('name').textContent=d.name||'-';$('id').textContent=d.id||'-';$('host').textContent=d.hostname||'-';$('paired').textContent=d.paired?'Yes':'No';$('tvid').textContent=d.pairedTvId||'-';$('fw').textContent=d.firmwareVersion||'-';$('pwstate').textContent=d.passwordNeedsChange?'Change Required':'Set';$('telemetry').textContent=`${d.lux??'-'} lx / ${d.temp??'-'} K / ${d.motion?'motion':'no motion'}`;msg('');}catch(e){msg('Unable to fetch status. Check local network access.',true);}}";
  html += "$('refreshBtn').addEventListener('click',load);";
  html += "$('renameBtn').addEventListener('click',async()=>{const name=$('renameInput').value.trim();if(!name){msg('Enter a name before saving.',true);return;}try{const r=await fetch('/api/name',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});if(!r.ok){msg('Rename failed.',true);return;}msg('Name updated.');$('renameInput').value='';load();}catch(e){msg('Rename failed: device unreachable.',true);}});";
  html += "$('passwordInput').addEventListener('keydown',async(e)=>{if(e.key!=='Enter')return;const password=$('passwordInput').value.trim();if(password.length<10){msg('Password must be at least 10 characters.',true);return;}try{const r=await fetch('/api/admin-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});if(!r.ok){msg('Password update failed.',true);return;}msg('Admin password updated.');$('passwordInput').value='';load();}catch(e2){msg('Password update failed: device unreachable.',true);}});";
  html += "$('unpairBtn').addEventListener('click',async()=>{if(!confirm('Unpair this sensor from current TV?'))return;try{const r=await fetch('/api/unpair',{method:'POST'});if(!r.ok){msg('Unpair failed.',true);return;}msg('Sensor unpaired from TV.');load();}catch(e){msg('Unpair failed: device unreachable.',true);}});";
  html += "$('resetBtn').addEventListener('click',async()=>{if(!confirm('Factory reset sensor? This clears pairing and saved settings.'))return;try{const r=await fetch('/api/factory-reset',{method:'POST'});if(!r.ok){msg('Factory reset failed.',true);return;}msg('Reset requested. Sensor will restart...');}catch(e){msg('Factory reset failed: device unreachable.',true);}});";
  html += "$('otaInfoBtn').addEventListener('click',()=>msg('Upload a compiled ESP32 .bin. Device restarts on success. Rollback support is enabled if the new image fails validation on boot.',false));";
  html += "$('otaBtn').addEventListener('click',async()=>{const file=$('otaFile').files&&$('otaFile').files[0];if(!file){msg('Choose a .bin file first.',true);return;}if(!confirm('Install new firmware now?'))return;try{msg('Calculating checksum...');const buffer=await file.arrayBuffer();const digest=await crypto.subtle.digest('SHA-256',buffer);const hex=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');const ver=prompt('Enter new firmware version label (must differ from current):','phase4-ota-v2');if(!ver){msg('OTA cancelled: firmware version required.',true);return;}const fd=new FormData();fd.append('firmware',file);const r=await fetch('/api/ota',{method:'POST',headers:{'X-Firmware-Version':ver,'X-Firmware-SHA256':hex},body:fd});const t=await r.text();if(!r.ok){msg('OTA failed: '+t,true);return;}msg('OTA installed. Device restarting...');}catch(e){msg('OTA failed: '+(e&&e.message?e.message:'device unreachable'),true);}});";
  html += "load();setInterval(load,5000);";
  html += "</script></body></html>";
  return html;
}

void handleRoot() {
  server.sendHeader("Cache-Control", "no-store");
  server.sendHeader("Location", "/ui");
  server.send(302, "text/plain", "Redirecting to /ui");
}

void handleRootJsonLegacy() {
  sendCors();
  server.send(200, "application/json", buildStatusJson());
}

void handleStatus() {
  sendCors();
  server.send(200, "application/json", buildStatusJson());
}

void handleAdminUi() {
  server.send(200, "text/html; charset=utf-8", buildAdminPageHtml());
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
  if (!requireAdminAuth()) return;
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
  if (!requireAdminAuth()) return;
  if (!requirePasswordRotationForSensitiveWrite()) return;
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

void handleUnpair() {
  if (!requireAdminAuth()) return;
  if (!requirePasswordRotationForSensitiveWrite()) return;
  sendCors();
  pairedTvId = "";
  preferences.putString("pairedTvId", pairedTvId);
  server.send(200, "application/json", "{\"ok\":true,\"paired\":false}");
}

void handleFactoryReset() {
  if (!requireAdminAuth()) return;
  if (!requirePasswordRotationForSensitiveWrite()) return;
  sendCors();
  preferences.clear();
  pairedTvId = "";
  roomName = buildBroadcastName("New Sensor");
  server.send(200, "application/json", "{\"ok\":true,\"reset\":true,\"restarting\":true}");
  delay(250);
  ESP.restart();
}

void handleAdminPasswordChange() {
  if (!requireAdminAuth()) return;
  sendCors();
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"ok\":false,\"error\":\"missing body\"}");
    return;
  }
  String password = getJsonValue(server.arg("plain"), "password");
  password.trim();
  if (password.length() < minAdminPasswordLength) {
    server.send(400, "application/json", "{\"ok\":false,\"error\":\"password too short\"}");
    return;
  }
  adminPassword = password;
  preferences.putString("adminPassword", adminPassword);
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleOtaUpdate() {
  if (!requireAdminAuth()) return;
  if (!requirePasswordRotationForSensitiveWrite()) return;
  sendCors();
  HTTPUpload& upload = server.upload();
  String requestedVersion = server.header("X-Firmware-Version");
  String requestedSha256 = server.header("X-Firmware-SHA256");
  requestedVersion.trim();
  requestedSha256.trim();
  requestedSha256.toLowerCase();

  if (upload.status == UPLOAD_FILE_START) {
    if (requestedVersion.length() == 0 || requestedVersion == firmwareVersion) {
      server.send(400, "text/plain", "invalid or unchanged firmware version");
      return;
    }
    if (requestedSha256.length() != 64) {
      server.send(400, "text/plain", "missing or invalid firmware sha256");
      return;
    }
    requestedSha256.toCharArray(otaSha256Expected, sizeof(otaSha256Expected));
    mbedtls_sha256_init(&otaSha256Ctx);
    mbedtls_sha256_starts_ret(&otaSha256Ctx, 0);
    otaChecksumActive = true;
    if (!upload.filename.endsWith(".bin")) {
      server.send(400, "text/plain", "expected .bin file");
      return;
    }
    if (!Update.begin(UPDATE_SIZE_UNKNOWN, U_FLASH)) {
      Update.printError(Serial);
      server.send(500, "text/plain", "update begin failed");
      return;
    }
  } else if (upload.status == UPLOAD_FILE_WRITE) {
    if (otaChecksumActive) {
      mbedtls_sha256_update_ret(&otaSha256Ctx, upload.buf, upload.currentSize);
    }
    if (Update.write(upload.buf, upload.currentSize) != upload.currentSize) {
      Update.printError(Serial);
      Update.abort();
      server.send(500, "text/plain", "update write failed");
      return;
    }
  } else if (upload.status == UPLOAD_FILE_END) {
    if (otaChecksumActive) {
      mbedtls_sha256_finish_ret(&otaSha256Ctx, otaSha256Digest);
      mbedtls_sha256_free(&otaSha256Ctx);
      otaChecksumActive = false;

      char actualHex[65];
      for (int i = 0; i < 32; i++) {
        sprintf(&actualHex[i * 2], "%02x", otaSha256Digest[i]);
      }
      actualHex[64] = '\0';
      if (strcmp(actualHex, otaSha256Expected) != 0) {
        Update.abort();
        server.send(400, "text/plain", "firmware sha256 mismatch");
        return;
      }
    }
    if (Update.end(true)) {
      server.send(200, "text/plain", "ok");
      delay(250);
      ESP.restart();
    } else {
      Update.printError(Serial);
      server.send(500, "text/plain", "update end failed");
    }
  } else if (upload.status == UPLOAD_FILE_ABORTED) {
    if (otaChecksumActive) {
      mbedtls_sha256_free(&otaSha256Ctx);
      otaChecksumActive = false;
    }
    Update.abort();
    server.send(500, "text/plain", "upload aborted");
  }
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

  bool res = wm.autoConnect(setupPortalSsid);

  if (!res) {
    Serial.println("Failed to connect... restarting.");
    ESP.restart();
  }

  roomName = buildBroadcastName(String(custom_room_name.getValue()));
  preferences.putString("room", roomName);

  if (pairedTvId.length() == 0) {
    String apSsid = roomName;
    if (apSsid.length() > 31) apSsid = apSsid.substring(0, 31);
    WiFi.softAP(apSsid.c_str());
    Serial.print("WiFi AP SSID: ");
    Serial.println(apSsid);
    Serial.print("WiFi AP IP: ");
    Serial.println(WiFi.softAPIP());
  } else {
    WiFi.mode(WIFI_STA);
    Serial.println("Device is paired. SoftAP disabled (STA mode only).");
  }

  Serial.println("\n--- CONNECTED! ---");
  Serial.print("Room Name Saved As: ");
  Serial.println(roomName);
  Serial.print("WiFi STA IP: ");
  Serial.println(WiFi.localIP());
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
    
    MDNS.addServiceTxt("http", "tcp", "paired", pairedTvId.length() > 0 ? "true" : "false");
    MDNS.addServiceTxt("http", "tcp", "tvId", pairedTvId.c_str());

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
  pinMode(resetButtonPin, INPUT_PULLUP);

  pinMode(sensorLedPin, OUTPUT);
  analogWrite(sensorLedPin, 2); // Extremely dim

  if (tcs.begin()) {
    Serial.println("Found TCS34725 Color Sensor");
  } else {
    Serial.println("TCS34725 not detected");
  }

  preferences.begin("ambient-app", false);
  roomName = buildBroadcastName(preferences.getString("room", "New Sensor"));

  pairedTvId = preferences.getString("pairedTvId", "");
  adminPassword = preferences.getString("adminPassword", defaultAdminPassword);

  setupNetwork();
  setupMdns();
  if (esp_ota_mark_app_valid_cancel_rollback() == ESP_OK) {
    Serial.println("[OTA] Current firmware marked valid.");
  }

  server.on("/", HTTP_GET, handleRoot);
  server.on("/api/root-status", HTTP_GET, handleRootJsonLegacy);
  server.on("/ui", HTTP_GET, handleAdminUi);
  server.on("/api/status", HTTP_GET, handleStatus);
  server.on("/api/name", HTTP_POST, handleRename);
  server.on("/api/pair", HTTP_POST, handlePair);
  server.on("/api/admin-password", HTTP_POST, handleAdminPasswordChange);
  server.on("/api/unpair", HTTP_POST, handleUnpair);
  server.on("/api/factory-reset", HTTP_POST, handleFactoryReset);
  server.on("/api/ota", HTTP_POST, []() {}, handleOtaUpdate);
  server.on("/", HTTP_OPTIONS, handleOptions);
  server.on("/ui", HTTP_OPTIONS, handleOptions);
  server.on("/api/status", HTTP_OPTIONS, handleOptions);
  server.on("/api/root-status", HTTP_OPTIONS, handleOptions);
  server.on("/api/name", HTTP_OPTIONS, handleOptions);
  server.on("/api/pair", HTTP_OPTIONS, handleOptions);
  server.on("/api/admin-password", HTTP_OPTIONS, handleOptions);
  server.on("/api/unpair", HTTP_OPTIONS, handleOptions);
  server.on("/api/factory-reset", HTTP_OPTIONS, handleOptions);
  server.on("/api/ota", HTTP_OPTIONS, handleOptions);
  server.begin();
}

void loop() {
  server.handleClient();

  if (digitalRead(resetButtonPin) == LOW) {
    if (resetPressStartMs == 0) {
      resetPressStartMs = millis();
    } else if (millis() - resetPressStartMs >= resetHoldMs) {
      preferences.clear();
      delay(100);
      ESP.restart();
    }
  } else {
    resetPressStartMs = 0;
  }

  if (millis() - lastReadTime > 50) { // Polling 10x faster (every 50ms)
    uint16_t r, g, b, c;
    tcs.getRawData(&r, &g, &b, &c);
    currentLux = tcs.calculateLux(r, g, b);
    currentTemp = (currentLux > 1) ? tcs.calculateColorTemperature(r, g, b) : 0;
    isMotion = (digitalRead(motionPin) == HIGH);
    lastReadTime = millis();
  }

  if (millis() - lastSerialPrint > 250) { // Serial output 8x faster
    lastSerialPrint = millis();
    Serial.print("[TELEMETRY] lux=");
    Serial.print(currentLux);
    Serial.print(" tempK=");
    Serial.print(currentTemp);
    Serial.print(" motion=");
    Serial.println(isMotion ? "1" : "0");
  }
}
