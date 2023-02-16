import { AnalyticsManager } from '@base/gistbot-shared';
import { ConnectToGmail } from '../../slack/components/connect-to-gmail';
import { SlackSlashCommandWrapper } from '../../slack/types';

export const connectGmailCommand = async (
  { client, command, body: { user_id }, ack }: SlackSlashCommandWrapper,
  analyticsManager: AnalyticsManager,
) => {
  await ack();
  await client.chat.postMessage({
    channel: user_id,
    text: 'Hi there :wave:',
    blocks: ConnectToGmail(command.user_id, command.team_id),
  });

  analyticsManager.gmailOnboardingFunnel({
    funnelStep: 'start',
    slackTeamId: command.team_id,
    slackUserId: command.user_id,
  });
};
