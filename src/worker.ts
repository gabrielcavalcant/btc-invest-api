import { Worker } from 'bullmq';
import { loadEnv } from './config/env';
import { redisOptionsFromUrl } from './infra/cache/redis';
import { createLogger } from './infra/logger';
import { LogMailer, SendGridMailer, type Mailer } from './infra/mail/mailers';
import type { EmailMessage } from './infra/mail/templates';
import {
  createMaintenanceQueue,
  EMAIL_QUEUE,
  MAINTENANCE_QUEUE,
  MaintenanceJob,
  scheduleMaintenanceJobs,
} from './infra/queue/queues';
import { createContainer } from './main/container';

/**
 * Background process (scales independently from the API):
 *  - sends the e-mails from the queue (with retries);
 *  - stores the BTC quote every 10 minutes;
 *  - purges history older than 90 days.
 */
async function main() {
  const env = loadEnv();
  const logger = createLogger(env);
  const container = await createContainer(env, logger);
  // Workers need maxRetriesPerRequest=null (blocking Redis commands)
  const connection = { ...redisOptionsFromUrl(env.REDIS_URL), maxRetriesPerRequest: null };

  const mailer: Mailer = env.SENDGRID_API_KEY
    ? new SendGridMailer(env.SENDGRID_API_KEY, env.MAIL_FROM)
    : new LogMailer(logger);

  const emailWorker = new Worker<EmailMessage>(
    EMAIL_QUEUE,
    async (job) => {
      await mailer.send(job.data);
      logger.info({ jobId: job.id, to: job.data.to, subject: job.data.subject }, 'E-mail sent');
    },
    { connection, concurrency: 5 },
  );

  const maintenanceWorker = new Worker(
    MAINTENANCE_QUEUE,
    async (job) => {
      if (job.name === MaintenanceJob.PRICE_SNAPSHOT) {
        const snapshot = await container.useCases.capturePriceSnapshot.execute();
        logger.info({ at: snapshot.capturedAt.toISOString() }, 'Price snapshot stored');
      } else if (job.name === MaintenanceJob.PURGE_HISTORY) {
        const removed = await container.useCases.purgeOldPriceHistory.execute();
        logger.info({ removed }, 'Old price history purged');
      }
    },
    { connection, concurrency: 1 },
  );

  for (const worker of [emailWorker, maintenanceWorker]) {
    worker.on('failed', (job, err) =>
      logger.error(
        { err, queue: worker.name, jobId: job?.id, attempts: job?.attemptsMade },
        'Job failed',
      ),
    );
  }

  const maintenanceQueue = createMaintenanceQueue(connection);
  await scheduleMaintenanceJobs(maintenanceQueue, env.APP_TIMEZONE);
  // Stores the current slot right away, so /history is not empty until the next 10-minute tick
  await maintenanceQueue.add(MaintenanceJob.PRICE_SNAPSHOT, {});
  logger.info('Worker started');

  const shutdown = async () => {
    logger.info('Shutting down worker');
    await Promise.all([emailWorker.close(), maintenanceWorker.close(), maintenanceQueue.close()]);
    await container.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
