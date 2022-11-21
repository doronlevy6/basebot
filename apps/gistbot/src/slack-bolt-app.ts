import {
  App,
  AuthorizeResult,
  Installation,
  InstallationStore,
  Receiver,
} from '@slack/bolt';
import { logger, BoltWrapper } from '@base/logger';

export function createApp(
  receiver: Receiver,
  installationStore: InstallationStore,
): App {
  return new App({
    receiver: receiver,
    logger: new BoltWrapper(logger),
    signingSecret: process.env.GISTBOT_SLACK_SIGNING_SECRET,
    clientId: process.env.GISTBOT_SLACK_CLIENT_ID,
    clientSecret: process.env.GISTBOT_SLACK_CLIENT_SECRET,
    stateSecret: process.env.GISTBOT_SLACK_STATE_SECRET,
    scopes: [
      'chat:write',
      'im:history',
      'users:read',
      'users.profile:read',
      'commands',
      'channels:history',
      'channels:join',
      'usergroups:read',
      'reactions:read',
      'groups:history',
      'channels:read',
      'groups:read',
    ],
    // All of the installation stuff cannot happen on this app, since the receiver is an asynchronous receiver
    // listening to SQS. The actual installation handling should be in the `apps/slacker` slack bolt app.
    // The installation store itself is passed in for a readonly capacity, to add an authorized token to each request received.
    authorize: async ({
      teamId,
      enterpriseId,
      isEnterpriseInstall,
    }): Promise<AuthorizeResult> => {
      const installation = await installationStore.fetchInstallation({
        teamId: teamId,
        enterpriseId: enterpriseId,
        isEnterpriseInstall: isEnterpriseInstall,
      });

      if (isEnterpriseInstall) {
        const orgInstallation = installation as Installation<'v2', true>;

        return {
          botToken: orgInstallation.bot?.token,
          userToken: orgInstallation.user.token,
          botId: orgInstallation.bot?.id,
          botUserId: orgInstallation.bot?.userId,
          teamId: undefined, // We actually have the team id on the installation value, but the type won't let us extract it.
          enterpriseId: orgInstallation.enterprise.id,
        };
      }

      const normalInstallation = installation as Installation<'v2', false>;

      return {
        botToken: normalInstallation.bot?.token,
        userToken: normalInstallation.user.token,
        botId: normalInstallation.bot?.id,
        botUserId: normalInstallation.bot?.userId,
        teamId: normalInstallation.team.id,
        enterpriseId: normalInstallation.enterprise?.id,
      };
    },
    socketMode: false,
    developerMode: true,
  });
}
