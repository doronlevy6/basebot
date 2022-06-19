import { logger } from '@base/logger';
import { CallbackOptions, Installation } from '@slack/oauth';
import { WebClient } from '@slack/web-api';
import { ImportController } from '../imports/controller';

export const installationSucccessHandler: (
  importController: ImportController,
) => CallbackOptions['successAsync'] =
  (importController) => async (installation, installOptions, req, res) => {
    startImport(installation, importController);

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write(
      `Thanks for connecting slack to BASE. You can go back to the app now.`,
    );
    res.end();
  };

const startImport = async (
  installation: Installation,
  importController: ImportController,
) => {
  const client = new WebClient(installation.bot.token);
  const teamInfoRes = await client.team.info();
  if (teamInfoRes.error || !teamInfoRes.ok) {
    logger.error(
      `Error getting team info in store installation on slack: ${teamInfoRes.error}`,
    );

    return;
  }

  const domains = teamInfoRes.team.email_domain.split(',');

  const token = installation.bot.token;
  const teamId = installation.team.id;
  importController.startImport({
    token,
    slackTeamEmailDomains: domains,
    slackTeamId: teamId,
  });
};
