import type { Queue } from 'bullmq';
import type { Notifier } from '../../application/ports';
import type { Logger } from '../logger';
import { emailTemplates, type EmailMessage } from '../mail/templates';

/**
 * Notifier that only enqueues the e-mail: the HTTP request does not wait for the e-mail
 * provider, and failures are retried by the worker with exponential backoff.
 * An enqueue failure is logged and never undoes the financial operation already committed.
 */
export class QueueNotifier implements Notifier {
  constructor(
    private readonly queue: Queue<EmailMessage>,
    private readonly logger: Logger,
  ) {}

  depositMade(input: Parameters<Notifier['depositMade']>[0]) {
    return this.enqueue('deposit', emailTemplates.deposit(input));
  }

  btcPurchased(input: Parameters<Notifier['btcPurchased']>[0]) {
    return this.enqueue('purchase', emailTemplates.purchase(input));
  }

  btcSold(input: Parameters<Notifier['btcSold']>[0]) {
    return this.enqueue('sell', emailTemplates.sell(input));
  }

  private async enqueue(kind: string, message: EmailMessage): Promise<void> {
    try {
      await this.queue.add(kind, message);
    } catch (error) {
      this.logger.error({ err: error, kind, to: message.to }, 'Could not enqueue e-mail');
    }
  }
}
