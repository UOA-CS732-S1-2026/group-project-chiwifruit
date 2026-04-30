const mongoose = require('mongoose');
const env = require('./env');

const connectDatabase = async () => {
  if (!env.mongodbUri) {
    throw new Error('MONGODB_URI is required to connect to MongoDB.');
  }

  await mongoose.connect(env.mongodbUri);
  // eslint-disable-next-line no-console
  console.log('[db] Connected to MongoDB');
};

module.exports = connectDatabase;
