import { CallbackOptions } from '@slack/oauth';

export const installationFailureHandler: CallbackOptions['failure'] = (
  installation,
  installOptions,
  req,
  res,
) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write(
    `We've failed connecting your slack account to BASE. Please try again.`,
  );
  res.end();
};
