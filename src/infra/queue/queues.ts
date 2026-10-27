import { Queue, type ConnectionOptions } from 'bullmq';
import type { EmailMessage } from '../mail/templates';

export const EMAIL_QUEUE = 'emails';
export const MAINTENANCE_QUEUE = 'maintenance';

export const MaintenanceJob = {
  PRICE_SNAPSHOT: 'price-snapshot',
  PURGE_HISTORY: 'purge-history',
} as const;

export function createEmailQueue(connection: ConnectionOptions) {
  return new Queue<EmailMessage>(EMAIL_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    },
  });
}

export function createMaintenanceQueue(connection: ConnectionOptions) {
  return new Queue(MAINTENANCE_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'fixed', delay: 10_000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  });
}

/**
 * Repeatable jobs (idempotent: running it again just updates the schedule):
 *  - every 10 minutes (08:00, 08:10, 08:20...) stores the BTC quote for /history;
 *  - every day at 03:00 removes history older than 90 days.
 */
export async function scheduleMaintenanceJobs(queue: Queue, timeZone: string) {
  await queue.upsertJobScheduler(
    MaintenanceJob.PRICE_SNAPSHOT,
    { pattern: '*/10 * * * *', tz: timeZone },
    { name: MaintenanceJob.PRICE_SNAPSHOT },
  );
  await queue.upsertJobScheduler(
    MaintenanceJob.PURGE_HISTORY,
    { pattern: '0 3 * * *', tz: timeZone },
    { name: MaintenanceJob.PURGE_HISTORY },
  );
}
