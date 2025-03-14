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
    const { domains, logo, displayName } =
      (await fetchTeamDomains(installation)) || {};

    if (domains) {
      await updateSettings(
        domains,
        installation,
        baseApi,
        logo?.image_230 || '',
        displayName || '',
      );
      await startImport(domains, installation, importController);
    } else {
      logger.warn(`no domains found for ${JSON.stringify(installation)}`);
    }

    const params = new URLSearchParams();
    params.set('from', `slack_success`);
    res.writeHead(302, {
      Location: `https://link.base.la?${params.toString()}`,
    });
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
      teamId: installation.team?.id || '',
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
  const token = installation.bot?.token || '';
  const teamId = installation.team?.id || '';
  await importController.startImport({
    token,
    slackTeamEmailDomains: teamDomains,
    slackTeamId: teamId,
  });
};

const fetchTeamDomains = async (installation: Installation) => {
  const client = new WebClient(installation.bot?.token);
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

  const domains = teamInfoRes.team?.email_domain?.split(',') || [];
  return {
    domains,
    logo: teamInfoRes.team?.icon,
    displayName: teamInfoRes.team?.name,
  };
};
