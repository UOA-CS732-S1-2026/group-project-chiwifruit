const http = require('http');
const app = require('./app');
const connectDatabase = require('./config/db');
const env = require('./config/env');
const { initSocket } = require('./socket');

async function startServer() {
  try {
    await connectDatabase();
    const httpServer = http.createServer(app);
    const io = initSocket(httpServer, env.frontendOrigin);
    app.set('io', io);

    httpServer.listen(env.port, () => {
      // eslint-disable-next-line no-console
      console.log(`[server] Listening on port ${env.port}`);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[server] Failed to start server', error);
    process.exit(1);
  }
}

startServer();
