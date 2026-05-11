const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("Database Error:", err.message);
    else console.log("Connected to SQLite Database at " + dbPath);
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

module.exports = db;
