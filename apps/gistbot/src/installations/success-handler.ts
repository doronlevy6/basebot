import { CallbackOptions } from '@slack/oauth';
import { postInstallationMessage } from './post-install';

export const installationSucccessHandler: CallbackOptions['successAsync'] =
  async (installation, installOptions, req, res) => {
    const redirectUrl = process.env.SLACK_REDIRECT_URL as string;

    await postInstallationMessage(
      installation.user.id,
      installation.bot?.token || '',
    );

    res.writeHead(302, {
      Location: redirectUrl,
    });
    res.end();
  };
