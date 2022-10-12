import { KnownBlock } from '@slack/web-api';

export const GeneratedByAIBlock = (): KnownBlock => ({
  type: 'context',
  elements: [
    {
      type: 'mrkdwn',
      text: 'This text was generated by our internal AI models and may contain inaccuracies.',
    },
  ],
});
