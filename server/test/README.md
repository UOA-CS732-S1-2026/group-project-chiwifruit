# Backend Unit Tests

This directory contains unit tests for the backend APIs.

## Running Tests

To run the tests, use:

```bash
npm test
```

## Test Coverage

- **Auth API**: Tests for user registration, login, and guest session creation.
- **Health Check**: Test for the health endpoint.

## Test Setup

The tests use Jest and Supertest for API testing. Database models and external services are mocked to isolate the API logic.

### Mocks

- **Mongoose Models**: Mocked to prevent actual database connections.
- **JWT**: Mocked for authentication.
- **Socket.IO**: Mocked for real-time features.
- **AWS S3**: Mocked for file storage.
- **Environment Variables**: Mocked for configuration.

## Adding New Tests

To add tests for new endpoints:

1. Create a new test file in this directory (e.g., `newFeature.test.js`).
2. Use `supertest` to make requests to the app.
3. Mock any dependencies as needed.
4. Follow the existing patterns for mocking models and services.

Example:

```javascript
const request = require('supertest');
const app = require('../src/app');

describe('New Feature API', () => {
  it('should work', async () => {
    const response = await request(app)
      .get('/api/new-endpoint')
      .expect(200);

    expect(response.body).toHaveProperty('data');
  });
});
```