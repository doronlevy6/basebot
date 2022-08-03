import { logger } from '@base/logger';
import { SlackbotApiApi } from '@base/oapigen';
import { snakeToTitleCase } from '@base/utils';
import { WebClient } from '@slack/web-api';

export const showOauthModalIfNeeded = async (
  data: {
    userId: string;
    orgId: string;
    triggerId: string;
    provider: string;
  },
  client: WebClient,
  baseApi: SlackbotApiApi,
) => {
  try {
    const { userId, orgId, triggerId, provider } = data;

    const userProviders = await (
      await baseApi.slackbotApiControllerGetUserProviders(userId, orgId)
    ).data;

    if (userProviders.includes(provider)) {
      return false;
    }

    const oauthRedirectUrl = (
      await baseApi.slackbotApiControllerGenerateOauthRedirect({
        provider,
        organizationId: orgId,
        userId: userId,
      })
    ).data;

    await client.views.open({
      trigger_id: triggerId,
      view: {
        private_metadata: '',
        callback_id: 'add-links-oauth-submit',
        type: 'modal',
        title: {
          type: 'plain_text',
          text: `Base & ${snakeToTitleCase(provider)}`,
        },
        close: {
          type: 'plain_text',
          text: 'Connect Later',
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Let Base update your progress automatically by connecting ${snakeToTitleCase(
                provider,
              )}\n\n`,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                style: 'primary',
                text: {
                  type: 'plain_text',
                  text: 'Connect now',
                  emoji: true,
                },
                value: 'click_to_open_oauth',
                url: oauthRedirectUrl,
                action_id: 'click-to-open-oauth-action',
              },
            ],
          },
        ],
      },
    });

    return true;
  } catch (error) {
    logger.error({
      msg: `Error creating modal for OAuth Connect`,
      error: error.stack,
    });
  }

  return false;
};
