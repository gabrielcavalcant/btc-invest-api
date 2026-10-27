import 'dotenv/config';
import { z } from 'zod';

/** Every setting comes from environment variables, validated at startup (fail fast). */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().url(),
  DATABASE_LOGGING: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  REDIS_URL: z.string().url(),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must have at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),

  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),

  QUOTE_PROVIDER: z.enum(['mercadobitcoin', 'fake']).default('mercadobitcoin'),
  QUOTE_URL: z.string().url().default('https://www.mercadobitcoin.net/api/BTC/ticker/'),
  QUOTE_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  QUOTE_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(10),

  SENDGRID_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().email().default('no-reply@btc-invest.local'),

  APP_TIMEZONE: z.string().default('America/Sao_Paulo'),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment variables:\n${problems.join('\n')}`);
  }
  return parsed.data;
}
