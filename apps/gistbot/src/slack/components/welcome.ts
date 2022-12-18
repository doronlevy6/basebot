import { KnownBlock } from '@slack/web-api';
import { AddToMultipleChannels } from './add-to-multiple-channels';
import { Help } from './help';

export const Welcome = (
  userId: string,
  myBotUserId: string,
  onboardingContext: string,
): KnownBlock[] => {
  return [
    ...Help(userId, myBotUserId),
    {
      type: 'divider',
    },
    ...AddToMultipleChannels(),
  ];
};
