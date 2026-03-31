const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Dispatch Service API',
      version: '4.0.0',
      description: 'NERDCP Dispatch & Vehicle Tracking API'
    },
    servers: [{ url: 'http://localhost:3003' }],
    security: [{ bearerAuth: [] }],
    paths: {
      '/vehicles': {
        get: {
          tags: ['Vehicles'],
          summary: 'List vehicles',
          responses: { '200': { description: 'Vehicles list' } }
        },
        post: {
          tags: ['Vehicles'],
          summary: 'Register new vehicle',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['firetruck', 'ambulance', 'police'] },
                    status: { type: 'string', enum: ['available', 'busy'] }
                  }
                }
              }
            }
          },
          responses: { '201': { description: 'Vehicle created' } }
        }
      },
      '/vehicles/{id}/location': {
        get: {
          tags: ['Vehicles'],
          summary: 'Get vehicle location',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Location' } }
        },
        put: {
          tags: ['Vehicles'],
          summary: 'Update location',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    latitude: { type: 'number' },
                    longitude: { type: 'number' }
                  }
                }
              }
            }
          },
          responses: { '200': { description: 'Updated' } }
        }
      }
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./routes/*.js', './controllers/*.js']
};

module.exports = swaggerJSDoc(options);

