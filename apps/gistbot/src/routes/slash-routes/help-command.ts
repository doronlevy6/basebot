import { Help } from '../../slack/components/help';
import { responder } from '../../slack/responder';
import { SlackSlashCommandWrapper } from '../../slack/types';

export const helpCommand = async ({
  respond,
  client,
  command,
  body: { channel_id, user_id },
  ack,
}: SlackSlashCommandWrapper) => {
  await ack();
  await responder(
    respond,
    client,
    'Hi there :wave:',
    Help(command.user_id),
    channel_id,
    user_id,
    { response_type: 'ephemeral' },
  );
};
