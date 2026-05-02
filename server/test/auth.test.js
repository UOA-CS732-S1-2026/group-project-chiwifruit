const request = require('supertest');
const app = require('../src/app');
const { createToken } = require('../src/services/tokenService');

describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Math.random for predictable guest name generation
    // This will select: prefix[0] = 'Swift', noun[0] = 'Falcon', suffix = 1000 + (0.5 * 9000) = 5500
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
      createToken.mockReturnValue('mocked-jwt-token');

      const response = await request(app)
        .post('/api/auth/guest')
        .expect(201);

      expect(response.body.message).toBe('Guest session created');
      expect(response.body.token).toBe('mocked-jwt-token');
      expect(response.body.user.isGuest).toBe(true);
      expect(response.body.user.id).toBe('guest_test-uuid-123');
      expect(response.body.user.username).toBe('BraveKoala5500');
      expect(response.body.user.avatarUrl).toBe('https://api.dicebear.com/9.x/bottts/svg?seed=guest_test-uuid-123');

      expect(createToken).toHaveBeenCalledWith({
        sub: 'guest_test-uuid-123',
        username: 'BraveKoala5500',
        isGuest: true,
      });
    }, 10000);
  });
});