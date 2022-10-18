import * as sendgrid from '@sendgrid/mail';
import { logger } from '@base/logger';
import { SendEmailJob } from './dto/send-email-job.dto';

export class EmailSender {
  private defaultSendFrom: string;
  constructor() {
    const key = process.env.SENDGRID_API_KEY as string;
    sendgrid.setApiKey(key);
    this.defaultSendFrom = 'welcome@mail.thegist.ai';
  }

  async sendEmail(job: SendEmailJob) {
    try {
      const { to, from, text, subject, headers, template, html } = job;

      if (!text && !template && !html) {
        throw new Error("Can't send email with no text and no template id");
      }

      await sendgrid.send({
        from: from ?? this.defaultSendFrom,
        to,
        text: text as string,
        templateId: template?.id,
        dynamicTemplateData: template?.data,
        html,
        subject,
        headers,
      });
    } catch (err) {
      logger.error(err);
      throw err;
    }
  }
}
