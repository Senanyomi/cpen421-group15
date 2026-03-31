const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Analytics Service API',
      version: '5.0.0',
      description: 'NERDCP Analytics & Monitoring API'
    },
    servers: [{ url: 'http://localhost:3004' }],
    security: [{ bearerAuth: [] }],
    paths: {
      '/analytics/response-times': {
        get: {
          tags: ['Analytics'],
          summary: 'Get API response times',
          responses: { '200': { description: 'Response time metrics' } }
        }
      },
      '/analytics/incidents-by-region': {
        get: {
          tags: ['Analytics'],
          summary: 'Incidents by region',
          parameters: [
            { name: 'region', in: 'query', schema: { type: 'string' } },
            { name: 'dateFrom', in: 'query', schema: { type: 'string' } },
            { name: 'dateTo', in: 'query', schema: { type: 'string' } }
          ],
          responses: { '200': { description: 'Incidents data' } }
        }
      },
      '/analytics/summary-dashboard': {
        get: {
          tags: ['Analytics'],
          summary: 'Summary dashboard metrics',
          responses: { '200': { description: 'Dashboard summary' } }
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

