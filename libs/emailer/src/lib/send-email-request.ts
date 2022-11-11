import { EmailTemplate } from './email-template';

export interface SendEmailRequest {
  from?: string;
  fromName?: string;
  to: string;
  subject?: string;
  text?: string;
  template?: EmailTemplate;
  html?: string;
  headers?: { [key: string]: string };
  originalMessageHeaders?: string;
}
