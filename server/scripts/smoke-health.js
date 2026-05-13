const app = require('../src/app');

async function runSmokeTest() {
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/health`);

    if (!response.ok) {
      throw new Error(`Expected 200 from /health, received ${response.status}`);
    }

    const payload = await response.json();

    if (payload.status !== 'ok') {
      throw new Error(`Expected payload status to be "ok", received "${payload.status}"`);
    }

    // eslint-disable-next-line no-console
    console.log('[smoke] Backend /health responded with status ok');
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

runSmokeTest()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[smoke] Backend smoke test failed', error);
    process.exit(1);
  });
