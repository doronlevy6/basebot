import { EmailTemplate } from '@base/emailer';

export const ActivateSubscriptionTemplate = (
  passphrase: string,
  slackLink: string,
  customerName?: string | null,
): EmailTemplate => {
  return {
    id: 'd-9f251ba60c0e481a854f3da9aead976c',
    data: {
      Passphrase: passphrase,
      Sender_Name: customerName,
      slack_url: slackLink,
    },
  };
};
