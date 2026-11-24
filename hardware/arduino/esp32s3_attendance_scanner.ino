/*
 ==============================================================================
  ESP32-S3 QR & Barcode Attendance Terminal
  - Hardware Protection Edition (Capacitors, Resistors, Status LEDs)
  - Green LED on GPIO 2: Lights up when TIME IN is active
  - Red LED on GPIO 10:  Lights up when TIME OUT is active
 ==============================================================================
  WIRING REFERENCE:
  -----------------------------------------------------------------------------
  GM65 Scanner:
    - VCC  --> 5V (With 104 0.1uF Ceramic Cap across VCC & GND)
    - GND  --> GND
    - TX   --> GPIO 16 (ESP32-S3 RX)
    - RX   --> GPIO 17 (ESP32-S3 TX)

  TFT Display (3.3V Logic & Power):
    - VCC    --> 3.3V (With 104 0.1uF Ceramic Cap across VCC & GND)
    - GND    --> GND
    - CS     --> GPIO 5
    - RESET  --> GPIO 4
    - DC/RS  --> GPIO 3
    - MOSI   --> GPIO 11
    - SCK    --> GPIO 12
    - LED/BL --> 3.3V (Through a ~200Ω Resistor)
    - MISO   --> NOT CONNECTED

  Buttons (Active LOW - each protected with a ~200Ω series resistor):
    - TIME IN  --> GPIO 18 ──[ 200Ω ]──[ Button ]── GND
    - TIME OUT --> GPIO 1  ──[ 200Ω ]──[ Button ]── GND

  LEDs:
    - GREEN LED (Time In)  --> GPIO 2  ──[ 200Ω ]──(+) LED (−)── GND
    - RED LED   (Time Out) --> GPIO 10 ──[ 200Ω ]──(+) LED (−)── GND

  Buzzer:
    - (+) Signal --> GPIO 21 ──[ 200Ω ]──(+) Buzzer (−)── GND

  Power Rail Filter Capacitors:
    - 5V Rail:   100µF 25V (or 2x 100µF in parallel) across 5V and GND
    - 3.3V Rail: 10µF 25V Electrolytic + 104 0.1uF Ceramic across 3.3V and GND
 ==============================================================================
*/

#include <Arduino.h>
#include <SPI.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>

// ======================== WI-FI CONFIGURATION ========================
const char* WIFI_SSID     = "M's BH";
const char* WIFI_PASSWORD = "tW!n$t@R@2k26";

// ======================== SUPABASE CONFIGURATION =====================
const char* SUPABASE_RPC_URL = "https://earkefnulkzgfabbphjh.supabase.co/rest/v1/rpc/record_attendance";
const char* SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhcmtlZm51bGt6Z2ZhYmJwaGpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxOTkxNDIsImV4cCI6MjExMDc3NTE0Mn0.b0BrEb3mg_Gnr-Kf5JiK2YuA1HfjYvvncIfdVSUMjNc";

// ======================== PIN DEFINITIONS ========================
#define GM65_RX_PIN     16
#define GM65_TX_PIN     17
#define GM65_BAUDRATE   9600

#define TFT_CS          5
#define TFT_RST         4
#define TFT_DC          3
#define TFT_MOSI        11
#define TFT_SCLK        12

#define BTN_TIME_IN     18
#define BTN_TIME_OUT    1

#define LED_GREEN_IN    2    // Green LED for TIME IN
#define LED_RED_OUT     10   // Red LED for TIME OUT

#define BUZZER_PIN      21

// ======================== HARDWARE OBJECTS ========================
HardwareSerial GM65Serial(1);

#define SCREEN_WIDTH    240
#define SCREEN_HEIGHT   240
Adafruit_ST7789 tft = Adafruit_ST7789(TFT_CS, TFT_DC, TFT_RST);

// ======================== COLOR PALETTE ========================
#define COLOR_BG        0x0841  // Dark Navy
#define COLOR_CARD_BG   0x10A2  // Card background
#define COLOR_WHITE     0xFFFF
#define COLOR_BLACK     0x0000
#define COLOR_GREEN     0x07E0  // Bright green
#define COLOR_ORANGE    0xFD20  // Bright orange
#define COLOR_CYAN      0x07FF
#define COLOR_GRAY      0x8410  // Gray
#define COLOR_DARK_GRAY 0x3186
#define COLOR_RED       0xF800

// ======================== SYSTEM MODES ========================
enum SelectionMode {
  MODE_NONE,       // Waiting for user selection
  MODE_TIME_IN,    // TIME IN active
  MODE_TIME_OUT    // TIME OUT active
};

SelectionMode currentMode = MODE_NONE;

bool lastInButtonState  = HIGH;
bool lastOutButtonState = HIGH;
unsigned long lastInDebounceTime  = 0;
unsigned long lastOutDebounceTime = 0;
const unsigned long DEBOUNCE_DELAY = 60; // ms

// ======================== LED CONTROL ========================
void updateStatusLEDs() {
  if (currentMode == MODE_TIME_IN) {
    digitalWrite(LED_GREEN_IN, HIGH);
    digitalWrite(LED_RED_OUT, LOW);
  } else if (currentMode == MODE_TIME_OUT) {
    digitalWrite(LED_GREEN_IN, LOW);
    digitalWrite(LED_RED_OUT, HIGH);
  } else {
    digitalWrite(LED_GREEN_IN, LOW);
    digitalWrite(LED_RED_OUT, LOW);
  }
}

void flashBothLEDs(int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_GREEN_IN, HIGH);
    digitalWrite(LED_RED_OUT, HIGH);
    delay(delayMs);
    digitalWrite(LED_GREEN_IN, LOW);
    digitalWrite(LED_RED_OUT, LOW);
    delay(delayMs);
  }
}

// ======================== BUZZER FUNCTIONS ========================
void beepTone(int freq, int durationMs) {
  #if defined(ESP32)
    tone(BUZZER_PIN, freq, durationMs);
  #endif
  digitalWrite(BUZZER_PIN, HIGH);
  delay(durationMs);
  #if defined(ESP32)
    noTone(BUZZER_PIN);
  #endif
  digitalWrite(BUZZER_PIN, LOW);
}

void beepClick() {
  beepTone(2400, 40);
}

void beepSuccess() {
  beepTone(1800, 80);
  delay(50);
  beepTone(2600, 140);
}

void beepError() {
  beepTone(600, 300);
}

// ======================== UI DISPLAY ROUTINES ========================
void drawHeader() {
  tft.fillRect(0, 0, SCREEN_WIDTH, 32, 0x18C3);
  tft.setTextColor(COLOR_WHITE);
  tft.setTextSize(2);
  tft.setCursor(14, 8);
  tft.print("ATTENDANCE");

  tft.setTextSize(1);
  if (WiFi.status() == WL_CONNECTED) {
    tft.setTextColor(COLOR_GREEN);
    tft.setCursor(SCREEN_WIDTH - 46, 12);
    tft.print("ONLINE");
  } else {
    tft.setTextColor(COLOR_RED);
    tft.setCursor(SCREEN_WIDTH - 50, 12);
    tft.print("OFFLINE");
  }
}

void drawButtonsUI() {
  // TIME IN Box
  if (currentMode == MODE_TIME_IN) {
    tft.fillRoundRect(10, 40, 105, 45, 6, COLOR_GREEN);
    tft.setTextColor(COLOR_BLACK);
    tft.setTextSize(2);
    tft.setCursor(18, 54);
    tft.print("TIME IN");
  } else {
    tft.fillRoundRect(10, 40, 105, 45, 6, COLOR_CARD_BG);
    tft.drawRoundRect(10, 40, 105, 45, 6, COLOR_DARK_GRAY);
    tft.setTextColor(COLOR_GRAY);
    tft.setTextSize(2);
    tft.setCursor(18, 54);
    tft.print("TIME IN");
  }

  // TIME OUT Box
  if (currentMode == MODE_TIME_OUT) {
    tft.fillRoundRect(125, 40, 105, 45, 6, COLOR_ORANGE);
    tft.setTextColor(COLOR_BLACK);
    tft.setTextSize(2);
    tft.setCursor(128, 54);
    tft.print("TIME OUT");
  } else {
    tft.fillRoundRect(125, 40, 105, 45, 6, COLOR_CARD_BG);
    tft.drawRoundRect(125, 40, 105, 45, 6, COLOR_DARK_GRAY);
    tft.setTextColor(COLOR_GRAY);
    tft.setTextSize(2);
    tft.setCursor(128, 54);
    tft.print("TIME OUT");
  }
}

void drawCenterPrompt() {
  tft.fillRect(10, 95, SCREEN_WIDTH - 20, 115, COLOR_BG);

  if (currentMode == MODE_NONE) {
    tft.drawRoundRect(10, 95, SCREEN_WIDTH - 20, 115, 6, COLOR_DARK_GRAY);
    
    tft.setTextColor(COLOR_WHITE);
    tft.setTextSize(2);
    tft.setCursor(30, 115);
    tft.print("PLEASE SELECT");

    tft.setTextColor(COLOR_CYAN);
    tft.setTextSize(1);
    tft.setCursor(20, 145);
    tft.print("Press [TIME IN] or [TIME OUT]");
    tft.setCursor(20, 160);
    tft.setTextColor(COLOR_GRAY);
    tft.print("Green LED = IN | Red LED = OUT");

    tft.setTextColor(COLOR_WHITE);
    tft.setCursor(45, 185);
    tft.print("to begin scanning");
  } else {
    uint16_t accent = (currentMode == MODE_TIME_IN) ? COLOR_GREEN : COLOR_ORANGE;
    tft.drawRoundRect(10, 95, SCREEN_WIDTH - 20, 115, 6, accent);
    tft.drawRoundRect(11, 96, SCREEN_WIDTH - 22, 113, 5, accent);

    tft.setTextColor(accent);
    tft.setTextSize(2);
    tft.setCursor(28, 112);
    if (currentMode == MODE_TIME_IN) {
      tft.print("READY: TIME IN");
    } else {
      tft.print("READY: TIME OUT");
    }

    tft.setTextColor(COLOR_WHITE);
    tft.setTextSize(2);
    tft.setCursor(22, 142);
    tft.print("SCAN QR CODE");

    tft.setTextColor(COLOR_GRAY);
    tft.setTextSize(1);
    tft.setCursor(24, 172);
    tft.print("Hold QR in front of scanner");
    tft.setCursor(24, 186);
    tft.print("Automatic Cloud Sync");
  }
}

void drawFooter() {
  tft.fillRect(0, SCREEN_HEIGHT - 24, SCREEN_WIDTH, 24, 0x10A2);
  tft.setTextColor(COLOR_GRAY);
  tft.setTextSize(1);
  tft.setCursor(12, SCREEN_HEIGHT - 16);
  if (WiFi.status() == WL_CONNECTED) {
    tft.print("WiFi: Connected (");
    tft.print(WiFi.localIP().toString());
    tft.print(")");
  } else {
    tft.print("WiFi: Offline");
  }
}

void refreshStandbyScreen() {
  tft.fillScreen(COLOR_BG);
  drawHeader();
  drawButtonsUI();
  drawCenterPrompt();
  drawFooter();
  updateStatusLEDs();
}

void showConnectingScreen() {
  tft.fillScreen(COLOR_BG);

  tft.fillRect(0, 0, SCREEN_WIDTH, 44, 0x18C3);
  tft.setTextColor(COLOR_WHITE);
  tft.setTextSize(2);
  tft.setCursor(20, 14);
  tft.print("SYSTEM STARTUP");

  tft.drawRoundRect(15, 65, SCREEN_WIDTH - 30, 110, 6, COLOR_CYAN);

  tft.setTextColor(COLOR_WHITE);
  tft.setTextSize(2);
  tft.setCursor(28, 85);
  tft.print("CONNECTING...");

  tft.setTextColor(COLOR_GRAY);
  tft.setTextSize(1);
  tft.setCursor(28, 115);
  tft.print("Network:");
  tft.setTextColor(COLOR_CYAN);
  tft.setCursor(28, 128);
  tft.print(WIFI_SSID);

  tft.setTextColor(COLOR_GRAY);
  tft.setCursor(28, 148);
  tft.print("Please wait a moment...");
}

void showProcessingScreen() {
  tft.fillRect(10, 95, SCREEN_WIDTH - 20, 115, COLOR_BG);
  tft.drawRoundRect(10, 95, SCREEN_WIDTH - 20, 115, 6, COLOR_CYAN);

  tft.setTextColor(COLOR_CYAN);
  tft.setTextSize(2);
  tft.setCursor(28, 125);
  tft.print("VERIFYING...");

  tft.setTextColor(COLOR_WHITE);
  tft.setTextSize(1);
  tft.setCursor(28, 155);
  tft.print("Checking database...");
}

void showResultScreen(bool success, String action, String name, String message) {
  uint16_t bannerColor = success ? (action == "TIME IN" ? COLOR_GREEN : COLOR_ORANGE) : COLOR_RED;

  tft.fillScreen(COLOR_BG);

  tft.fillRect(0, 0, SCREEN_WIDTH, 48, bannerColor);
  tft.setTextColor(COLOR_BLACK);
  tft.setTextSize(2);
  tft.setCursor(16, 15);
  if (success) {
    tft.print(action + " SUCCESS!");
  } else {
    tft.print("SCAN FAILED");
  }

  tft.drawRoundRect(10, 58, SCREEN_WIDTH - 20, 120, 6, COLOR_WHITE);

  if (success) {
    tft.setTextSize(1);
    tft.setTextColor(COLOR_GRAY);
    tft.setCursor(20, 70);
    tft.print("EMPLOYEE NAME:");

    tft.setTextSize(2);
    tft.setTextColor(COLOR_WHITE);
    tft.setCursor(20, 88);
    if (name.length() > 17) name = name.substring(0, 15) + "..";
    tft.print(name.length() > 0 ? name : "Verified");

    tft.setTextSize(1);
    tft.setTextColor(bannerColor);
    tft.setCursor(20, 118);
    tft.print("STATUS: RECORDED IN DATABASE");

    tft.setTextColor(COLOR_GRAY);
    tft.setCursor(20, 136);
    tft.print("Web dashboard updated!");

    beepSuccess();
    flashBothLEDs(2, 100);
  } else {
    tft.setTextSize(1);
    tft.setTextColor(COLOR_RED);
    tft.setCursor(20, 74);
    tft.print("REASON:");

    tft.setTextSize(1);
    tft.setTextColor(COLOR_WHITE);
    tft.setCursor(20, 94);
    if (message.length() > 30) {
      tft.println(message.substring(0, 28));
      tft.setCursor(20, 108);
      tft.println(message.substring(28));
    } else {
      tft.println(message);
    }

    tft.setTextColor(COLOR_GRAY);
    tft.setCursor(20, 136);
    tft.print("Please try scanning again");

    beepError();
    for (int k = 0; k < 3; k++) {
      digitalWrite(LED_RED_OUT, HIGH);
      delay(80);
      digitalWrite(LED_RED_OUT, LOW);
      delay(80);
    }
  }

  tft.fillRect(0, SCREEN_HEIGHT - 30, SCREEN_WIDTH, 30, 0x18C3);
  tft.setTextColor(COLOR_WHITE);
  tft.setTextSize(1);
  tft.setCursor(45, SCREEN_HEIGHT - 20);
  tft.print("Thank you! Next user...");

  delay(2800);

  currentMode = MODE_NONE;
  refreshStandbyScreen();
}

void sendAttendanceToSupabase(String qrToken) {
  showProcessingScreen();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[Wi-Fi] Reconnecting...");
    WiFi.reconnect();
    unsigned long waitStart = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - waitStart < 4000) {
      delay(200);
    }
    if (WiFi.status() != WL_CONNECTED) {
      showResultScreen(false, "", "", "Wi-Fi Disconnected");
      return;
    }
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  if (!http.begin(client, SUPABASE_RPC_URL)) {
    showResultScreen(false, "", "", "Cloud Host Unreachable");
    return;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_API_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_API_KEY);

  JsonDocument doc;
  doc["p_qr_token"] = qrToken;
  String requestBody;
  serializeJson(doc, requestBody);

  Serial.println("[HTTP] Sending POST: " + requestBody);

  int httpCode = http.POST(requestBody);
  Serial.printf("[HTTP] Code: %d\n", httpCode);

  if (httpCode > 0) {
    String payload = http.getString();
    Serial.println("[HTTP] Response: " + payload);

    JsonDocument resDoc;
    DeserializationError error = deserializeJson(resDoc, payload);

    if (!error) {
      bool success = resDoc["success"] | false;
      String action = resDoc["action"] | (currentMode == MODE_TIME_IN ? "TIME IN" : "TIME OUT");
      String name = resDoc["name"] | "";
      String msg = resDoc["message"] | resDoc["error"] | "Unknown response";

      showResultScreen(success, action, name, msg);
    } else {
      showResultScreen(false, "", "", "Invalid JSON Response");
    }
  } else {
    showResultScreen(false, "", "", "Network Request Failed");
  }

  http.end();
}

void setup() {
  Serial.begin(115200);
  Serial.println("\n--- ESP32-S3 Hardware-Protected Terminal Starting ---");

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  pinMode(LED_GREEN_IN, OUTPUT);
  pinMode(LED_RED_OUT, OUTPUT);
  digitalWrite(LED_GREEN_IN, LOW);
  digitalWrite(LED_RED_OUT, LOW);

  pinMode(BTN_TIME_IN, INPUT_PULLUP);
  pinMode(BTN_TIME_OUT, INPUT_PULLUP);

  SPI.begin(TFT_SCLK, -1, TFT_MOSI, TFT_CS);
  tft.init(SCREEN_WIDTH, SCREEN_HEIGHT);
  tft.setRotation(2);

  showConnectingScreen();

  flashBothLEDs(2, 80);

  pinMode(GM65_TX_PIN, OUTPUT);
  digitalWrite(GM65_TX_PIN, HIGH);
  GM65Serial.begin(GM65_BAUDRATE, SERIAL_8N1, GM65_RX_PIN, GM65_TX_PIN);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(400);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
    beepClick();
  } else {
    Serial.println("\n[WiFi] Offline mode.");
  }

  refreshStandbyScreen();
}

void loop() {
  unsigned long now = millis();

  // 1. Button TIME IN (GPIO 18)
  bool currentInReading = digitalRead(BTN_TIME_IN);
  if (currentInReading != lastInButtonState) {
    lastInDebounceTime = now;
  }
  if ((now - lastInDebounceTime) > DEBOUNCE_DELAY) {
    if (currentInReading == LOW && currentMode != MODE_TIME_IN) {
      currentMode = MODE_TIME_IN;
      Serial.println("[Mode Selected] -> TIME IN");
      beepClick();
      updateStatusLEDs();
      drawButtonsUI();
      drawCenterPrompt();
    }
  }
  lastInButtonState = currentInReading;

  // 2. Button TIME OUT (GPIO 1)
  bool currentOutReading = digitalRead(BTN_TIME_OUT);
  if (currentOutReading != lastOutButtonState) {
    lastOutDebounceTime = now;
  }
  if ((now - lastOutDebounceTime) > DEBOUNCE_DELAY) {
    if (currentOutReading == LOW && currentMode != MODE_TIME_OUT) {
      currentMode = MODE_TIME_OUT;
      Serial.println("[Mode Selected] -> TIME OUT");
      beepClick();
      updateStatusLEDs();
      drawButtonsUI();
      drawCenterPrompt();
    }
  }
  lastOutButtonState = currentOutReading;

  // 3. GM65 Scanner UART Reading
  if (GM65Serial.available()) {
    String scannedData = "";
    unsigned long readStart = millis();

    while (millis() - readStart < 150) {
      while (GM65Serial.available()) {
        char c = (char)GM65Serial.read();
        if (c != '\r' && c != '\n') {
          scannedData += c;
        }
        readStart = millis();
      }
    }

    scannedData.trim();

    if (scannedData.length() > 0) {
      Serial.println("[Scan Detected] Token: " + scannedData);

      if (currentMode == MODE_NONE) {
        tft.fillRect(10, 95, SCREEN_WIDTH - 20, 115, COLOR_BG);
        tft.drawRoundRect(10, 95, SCREEN_WIDTH - 20, 115, 6, COLOR_ORANGE);
        tft.setTextColor(COLOR_ORANGE);
        tft.setTextSize(2);
        tft.setCursor(32, 115);
        tft.print("SELECT FIRST!");
        tft.setTextSize(1);
        tft.setTextColor(COLOR_WHITE);
        tft.setCursor(20, 145);
        tft.print("Press [TIME IN] or [TIME OUT]");
        tft.setCursor(20, 160);
        tft.print("before presenting your QR.");
        beepError();
        for (int k = 0; k < 2; k++) {
          digitalWrite(LED_RED_OUT, HIGH);
          delay(100);
          digitalWrite(LED_RED_OUT, LOW);
          delay(100);
        }
        drawCenterPrompt();
      } else {
        sendAttendanceToSupabase(scannedData);
      }

      while (GM65Serial.available()) {
        GM65Serial.read();
      }
    }
  }
}
