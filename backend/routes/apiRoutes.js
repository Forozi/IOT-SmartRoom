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
        const targetAction = state ? 'ON' : 'OFF';

        // ON OFF CONTROL
        // PENDING FIRST
        db.run(`INSERT INTO action_history (device, action, status) VALUES (?, ?, ?)`,
            [deviceName, targetAction, 'PENDING'], function (err) {
                if (err) return res.status(500).json({ error: err.message });

                const actionId = this.lastID;

                // pub control MQTT mqttHandler.js
                mqttClient.publish(CONFIG.MQTT_TOPICS.COMMAND, JSON.stringify(req.body));

                res.json({ id: actionId, status: "PENDING" });

                // Handle hardware (timeout)
                // After 3s  
                setTimeout(() => {
                    db.get(`SELECT status, action FROM action_history WHERE id = ?`, [actionId], (err, row) => {
                        if (row && row.status === 'PENDING') { //if still PENDING
                            db.run(`UPDATE action_history SET status = 'ERROR' WHERE id = ?`, [actionId]);
                            const revertTo = row.action === 'ON' ? 'OFF' : 'ON'; //-> ERROR and revert UI
                            io.emit('device_update', { device: deviceName, state: revertTo }); //socket
                        }
                    });
                }, 3000);
            });
    });

    router.get('/today-summary', (req, res) => {
        const query = `
            SELECT 
                COALESCE(AVG(temp), 0) AS avg_temp,
                COALESCE(MAX(temp), 0) AS max_temp,
                COALESCE(MIN(temp), 0) AS min_temp,
                COALESCE(AVG(hum), 0) AS avg_hum,
                COALESCE(MAX(hum), 0) AS max_hum,
                COALESCE(MIN(hum), 0) AS min_hum,
                COALESCE(AVG(light), 0) AS avg_light,
                COALESCE(MAX(light), 0) AS max_light,
                COALESCE(MIN(light), 0) AS min_light
            FROM sensor_data
            WHERE date(created_at) = date('now', 'localtime')
            AND temp IS NOT NULL
        `;
        db.get(query, (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(row);
        });
    });

    router.get('/current-status', (req, res) => {
        // PARTITION BY: gộp device
        // LastSuccess used for revert
        const query = `
            WITH LatestActions AS (
                SELECT device, action, status,
                       ROW_NUMBER() OVER (PARTITION BY device ORDER BY created_at DESC) as rn
                FROM action_history
            ),
            LastSuccess AS (
                SELECT device, action,
                       ROW_NUMBER() OVER (PARTITION BY device ORDER BY created_at DESC) as rn
                FROM action_history
                WHERE status = 'SUCCESS'
            )
            SELECT 
                d.device_name, l.status as latest_status, l.action as latest_action, s.action as last_success_action
            FROM (
                SELECT 'LED_1' as device_name UNION SELECT 'LED_2' UNION 
                SELECT 'LED_3' UNION SELECT 'LED_4' UNION SELECT 'LED_5'
            ) d
            LEFT JOIN LatestActions l ON d.device_name = l.device AND l.rn = 1
            LEFT JOIN LastSuccess s ON d.device_name = s.device AND s.rn = 1
        `;

        db.all(query, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });

            const results = {};
            //ON OFF BTN REVERT STATE UI
            rows.forEach(row => {
                let currentState = 'OFF';
                if (row.latest_status === 'PENDING') currentState = 'LOADING';
                else if (row.latest_status === 'SUCCESS') currentState = row.latest_action;
                else currentState = row.last_success_action || 'OFF';

                results[row.device_name] = { current_state: currentState };
            });
            res.json(results);
        });
    });

    router.get('/action-history', (req, res) => {
        const { page = 1, limit = 10, status, search, device } = req.query;
        const offset = (page - 1) * limit;
        let clauses = []; let params = [];
        //error/success filter 
        if (status === 'ok') clauses.push(`status = 'SUCCESS'`);
        else if (status === 'error') clauses.push(`status IN ('PENDING', 'ERROR')`);
        //search - use strftime for LIKE matching
        if (search) { clauses.push(`strftime('%Y-%m-%d %H:%M:%S', created_at) LIKE ?`); params.push(`%${search}%`); }
        //device filter
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
        //error/success filter
        if (status === 'ok') clauses.push(`temp IS NOT NULL`);
        else if (status === 'error') clauses.push(`temp IS NULL`);
        //search - use strftime for LIKE matching
        if (search) { clauses.push(`strftime('%Y-%m-%d %H:%M:%S', created_at) LIKE ?`); params.push(`%${search}%`); }
        //value filter
        if (value) {
            const numVal = parseFloat(value);
            if (!isNaN(numVal)) {
                if (sensor && sensor !== 'all') { clauses.push(`ROUND(${sensor}, 2) = ROUND(?, 2)`); params.push(numVal); }
                else { clauses.push(`(ROUND(temp, 2) = ROUND(?, 2) OR ROUND(hum, 2) = ROUND(?, 2) OR ROUND(light, 2) = ROUND(?, 2))`); params.push(numVal, numVal, numVal); }
            }
        }
        const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
        //pagination
        db.get(`SELECT COUNT(*) as total FROM sensor_data ${where}`, params, (err, countRow) => {
            db.all(`SELECT * FROM sensor_data ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset], (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ data: rows, totalPages: Math.ceil(countRow.total / limit), currentPage: parseInt(page) });
            });
        });
    });

    // NEW: DAILY BTN CONTROL ANALYTICS
    // COUNT - GROUP BY device, action 
    router.get('/analytics/daily-stats', (req, res) => { //Analytics 85
        const { date } = req.query;
        if (!date) return res.status(400).json({ error: "Date required" });

        const query = `
            SELECT device, action, COUNT(*) as count
            FROM action_history
            WHERE strftime('%Y-%m-%d', created_at) = ?
            GROUP BY device, action
        `;

        db.all(query, [date], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            const stats = {};
            ['LED_1', 'LED_2', 'LED_3', 'LED_4', 'LED_5'].forEach(dev => { stats[dev] = { ON: 0, OFF: 0 }; });
            rows.forEach(row => { if (stats[row.device]) stats[row.device][row.action] = row.count; });
            const chartData = Object.keys(stats).map(dev => ({ device: dev, on_count: stats[dev].ON, off_count: stats[dev].OFF }));
            res.json(chartData); //[{ device: "LED_1", on_count: 10, off_count: 8 }, ...]
        });
    });

    router.get('/analytics/metadata', (req, res) => { //Analytics 30
        // DISTINCT - get availabled only
        db.all(`SELECT DISTINCT strftime('%Y', created_at) as year, strftime('%m', created_at) as month, strftime('%d', created_at) as day FROM action_history ORDER BY year DESC, month DESC, day DESC`, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            const metadata = {};
            rows.forEach(row => {
                if (!metadata[row.year]) metadata[row.year] = {};
                if (!metadata[row.year][row.month]) metadata[row.year][row.month] = [];
                metadata[row.year][row.month].push(row.day);
            });
            res.json(metadata); //{"2026": {"05": ["10", "11"]}}
        });
    });

    return router;
}

module.exports = setupRoutes;
