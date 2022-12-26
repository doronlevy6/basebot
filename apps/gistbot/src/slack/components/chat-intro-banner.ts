import { KnownBlock } from '@slack/web-api';
import { OnboardingChatImage } from './onboarding-chat-image';
import { UserLink } from './user-link';

export const ChatIntroBanner = (userId: string): KnownBlock[] => {
  // TODO remove this ugly code, and extract logic to a different place to be generic.
  // for now as a workaround only will apply at 26.12 and 04.10
  const today = new Date();
  if (
    !(
      (today.getDate() === 26 && today.getMonth() === 11) ||
      (today.getDate() === 27 && today.getMonth() === 11) ||
      (today.getDate() === 4 && today.getMonth() === 0)
    )
  ) {
    return [];
  }

  return [
    OnboardingChatImage(),
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Hey ${UserLink(
          userId,
        )} I'm theGist assistant :wave:\nI'm the step brother of chatGPT, but I live here in slack.\n\nCan I help you with anything?\n(e.g write a linkedin post to celebrate the holidays)`,
      },
    },
  ];
};
