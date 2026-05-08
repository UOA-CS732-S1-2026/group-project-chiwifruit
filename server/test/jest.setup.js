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

// Mock crypto for predictable UUIDs
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => 'test-uuid-123'),
}));

// Mock tokenService
jest.mock('../src/services/tokenService', () => ({
  createToken: jest.fn(),
}));
