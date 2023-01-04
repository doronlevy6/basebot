export const ChatGistMessageBlocks = (name: string, title: string) => {
  return [
    {
      type: 'image',
      title: {
        type: 'plain_text',
        text: 'I Need a Marg',
        emoji: true,
      },
      image_url: 'https://media.giphy.com/media/l0HlFFZMA9gConoJO/giphy.gif',
      alt_text: 'marg',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'We\'ve added a new feature: *Chat!* I can help you with writing, coding, problem-solving, or just provide a new perspective on any topic.\n\n Ask me anything directly here in the DM, or you can even ask me questions in channels by mentioning me: "@theGist [your question]". Go ahead and give it a try, choose one of these prompts to get started:',
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Write an HTTP request in JS',
            emoji: true,
          },
          value: 'How do I make an HTTP request in Javascript?',
          style: 'primary',
          action_id: 'chat-gist-action-item-0',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Write me a love poem',
            emoji: true,
          },
          value: `Write me a love poem about ${name} the ${title}`,
          style: 'primary',
          action_id: 'chat-gist-action-item-1',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'New year message to colleague',
            emoji: true,
          },
          value:
            'Write a message I can send my colleague wishing him a happy new year, 2023',
          style: 'primary',
          action_id: 'chat-gist-action-item-2',
        },
      ],
    },
  ];
};
