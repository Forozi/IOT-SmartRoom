const CONFIG = {
    PORT: 5000, //server.js
    MQTT_BROKER: 'mqtt://localhost:1884', // mqtt/mqttHandler.js

    MQTT_TOPICS: {
        STATUS_REPORT: 'room/status_report', // mqtt/mqttHandler.js sub
        SENSOR_DATA: 'room/sensor_data', // mqtt/mqttHandler.js sub
        COMMAND: 'room/command' // routes/apiRoutes.js pub
    },
    DEVICES: {
        LED_1: 'LED_1',
        LED_2: 'LED_2',
        LED_3: 'LED_3'
    }
};

module.exports = CONFIG;
