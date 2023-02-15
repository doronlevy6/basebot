import { ConnectToGmail } from '../../slack/components/connect-to-gmail';
import { SlackSlashCommandWrapper } from '../../slack/types';

export const connectGmailCommand = async ({
  client,
  command,
  body: { user_id },
}: SlackSlashCommandWrapper) => {
  await client.chat.postMessage({
    channel: user_id,
    text: 'Hi there :wave:',
    blocks: ConnectToGmail(command.user_id, command.team_id),
  });
};
