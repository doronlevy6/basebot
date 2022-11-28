import {
  ConversationSummary,
  MessagesSummaryModel,
  Response,
} from './messages-summary.model';

describe('MessagesSummaryModel', () => {
  it('should parse response correctly', async () => {
    const response: Response = {
      non_english: {
        LANGUAGE: {
          '12': 'de',
          '10': 'lt',
        },
        SUB_TS: {
          '12': ['1668361040686609'],
          '10': ['1668360978013109'],
        },
        THREAD_TS: {
          '12': '1668352582713729',
          '10': '1668352582713729',
        },
        TS: {
          '12': '1668361040686609',
          '10': '1668360978013109',
        },
      },
      english: {
        SUB_TS: {
          '0': ['1668330760643919', '1668337919233329', '1668338065514789'],
          '1': [
            '1668352582713729',
            '1668352592826439',
            '1668352610763029',
            '1668352671864819',
            '1668353394526309',
            '1668354761803369',
            '1668355219602539',
            '1668361005473889',
            '1668361052159479',
            '1668361072758479',
            '1668361129997309',
            '1668361222084509',
            '1668362498169009',
            '1668362505059059',
            '1668362551661339',
          ],
          '2': [
            '1668354199704749',
            '1668354704141679',
            '1668354903100889',
            '1668354959013219',
            '1668354960152739',
          ],
          '3': [
            '1668360190439619',
            '1668360228506029',
            '1668360269096309',
            '1668360499366249',
            '1668360563733729',
            '1668360570991109',
          ],
        },
        SUMMARY: {
          '0': 'Kiani Bamba came back on Friday, but did not have a good experience. Itay Dressler wonders if the onboarding events were sent correctly. Lior Nussbaum is going to clear the test databases and try again.',
          '1': 'The Slack API team is discussing an issue with links not being properly disabled when using the scheduled message API. They are considering copying over code from the Slackbot to fix the issue.',
          '2': 'Itay and Coby discuss the onboarding process for the message app. It is decided that if there is not enough content, the user will be notified.',
          '3': 'Itay Dressler and Lior Nussbaum discuss deploying to prod in order to help with tests. Lior suggests testing the triggers as well, and Itay agrees. They agree to test the threads on a different environment during onboarding.',
        },
        TITLES: {
          '0': 'Resetting the stage for Kiani Bamba',
          '1': 'Delayed Messages in Slack',
          '2': '"Onboarding Defaulting to 3 Days"',
          '3': 'Itay and Lior discuss testing and deployment plans.',
        },
        THREAD_TS: {
          '0': '1668337919233329',
          '1': '1668352582713729',
          '2': '1668354199704749',
          '3': '1668360190439619',
        },
      },
    };

    const expected: ConversationSummary[] = [
      {
        rootMessageTs: '1668337919233329',
        subMessagesTs: [
          '1668330760643919',
          '1668337919233329',
          '1668338065514789',
        ],
        language: 'english',
        title: 'Resetting the stage for Kiani Bamba',
        summary:
          'Kiani Bamba came back on Friday, but did not have a good experience. Itay Dressler wonders if the onboarding events were sent correctly. Lior Nussbaum is going to clear the test databases and try again.',
      },
      {
        rootMessageTs: '1668352582713729',
        subMessagesTs: [
          '1668352582713729',
          '1668352592826439',
          '1668352610763029',
          '1668352671864819',
          '1668353394526309',
          '1668354761803369',
          '1668355219602539',
          '1668361005473889',
          '1668361052159479',
          '1668361072758479',
          '1668361129997309',
          '1668361222084509',
          '1668362498169009',
          '1668362505059059',
          '1668362551661339',
        ],
        language: 'english',
        title: 'Delayed Messages in Slack',
        summary:
          'The Slack API team is discussing an issue with links not being properly disabled when using the scheduled message API. They are considering copying over code from the Slackbot to fix the issue.',
      },
      {
        rootMessageTs: '1668352582713729',
        subMessagesTs: ['1668360978013109'],
        language: 'lt',
        title: '',
        summary: '',
      },
      {
        rootMessageTs: '1668352582713729',
        subMessagesTs: ['1668361040686609'],
        language: 'de',
        title: '',
        summary: '',
      },
      {
        rootMessageTs: '1668354199704749',
        subMessagesTs: [
          '1668354199704749',
          '1668354704141679',
          '1668354903100889',
          '1668354959013219',
          '1668354960152739',
        ],
        language: 'english',
        title: '"Onboarding Defaulting to 3 Days"',
        summary:
          'Itay and Coby discuss the onboarding process for the message app. It is decided that if there is not enough content, the user will be notified.',
      },
      {
        rootMessageTs: '1668360190439619',
        subMessagesTs: [
          '1668360190439619',
          '1668360228506029',
          '1668360269096309',
          '1668360499366249',
          '1668360563733729',
          '1668360570991109',
        ],
        language: 'english',
        title: 'Itay and Lior discuss testing and deployment plans.',
        summary:
          'Itay Dressler and Lior Nussbaum discuss deploying to prod in order to help with tests. Lior suggests testing the triggers as well, and Itay agrees. They agree to test the threads on a different environment during onboarding.',
      },
    ];

    const model = new MessagesSummaryModel();
    const conversations = model.convertModelResponseToSummaries(response);
    expect(conversations).toEqual(expected);
  });
});
