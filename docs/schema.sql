-- ══════════════════════════════════════════════════════════════
-- Database: orto_sensors
-- Setup iniziale per il server di monitoraggio ambientale
-- ══════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS orto_sensors;
USE orto_sensors;

CREATE TABLE IF NOT EXISTS sensor_data (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    sensor_id   INT NOT NULL,
    timestamp   DATETIME NOT NULL,
    value       FLOAT NOT NULL,
    INDEX idx_sensor_timestamp (sensor_id, timestamp)
);

-- ══════════════════════════════════════════════════════════════
-- Mapping sensor_id → descrizione
-- ══════════════════════════════════════════════════════════════
--
--  ID  | Sorgente  | Grandezza
-- -----+-----------+------------------------------
--   1  | Orto      | Umidita terreno (tensione V)
--   2  | Orto      | Temperatura aria (°C)
--   3  | Orto      | Umidita aria (%)
--   4  | Orto      | Pressione atmosferica (hPa)
--   5  | Orto      | Temperatura terreno (°C)
--  10  | PalaBVU   | Temperatura interna (°C)
--  11  | PalaBVU   | Umidita interna (%)
--  12  | PalaBVU   | Pressione interna (hPa)
--  13  | PalaBVU   | Temperatura esterna (°C)
--  14  | PalaBVU   | Umidita esterna (%)
--  15  | PalaBVU   | Pressione esterna (hPa)
--  16  | PalaBVU   | Temperatura terreno (°C)
--  17  | PalaBVU   | Umidita terreno (tensione V)
