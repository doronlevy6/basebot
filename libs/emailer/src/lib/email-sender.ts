import * as sendgrid from '@sendgrid/mail';
import { logger } from '@base/logger';
import { SendEmailRequest } from './send-email-request';

export class EmailSender {
  private defaultSendFrom: string;

  constructor(apiKey: string, defaultSendFrom: string) {
    sendgrid.setApiKey(apiKey);
    this.defaultSendFrom = defaultSendFrom;
  }

  async sendEmail(req: SendEmailRequest) {
    try {
      const { to, from, fromName, text, subject, headers, template, html } =
        req;

      if (!text && !template && !html) {
        throw new Error("Can't send email with no text and no template id");
      }

      await sendgrid.send({
        from: { name: fromName, email: from ?? this.defaultSendFrom },
        to,
        text: text as string,
        templateId: template?.id,
        dynamicTemplateData: template?.data,
        html,
        subject,
        headers,
      });
    } catch (error) {
      logger.error({
        msg: `error in consuming payment event`,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error as Error;
    }
  }
}
