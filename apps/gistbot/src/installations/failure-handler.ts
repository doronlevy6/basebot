import { CallbackOptions } from '@slack/oauth';

export const installationFailureHandler: CallbackOptions['failure'] = (
  installation,
  installOptions,
  req,
  res,
) => {
  const params = new URLSearchParams();
  params.set(
    'error',
    `We've failed connecting your slack account to BASE. Please try again.`,
  );
  params.set('from', 'slack_failure');

  // TODO: Redirect to Gistbot Page instead of www.base.la
  res.writeHead(302, {
    Location: `https://www.base.la/slack-failure`,
  });
  res.end();
};
