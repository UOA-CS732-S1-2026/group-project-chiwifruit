const jwt = require('jsonwebtoken');

jest.unmock('../../src/services/tokenService');

const { createToken } = require('../../src/services/tokenService');

// Unit scope: token payload construction is verified against mocked jwt.sign.
describe('tokenService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jwt.sign.mockReturnValue('signed-token');
  });

  it('should sign a registered user token payload', () => {
    const token = createToken({ _id: 'user-123', username: 'Zoe' });

    expect(token).toBe('signed-token');
    expect(jwt.sign).toHaveBeenCalledWith(
      {
        sub: 'user-123',
        username: 'Zoe',
        isGuest: false,
      },
      'testSecret',
      { expiresIn: '1d' }
    );
  });

  it('should sign a guest token payload using sub', () => {
    createToken({ sub: 'guest-123', username: 'Guest', isGuest: true });

    expect(jwt.sign).toHaveBeenCalledWith(
      {
        sub: 'guest-123',
        username: 'Guest',
        isGuest: true,
      },
      'testSecret',
      { expiresIn: '1d' }
    );
  });
});
