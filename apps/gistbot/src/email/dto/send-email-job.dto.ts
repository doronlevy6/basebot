import { EmailTemplate } from './email-template';

export class SendEmailJob {
  from?: string;
  to: string;
  subject?: string;
  text?: string;
  template?: EmailTemplate;
  html?: string;
  headers?: { [key: string]: string };
  originalMessageHeaders?: string;
}
