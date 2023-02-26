import { WebClient } from '@slack/web-api';
import { ConversationSummary } from '../models/messages-summary.model';
import { formatConversationSummaries } from './formatter';

describe('formatConversationSummaries', () => {
  it.only('should format the summaries correctly (no permalinks, mix english and others)', async () => {
    const summaries: ConversationSummary[] = [
      {
        rootMessageTs: '1668337919233329',
        title: 'Resetting the stage for Kiani Bamba',
        summary:
          'Kiani Bamba came back on Friday, but did not have a good experience. Itay Dressler wonders if the onboarding events were sent correctly. Lior Nussbaum is going to clear the test databases and try again.',
        timeSavedSeconds: -1,
      },
      {
        rootMessageTs: '1668352582713729',
        title: 'Delayed Messages in Slack',
        summary:
          'The Slack API team is discussing an issue with links not being properly disabled when using the scheduled message API. They are considering copying over code from the Slackbot to fix the issue.',
        timeSavedSeconds: -1,
      },
      {
        rootMessageTs: '1668354199704749',
        title: '"Onboarding Defaulting to 3 Days"',
        summary:
          'Itay and Coby discuss the onboarding process for the message app. It is decided that if there is not enough content, the user will be notified.',
        timeSavedSeconds: -1,
      },
      {
        rootMessageTs: '1668360190439619',
        title: 'Itay and Lior discuss testing and deployment plans.',
        summary:
          'Itay Dressler and Lior Nussbaum discuss deploying to prod in order to help with tests. Lior suggests testing the triggers as well, and Itay agrees. They agree to test the threads on a different environment during onboarding.',
        timeSavedSeconds: -1,
      },
    ];

    const expected =
      '> *Resetting the stage for Kiani Bamba*\n' +
      '> Kiani Bamba came back on Friday, but did not have a good experience. Itay Dressler wonders if the onboarding events were sent correctly. Lior Nussbaum is going to clear the test databases and try again.\n\n' +
      '> *Delayed Messages in Slack*\n' +
      '> The Slack API team is discussing an issue with links not being properly disabled when using the scheduled message API. They are considering copying over code from the Slackbot to fix the issue.\n\n' +
      '> *Onboarding Defaulting to 3 Days*\n' +
      '> Itay and Coby discuss the onboarding process for the message app. It is decided that if there is not enough content, the user will be notified.\n\n' +
      '> *Itay and Lior discuss testing and deployment plans.*\n' +
      '> Itay Dressler and Lior Nussbaum discuss deploying to prod in order to help with tests. Lior suggests testing the triggers as well, and Itay agrees. They agree to test the threads on a different environment during onboarding.';

    const got = await formatConversationSummaries(
      'C123',
      summaries,
      {} as unknown as WebClient,
      {
        addPermalinks: false,
      },
    );

    expect(got).toEqual(expected);
  });
});
