const request = require('supertest');
const app = require('../../src/app');
const { createToken } = require('../../src/services/tokenService');

// Unit scope: auth routes are exercised with mocked token signing.
describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Predictable guest name: prefix[3] Brave, noun[3] Koala, suffix 5500.
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /health', () => {
    it('should return ok status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body.status).toBe('ok');
    });
  });

  describe('POST /api/auth/guest', () => {
    it('should create guest session successfully', async () => {
      createToken.mockReturnValue('mocked-jwt-token');

      const response = await request(app).post('/api/auth/guest').expect(201);

      expect(response.body).toMatchObject({
        message: 'Guest session created',
        token: 'mocked-jwt-token',
        user: {
          id: 'guest_test-uuid-123',
          username: 'BraveKoala5500',
          isGuest: true,
          avatarUrl: 'https://api.dicebear.com/9.x/bottts/svg?seed=guest_test-uuid-123',
        },
      });
      expect(createToken).toHaveBeenCalledWith({
        sub: 'guest_test-uuid-123',
        username: 'BraveKoala5500',
        isGuest: true,
      });
    });
  });
});
