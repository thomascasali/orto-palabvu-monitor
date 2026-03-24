# Orto Monitor

Sistema IoT per il monitoraggio ambientale con ESP32 e Raspberry Pi.

## Architettura

```
ESP32 (sensori + display OLED)
        |
        | MQTT (WiFi)
        v
Raspberry Pi (broker MQTT + Node.js + MySQL)
        |
        | WebSocket
        v
Dashboard web (browser)
```

## Hardware

### ESP32
- **2x DHT22** — temperatura e umidita aria (interna + esterna)
- **BMP280** — pressione atmosferica (I2C, 0x77)
- **DS18B20** — temperatura terreno (OneWire)
- **Sensore capacitivo** — umidita terreno (analogico)
- **OLED SSD1306 128x32** — display stato e dati (I2C, 0x3C)

Schema pin dettagliato: [docs/wiring.md](docs/wiring.md)

### Raspberry Pi
- Broker MQTT (es. Mosquitto)
- MySQL/MariaDB
- Node.js

## Setup

### ESP32

1. Compilare e caricare con PlatformIO:
   ```bash
   cd esp32
   pio run -t upload
   ```
   Le librerie vengono installate automaticamente da `platformio.ini`.

2. **Prima configurazione (WiFiManager):**
   - Al primo avvio l'ESP32 crea la rete WiFi **ESP32Sensor-Setup**
   - Collegarsi con il telefono a questa rete
   - Si apre automaticamente un portale captive (oppure navigare a `192.168.4.1`)
   - Inserire: SSID e password della rete WiFi, IP broker MQTT locale, IP broker MQTT esterno, SSID della rete locale (per scegliere automaticamente il broker)
   - I parametri vengono salvati nella flash (NVS) e riusati ai riavvii successivi

3. **Reset configurazione:** tenere premuto il pulsante **BOOT** durante l'accensione per cancellare le credenziali salvate e riaprire il portale di configurazione

### Raspberry Pi (server)

1. Installare e avviare il broker MQTT (es. `sudo apt install mosquitto`)
2. Creare il database MySQL:
   ```bash
   mysql -u root -p < docs/schema.sql
   ```
3. Configurare il server:
   ```bash
   cd server
   cp .env.example .env
   # Modificare .env con le proprie credenziali
   npm install
   ```
4. Avviare:
   ```bash
   npm start
   ```

### Accesso dashboard

- **Orto:** `http://<ip-raspberry>:3000/`
- **PalaBVU:** `http://<ip-raspberry>:3000/palabvu.html`

## Topic MQTT

| Topic                         | Direzione    | Descrizione                |
|-------------------------------|--------------|----------------------------|
| `palabvu/temperatura_interna` | ESP32 → Rasp | Temperatura interna (°C)   |
| `palabvu/temperatura_esterna` | ESP32 → Rasp | Temperatura esterna (°C)   |
| `palabvu/umidita_interna`     | ESP32 → Rasp | Umidita interna (%)        |
| `palabvu/umidita_esterna`     | ESP32 → Rasp | Umidita esterna (%)        |
| `palabvu/pressione_interna`   | ESP32 → Rasp | Pressione (hPa)            |
| `palabvu/temperatura_terreno` | ESP32 → Rasp | Temperatura suolo (°C)     |
| `palabvu/umidita_terreno`     | ESP32 → Rasp | Umidita suolo (tensione V) |
| `palabvu/heartbeat`           | ESP32 → Rasp | Segnale di vita (5 min)    |
| `palabvu/comando`             | Rasp → ESP32 | Comandi (es. leggiSensori) |
| `palabvu/debug`               | ESP32 → Rasp | Messaggi di debug          |
| `palabvu/connessione`         | ESP32 → Rasp | IP del dispositivo         |

## Display OLED

Il display mostra a rotazione (ogni 4 secondi) le seguenti pagine:

1. **Connessione** — SSID, IP, stato MQTT
2. **Stato** — uptime, tempo dall'ultimo invio
3. **Aria Interna** — temperatura e umidita
4. **Aria Esterna** — temperatura e umidita
5. **Pressione** — valore in hPa
6. **Suolo** — temperatura e livello umidita
