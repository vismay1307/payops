import express, {
  type Express,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Env } from './config/env.js';
import { checkDatabase, type DbPool } from './db/db.js';
import { AppError } from './errors/app-error.js';
import { logger } from './lib/logger.js';
import { requestId } from './middleware/request-id.middleware.js';

export interface AppDependencies {
  env: Env;
  db: DbPool;
  webhookHandler?: RequestHandler | undefined;
}

const webhookNotConfigured: RequestHandler = (_req, _res, next) => {
  next(new AppError('WEBHOOK_NOT_CONFIGURED', 503, 'Webhook endpoint is not configured.'));
};

export function createApp({ env, db, webhookHandler }: AppDependencies): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestId);
  app.use(pinoHttp({ logger }));
  app.use(helmet());

  // PayPal webhook MUST come before express.json().
  // Signature verification requires the original, unmodified request body.
  app.post(
    '/api/webhooks/paypal',
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
    express.raw({
      type: 'application/json',
      limit: '1mb',
    }),
    webhookHandler ?? webhookNotConfigured,
  );

  // Parse ordinary API requests only after the raw webhook route.
  app.use(express.json({ limit: '1mb' }));

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

  app.use(
    (
      error: unknown,
      _req: Request,
      res: Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: NextFunction,
    ) => {
      if (error instanceof AppError) {
        res.status(error.status).json({
          error: {
            code: error.code,
            message: error.message,
            requestId: res.locals.requestId,
          },
        });
        return;
      }

      const parserError = error as { type?: string };

      if (parserError?.type === 'entity.too.large') {
        res.status(413).json({
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: 'Request body is too large.',
            requestId: res.locals.requestId,
          },
        });
        return;
      }

      if (parserError?.type === 'entity.parse.failed') {
        res.status(400).json({
          error: {
            code: 'INVALID_JSON',
            message: 'Request body must contain valid JSON.',
            requestId: res.locals.requestId,
          },
        });
        return;
      }

      logger.error({ error }, 'Unhandled application error');

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
          requestId: res.locals.requestId,
        },
      });
    },
  );

  void env;

  return app;
}
