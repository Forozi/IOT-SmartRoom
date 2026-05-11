const mqtt = require('mqtt');
const CONFIG = require('../config');

const MQTT_BROKER = CONFIG.MQTT_BROKER;

function setupMQTT(db, io) {
    const client = mqtt.connect(MQTT_BROKER); // connect to broker

    let lastDataTime = Date.now();
    let isOfflineLogged = false; // flag for db

    client.on('connect', () => {
        console.log("MQTT: Connected to broker at " + MQTT_BROKER);
        client.subscribe([CONFIG.MQTT_TOPICS.STATUS_REPORT, CONFIG.MQTT_TOPICS.SENSOR_DATA]);
    });

    client.on('message', (topic, message) => {
        const payload = message.toString();

        try {
            const data = JSON.parse(payload);
            // Topic STATUS_REPORT display on off
            if (topic === CONFIG.MQTT_TOPICS.STATUS_REPORT) {
                if (data.status === "COMMAND_OK") { // wait for comfirm
                    const sqlGetLatest =
                        `SELECT id, device, action 
                    FROM action_history 
                    WHERE status = 'PENDING'
                    ORDER BY created_at DESC 
                    LIMIT 1`;
                    // pending apiRoute 20
                    db.get(sqlGetLatest, [], (err, row) => {
                        if (row) {
                            db.run(
                                `UPDATE action_history 
                                SET status = 'SUCCESS' 
                                WHERE id = ?`, [row.id], (err) => {
                                if (!err) {
                                    // socket to Dashboard.jsx 196
                                    io.emit('device_update', { device: row.device, state: row.action });
                                }
                            });
                        }
                    });
                    return;
                }

                // ESP update actual state 
                Object.keys(data).forEach(key => {
                    if (key.startsWith("LED")) {
                        const ledNum = parseInt(key.split(' ')[1]);
                        const deviceName = `LED_${ledNum}`;
                        const physicalState = data[key] ? 'ON' : 'OFF';

                        const sqlConfirm = `
                            UPDATE action_history 
                            SET status = 'SUCCESS', action = ? 
                            WHERE id = (
                                SELECT id FROM action_history 
                                WHERE device = ? AND status = 'PENDING' 
                                ORDER BY created_at DESC LIMIT 1
                            )`;
                        //fallback to clean up PENDING
                        db.run(sqlConfirm, [physicalState, deviceName], function (err) {
                            if (!err && this.changes === 0) {
                                db.get(`SELECT action, status FROM action_history WHERE device = ? ORDER BY created_at DESC LIMIT 1`, [deviceName], (err, row) => {
                                    if (!row || row.action !== physicalState || row.status !== 'SUCCESS') {
                                        db.run(`INSERT INTO action_history (device, action, status) VALUES (?, ?, 'SUCCESS')`, [deviceName, physicalState]);
                                    }
                                });
                            }
                        });
                        // socket update frontend
                        io.emit('device_update', { device: deviceName, state: physicalState });
                    }
                });
            }

            // Topic SENSOR_DATA received
            if (topic === CONFIG.MQTT_TOPICS.SENSOR_DATA) {
                lastDataTime = Date.now();
                isOfflineLogged = false;

                if (data.light != null) {
                    data.light = Math.min(100, Math.max(0, Math.round((data.light / 4096) * 100)));
                }

                db.run(`INSERT INTO sensor_data (temp, hum, light) VALUES (?, ?, ?)`, [data.temp, data.hum, data.light]);

                // socket send sensor data
                io.emit('sensor_update', data); // dash 174
            }
        } catch (e) {
            console.error("MQTT Processing Error:", e.message);
        }
    });

    // Watchdog check sensor status (6 seconds timeout)
    setInterval(() => {
        const now = Date.now();
        if (now - lastDataTime > 6000) {
            if (!isOfflineLogged) {
                db.run(`INSERT INTO sensor_data (temp, hum, light) VALUES (?, ?, ?)`, [null, null, null]);
                io.emit('sensor_update', { temp: null, hum: null, light: null }); // dash 178
                isOfflineLogged = true;
            }
        }
    }, 1000);

    return client;
}

module.exports = setupMQTT;
