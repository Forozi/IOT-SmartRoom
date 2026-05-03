export const CONFIG = {
    API_BASE_URL: 'http://localhost:5000', //App.jsx

    API_ENDPOINTS: {
        CURRENT_STATUS: 'http://localhost:5000/api/current-status', // Dashboard.jsx
        TODAY_SUMMARY: 'http://localhost:5000/api/today-summary', // Dashboard.jsx
        CONTROL: 'http://localhost:5000/api/control', // Dashboard.jsx

        SENSOR_DATA: 'http://localhost:5000/api/sensor-data', // DataSensor.jsx

        ACTION_HISTORY: 'http://localhost:5000/api/action-history', // ActionHistory.jsx
    },

    DEVICES: {
        LAMP: { id: 1, key: 'LED_1', name: 'Lamp' },
        AC: { id: 2, key: 'LED_2', name: 'AC' },
        FAN: { id: 3, key: 'LED_3', name: 'Fan' }
    }
};
