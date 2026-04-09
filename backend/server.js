// server.js (FINAL CLEAN VERSION)

const express = require('express');
const mqtt = require('mqtt');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerDefinition = require('./swaggerConfig'); // Import the clean config

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// 1. --- DATABASE SETUP ---
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error("Database Error:", err.message);
    else console.log("Connected to SQLite Database.");
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS action_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device TEXT,
        action TEXT,
        status TEXT,
        created_at DATETIME DEFAULT (datetime('now','localtime'))
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS sensor_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        temp FLOAT,
        hum FLOAT,
        light INTEGER,
        created_at DATETIME DEFAULT (datetime('now','localtime'))
    )`);
    console.log("Database Tables Verified.");
});

// 2. --- MQTT CONNECTION ---
const MQTT_BROKER = 'mqtt://192.168.1.42';
const client = mqtt.connect(MQTT_BROKER);

client.on('connect', () => {
    console.log("MQTT: Connected to broker at " + MQTT_BROKER);
    client.subscribe(['room/status_report', 'room/sensor_data']);
});

// --- SENSOR WATCHDOG TIMER ---
let lastDataTime = Date.now();
let isOfflineLogged = false;

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

// 3. --- MQTT MESSAGE HANDLER ---
client.on('message', (topic, message) => {
    try {
        const payload = message.toString();
        const data = JSON.parse(payload);

        if (topic === 'room/status_report') {
            // Update the most recent PENDING action to SUCCESS
            const sqlUpdate = `
                UPDATE action_history SET status = 'SUCCESS' WHERE id = (
                    SELECT id FROM action_history WHERE status = 'PENDING' ORDER BY created_at DESC LIMIT 1
                )`;

            db.run(sqlUpdate, function (err) {
                if (err) console.error("Sync Error:", err.message);
                else if (this.changes > 0) console.log("DB: Action confirmed SUCCESS");
            });

            // Emit updates for UI buttons
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


// 4. --- API ROUTES ---

app.post('/api/control', (req, res) => {
    const { state, led } = req.body;
    const deviceName = `LED_${led}`;

    db.run(`INSERT INTO action_history (device, action, status) VALUES (?, ?, ?)`,
        [deviceName, state ? 'ON' : 'OFF', 'PENDING'], function (err) {
            if (err) return res.status(500).json({ error: err.message });

            const actionId = this.lastID;
            client.publish('room/command', JSON.stringify(req.body));
            res.json({ id: actionId, status: "PENDING" });

            // --- ACTION WATCHDOG (FIX) ---
            // If ESP32 doesn't reply in 3 seconds, mark as ERROR and notify UI
            setTimeout(() => {
                db.get(`SELECT status, action FROM action_history WHERE id = ?`, [actionId], (err, row) => {
                    if (row && row.status === 'PENDING') {
                        console.log(`⚠️ No reply for ${deviceName}. Reverting.`);
                        db.run(`UPDATE action_history SET status = 'ERROR' WHERE id = ?`, [actionId]);
                        const revertTo = row.action === 'ON' ? 'OFF' : 'ON';
                        io.emit('device_update', { device: deviceName, state: revertTo });
                    }
                });
            }, 3000);
        });
});

app.get('/api/current-status', (req, res) => {
    db.all(`SELECT device, action, status FROM action_history WHERE id IN (SELECT MAX(id) FROM action_history GROUP BY device)`, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const status = { LED_1: 'OFF', LED_2: 'OFF', LED_3: 'OFF' };
        rows.forEach(row => { status[row.device] = row.status === 'PENDING' ? 'LOADING' : row.action; });
        res.json(status);
    });
});

app.get('/api/today-summary', (req, res) => {
    const query = `SELECT COALESCE(AVG(temp),0) as avg_temp, COALESCE(MAX(temp),0) as max_temp, COALESCE(MIN(temp),0) as min_temp, 
                   COALESCE(AVG(hum),0) as avg_hum, COALESCE(MAX(hum),0) as max_hum, COALESCE(MIN(hum),0) as min_hum,
                   COALESCE(AVG(light),0) as avg_light, COALESCE(MAX(light),0) as max_light, COALESCE(MIN(light),0) as min_light
                   FROM sensor_data WHERE date(created_at) = date('now','localtime') AND temp IS NOT NULL`;
    db.get(query, (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
    });
});

app.get('/api/action-history', (req, res) => {
    const { page = 1, limit = 10, status, search, device } = req.query;
    const offset = (page - 1) * limit;
    let clauses = []; let params = [];
    if (status === 'ok') clauses.push(`status = 'SUCCESS'`);
    else if (status === 'error') clauses.push(`status IN ('PENDING', 'ERROR')`);
    if (search) { clauses.push(`created_at LIKE ?`); params.push(`%${search}%`); }
    if (device && device !== 'all') { clauses.push(`device = ?`); params.push(device); }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

    db.get(`SELECT COUNT(*) as total FROM action_history ${where}`, params, (err, countRow) => {
        db.all(`SELECT * FROM action_history ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ data: rows, totalPages: Math.ceil(countRow.total / limit), currentPage: parseInt(page) });
        });
    });
});

app.get('/api/sensor-data', (req, res) => {
    const { page = 1, limit = 10, status, search } = req.query;
    const offset = (page - 1) * limit;
    let clauses = []; let params = [];
    if (status === 'ok') clauses.push(`temp IS NOT NULL`);
    else if (status === 'error') clauses.push(`temp IS NULL`);
    if (search) { clauses.push(`created_at LIKE ?`); params.push(`%${search}%`); }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

    db.get(`SELECT COUNT(*) as total FROM sensor_data ${where}`, params, (err, countRow) => {
        db.all(`SELECT * FROM sensor_data ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ data: rows, totalPages: Math.ceil(countRow.total / limit), currentPage: parseInt(page) });
        });
    });
});

// 5. --- SWAGGER SETUP ---
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDefinition));

// 6. --- START SERVER ---
const PORT = 5000;
server.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`SERVER RUNNING ON PORT: ${PORT}`);
    console.log(`API DOCS: http://localhost:${PORT}/api-docs`);
    console.log(`=================================`);
});