const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const { createToken } = require('../../src/services/tokenService');

// Unit scope: auth routes are exercised with mocked persistence and token signing.
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

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      User.findOne.mockResolvedValue(null);
      User.hashPassword.mockResolvedValue('hashed-password');
      User.create.mockResolvedValue({ _id: 'user-123', username: 'zoe' });
      createToken.mockReturnValue('registered-user-token');

      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: ' zoe ', password: 'password123' })
        .expect(201);

      expect(User.findOne).toHaveBeenCalledWith({ username: 'zoe' });
      expect(User.hashPassword).toHaveBeenCalledWith('password123');
      expect(User.create).toHaveBeenCalledWith({ username: 'zoe', passwordHash: 'hashed-password' });
      expect(createToken).toHaveBeenCalledWith({ _id: 'user-123', username: 'zoe' });
      expect(response.body).toMatchObject({
        message: 'Register success',
        token: 'registered-user-token',
        user: {
          id: 'user-123',
          username: 'zoe',
          isGuest: false,
          avatarUrl: 'https://api.dicebear.com/9.x/bottts/svg?seed=user-123',
        },
      });
    });

    it('should reject duplicate username', async () => {
      User.findOne.mockResolvedValue({ _id: 'existing-user' });

      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'zoe', password: 'password123' })
        .expect(409);

      expect(response.body.message).toBe('Username already exists');
      expect(User.hashPassword).not.toHaveBeenCalled();
      expect(User.create).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully', async () => {
      const user = {
        _id: 'user-123',
        username: 'zoe',
        comparePassword: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(user);
      createToken.mockReturnValue('login-token');

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: ' zoe ', password: 'password123' })
        .expect(200);

      expect(User.findOne).toHaveBeenCalledWith({ username: 'zoe' });
      expect(user.comparePassword).toHaveBeenCalledWith('password123');
      expect(createToken).toHaveBeenCalledWith(user);
      expect(response.body).toMatchObject({
        message: 'Login success',
        token: 'login-token',
        user: {
          id: 'user-123',
          username: 'zoe',
          isGuest: false,
          avatarUrl: 'https://api.dicebear.com/9.x/bottts/svg?seed=user-123',
        },
      });
    });

    it('should reject unknown username', async () => {
      User.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'missing', password: 'password123' })
        .expect(401);

      expect(response.body.message).toBe('Invalid credentials');
      expect(createToken).not.toHaveBeenCalled();
    });

    it('should reject invalid password', async () => {
      const user = { comparePassword: jest.fn().mockResolvedValue(false) };
      User.findOne.mockResolvedValue(user);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'zoe', password: 'wrong' })
        .expect(401);

      expect(user.comparePassword).toHaveBeenCalledWith('wrong');
      expect(response.body.message).toBe('Invalid credentials');
      expect(createToken).not.toHaveBeenCalled();
    });
  });
});
