import { gmail_v1 } from 'googleapis';

export const extractEmailContent = (data: gmail_v1.Schema$Message[]) => {
  const results = data.map((mail) => {
    const from = mail.payload?.headers?.find(
      (header) => header.name?.toLowerCase() === 'from',
    );
    const subject = mail.payload?.headers?.find(
      (header) => header.name?.toLowerCase() === 'subject',
    );
    return {
      from: from?.value || '',
      subject: subject?.value || '',
      snippet: mail.snippet || '',
      id: mail.id || '',
    };
  });
  return results;
};
