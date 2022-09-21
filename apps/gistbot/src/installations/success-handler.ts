import { CallbackOptions } from '@slack/oauth';

export const installationSucccessHandler: CallbackOptions['successAsync'] =
  async (installation, installOptions, req, res) => {
    const params = new URLSearchParams();
    params.set('from', `slack_success`);

    // TODO: Redirect to Gistbot Page instead of link.base.la
    res.writeHead(302, {
      Location: `https://link.base.la?${params.toString()}`,
    });
    res.end();
  };
