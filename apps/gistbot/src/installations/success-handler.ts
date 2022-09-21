import { CallbackOptions } from '@slack/oauth';

export const installationSucccessHandler: CallbackOptions['successAsync'] =
  async (installation, installOptions, req, res) => {
    const redirectUrl = process.env.SLACK_REDIRECT_URL as string;

    res.writeHead(302, {
      Location: redirectUrl,
    });
    res.end();
  };
