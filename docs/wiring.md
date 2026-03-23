# Schema collegamenti ESP32

## Pin I2C (bus condiviso)

| Dispositivo      | SDA      | SCL      | Indirizzo |
|------------------|----------|----------|-----------|
| OLED SSD1306     | GPIO 21  | GPIO 22  | 0x3C      |
| BMP280           | GPIO 21  | GPIO 22  | 0x77      |

## Sensori digitali

| Sensore          | Pin      | Protocollo | Note                        |
|------------------|----------|------------|-----------------------------|
| DHT22 (interno)  | GPIO 13  | Digitale   | Temperatura + umidita aria  |
| DHT22 (esterno)  | GPIO 23  | Digitale   | Temperatura + umidita aria  |
| DS18B20          | GPIO 4   | OneWire    | Temperatura terreno         |

## Sensori analogici

| Sensore                  | Pin      | Note                              |
|--------------------------|----------|-----------------------------------|
| Umidita terreno (capac.) | GPIO 36  | Pin VP, ADC, tensione max 3.3V    |

## Alimentazione

| Componente       | Tensione |
|------------------|----------|
| OLED SSD1306     | 3.3V     |
| BMP280           | 3.3V     |
| DHT22 (x2)      | 3.3V     |
| DS18B20          | 3.3V     |

## Note

- GPIO 1 (TX) e GPIO 3 (RX) sono riservati alla seriale USB, non usarli per sensori.
- Il bus I2C e condiviso tra OLED e BMP280: verificare che gli indirizzi non collidano.
- Per verificare i dispositivi sul bus I2C, usare lo scanner I2C (vedi README).
