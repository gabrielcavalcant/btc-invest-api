import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Interactive API docs (OpenAPI 3) at /docs, raw spec at /docs/json.
 *
 * Route schemas exist only to document the API: input is still validated by the zod
 * schemas inside each handler, which are also the source of these JSON schemas, so the
 * docs never drift from the real validation.
 */
export async function registerDocs(app: FastifyInstance) {
  // Documentation-only schemas: zod is the single validator (keeps the error contract)
  app.setValidatorCompiler(() => () => true);

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'BTC Invest API',
        version: '1.0.0',
        description:
          'Bitcoin investment API. Create an account, call POST /login and paste the token ' +
          'in "Authorize". Money values are decimal strings ("1500.00", "0.00431234").',
      },
      tags: [
        { name: 'account', description: 'Registration, login, deposit and balance' },
        { name: 'btc', description: 'Quote, purchase, sale and position' },
        { name: 'reports', description: 'Statement, daily volume and price history' },
        { name: 'system', description: 'Health check' },
      ],
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { persistAuthorization: true, displayRequestDuration: true },
  });
}

/** JSON schema of the zod input (before transforms), for the OpenAPI docs. */
// Non-generic view of the converter: matching zod's generics here hits TS2589 (excessively deep type)
const toJsonSchema = zodToJsonSchema as unknown as (
  schema: ZodTypeAny,
  options: Record<string, unknown>,
) => Record<string, unknown>;

export function jsonSchemaOf(schema: ZodTypeAny) {
  return toJsonSchema(schema, {
    target: 'openApi3',
    $refStrategy: 'none',
    effectStrategy: 'input',
  });
}

/**
 * Documents a request body accepted both as an HTML form and as JSON. The form comes first,
 * so the Swagger UI shows one input per field instead of a raw JSON text box.
 */
export function bodyOf(schema: ZodTypeAny) {
  return {
    body: jsonSchemaOf(schema),
    consumes: ['application/x-www-form-urlencoded', 'application/json'],
  };
}

/** Marks a route as protected in the docs (padlock + "Authorize" token). */
export const bearerAuth = [{ bearerAuth: [] }];
