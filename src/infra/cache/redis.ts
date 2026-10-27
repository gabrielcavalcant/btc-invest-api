import { Redis, type RedisOptions } from 'ioredis';

/**
 * Converts REDIS_URL into plain connection options. BullMQ receives options (not an
 * ioredis instance) so it can manage its own connections with its own ioredis version.
 */
export function redisOptionsFromUrl(url: string): RedisOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : 0,
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

export function createRedis(url: string): Redis {
  return new Redis({ ...redisOptionsFromUrl(url), maxRetriesPerRequest: 3, lazyConnect: false });
}
