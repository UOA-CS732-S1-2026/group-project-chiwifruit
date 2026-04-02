const Audio = require('../models/Audio');
const { getAudioSignedUrl } = require('../services/audioService');

async function getAudioByIndex(req, res) {
  const num = Number(req.params.num);
  const mode = req.query.mode;

  if (!Number.isInteger(num) || num < 1) {
    return res.status(400).json({ message: 'num must be a positive integer' });
  }

  if (mode && !['animals', 'music'].includes(mode)) {
    return res.status(400).json({ message: 'mode must be animals or music' });
  }

  const filter = { index: num };
  if (mode) {
    filter.mode = mode;
  }

  const audio = await Audio.findOne(filter).lean();

  if (!audio) {
    return res.status(404).json({ message: 'Audio not found for provided index/mode' });
  }

  const signedUrl = getAudioSignedUrl(audio.s3Key);

  return res.json({
    index: audio.index,
    mode: audio.mode,
    title: audio.title,
    s3Key: audio.s3Key,
    url: signedUrl
  });
}

module.exports = { getAudioByIndex };
