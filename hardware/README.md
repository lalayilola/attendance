# ESP32-S3 QR/Barcode Attendance Scanner Hardware

This directory contains the firmware and wiring specifications for the standalone ESP32-S3 Attendance Scanner terminal for the Municipality of Malimono.

---

## Pinout Mapping

| Component | Pin / Function | ESP32-S3 GPIO | Notes |
| :--- | :--- | :--- | :--- |
| **GM65 Scanner** | TX | GPIO 16 (RX) | UART Serial2 (9600 baud) |
| **GM65 Scanner** | RX | GPIO 17 (TX) | Optional trigger control |
| **GM65 Scanner** | VCC | 5V Rail | Scanner requires 5V |
| **GM65 Scanner** | GND | Common GND | |
| **TFT ST7789 Display** | MOSI / SDA | GPIO 11 | Hardware SPI |
| **TFT ST7789 Display** | SCLK / SCK | GPIO 12 | Hardware SPI |
| **TFT ST7789 Display** | CS | GPIO 5 | Chip Select |
| **TFT ST7789 Display** | DC | GPIO 3 | Data / Command |
| **TFT ST7789 Display** | RST | GPIO 4 | Hardware Reset |
| **TFT ST7789 Display** | BL / LED | 3.3V Rail | Via 200Ω Current Limiting Resistor |
| **TFT ST7789 Display** | VCC | 3.3V Rail | Display IC power |
| **TFT ST7789 Display** | GND | Common GND | |
| **TIME IN Button** | Terminal 1 | GPIO 18 | `INPUT_PULLUP` (Active LOW to GND) |
| **TIME OUT Button** | Terminal 1 | GPIO 1 | `INPUT_PULLUP` (Active LOW to GND, moved from GPIO 19) |
| **Green LED (Time In)** | Anode (+) | GPIO 2 | Via 220Ω resistor (Cathode to GND) |
| **Red LED (Time Out)** | Anode (+) | GPIO 10 | Via 220Ω resistor (Cathode to GND) |
| **Active Buzzer** | Anode (+) | GPIO 21 | Via 200Ω resistor (Cathode to GND) |

---

## Power Distribution & Protection Circuit

1. **Power Switch**:
   - 2-pin switch placed on the **5V VCC positive line** directly after the 5V DC power adapter input.
   - The GND line connects directly from adapter GND to the main GND rail.

2. **Capacitor Decoupling "Wall"**:
   - **Main 5V Rail**: 470µF – 1000µF electrolytic capacitor in parallel with 0.1µF (100nF) ceramic capacitor across 5V and GND.
   - **ESP32-S3 3.3V Rail**: 100µF – 220µF electrolytic capacitor in parallel with 0.1µF ceramic capacitor across 3.3V and GND.
   - **TFT Power Pins**: 0.1µF ceramic capacitor across VCC and GND close to the display header.

---

## Firmware Projects

- **`arduino/`**: Complete sketch for Arduino IDE (`esp32s3_attendance_scanner.ino`).
- **`platformio/`**: Complete PlatformIO project configuration and `src/main.cpp`.
