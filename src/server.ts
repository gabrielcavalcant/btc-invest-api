import { loadEnv } from './config/env';
import { buildApp } from './http/app';
import { createLogger, loggerOptions } from './infra/logger';
import { createContainer } from './main/container';

async function main() {
  const env = loadEnv();
  const bootLogger = createLogger(env);
  const container = await createContainer(env, bootLogger);
  const app = await buildApp({ ...container }, loggerOptions(env));

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down');
    await app.close();
    await container.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: env.HOST, port: env.PORT });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
