// server.js (CLEANED VERSION)

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerDefinition = require('./swaggerConfig');

// 1. --- DATABASE & SERVICES ---
const db = require('./database/db');
const setupMQTT = require('./mqtt/mqttHandler');
const setupRoutes = require('./routes/apiRoutes');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// 2. --- INITIALIZE MQTT ---
const mqttClient = setupMQTT(db, io);

// 3. --- INITIALIZE ROUTES ---
app.use('/api', setupRoutes(db, mqttClient, io));

// 4. --- SWAGGER SETUP ---
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDefinition));

// 5. --- START SERVER ---
const PORT = 5000;
server.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT: ${PORT}`);
    console.log(`API DOCS: http://localhost:${PORT}/api-docs`);
});