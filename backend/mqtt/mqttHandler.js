const mqtt = require('mqtt');
const CONFIG = require('../config');

const MQTT_BROKER = CONFIG.MQTT_BROKER;

function setupMQTT(db, io) {
    const client = mqtt.connect(MQTT_BROKER); //set up broker connection

    let lastDataTime = Date.now();
    let isOfflineLogged = false;

    client.on('connect', () => {
        console.log("MQTT: Connected to broker at " + MQTT_BROKER);
        client.subscribe([CONFIG.MQTT_TOPICS.STATUS_REPORT, CONFIG.MQTT_TOPICS.SENSOR_DATA]); //subscribe to topics
    });

    client.on('message', (topic, message) => {
        try {
            const payload = message.toString(); //convert message to string
            const data = JSON.parse(payload); //parse JSON data

            if (topic === CONFIG.MQTT_TOPICS.STATUS_REPORT) {
                const sqlUpdate = `
                    UPDATE action_history SET status = 'SUCCESS' WHERE id = (
                        SELECT id FROM action_history WHERE status = 'PENDING' ORDER BY created_at DESC LIMIT 1
                    )`;

                db.run(sqlUpdate, function (err) {
                    if (err) console.error("Sync Error:", err.message);
                    else if (this.changes > 0) console.log("DB: Action confirmed SUCCESS");
                });

                Object.keys(data).forEach(key => {
                    if (key.startsWith("LED")) {
                        const ledNum = parseInt(key.split(' ')[1]);
                        const deviceName = `LED_${ledNum}`;
                        io.emit('device_update', { device: deviceName, state: data[key] }); //push to frontend LED data
                    }
                });
            }

            if (topic === CONFIG.MQTT_TOPICS.SENSOR_DATA) {
                lastDataTime = Date.now();
                isOfflineLogged = false;

                // Normalize light from 0-4096 to 0-100 lux
                if (data.light != null) {
                    data.light = Math.min(100, Math.max(0, Math.round((data.light / 4096) * 100)));
                }

                db.run(`INSERT INTO sensor_data (temp, hum, light) VALUES (?, ?, ?)`, [data.temp, data.hum, data.light]);
                io.emit('sensor_update', data); //push to frontend sensor data
            }
        } catch (e) {
            console.error("MQTT Processing Error:", e.message);
        }
    });

    // Watchdog for sensors 6s
    setInterval(() => {
        const now = Date.now();
        if (now - lastDataTime > 6000) {
            if (!isOfflineLogged) {
                console.log("Sensor disconnected → logging NULL row");
                db.run(`INSERT INTO sensor_data (temp, hum, light) VALUES (?, ?, ?)`, [null, null, null]);
                io.emit('sensor_update', { temp: null, hum: null, light: null }); //if sensor disconnect, push null to frontend
                isOfflineLogged = true;
            }
        }
    }, 1000);

    return client;
}

module.exports = setupMQTT;
