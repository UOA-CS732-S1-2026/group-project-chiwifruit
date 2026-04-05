const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const s3 = require('../config/s3');
const env = require('../config/env');

async function getAudioSignedUrl(s3Key, expiresInSeconds = 300) {
  const command = new GetObjectCommand({
    Bucket: env.awsS3Bucket,
    Key: s3Key
  });

  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

module.exports = { getAudioSignedUrl };
