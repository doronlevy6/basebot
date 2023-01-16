import {
  ConversationSummary,
  MessagesSummaryModel,
  InferenceResult,
} from './messages-summary.model';

describe('MessagesSummaryModel', () => {
  it('should parse response correctly', async () => {
    const response: InferenceResult[] = [
      {
        MOD_TITLE: false,
        TEXT_TITLE: 'Resetting the stage for Kiani Bamba',
        THREAD_TS: '1668337919233329',
        TEXT_SUMMARY:
          'Kiani Bamba came back on Friday, but did not have a good experience. Itay Dressler wonders if the onboarding events were sent correctly. Lior Nussbaum is going to clear the test databases and try again.',
        EVALUATION: true,
        MOD_SUMMARY: false,
        TIME_SAVED: -1,
      },
      {
        MOD_TITLE: false,
        TEXT_TITLE: 'Delayed Messages in Slack',
        THREAD_TS: '1668352582713729',
        TEXT_SUMMARY:
          'The Slack API team is discussing an issue with links not being properly disabled when using the scheduled message API. They are considering copying over code from the Slackbot to fix the issue.',
        EVALUATION: true,
        MOD_SUMMARY: false,
        TIME_SAVED: -1,
      },
      {
        MOD_TITLE: false,
        TEXT_TITLE: '"Onboarding Defaulting to 3 Days"',
        THREAD_TS: '1668354199704749',
        TEXT_SUMMARY:
          'Itay and Coby discuss the onboarding process for the message app. It is decided that if there is not enough content, the user will be notified.',
        EVALUATION: true,
        MOD_SUMMARY: false,
        TIME_SAVED: -1,
      },
      {
        MOD_TITLE: false,
        TEXT_TITLE: 'Itay and Lior discuss testing and deployment plans.',
        THREAD_TS: '1668360190439619',
        TEXT_SUMMARY:
          'Itay Dressler and Lior Nussbaum discuss deploying to prod in order to help with tests. Lior suggests testing the triggers as well, and Itay agrees. They agree to test the threads on a different environment during onboarding.',
        EVALUATION: true,
        MOD_SUMMARY: false,
        TIME_SAVED: -1,
      },
    ];

    const expected: ConversationSummary[] = [
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

    const model = new MessagesSummaryModel('', '', '');
    const conversations = model.convertModelResponseToSummaries(response);
    expect(conversations).toEqual(expected);
  });
});
