import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError, type ErrorCode } from '../domain/errors';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INSUFFICIENT_FUNDS: 422,
  QUOTE_UNAVAILABLE: 503,
};

/** Single error contract: { error: { code, message, details? } } */
export function errorHandler(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      },
    });
  }

  if (error instanceof AppError) {
    const status = STATUS_BY_CODE[error.code];
    if (status >= 500) request.log.warn({ err: error }, error.message);
    return reply.status(status).send({ error: { code: error.code, message: error.message } });
  }

  // Errors raised by Fastify and its plugins (JWT, rate limit, malformed JSON...)
  const { statusCode, message } = (error ?? {}) as { statusCode?: number; message?: string };
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    const code =
      statusCode === 401
        ? 'UNAUTHORIZED'
        : statusCode === 429
          ? 'TOO_MANY_REQUESTS'
          : 'BAD_REQUEST';
    return reply.status(statusCode).send({ error: { code, message: message ?? 'Bad request' } });
  }

  request.log.error({ err: error }, 'Unhandled error');
  return reply
    .status(500)
    .send({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
}
