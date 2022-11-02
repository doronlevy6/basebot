import { ModalView } from '@slack/web-api';
import { UserLink } from '../slack/components/user-link';
import { GistlyCommandType } from './types';

interface IProps {
  metadata?: string;
  submitCallback: string;
  userInput?: string;
  suggestedText?: string;
  userId: string;
  selectedCommand?: GistlyCommandType;
}

export const GistlyModal: (props: IProps) => ModalView = ({
  metadata,
  submitCallback,
  suggestedText,
  userInput,
  userId,
  selectedCommand,
}) => {
  return {
    type: 'modal',
    private_metadata: metadata,
    callback_id: submitCallback,
    submit: {
      type: 'plain_text',
      text: 'Update',
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
      emoji: true,
    },
    title: {
      type: 'plain_text',
      text: 'Gistly',
      emoji: true,
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:wave: Hey ${UserLink(userId)}!.`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'input',
        block_id: 'command_type',
        label: {
          type: 'plain_text',
          text: 'How would you like me to help you?',
          emoji: true,
        },
        element: {
          type: 'radio_buttons',
          initial_option: {
            text: {
              type: 'plain_text',
              text: 'Grammer Correct',
              emoji: true,
            },
            value: selectedCommand ?? GistlyCommandType.Grammer,
          },
          action_id: 'value',
          options: [
            {
              text: {
                type: 'plain_text',
                text: 'Grammer Correct',
                emoji: true,
              },
              value: GistlyCommandType.Grammer,
            },
            {
              text: {
                type: 'plain_text',
                text: 'Shorten text',
                emoji: true,
              },
              value: GistlyCommandType.ShortenText,
            },
            {
              text: {
                type: 'plain_text',
                text: 'Generate message',
                emoji: true,
              },
              value: GistlyCommandType.Generate,
            },
            {
              text: {
                type: 'plain_text',
                text: 'Add emojis',
                emoji: true,
              },
              value: GistlyCommandType.Emojify,
            },
            {
              text: {
                type: 'plain_text',
                text: 'Custom',
                emoji: true,
              },
              value: GistlyCommandType.Custom,
            },
          ],
        },
      },
      {
        type: 'input',
        block_id: 'input_text',
        label: {
          type: 'plain_text',
          text: 'Paste the text you want me to work on',
          emoji: true,
        },
        element: {
          type: 'plain_text_input',
          multiline: true,
          initial_value: userInput,
          action_id: 'value',
        },
      },
      {
        block_id: 'suggestion',
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: suggestedText ?? ' ',
        },
      },
    ],
  };
};
