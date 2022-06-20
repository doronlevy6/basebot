import { logger } from '@base/logger';
import { SlackbotApiApi as SlackbotApi } from '@base/oapigen';
import { CallbackOptions, Installation } from '@slack/oauth';
import { WebClient } from '@slack/web-api';
import { ImportController } from '../imports/controller';

export const installationSucccessHandler: (
  importController: ImportController,
  baseApi: SlackbotApi,
) => CallbackOptions['successAsync'] =
  (importController, baseApi) =>
  async (installation, installOptions, req, res) => {
    const { domains, logo, displayName } = await fetchTeamDomains(installation);

    updateSettings(domains, installation, baseApi, logo.image_230, displayName);
    startImport(domains, installation, importController);

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write(
      `Thanks for connecting slack to BASE. You can go back to the app now.`,
    );
    res.end();
  };

const updateSettings = async (
  teamDomains: string[],
  installation: Installation,
  baseApi: SlackbotApi,
  teamLogo: string,
  teamDisplayName: string,
) => {
  try {
    await baseApi.slackbotApiControllerUpdateSettings({
      teamDisplayName: teamDisplayName,
      teamDomains: teamDomains,
      teamId: installation.team.id,
      teamLogo,
    });
  } catch (err) {
    logger.error({ msg: 'Failed updating org settings', err });
  }
};

const startImport = async (
  teamDomains: string[],
  installation: Installation,
  importController: ImportController,
) => {
  const token = installation.bot.token;
  const teamId = installation.team.id;
  importController.startImport({
    token,
    slackTeamEmailDomains: teamDomains,
    slackTeamId: teamId,
  });
};

const fetchTeamDomains = async (installation: Installation) => {
  const client = new WebClient(installation.bot.token);
  const teamInfoRes = await client.team.info();

  if (teamInfoRes.error || !teamInfoRes.ok) {
    logger.error(
      `Error getting team info in store installation on slack: ${teamInfoRes.error}`,
    );

    return;
  }

  logger.debug({
    msg: 'Fetched team info post installation',
    team: teamInfoRes.team,
  });

  const domains = teamInfoRes.team.email_domain.split(',');
  return {
    domains,
    logo: teamInfoRes.team.icon,
    displayName: teamInfoRes.team.name,
  };
};
