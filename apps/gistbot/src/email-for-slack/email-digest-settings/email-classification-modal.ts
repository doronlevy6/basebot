import { ModalView, PlainTextOption } from '@slack/web-api';
import { EmailCategory } from '../types';

export const emailClassificationModal = (
  currentCategory: string,
): ModalView => {
  return {
    type: 'modal',

    callback_id: 'category-classification',
    title: {
      type: 'plain_text',
      text: `${currentCategory}`,
      emoji: true,
    },
    submit: {
      type: 'plain_text',
      text: 'Submit',
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
      emoji: true,
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Should this email not be in ${currentCategory}?* `,
        },
      },
      {
        block_id: 'categories',
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Choose where you want to recieve emails like this in the future',
        },
        accessory: {
          type: 'multi_static_select',
          placeholder: {
            type: 'plain_text',
            text: 'Select options',
            emoji: true,
          },
          options: createBlocksFromEnum(EmailCategory[currentCategory]),
          action_id: 'selected-category',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: "It will not impact your Gmail tags, categories, in anyway. Only where you'll get it via theGist",
          },
        ],
      },
    ],
  };
};

const createBlocksFromEnum = (
  currentCategory: EmailCategory,
): PlainTextOption[] => {
  const options: PlainTextOption[] = [];
  for (const category in EmailCategory) {
    if (category !== currentCategory) {
      options.push({
        text: {
          type: 'plain_text',
          text: EmailCategory[category],
          emoji: true,
        },
        value: EmailCategory[category],
      });
    }
  }

  return options;
};
