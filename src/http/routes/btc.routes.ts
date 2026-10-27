import type { FastifyInstance } from 'fastify';
import { formatBrl, formatBtc } from '../../domain/money';
import type { Container } from '../../main/container';
import { bearerAuth, bodyOf, jsonSchemaOf } from '../docs';
import { presentPosition, presentQuote, presentSnapshot, presentTransaction } from '../presenters';
import { amountBody, statementQuery } from '../validation';

type UseCases = Container['useCases'];

/** OpenAPI documentation of an authenticated route. */
const doc = (tag: string, summary: string, extra: Record<string, unknown> = {}) => ({
  schema: { tags: [tag], summary, security: bearerAuth, ...extra },
});

/** Authenticated routes: quote, purchase, sale, position, statement, volume and history. */
export function btcRoutes(useCases: UseCases, options: { timeZone: string }) {
  const statementQuerySchema = statementQuery(options.timeZone);

  return async (app: FastifyInstance) => {
    app.get('/btc/price', doc('btc', 'Current BTC quote: buy (bid) and sell (ask)'), async () =>
      presentQuote(await useCases.getQuote.execute()),
    );

    app.post(
      '/btc/purchase',
      doc('btc', 'Buys BTC with the balance, at the sell price (sends an e-mail)', {
        ...bodyOf(amountBody),
      }),
      async (request, reply) => {
        const { amountCents } = amountBody.parse(request.body);
        const r = await useCases.purchaseBtc.execute({ accountId: request.user.sub, amountCents });
        return reply.status(201).send({
          investmentId: r.investmentId,
          amount: formatBrl(r.amountCents),
          btcAmount: formatBtc(r.btcSats),
          btcPrice: formatBrl(r.priceCents),
          balance: formatBrl(r.balanceCents),
          date: r.purchasedAt.toISOString(),
        });
      },
    );

    app.post(
      '/btc/sell',
      doc('btc', 'Sells BTC until the BRL amount is reached, FIFO (sends an e-mail)', {
        description:
          'Investments are consumed oldest first at the current buy price. A partially sold ' +
          'investment is fully liquidated and the residual is reinvested keeping its original ' +
          'quote (SELL + REINVESTMENT entries in the statement).',
        ...bodyOf(amountBody),
      }),
      async (request, reply) => {
        const { amountCents } = amountBody.parse(request.body);
        const r = await useCases.sellBtc.execute({ accountId: request.user.sub, amountCents });
        return reply.status(201).send({
          amount: formatBrl(r.amountCents),
          btcAmount: formatBtc(r.btcSats),
          btcPrice: formatBrl(r.priceCents),
          balance: formatBrl(r.balanceCents),
          liquidatedInvestments: r.liquidatedInvestments,
          reinvestment: r.reinvestment && {
            investmentId: r.reinvestment.investmentId,
            amount: formatBrl(r.reinvestment.amountCents),
            btcAmount: formatBtc(r.reinvestment.btcSats),
            btcPrice: formatBrl(r.reinvestment.priceCents),
          },
          date: r.soldAt.toISOString(),
        });
      },
    );

    app.get(
      '/btc',
      doc('btc', 'Position: every investment and its price variation'),
      async (request) => presentPosition(await useCases.getPosition.execute(request.user.sub)),
    );

    app.get(
      '/extract',
      doc('reports', 'Statement (default: last 90 days)', {
        description:
          'ISO 8601 dates. Plain dates (YYYY-MM-DD) use APP_TIMEZONE and "to" includes the whole day.',
        querystring: jsonSchemaOf(statementQuerySchema),
      }),
      async (request) => {
        const query = statementQuerySchema.parse(request.query);
        const result = await useCases.getStatement.execute({
          accountId: request.user.sub,
          ...query,
        });
        return {
          from: result.from.toISOString(),
          to: result.to.toISOString(),
          items: result.items.map(presentTransaction),
        };
      },
    );

    app.get('/volume', doc('reports', 'BTC bought and sold today'), async () => {
      const v = await useCases.getDailyVolume.execute();
      return {
        day: v.day.toISOString(),
        buy: formatBtc(v.boughtSats),
        sell: formatBtc(v.soldSats),
      };
    });

    app.get('/history', doc('reports', 'Quotes of the last 24h, every 10 minutes'), async () =>
      (await useCases.getPriceHistory.execute()).map(presentSnapshot),
    );
  };
}
