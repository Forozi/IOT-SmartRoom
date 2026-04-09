// swaggerConfig.js

const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
        title: 'Smart Home IoT API',
        version: '1.0.0',
        description: 'Documentation for Sensor Monitoring and Device Control API',
    },
    servers: [
        {
            url: 'http://localhost:5000',
            description: 'Local server',
        },
    ],
    paths: {
        '/api/sensor-data': {
            get: {
                summary: 'Get paginated sensor data',
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }
                ],
                responses: { 200: { description: 'Success' } }
            }
        },
        '/api/action-history': {
            get: {
                summary: 'Get paginated action history logs',
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
                    { name: 'device', in: 'query', schema: { type: 'string' }, description: 'LED_1, LED_2, or LED_3' }
                ],
                responses: { 200: { description: 'Success' } }
            }
        },
        '/api/control': {
            post: {
                summary: 'Control a device (LED)',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    led: { type: 'integer', example: 1 },
                                    state: { type: 'boolean', example: true }
                                }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'Command sent' } }
            }
        },
        '/api/today-summary': {
            get: {
                summary: 'Get Min/Max/Avg stats for today',
                responses: { 200: { description: 'Stats returned' } }
            }
        },
        '/api/current-status': {
            get: {
                summary: 'Get current ON/OFF state of all devices',
                responses: { 200: { description: 'Status returned' } }
            }
        }
    }
};

module.exports = swaggerDefinition;