// Helper: build the deterministic DiceBear avatar URL used across auth,
// room-state serialization, and in-memory game snapshots.
function buildAvatarUrl(seed, style = 'bottts') {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

module.exports = { buildAvatarUrl };