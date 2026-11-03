import { Router } from 'express';
import { pool } from '../../db/client.js';

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
  try {
    await pool.query('select 1');
  } catch {
    res.status(503).json({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database is not reachable.',
      },
    });
    return;
  }

  res.json({
    data: {
      status: 'ok',
      db: 'up',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
});
