const s3 = require('../config/s3');
const env = require('../config/env');

function getAudioSignedUrl(s3Key, expiresInSeconds = 300) {
  return s3.getSignedUrl('getObject', {
    Bucket: env.awsS3Bucket,
    Key: s3Key,
    Expires: expiresInSeconds
  });
}

module.exports = { getAudioSignedUrl };
