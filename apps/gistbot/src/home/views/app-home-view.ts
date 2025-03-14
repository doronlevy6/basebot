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
import { OnboardToGmailNotConnectedBlocks } from './onboarding/onboard-gmail-not-connected';
import { SLACK_MAX_HOME_BLOCKS } from '../../slack/constants';

const DIVIDER_BLOCK_LENGTH = 1;

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
  const {
    emailEnabled,
    slackOnboarded,
    gmailDigest,
    gmailRefreshMetadata,
    onBoardingMessage,
    gmailConnected,
  } = state;

  if (!slackOnboarded && !emailEnabled) {
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
  const onBoardingHeader = OnboardingHeaderGoProBlocks();
  if (emailEnabled) {
    if (!gmailConnected) {
      gmailBlocks = OnboardToGmailNotConnectedBlocks(slackUserId, slackTeamId);
    } else if (gmailDigest) {
      const { digest, lastUpdated } = gmailDigest;
      const {
        metedata: { userId },
      } = digest;
      const header = EmailHeaderBlocks(
        userId,
        slackUserId,
        lastUpdated,
        gmailRefreshMetadata,
        undefined,
        onBoardingMessage,
      );
      const isInboxEmpty = digest.sections.length === 0;
      if (isInboxEmpty) {
        gmailBlocks = [...header, divider, ...InboxZeroBlocks()];
      } else {
        const footerBlocks = EmailFooterBlocks(slackTeamId, daysLeftFreeTrial);
        const remainingBlocksForMessages =
          SLACK_MAX_HOME_BLOCKS -
          (2 * DIVIDER_BLOCK_LENGTH +
            header.length +
            footerBlocks.length +
            slackBlocks.length +
            onBoardingHeader.length); //footer and headr size + 2 dividers
        gmailBlocks = [
          ...header,
          divider,
          ...createEmailDigestBlocks(
            digest.sections,
            remainingBlocksForMessages,
          ),
          ...footerBlocks,
        ];
      }
    } else if (gmailRefreshMetadata) {
      gmailBlocks = EmailHeaderBlocks(
        'Email Digest',
        slackUserId,
        Date.now(),
        gmailRefreshMetadata,
        'Getting your first Email Digest',
        onBoardingMessage,
      );
    } else {
      gmailBlocks = CreateEmailDigestBlocks();
    }
  } else {
    gmailBlocks = OnboardToGmailBlocks(slackUserId, slackTeamId);
  }
  return [...onBoardingHeader, ...slackBlocks, divider, ...gmailBlocks];
};
