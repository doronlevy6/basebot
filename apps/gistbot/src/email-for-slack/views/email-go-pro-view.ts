import { ModalView } from '@slack/web-api';
import { GoProButton } from '../../slack/components/go-pro-button';

export const EmailGoProView: () => ModalView = () => {
  return {
    type: 'modal',
    title: {
      type: 'plain_text',
      text: 'Get Unlimited Access',
      emoji: true,
    },
    blocks: [
      {
        type: 'image',
        image_url:
          'https://assets.thegist.ai/gist/assets/rule_gmail_slack.jpeg',
        alt_text: 'inspiration',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*What you get with Pro*\n _Gmail_\n- Clear your inbox with bulk actions.\n- Reply from Slack\n_Slack_\n- Unlimited on-demand summaries\n- 16 channels digests\n- Unlimited ChatGPT functionality\n\n',
        },
        accessory: GoProButton(),
      },
    ],
  };
};
