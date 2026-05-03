// server.js (CLEANED VERSION)

const express = require('express');
const http = require('http');
const { Server } = require('socket.io'); // SOCKET - mqttHandler.js, apiRoutes.js
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerDefinition = require('./swaggerConfig');
const CONFIG = require('./config');

// SETUP DB & MQTT & ROUTE
const db = require('./database/db');
const setupMQTT = require('./mqtt/mqttHandler');
const setupRoutes = require('./routes/apiRoutes');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } }); // init Socket.io

// INIT MQTT
const mqttClient = setupMQTT(db, io); //pass socket in to send data

// INIT ROUTE
app.use('/api', setupRoutes(db, mqttClient, io)); //pass socket in to send data

// SETUP SWAGGER
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDefinition));

// START SERVER
const PORT = CONFIG.PORT;
server.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT: ${PORT}`);
    console.log(`API DOCS: http://localhost:${PORT}/api-docs`);
});