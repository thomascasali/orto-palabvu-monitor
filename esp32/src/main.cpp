#include <WiFi.h>
#include <WiFiManager.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BMP280.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <esp_task_wdt.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Preferences.h>

// Prototipi
void reconnectMQTT();
void printlnSeriale(String data);
void printSeriale(String data);
bool initOled();
void aggiornaDisplay();
void setupWiFiManager();
void salvaParametriMQTT();
void caricaParametriMQTT();

// ── MQTT ─────────────────────────────────────────────────────
char mqtt_server_locale[40]  = "192.168.1.3";
char mqtt_server_esterno[40] = "";
char ssid_rete_locale[33]    = "";

const char* mqtt_server = "";
const char* temperatura_interna_topic = "palabvu/temperatura_interna";
const char* temperatura_esterna_topic = "palabvu/temperatura_esterna";
const char* umidita_interna_topic = "palabvu/umidita_interna";
const char* umidita_esterna_topic = "palabvu/umidita_esterna";
const char* terreno_topic = "palabvu/umidita_terreno";
const char* terreno_temp_topic = "palabvu/temperatura_terreno";
const char* pressione_interna_topic = "palabvu/pressione_interna";
const char* debug_topic = "palabvu/debug";

String indirizzoIP = "";
String ssidConnesso = "";
const char* topic_msg_to_dispositivo = "palabvu/comando";
const char* topic_connessione = "palabvu/connessione";

// ── WiFiManager ─────────────────────────────────────────────
WiFiManager wm;
bool salvareConfig = false;        // flag settato dal callback
Preferences preferences;

// Pin per reset configurazione (opzionale: collegare un pulsante a GND)
#define PIN_RESET_CONFIG 0  // BOOT button su ESP32 DevKit

// ── SENSORI ──────────────────────────────────────────────────
// DHT22 temperatura e umidita aria
#define DHTPIN_TEMPERATURA_INTERNA 13
#define DHTPIN_TEMPERATURA_ESTERNA 23
#define DHTTYPE DHT22

DHT dht_in(DHTPIN_TEMPERATURA_INTERNA, DHTTYPE);
DHT dht_out(DHTPIN_TEMPERATURA_ESTERNA, DHTTYPE);

// DS18B20 temperatura terreno
#define ONE_WIRE_BUS 4
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// Umidita terreno (capacitivo)
const int pinSensoreUmiditaTerreno = 36; // VP pin

// BMP280 pressione (I2C)
Adafruit_BMP280 bmp;
#define I2C_SDA 21
#define I2C_SCL 22
bool bmp280Inizializzato = false;

// ── DISPLAY OLED SSD1306 128x32 (I2C condiviso con BMP280) ──
#define OLED_ADDRESS 0x3C
#define OLED_WIDTH   128
#define OLED_HEIGHT  32

static Adafruit_SSD1306 oled(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);
static bool oledReady = false;

// ── RETE ─────────────────────────────────────────────────────
WiFiClient espClient;
PubSubClient client(espClient);

// ── TEMPORIZZAZIONE ──────────────────────────────────────────
unsigned long previousMillis = 0;
const long interval = 3000000; // 50 minuti

unsigned long ultimoHeartbeat = 0;
const long intervalloHeartbeat = 300000; // 5 minuti

unsigned long ultimoInvioDati = 0; // timestamp ultimo invio riuscito

// Display: rotazione pagine
unsigned long ultimoCambioPagina = 0;
const long intervalloPagina = 4000; // 4 secondi
int paginaCorrente = 0;
const int NUMERO_PAGINE = 6;

// ── VARIABILI AMBIENTALI ─────────────────────────────────────
float pressione_interna = 0;
float umidita_interna = 0;
float temperatura_interna = 0;
float umidita_esterna = 0;
float temperatura_esterna = 0;
float tensione = 0;
float temperaturaSuolo = 0;

#define livelloSecco     2.5
#define livelloPocoUmido 1.8
#define livelloUmido     1.2
#define livelloBagnato   0.6

// ══════════════════════════════════════════════════════════════
// PERSISTENZA PARAMETRI MQTT (NVS)
// ══════════════════════════════════════════════════════════════
void caricaParametriMQTT() {
  preferences.begin("mqtt", true); // read-only
  String s;
  s = preferences.getString("broker_loc", "");
  if (s.length() > 0) strncpy(mqtt_server_locale, s.c_str(), sizeof(mqtt_server_locale));
  s = preferences.getString("broker_ext", "");
  if (s.length() > 0) strncpy(mqtt_server_esterno, s.c_str(), sizeof(mqtt_server_esterno));
  s = preferences.getString("ssid_locale", "");
  if (s.length() > 0) strncpy(ssid_rete_locale, s.c_str(), sizeof(ssid_rete_locale));
  preferences.end();
  Serial.printf("[NVS] broker_loc=%s  broker_ext=%s  ssid_locale=%s\n",
                mqtt_server_locale, mqtt_server_esterno, ssid_rete_locale);
}

void salvaParametriMQTT() {
  preferences.begin("mqtt", false); // read-write
  preferences.putString("broker_loc", mqtt_server_locale);
  preferences.putString("broker_ext", mqtt_server_esterno);
  preferences.putString("ssid_locale", ssid_rete_locale);
  preferences.end();
  Serial.println("[NVS] Parametri MQTT salvati");
}

// ══════════════════════════════════════════════════════════════
// WiFiManager: CONFIGURAZIONE VIA PORTALE CAPTIVE
// ══════════════════════════════════════════════════════════════
void saveConfigCallback() {
  salvareConfig = true;
}

void setupWiFiManager() {
  // Campi custom per MQTT
  WiFiManagerParameter param_broker_loc("broker_loc", "MQTT Broker Locale (IP)", mqtt_server_locale, 40);
  WiFiManagerParameter param_broker_ext("broker_ext", "MQTT Broker Esterno (IP)", mqtt_server_esterno, 40);
  WiFiManagerParameter param_ssid_locale("ssid_locale", "SSID Rete Locale", ssid_rete_locale, 33);

  wm.addParameter(&param_broker_loc);
  wm.addParameter(&param_broker_ext);
  wm.addParameter(&param_ssid_locale);

  wm.setSaveConfigCallback(saveConfigCallback);

  // Timeout portale: 3 minuti, poi riavvia
  wm.setConfigPortalTimeout(180);

  // Mostra messaggio sul display durante configurazione
  if (oledReady) {
    oled.clearDisplay();
    oled.setTextSize(1);
    oled.setCursor(0, 0);
    oled.println("== SETUP WiFi ==");
    oled.println("Connettiti a:");
    oled.println("ESP32Sensor-Setup");
    oled.println("poi vai a 192.168.4.1");
    oled.display();
  }

  // Tenta connessione automatica, altrimenti apre il portale
  if (!wm.autoConnect("ESP32Sensor-Setup")) {
    Serial.println(F("[WiFi] Portale scaduto - riavvio"));
    ESP.restart();
  }

  // Se l'utente ha salvato nuove credenziali dal portale
  if (salvareConfig) {
    strncpy(mqtt_server_locale, param_broker_loc.getValue(), sizeof(mqtt_server_locale));
    strncpy(mqtt_server_esterno, param_broker_ext.getValue(), sizeof(mqtt_server_esterno));
    strncpy(ssid_rete_locale, param_ssid_locale.getValue(), sizeof(ssid_rete_locale));
    salvaParametriMQTT();
  }

  // Connessione riuscita
  indirizzoIP = WiFi.localIP().toString();
  ssidConnesso = WiFi.SSID();
  Serial.println("Connesso a " + ssidConnesso + " con IP " + indirizzoIP);

  // Seleziona broker MQTT in base alla rete
  if (ssidConnesso == String(ssid_rete_locale)) {
    mqtt_server = mqtt_server_locale;
  } else {
    mqtt_server = mqtt_server_esterno;
  }
  client.setServer(mqtt_server, 1883);
}

// ══════════════════════════════════════════════════════════════
// OLED INIT (pattern dalla guida con recovery bus I2C)
// ══════════════════════════════════════════════════════════════
bool initOled() {
  // 1. Recupero bus I2C
  {
    pinMode(I2C_SCL, OUTPUT); digitalWrite(I2C_SCL, HIGH);
    pinMode(I2C_SDA, INPUT_PULLUP);
    delayMicroseconds(10);
    if (!digitalRead(I2C_SDA)) {
      for (int i = 0; i < 9; i++) {
        digitalWrite(I2C_SCL, LOW);  delayMicroseconds(5);
        digitalWrite(I2C_SCL, HIGH); delayMicroseconds(5);
        if (digitalRead(I2C_SDA)) break;
      }
    }
    digitalWrite(I2C_SCL, LOW);  delayMicroseconds(5);
    pinMode(I2C_SDA, OUTPUT);
    digitalWrite(I2C_SDA, LOW);  delayMicroseconds(5);
    digitalWrite(I2C_SCL, HIGH); delayMicroseconds(5);
    digitalWrite(I2C_SDA, HIGH); delayMicroseconds(5);
    pinMode(I2C_SCL, INPUT);
    pinMode(I2C_SDA, INPUT);
    delay(5);
  }

  // 2. Init Wire + timeout pre-probe
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setTimeOut(3000);

  // 3. Probe: verifica presenza display
  Wire.beginTransmission(OLED_ADDRESS);
  if (Wire.endTransmission() != 0) {
    Serial.println("[OLED] Non trovato - continuo senza display");
    oledReady = false;
    return false;
  }

  // 4. Init completa
  if (!oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
    Serial.println("[OLED] Init fallita");
    oledReady = false;
    return false;
  }

  // 5. Timeout post-begin (critico: oled.begin() azzera il timeout)
  Wire.setTimeOut(1000);

  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(1);
  oled.cp437(true);
  oled.display();
  oledReady = true;
  Serial.printf("[OLED] OK - %dx%d\n", OLED_WIDTH, OLED_HEIGHT);
  return true;
}

// ══════════════════════════════════════════════════════════════
// DISPLAY: PAGINE A ROTAZIONE
// ══════════════════════════════════════════════════════════════
void aggiornaDisplay() {
  if (!oledReady) return;

  oled.clearDisplay();
  oled.setTextSize(1); // 21 char x 4 righe su 128x32
  oled.setCursor(0, 0);

  switch (paginaCorrente) {
    case 0: // Connessione
      oled.println("== CONNESSIONE ==");
      oled.print("SSID: ");
      oled.println(ssidConnesso.length() > 0 ? ssidConnesso : "---");
      oled.print("IP:   ");
      oled.println(indirizzoIP.length() > 0 ? indirizzoIP : "---");
      oled.print("MQTT: ");
      oled.println(client.connected() ? "OK" : "NO");
      break;

    case 1: { // Heartbeat e uptime
      unsigned long sec = millis() / 1000;
      unsigned long h = sec / 3600;
      unsigned long m = (sec % 3600) / 60;
      unsigned long s = sec % 60;
      char uptime[12];
      snprintf(uptime, sizeof(uptime), "%02lu:%02lu:%02lu", h, m, s);

      oled.println("== STATO ==");
      oled.print("Uptime: ");
      oled.println(uptime);
      if (ultimoInvioDati > 0) {
        unsigned long agoSec = (millis() - ultimoInvioDati) / 1000;
        unsigned long agoMin = agoSec / 60;
        oled.print("Ultimo invio: ");
        oled.print(agoMin);
        oled.println(" min fa");
      } else {
        oled.println("Nessun invio yet");
      }
      break;
    }

    case 2: // Aria interna
      oled.println("== ARIA INTERNA ==");
      oled.print("Temp: ");
      oled.print(temperatura_interna, 1);
      oled.println(" C");
      oled.print("Umid: ");
      oled.print(umidita_interna, 1);
      oled.println(" %");
      break;

    case 3: // Aria esterna
      oled.println("== ARIA ESTERNA ==");
      oled.print("Temp: ");
      oled.print(temperatura_esterna, 1);
      oled.println(" C");
      oled.print("Umid: ");
      oled.print(umidita_esterna, 1);
      oled.println(" %");
      break;

    case 4: // Pressione
      oled.println("== PRESSIONE ==");
      oled.print("Press: ");
      oled.print(pressione_interna, 1);
      oled.println(" hPa");
      if (!bmp280Inizializzato) {
        oled.println("(sensore assente)");
      }
      break;

    case 5: { // Suolo
      oled.println("== SUOLO ==");
      oled.print("Temp: ");
      oled.print(temperaturaSuolo, 1);
      oled.println(" C");
      oled.print("Umid: ");
      oled.print(tensione, 2);
      oled.print("V ");
      if (tensione >= 3.2) oled.println("(aria)");
      else if (tensione > livelloSecco) oled.println("Secco");
      else if (tensione > livelloPocoUmido) oled.println("Poco umido");
      else if (tensione > livelloUmido) oled.println("Umido");
      else oled.println("Bagnato");
      break;
    }
  }

  oled.display();
}

// ══════════════════════════════════════════════════════════════
// SETUP
// ══════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(1000);

  String macAddress = WiFi.macAddress();
  Serial.println("MAC: " + macAddress);

  // Pin reset configurazione WiFi (BOOT button)
  pinMode(PIN_RESET_CONFIG, INPUT_PULLUP);

  // Sensore temperatura terreno
  sensors.begin();
  if (sensors.getDeviceCount() == 0) {
    Serial.println(F("Nessun sensore DS18B20 trovato!"));
  } else {
    Serial.println(F("DS18B20 inizializzato."));
  }

  // Umidita terreno (pin analogico)
  pinMode(pinSensoreUmiditaTerreno, INPUT);

  // DHT22
  dht_in.begin();
  dht_out.begin();

  // OLED (fa Wire.begin internamente)
  initOled();

  // BMP280 (usa Wire gia inizializzato da initOled)
  bmp280Inizializzato = bmp.begin(0x77);
  if (!bmp280Inizializzato) {
    printlnSeriale(F("Sensore di pressione non rilevato!"));
  } else {
    bmp.setSampling(Adafruit_BMP280::MODE_NORMAL,
                    Adafruit_BMP280::SAMPLING_X2,
                    Adafruit_BMP280::SAMPLING_X16,
                    Adafruit_BMP280::FILTER_X16,
                    Adafruit_BMP280::STANDBY_MS_500);
  }

  // Timeout I2C finale dopo tutte le init
  Wire.setTimeOut(1000);

  // Carica parametri MQTT salvati in NVS
  caricaParametriMQTT();

  // Se il pulsante BOOT e premuto all'avvio, resetta la configurazione WiFi
  if (digitalRead(PIN_RESET_CONFIG) == LOW) {
    Serial.println(F("[WiFi] Reset configurazione richiesto!"));
    if (oledReady) {
      oled.clearDisplay();
      oled.setCursor(0, 0);
      oled.println("RESET CONFIG WiFi");
      oled.println("Rilascia BOOT...");
      oled.display();
    }
    wm.resetSettings();
    delay(1000);
  }

  // WiFiManager: connessione automatica o portale captive
  setupWiFiManager();

  // MQTT
  client.setCallback(callback);
  reconnectMQTT();

  // Task di riconnessione MQTT sul core 1
  xTaskCreatePinnedToCore(TaskReconnect, "TaskReconnect", 10000, NULL, 1, NULL, 1);

  // Watchdog Timer (5 minuti)
  esp_task_wdt_config_t wdtConfig = {
    .timeout_ms = 300000,
    .trigger_panic = true,
  };
  esp_task_wdt_init(&wdtConfig);
  esp_task_wdt_add(NULL);

  // Mostra pagina connessione sul display
  aggiornaDisplay();
}

// ══════════════════════════════════════════════════════════════
// LOOP
// ══════════════════════════════════════════════════════════════
void loop() {
  unsigned long currentMillis = millis();
  esp_task_wdt_reset();
  client.loop();

  // Heartbeat ogni 5 minuti
  if (currentMillis - ultimoHeartbeat > intervalloHeartbeat) {
    ultimoHeartbeat = currentMillis;
    client.publish("palabvu/heartbeat", "alive");
  }

  // Lettura sensori ogni 50 minuti
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;
    timeStamp();
    leggiUmiditaTerreno();
    leggiAriaInterna();
    leggiAriaEsterna();
    leggiPressioneInterna();
    leggiTemperaturaSuolo();
    ultimoInvioDati = currentMillis;
  }

  // Rotazione pagine display ogni 4 secondi
  if (currentMillis - ultimoCambioPagina >= intervalloPagina) {
    ultimoCambioPagina = currentMillis;
    paginaCorrente = (paginaCorrente + 1) % NUMERO_PAGINE;
    aggiornaDisplay();
  }

  delay(100);
}

// ══════════════════════════════════════════════════════════════
// LETTURA SENSORI
// ══════════════════════════════════════════════════════════════
void leggiPressioneInterna() {
  if (bmp280Inizializzato) {
    pressione_interna = bmp.readPressure() / 100.0F;
    client.publish(pressione_interna_topic, String(pressione_interna).c_str());
    printlnSeriale("Pressione interna: " + String(pressione_interna) + " hPa");
  } else {
    printlnSeriale(F("Sensore di pressione non disponibile."));
  }
}

void leggiAriaInterna() {
  umidita_interna = dht_in.readHumidity();
  temperatura_interna = dht_in.readTemperature();

  if (!isnan(umidita_interna) && !isnan(temperatura_interna)) {
    client.publish(temperatura_interna_topic, String(temperatura_interna).c_str());
    client.publish(umidita_interna_topic, String(umidita_interna).c_str());
    printlnSeriale("Temp interna: " + String(temperatura_interna) + " C");
    printlnSeriale("Umid interna: " + String(umidita_interna) + " %");
  }
}

void leggiAriaEsterna() {
  umidita_esterna = dht_out.readHumidity();
  temperatura_esterna = dht_out.readTemperature();

  if (!isnan(umidita_esterna) && !isnan(temperatura_esterna)) {
    client.publish(temperatura_esterna_topic, String(temperatura_esterna).c_str());
    client.publish(umidita_esterna_topic, String(umidita_esterna).c_str());
    printlnSeriale("Temp esterna: " + String(temperatura_esterna) + " C");
    printlnSeriale("Umid esterna: " + String(umidita_esterna) + " %");
  }
}

void leggiUmiditaTerreno() {
  int sensorValue = analogRead(pinSensoreUmiditaTerreno);
  tensione = sensorValue * (3.3 / 4095.0);

  if (tensione < 3.2) {
    char message[50];
    snprintf(message, sizeof(message), "%f", tensione);
    client.publish(terreno_topic, message);
    printlnSeriale("Tensione suolo: " + String(tensione) + " V");
  } else {
    printlnSeriale(F("Sensore esposto all'aria, lettura non trasmessa"));
  }
}

void leggiTemperaturaSuolo() {
  sensors.requestTemperatures();
  temperaturaSuolo = sensors.getTempCByIndex(0);
  if (temperaturaSuolo > -100) {
    client.publish(terreno_temp_topic, String(temperaturaSuolo).c_str());
    printlnSeriale("Temp suolo: " + String(temperaturaSuolo) + " C");
  } else {
    printlnSeriale("Temp suolo fuori range: " + String(temperaturaSuolo) + " C");
  }
}

// ══════════════════════════════════════════════════════════════
// UTILITA
// ══════════════════════════════════════════════════════════════
void timeStamp() {
  unsigned long seconds = millis() / 1000;
  unsigned long minutes = seconds / 60;
  unsigned long hours = minutes / 60;
  seconds = seconds % 60;
  minutes = minutes % 60;

  char timeStampStr[12];
  snprintf(timeStampStr, sizeof(timeStampStr), "%02lu:%02lu:%02lu", hours, minutes, seconds);
  printlnSeriale(timeStampStr);
}

void callback(char* topic, byte* message, unsigned int length) {
  char messageBuffer[50];
  strncpy(messageBuffer, (char*)message, length);
  messageBuffer[length] = '\0';

  if (strcmp(topic, "palabvu/comando") == 0) {
    if (strcmp(messageBuffer, "leggiSensori") == 0) {
      printlnSeriale(F("Lettura istantanea"));
      leggiUmiditaTerreno();
      leggiAriaInterna();
      leggiAriaEsterna();
      leggiPressioneInterna();
      leggiTemperaturaSuolo();
      ultimoInvioDati = millis();
    }
  }
}

// ══════════════════════════════════════════════════════════════
// CONNESSIONE MQTT
// ══════════════════════════════════════════════════════════════
void reconnectMQTT() {
  unsigned long startAttemptTime = millis();
  while (!client.connected() && millis() - startAttemptTime < 10000) {
    if (client.connect(indirizzoIP.c_str())) {
      client.subscribe(topic_msg_to_dispositivo);
      printlnSeriale(F("Connesso a MQTT!"));
      client.publish(topic_connessione, indirizzoIP.c_str());
      break;
    } else {
      delay(200);
      Serial.print(".");
    }
  }
}

// Task riconnessione sul Core 1
// WiFiManager gestisce la riconnessione WiFi automaticamente,
// qui ci occupiamo solo di MQTT e del fallback WiFi
void TaskReconnect(void *pvParameters) {
  for (;;) {
    if (WiFi.status() != WL_CONNECTED) {
      // WiFiManager tenta di riconnettersi alla rete salvata
      WiFi.reconnect();
      vTaskDelay(10000 / portTICK_PERIOD_MS);
      if (WiFi.status() == WL_CONNECTED) {
        indirizzoIP = WiFi.localIP().toString();
        ssidConnesso = WiFi.SSID();
        Serial.println("Riconnesso a " + ssidConnesso);
      }
    }
    if (WiFi.status() == WL_CONNECTED && !client.connected()) {
      reconnectMQTT();
    }
    vTaskDelay(5000 / portTICK_PERIOD_MS);
  }
}

void printlnSeriale(String data) {
  Serial.println(data);
  client.publish(debug_topic, data.c_str());
}

void printSeriale(String data) {
  Serial.print(data);
  client.publish(debug_topic, data.c_str());
}
