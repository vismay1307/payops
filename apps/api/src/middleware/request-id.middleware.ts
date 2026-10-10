import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');

  const id = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();

  res.setHeader('x-request-id', id);
  res.locals.requestId = id;

  next();
};
