import { AnalyticsManager } from '@base/gistbot-shared';
import {
  SlackBlockActionWrapper,
  SlackSlashCommandWrapper,
  ViewAction,
} from '../../slack/types';
import { createClassificationRule } from './email-digest-settings-client';

import { CreateUserDomainRuleDto, UserDomainRuleType } from './types';
import { EmailCategory, GmailDigestSection } from '../types';
import { HomeDataStore } from '../../home/home-data-store';
import { emailClassificationModal } from './email-classification-modal';

export const showEmailDigestClassifcationsModal =
  (analyticsManager: AnalyticsManager, homeStore: HomeDataStore) =>
  async ({
    logger,
    body,
    client,
  }: SlackBlockActionWrapper | SlackSlashCommandWrapper) => {
    const teamId = body.team?.id;
    const userId = body.user?.id;
    if (!teamId || !userId) {
      logger.error(
        `no teamId or userId in handler for showEmailDigestClassifcationsModal ${JSON.stringify(
          body,
        )}`,
      );
      return;
    }
    try {
      logger.debug(`Showing email classifcation modal ${body}`);

      const data = await homeStore.fetch({
        slackUserId: body.user.id,
        slackTeamId: body.team.id,
      });
      const messageId = body.actions[0].value;
      const sections = data?.gmailDigest?.digest.sections;
      const category = getMessage(sections, messageId)?.relatedMails?.[0]
        ?.classifications?.[0]?.type as string;
      await client.views.push({
        trigger_id: body.trigger_id,
        view: {
          private_metadata: messageId,
          ...emailClassificationModal(category),
        },
      });
      try {
        analyticsManager.buttonClicked({
          type: 'email-digest-open-change-classificaion-modal',
          slackTeamId: teamId,
          slackUserId: userId,
        });
      } catch (ex) {
        logger.error(
          `Failed to send analytics , email-digest-open-change-classificaion-modal,userId ${userId}, error:  ${ex}`,
        );
      }
    } catch (err) {
      logger.error(
        `email change classification open modal error: ${err} ${err.stack}`,
      );
    }
  };

export const saveEmailDigestClassificationHandler =
  (analyticsManager: AnalyticsManager, homeStore: HomeDataStore) =>
  async (params: ViewAction) => {
    const { body, view, logger } = params;
    const userId = body.user.id;
    const teamId = body.team?.id;
    const messageId = body.view.private_metadata;
    let currentCategory = '';
    let changeTocategory = '';
    if (!teamId || !userId) {
      logger.error(
        `no teamId or userId in handler for showEmailDigestClassifcationsModal ${JSON.stringify(
          body,
        )}`,
      );
      return;
    }
    try {
      changeTocategory =
        view.state.values?.categories?.['selected-category']
          ?.selected_options?.[0]?.value ?? '';
      if (!changeTocategory) {
        console.warn(
          `cant change category cause ,selected caterogy is missing ,userId: ${userId}, `,
        );
      }
      const data = await homeStore.fetch({
        slackUserId: userId,
        slackTeamId: teamId,
      });
      const message = getMessage(data?.gmailDigest?.digest.sections, messageId);
      currentCategory = message?.relatedMails?.[0]?.classifications?.[0]
        ?.type as string;
      const from = message?.from;
      if (!from) {
        logger.error(
          `Failed to change category cause selected domain is missing ,for user ${userId},messageId: ${messageId}`,
        );
        return;
      }
      const userDomainRule: CreateUserDomainRuleDto = {
        data: {
          category: EmailCategory[changeTocategory],
        },
        includeAllUsernames: false,
        senderEmail: getEmailAddress(from),
        type: UserDomainRuleType.Classify,
      };
      await createClassificationRule(
        { slackTeamId: teamId, slackUserId: userId },
        userDomainRule,
      );
    } catch (ex) {
      logger.error(
        `error occured during change email's category procedure in change calssification modal,for user ${userId}, error:  ${ex}`,
      );
    }
    try {
      analyticsManager.buttonClicked({
        type: 'email-change-category',
        slackTeamId: teamId,
        slackUserId: userId,
        extraParams: {
          to: changeTocategory,
          from: currentCategory,
        },
      });
    } catch (ex) {
      logger.error(
        `Failed to send analytics,email-change-category,userId ${userId}, error:  ${ex}`,
      );
    }
  };

function getEmailAddress(from: string) {
  const regex = /<([^>]+)>/;
  const match = regex.exec(from);
  const extractedString = (match && match[1]) || '';
  return extractedString;
}

function getMessage(
  sections: GmailDigestSection[] | undefined,
  messageId: string,
) {
  const message = sections
    ?.map(
      (section) => section.messages.filter((msg) => msg.id === messageId)[0],
    )
    .filter((message) => message !== undefined)[0];
  return message;
}
