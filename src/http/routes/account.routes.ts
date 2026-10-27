import type { FastifyInstance } from 'fastify';
import type { Authenticate } from '../../application/use-cases/authenticate';
import { formatBrl } from '../../domain/money';
import type { Container } from '../../main/container';
import { bearerAuth, bodyOf } from '../docs';
import { amountBody, loginBody, registerBody } from '../validation';

type UseCases = Container['useCases'];

/** Public routes: account registration and login. */
export function publicAccountRoutes(deps: { useCases: UseCases; authenticate: Authenticate }) {
  return async (app: FastifyInstance) => {
    const registerSchema = {
      tags: ['account'],
      summary: 'Creates an account',
      ...bodyOf(registerBody),
    };
    app.post('/account', { schema: registerSchema }, async (request, reply) => {
      const input = registerBody.parse(request.body);
      const account = await deps.useCases.registerAccount.execute(input);
      return reply.status(201).send({
        id: account.id,
        name: account.name,
        email: account.email,
        createdAt: account.createdAt.toISOString(),
      });
    });

    app.post(
      '/login',
      // brute-force protection: much stricter limit than the global one
      {
        config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
        schema: {
          tags: ['account'],
          summary: 'Logs in and returns a JWT (paste it in "Authorize")',
          ...bodyOf(loginBody),
        },
      },
      async (request) => {
        const input = loginBody.parse(request.body);
        return deps.authenticate.execute(input);
      },
    );
  };
}

/** Authenticated routes for the account balance. */
export function accountRoutes(useCases: UseCases) {
  return async (app: FastifyInstance) => {
    const depositSchema = {
      tags: ['account'],
      summary: 'Deposits BRL into the balance (sends an e-mail)',
      security: bearerAuth,
      ...bodyOf(amountBody),
    };
    app.post('/account/deposit', { schema: depositSchema }, async (request, reply) => {
      const { amountCents } = amountBody.parse(request.body);
      const result = await useCases.deposit.execute({ accountId: request.user.sub, amountCents });
      return reply.status(201).send({
        id: result.transactionId,
        amount: formatBrl(result.amountCents),
        balance: formatBrl(result.balanceCents),
        date: result.createdAt.toISOString(),
      });
    });

    const balanceSchema = {
      tags: ['account'],
      summary: 'Available balance in BRL',
      security: bearerAuth,
    };
    app.get('/account/balance', { schema: balanceSchema }, async (request) => {
      const { balanceCents } = await useCases.getBalance.execute(request.user.sub);
      return { balance: formatBrl(balanceCents) };
    });
  };
}
