const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Incident Service API',
      version: '3.0.0',
      description: 'NERDCP Emergency Incident Service'
    },
    servers: [{ url: 'http://localhost:3002' }],
    security: [{ bearerAuth: [] }],
    paths: {
      '/incidents': {
        post: {
          tags: ['Incidents'],
          summary: 'Create new incident',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    latitude: { type: 'number' },
                    longitude: { type: 'number' },
                    description: { type: 'string' },
                    severity: { type: 'string', enum: ['low', 'medium', 'high'] }
                  }
                }
              }
            }
          },
          responses: { '201': { description: 'Incident created' } }
        },
        get: {
          tags: ['Incidents'],
          summary: 'List incidents',
          responses: { '200': { description: 'List of incidents' } }
        }
      },
      '/incidents/{id}': {
        get: { tags: ['Incidents'], summary: 'Get incident by ID', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Incident details' } } },
        put: { tags: ['Incidents'], summary: 'Update incident status', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } }
      }
      // Add responders...
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

