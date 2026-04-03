const AWS = require('aws-sdk');
const env = require('./env');

AWS.config.update({
  region: env.awsRegion,
  accessKeyId: env.awsAccessKeyId,
  secretAccessKey: env.awsSecretAccessKey
});

const s3 = new AWS.S3({ signatureVersion: 'v4' });

module.exports = s3;
