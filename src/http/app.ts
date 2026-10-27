import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import helmet from '@fastify/helmet';
import fastifyJwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyServerOptions } from 'fastify';
import type { Redis } from 'ioredis';
import { Authenticate } from '../application/use-cases/authenticate';
import type { Container } from '../main/container';
import { registerDocs } from './docs';
import { errorHandler } from './error-handler';
import { accountRoutes, publicAccountRoutes } from './routes/account.routes';
import { btcRoutes } from './routes/btc.routes';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

export type AppDeps = Pick<
  Container,
  'useCases' | 'accounts' | 'hasher' | 'healthCheck' | 'env'
> & {
  redis?: Redis;
};

export async function buildApp(deps: AppDeps, logger: FastifyServerOptions['logger'] = false) {
  const { env } = deps;
  const app = Fastify({
    logger,
    trustProxy: true,
    bodyLimit: 16 * 1024,
    disableRequestLogging: false,
  });

  app.setErrorHandler((error, request, reply) => errorHandler(error, request, reply));
  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({
      error: { code: 'NOT_FOUND', message: `Route ${request.method} ${request.url} not found` },
    }),
  );

  await app.register(helmet);
  // HTML form bodies (application/x-www-form-urlencoded), besides JSON
  await app.register(formbody);
  await app.register(cors, { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    // shared counter between API instances when Redis is available
    ...(deps.redis ? { redis: deps.redis } : {}),
  });
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
  });
  // Must come before the routes, so they are collected into the OpenAPI spec
  await registerDocs(app);

  const authenticate = new Authenticate({
    accounts: deps.accounts,
    hasher: deps.hasher,
    tokens: { issue: async (accountId) => app.jwt.sign({ sub: accountId }) },
  });

  const healthSchema = { tags: ['system'], summary: 'Checks the database and Redis' };
  app.get('/health', { schema: healthSchema }, async (_request, reply) => {
    try {
      await deps.healthCheck();
      return { status: 'ok' };
    } catch {
      return reply.status(503).send({ status: 'unavailable' });
    }
  });

  await app.register(publicAccountRoutes({ useCases: deps.useCases, authenticate }));

  // Every other endpoint requires a valid JWT (Authorization: Bearer <token>)
  await app.register(async (protectedApp) => {
    protectedApp.addHook('onRequest', async (request) => {
      await request.jwtVerify();
    });
    await protectedApp.register(accountRoutes(deps.useCases));
    await protectedApp.register(btcRoutes(deps.useCases, { timeZone: env.APP_TIMEZONE }));
  });

  return app;
}
