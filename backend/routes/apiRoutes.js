const express = require('express');
const router = express.Router();
const CONFIG = require('../config');

function setupRoutes(db, mqttClient, io) {
    /**
     * @swagger
     * /api/control:
     *   post:
     *     summary: Control a device (LED)
     *     tags: [Control]
     */
    router.post('/control', (req, res) => {
        const { state, led } = req.body;
        const deviceName = `LED_${led}`;

        db.run(`INSERT INTO action_history (device, action, status) VALUES (?, ?, ?)`,
            [deviceName, state ? 'ON' : 'OFF', 'PENDING'], function (err) {
                if (err) return res.status(500).json({ error: err.message });

                const actionId = this.lastID;

                // --- NEW DEVICES (Virtual controls) ---
                // if (led === 4 || led === 5) {
                //     res.json({ id: actionId, status: "PENDING" });
                //     setTimeout(() => {
                //         if (led === 4) {
                //             db.run(`UPDATE action_history SET status = 'SUCCESS' WHERE id = ?`, [actionId]);
                //             io.emit('device_update', { device: deviceName, state: state ? 'ON' : 'OFF' });
                //         } else if (led === 5) {
                //             db.run(`UPDATE action_history SET status = 'ERROR' WHERE id = ?`, [actionId]);
                //             // Emit reverted state on error
                //             io.emit('device_update', { device: deviceName, state: state ? 'OFF' : 'ON' });
                //         }
                //     }, 2000);
                //     return;
                // }
                // ------------------------------------

                mqttClient.publish(CONFIG.MQTT_TOPICS.COMMAND, JSON.stringify(req.body));
                res.json({ id: actionId, status: "PENDING" });

                // Action Watchdog
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

    router.get('/current-status', (req, res) => {
        db.all(`SELECT device, action, status FROM action_history WHERE id IN (SELECT MAX(id) FROM action_history GROUP BY device)`, (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            const status = { 
                LED_1: 'OFF', LED_2: 'OFF', LED_3: 'OFF'
                // --- NEW DEVICES ---
                // LED_4: 'OFF', LED_5: 'OFF'
            };
            rows.forEach(row => { status[row.device] = row.status === 'PENDING' ? 'LOADING' : row.action; });
            res.json(status);
        });
    });

    router.get('/today-summary', (req, res) => {
        const query = `SELECT COALESCE(AVG(temp),0) as avg_temp, COALESCE(MAX(temp),0) as max_temp, COALESCE(MIN(temp),0) as min_temp, 
                       COALESCE(AVG(hum),0) as avg_hum, COALESCE(MAX(hum),0) as max_hum, COALESCE(MIN(hum),0) as min_hum,
                       COALESCE(AVG(light),0) as avg_light, COALESCE(MAX(light),0) as max_light, COALESCE(MIN(light),0) as min_light
                       FROM sensor_data WHERE date(created_at) = date('now','localtime') AND temp IS NOT NULL`;
        db.get(query, (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(row);
        });
    });

    router.get('/action-history', (req, res) => {
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

    router.get('/sensor-data', (req, res) => {
        const { page = 1, limit = 10, status, search, value, sensor } = req.query;
        const offset = (page - 1) * limit;
        let clauses = []; let params = [];
        if (status === 'ok') clauses.push(`temp IS NOT NULL`);
        else if (status === 'error') clauses.push(`temp IS NULL`);
        if (search) { clauses.push(`created_at LIKE ?`); params.push(`%${search}%`); }
        
        if (value !== undefined && value !== null && value !== '') {
            const numVal = parseFloat(value);
            if (!isNaN(numVal)) {
                if (sensor && sensor !== 'all') {
                    clauses.push(`ROUND(${sensor}, 2) = ROUND(?, 2)`);
                    params.push(numVal);
                } else {
                    clauses.push(`(ROUND(temp, 2) = ROUND(?, 2) OR ROUND(hum, 2) = ROUND(?, 2) OR ROUND(light, 2) = ROUND(?, 2))`);
                    params.push(numVal, numVal, numVal);
                }
            }
        }
        
        const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

        db.get(`SELECT COUNT(*) as total FROM sensor_data ${where}`, params, (err, countRow) => {
            db.all(`SELECT * FROM sensor_data ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset], (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ data: rows, totalPages: Math.ceil(countRow.total / limit), currentPage: parseInt(page) });
            });
        });
    });

    return router;
}

module.exports = setupRoutes;
