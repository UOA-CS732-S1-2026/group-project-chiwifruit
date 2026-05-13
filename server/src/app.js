const express = require('express');
const cors = require('cors');
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const authRoutes = require('./routes/authRoutes');
const roomRoutes = require('./routes/roomRoutes');
const env = require('./config/env');

// NOTE (2026-05-14): Express application shell wiring middleware, documentation,
// routes, and the shared error boundary for the backend.
const app = express();

// Helper: Swagger definition used by the local API docs page.
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sound Chain Backend API',
      version: '1.0.0',
      description: 'API documentation for the Sound Chain Sequence game backend',
    },
    servers: [
      {
        url: `http://localhost:${env.port}`,
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.js'], // Path to the API routes
};

// Helper: Build the Swagger spec once during startup.
const swaggerSpec = swaggerJSDoc(swaggerOptions);

app.use(
  cors({
    origin: env.frontendOrigin
  })
);
app.use(express.json());

// Helper: Lightweight health endpoint used by smoke checks and container probes.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Helper: Serve interactive API documentation for local development.
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// Helper: Shared fallback error handler for uncaught request pipeline errors.
app.use((error, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(error);
  res.status(500).json({ message: 'Internal server error', details: error.message });
});

module.exports = app;
