import sgMail from '@sendgrid/mail';
import type { Logger } from '../logger';
import type { EmailMessage } from './templates';

export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

/** SendGrid (free tier). Used when SENDGRID_API_KEY is configured. */
export class SendGridMailer implements Mailer {
  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    sgMail.setApiKey(apiKey);
  }

  async send(message: EmailMessage): Promise<void> {
    await sgMail.send({ ...message, from: this.from });
  }
}

/** Development fallback: writes the e-mail to the log instead of sending it. */
export class LogMailer implements Mailer {
  constructor(private readonly logger: Logger) {}

  async send(message: EmailMessage): Promise<void> {
    this.logger.info(
      { email: { to: message.to, subject: message.subject, text: message.text } },
      'E-mail (not sent: SENDGRID_API_KEY not set)',
    );
  }
}
