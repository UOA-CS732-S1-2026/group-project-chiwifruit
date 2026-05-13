const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Helper: generate a room code that avoids ambiguous characters like 0/O and 1/I.
function generateRoomCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

module.exports = { generateRoomCode };
