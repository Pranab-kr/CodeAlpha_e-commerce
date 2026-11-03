import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { isProduction, isTest } from './config/env.js';
import { apiNotFound, errorHandler } from './middleware/error.js';
import { originCheck } from './middleware/origin.js';
import { apiRateLimit } from './middleware/rate-limit.js';
import { apiRouter } from './routes.js';

const here = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(here, '../../client');

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  if (isProduction) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );

  app.use(
    morgan(isProduction ? 'combined' : 'dev', {
      skip: () => isTest,
    }),
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(originCheck());

  app.use(
    express.static(clientDir, {
      index: 'index.html',
      maxAge: isProduction ? '1h' : 0,
    }),
  );

  app.use('/api', apiRateLimit);
  app.use('/api', apiRouter);
  app.use('/api', apiNotFound);

  app.use((req, res) => {
    res.status(404).sendFile(join(clientDir, '404.html'));
  });

  app.use(errorHandler);

  return app;
}

export { clientDir };
