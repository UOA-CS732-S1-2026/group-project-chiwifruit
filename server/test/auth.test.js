const request = require('supertest');
const app = require('../src/app');

describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return ok status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
    });
  });

  describe('POST /api/auth/guest', () => {
    it('should create guest session successfully', async () => {
      const response = await request(app)
        .post('/api/auth/guest')
        .expect(201);

      expect(response.body.message).toBe('Guest session created');
      expect(response.body.token).toBe('guestToken');
      expect(response.body.user.isGuest).toBe(true);
      expect(response.body.user.username).toBe('SwiftFalcon1234');
      expect(response.body.user.avatarUrl).toContain('api.dicebear.com');
    }, 10000);
  });
});