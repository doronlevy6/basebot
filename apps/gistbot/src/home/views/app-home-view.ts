import { logger } from '@base/logger';
import { Block, KnownBlock } from '@slack/web-api';
import { createEmailDigestBlocks } from '../../email-for-slack/components/email-digest-blocks';
import { IHomeState } from '../types';
import { CreateEmailDigestBlocks } from './email/create-email-digest';
import { EmailFooterBlocks } from './email/footer';
import { EmailHeaderBlocks } from './email/header';
import { InboxZeroBlocks } from './email/inbox-zero';
import { OnboardToGmailBlocks } from './onboarding/onboard-gmail';
import { OnboardToSlackBlocks } from './onboarding/onboard-slack';
import { OnboardingHeaderBlocks } from './onboarding/onboarding-header';
import { OnboardingHeaderGoProBlocks } from './onboarding/onboarding-header-go-pro';
import { GoToSlackDigestBlocks } from './slack/go-to-slack-digest';

export interface IHomeMetadata {
  slackUserId: string;
  slackTeamId: string;
}

const divider: KnownBlock = { type: 'divider' };

export const AppHomeView = (
  metadata: IHomeMetadata,
  state: IHomeState,
  daysLeftFreeTrial?: number,
): Block[] => {
  const { slackUserId, slackTeamId } = metadata;
  const { gmailConnected, slackOnboarded, gmailDigest, gmailRefreshMetadata } =
    state;

  if (!slackOnboarded && !gmailConnected) {
    logger.debug(`Showing onboarding home view for ${slackUserId}...`);
    return [
      ...OnboardingHeaderBlocks(slackUserId),
      ...OnboardToSlackBlocks(),
      divider,
      ...OnboardToGmailBlocks(slackUserId, slackTeamId),
    ];
  }

  let slackBlocks: Block[] = [];
  if (slackOnboarded) {
    slackBlocks = GoToSlackDigestBlocks(slackTeamId);
  } else {
    slackBlocks = OnboardToSlackBlocks();
  }

  let gmailBlocks: Block[] = [];
  if (gmailConnected) {
    if (gmailDigest) {
      const { digest, lastUpdated } = gmailDigest;
      const {
        metedata: { userId },
      } = digest;
      const header = EmailHeaderBlocks(
        userId,
        lastUpdated,
        gmailRefreshMetadata,
      );
      const isInboxEmpty = digest.sections.length === 0;
      if (isInboxEmpty) {
        gmailBlocks = [...header, divider, ...InboxZeroBlocks()];
      } else {
        gmailBlocks = [
          ...header,
          divider,
          ...createEmailDigestBlocks(digest.sections),
          ...EmailFooterBlocks(),
        ];
      }
    } else {
      gmailBlocks = CreateEmailDigestBlocks();
    }
  } else {
    gmailBlocks = OnboardToGmailBlocks(slackUserId, slackTeamId);
  }

  return [
    ...OnboardingHeaderGoProBlocks(daysLeftFreeTrial),
    ...slackBlocks,
    divider,
    ...gmailBlocks,
  ];
};
