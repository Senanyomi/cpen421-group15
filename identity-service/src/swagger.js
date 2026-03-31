const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Identity Service API',
      version: '2.0.0',
      description: 'NERDCP Identity & Authentication Service API Documentation'
    },
    servers: [
      {
        url: 'http://localhost:3001'
      }
    ],
    paths: {
      '/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Register new user',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    email: { type: 'string', example: 'user@example.com' },
                    password: { type: 'string' },
                    role: { type: 'string', enum: ['citizen', 'dispatcher', 'admin'] }
                  }
                }
              }
            }
          },
          responses: {
            '201': { description: 'User created' },
            '400': { description: 'Validation error' }
          }
        }
      },
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login user',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    email: { type: 'string' },
                    password: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Login successful, returns JWT' },
            '401': { description: 'Invalid credentials' }
          }
        }
      },
      // Add more paths as needed...
      '/auth/profile': {
        get: {
          tags: ['Auth'],
          summary: 'Get current user profile',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'User profile' } }
        },
        put: {
          tags: ['Auth'],
          summary: 'Update profile',
          security: [{ bearerAuth: [] }],
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

