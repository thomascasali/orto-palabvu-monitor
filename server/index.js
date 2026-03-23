require('dotenv').config();
const express = require('express');
const socketIo = require('socket.io');
const mqtt = require('mqtt');
const http = require('http');
const mysql = require('mysql2');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// MQTT
const mqttClient = mqtt.connect(process.env.MQTT_BROKER || 'mqtt://localhost');

// MySQL
const dbConnection = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'orto_sensors',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// File statici
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Connessione MQTT e sottoscrizione ai topic
mqttClient.on('connect', () => {
    console.log('Connesso al broker MQTT');

    // Topic Orto
    mqttClient.subscribe('orto/umidita_terreno');
    mqttClient.subscribe('orto/temperatura');
    mqttClient.subscribe('orto/umidita_aria');
    mqttClient.subscribe('orto/pressione');
    mqttClient.subscribe('orto/temperatura_terreno');
    mqttClient.subscribe('orto/heartbeat');

    // Topic PalaBVU
    mqttClient.subscribe('palabvu/temperatura_interna');
    mqttClient.subscribe('palabvu/umidita_interna');
    mqttClient.subscribe('palabvu/pressione_interna');
    mqttClient.subscribe('palabvu/temperatura_esterna');
    mqttClient.subscribe('palabvu/umidita_esterna');
    mqttClient.subscribe('palabvu/pressione_esterna');
    mqttClient.subscribe('palabvu/temperatura_terreno');
    mqttClient.subscribe('palabvu/umidita_terreno');
});

mqttClient.on('message', (topic, message) => {
    console.log(topic, message.toString());
    let updateTopic;
    let update = true;
    switch (topic) {
        // Orto
        case 'orto/umidita_terreno':
            updateTopic = 'umiditaTerrenoUpdate';
            break;
        case 'orto/temperatura':
            updateTopic = 'temperaturaUpdate';
            break;
        case 'orto/umidita_aria':
            updateTopic = 'umiditaAriaUpdate';
            break;
        case 'orto/pressione':
            updateTopic = 'pressioneUpdate';
            break;
        case 'orto/temperatura_terreno':
            updateTopic = 'temperaturaTerrenoUpdate';
            break;
        case 'orto/heartbeat':
            update = false;
            break;

        // PalaBVU
        case 'palabvu/temperatura_interna':
            updateTopic = 'temperaturaInternaUpdate';
            break;
        case 'palabvu/umidita_interna':
            updateTopic = 'umiditaInternaUpdate';
            break;
        case 'palabvu/pressione_interna':
            updateTopic = 'pressioneInternaUpdate';
            break;
        case 'palabvu/temperatura_esterna':
            updateTopic = 'temperaturaEsternaUpdate';
            break;
        case 'palabvu/umidita_esterna':
            updateTopic = 'umiditaEsternaUpdate';
            break;
        case 'palabvu/pressione_esterna':
            updateTopic = 'pressioneEsternaUpdate';
            break;
        case 'palabvu/temperatura_terreno':
            updateTopic = 'temperaturaTerrenoUpdate';
            break;
        case 'palabvu/umidita_terreno':
            updateTopic = 'umiditaTerrenoUpdate';
            break;
        default:
            update = false;
            break;
    }

    if (update) {
        io.emit(updateTopic, message.toString());
        inserisciDatoSensori(topic, message);
    }
});

// WebSocket
io.on('connection', (socket) => {
    console.log('Connessione di un client');
    socket.on('disconnect', () => {
        console.log('Disconnessione di un client');
    });

    // Richiede lettura istantanea ai dispositivi
    mqttClient.publish('esp32/comando', 'leggiSensori');
    mqttClient.publish('palabvu/comando', 'leggiSensori');

    // Invio dati storici per Orto
    recuperaDatiStorici(1, (dati) => socket.emit('umiditaTerrenoStorico', dati));
    recuperaDatiStorici(2, (dati) => socket.emit('temperaturaAriaStorico', dati));
    recuperaDatiStorici(3, (dati) => socket.emit('umiditaAriaStorico', dati));
    recuperaDatiStorici(4, (dati) => socket.emit('pressioneStorico', dati));
    recuperaDatiStorici(5, (dati) => socket.emit('temperaturaTerrenoStorico', dati));

    // Invio dati storici per PalaBVU
    recuperaDatiStorici(10, (dati) => socket.emit('temperaturaInternaStorico', dati));
    recuperaDatiStorici(11, (dati) => socket.emit('umiditaInternaStorico', dati));
    recuperaDatiStorici(12, (dati) => socket.emit('pressioneInternaStorico', dati));
    recuperaDatiStorici(13, (dati) => socket.emit('temperaturaEsternaStorico', dati));
    recuperaDatiStorici(14, (dati) => socket.emit('umiditaEsternaStorico', dati));
    recuperaDatiStorici(15, (dati) => socket.emit('pressioneEsternaStorico', dati));
    recuperaDatiStorici(16, (dati) => socket.emit('temperaturaTerrenoStorico', dati));
});

// Inserimento dati nel database con retry su deadlock
function inserisciDatoSensori(topic, message) {
    let sensorID;
    switch (topic) {
        // Orto
        case 'orto/umidita_terreno': sensorID = 1; break;
        case 'orto/temperatura': sensorID = 2; break;
        case 'orto/umidita_aria': sensorID = 3; break;
        case 'orto/pressione': sensorID = 4; break;
        case 'orto/temperatura_terreno': sensorID = 5; break;

        // PalaBVU
        case 'palabvu/temperatura_interna': sensorID = 10; break;
        case 'palabvu/umidita_interna': sensorID = 11; break;
        case 'palabvu/pressione_interna': sensorID = 12; break;
        case 'palabvu/temperatura_esterna': sensorID = 13; break;
        case 'palabvu/umidita_esterna': sensorID = 14; break;
        case 'palabvu/pressione_esterna': sensorID = 15; break;
        case 'palabvu/temperatura_terreno': sensorID = 16; break;
        case 'palabvu/umidita_terreno': sensorID = 17; break;

        default: return;
    }

    const query = `
        INSERT INTO sensor_data (sensor_id, timestamp, value)
        SELECT * FROM (SELECT ? AS sensor_id, NOW() AS timestamp, ? AS value) AS temp
        WHERE NOT EXISTS (
            SELECT 1 FROM sensor_data
            WHERE sensor_id = ?
            AND timestamp >= NOW() - INTERVAL 5 MINUTE
        );
    `;

    const tentaInserimento = (tentativi) => {
        dbConnection.execute(query, [sensorID, message.toString(), sensorID], (err, results) => {
            if (err) {
                if (err.code === 'ER_LOCK_DEADLOCK' && tentativi > 0) {
                    console.warn('Deadlock rilevato. Tentativo di riesecuzione...');
                    setTimeout(() => tentaInserimento(tentativi - 1), 100);
                } else {
                    console.error(err);
                }
                return;
            }

            if (results.affectedRows > 0) {
                const now = new Date();
                const time = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
                console.log(`${time} - Dato inserito: sensor_id=${sensorID}`);
            }
        });
    };

    tentaInserimento(3);
}

// Recupera dati storici del giorno corrente
function recuperaDatiStorici(sensorID, callback) {
    const query = 'SELECT timestamp, value FROM sensor_data WHERE sensor_id = ? AND DATE(timestamp) = CURDATE()';
    dbConnection.query(query, [sensorID], (err, results) => {
        if (err) {
            console.error(err);
            return callback([]);
        }
        callback(results);
    });
}

// Avvio server
server.listen(PORT, () => {
    console.log(`Server in ascolto sulla porta ${PORT}`);
});
