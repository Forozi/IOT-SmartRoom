const mqtt = require('mqtt');

const MQTT_BROKER = 'mqtt://192.168.1.42';

function setupMQTT(db, io) {
    const client = mqtt.connect(MQTT_BROKER);

    let lastDataTime = Date.now();
    let isOfflineLogged = false;

    client.on('connect', () => {
        console.log("MQTT: Connected to broker at " + MQTT_BROKER);
        client.subscribe(['room/status_report', 'room/sensor_data']);
    });

    // Watchdog for sensors
    setInterval(() => {
        const now = Date.now();
        if (now - lastDataTime > 6000) {
            if (!isOfflineLogged) {
                console.log("⚠️ Sensor disconnected → logging NULL row");
                db.run(`INSERT INTO sensor_data (temp, hum, light) VALUES (?, ?, ?)`, [null, null, null]);
                io.emit('sensor_update', { temp: null, hum: null, light: null });
                isOfflineLogged = true;
            }
        }
    }, 1000);

    client.on('message', (topic, message) => {
        try {
            const payload = message.toString();
            const data = JSON.parse(payload);

            if (topic === 'room/status_report') {
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
                        io.emit('device_update', { device: deviceName, state: data[key] });
                    }
                });
            }

            if (topic === 'room/sensor_data') {
                lastDataTime = Date.now();
                isOfflineLogged = false;
                db.run(`INSERT INTO sensor_data (temp, hum, light) VALUES (?, ?, ?)`, [data.temp, data.hum, data.light]);
                io.emit('sensor_update', data);
            }
        } catch (e) {
            console.error("MQTT Processing Error:", e.message);
        }
    });

    return client;
}

module.exports = setupMQTT;
