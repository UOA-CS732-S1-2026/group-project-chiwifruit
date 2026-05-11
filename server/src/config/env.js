const path = require('path');
const dotenv = require('dotenv');

// Always load the repository-level .env file so local scripts work whether they
// are started from the root workspace or from the server workspace.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const requiredVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'FRONTEND_ORIGIN'
];

requiredVars.forEach((key) => {
  if (!process.env[key]) {
    // eslint-disable-next-line no-console
    console.warn(`[env] Missing ${key}. Add it in the root .env file.`);
  }
});

module.exports = {
  port: process.env.PORT || 3000,
  frontendOrigin: process.env.FRONTEND_ORIGIN || '*',
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d'
};
