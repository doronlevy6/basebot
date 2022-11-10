import { KnownBlock } from '@slack/bolt';

export const OnboardingFirstSummaryDivider = (): KnownBlock[] => {
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: "Let's get your first summaries 👀",
        emoji: true,
      },
    },
  ];
};
