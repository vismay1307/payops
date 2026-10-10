import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Env } from './config/env.js';
import { checkDatabase, type DbPool } from './db/db.js';
import { logger } from './lib/logger.js';
import { requestId } from './middleware/request-id.middleware.js';

export interface AppDependencies {
  env: Env;
  db: DbPool;
}

export function createApp({ env, db }: AppDependencies): Express {
  const app = express();

  app.disable('x-powered-by');

  app.use(requestId);

  app.use(pinoHttp({ logger }));

  app.use(helmet());

  app.use(express.json());

  app.get('/healthz', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'payops-api',
      commit: process.env.RENDER_GIT_COMMIT ?? 'local',
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  app.get('/readyz', async (_req: Request, res: Response) => {
    const databaseOk = await checkDatabase(db);

    if (!databaseOk) {
      res.status(503).json({
        status: 'degraded',
        service: 'payops-api',
        commit: process.env.RENDER_GIT_COMMIT ?? 'local',
        uptimeSeconds: Math.floor(process.uptime()),
        checks: {
          database: 'down',
        },
      });

      return;
    }

    res.status(200).json({
      status: 'ok',
      service: 'payops-api',
      commit: process.env.RENDER_GIT_COMMIT ?? 'local',
      uptimeSeconds: Math.floor(process.uptime()),
      checks: {
        database: 'ok',
      },
    });
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        requestId: res.locals.requestId,
      },
    });
  });

  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    void next;

    logger.error({ error }, 'Unhandled application error');

    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        requestId: res.locals.requestId,
      },
    });
  });

  void env;

  return app;
}
