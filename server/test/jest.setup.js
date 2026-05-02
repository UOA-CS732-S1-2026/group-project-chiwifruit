// jest.setup.js
jest.mock('../src/config/env', () => ({
  port: 3000,
  frontendOrigin: 'http://localhost:5173',
  jwtSecret: 'testSecret',
}));

// Mock mongoose to prevent actual DB connection
jest.mock('mongoose', () => {
  const mockModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    exists: jest.fn(),
    hashPassword: jest.fn(),
  };

  const mockSchema = function(definition) {
    this.definition = definition;
    this.methods = {};
    this.statics = {};
  };

  mockSchema.Types = {
    ObjectId: jest.fn(),
    Mixed: jest.fn(),
  };

  mockSchema.prototype.index = jest.fn();
  mockSchema.prototype.methods = {};
  mockSchema.prototype.statics = {};

  return {
    Schema: mockSchema,
    model: jest.fn(() => mockModel),
    connect: jest.fn().mockResolvedValue(),
    connection: {
      readyState: 1,
    },
    Types: {
      ObjectId: jest.fn(),
      Mixed: jest.fn(),
    },
  };
});

// Mock socket.io
jest.mock('socket.io', () => ({
  Server: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    emit: jest.fn(),
  })),
}));

// Mock AWS S3 if needed
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(() => ({ sub: 'userId123', username: 'testuser', isGuest: false })),
  sign: jest.fn(),
}));

// Mock buildAvatarUrl
jest.mock('../src/controllers/authController', () => ({
  buildAvatarUrl: (seed, style = 'bottts') => `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`,
  login: jest.fn(),
  register: jest.fn(),
  continueAsGuest: jest.fn((req, res) => {
    res.status(201).json({
      message: 'Guest session created',
      token: 'guestToken',
      user: {
        id: 'guest_123',
        username: 'SwiftFalcon1234',
        isGuest: true,
        avatarUrl: 'https://api.dicebear.com/9.x/bottts/svg?seed=guest_123',
      },
    });
  }),
}));

// Mock getRoomState to prevent DB calls
const roomController = require('../src/controllers/roomController');
jest.spyOn(roomController, 'getRoomState').mockResolvedValue({});