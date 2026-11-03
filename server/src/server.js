import { createApp } from './app.js';
import { env } from './config/env.js';
import { closeDb } from './db/client.js';

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`Bench Supply listening on http://localhost:${env.PORT}`);
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down.`);

  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();

  server.close(async (error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
    await closeDb();
    process.exit();
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
