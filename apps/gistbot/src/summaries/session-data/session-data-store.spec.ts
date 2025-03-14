import { Session } from './types';
import { anonymizeSession } from './utils';

describe('SessionDataStore', () => {
  it('anonymizes session correctly', async () => {
    const input = [
      {
        ts: '1668444126.667779',
        thread_ts: '1668444126.667779',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02FRGJHG5V',
        user_name: 'Itay Dressler',
        user_title: 'Founder & CTO',
        reactions: [
          {
            name: 'eyes',
            count: 1,
          },
          {
            name: 'cool',
            count: 1,
          },
          {
            name: 'call_me_hand',
            count: 1,
          },
          {
            name: 'muscle',
            count: 1,
          },
        ],
        text: 'Alright slack are doing some tests on the bot, asked me for premium to continue testing and some questions re why we need some of the permissions. Hopefully they would give us a good response today/tomorrow.',
      },
      {
        ts: '1668534344.636069',
        thread_ts: '1668534344.636069',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02FRGJHG5V',
        user_name: 'Itay Dressler',
        user_title: 'Founder & CTO',
        reactions: [],
        text: 'Slack submission feedback came.',
      },
      {
        ts: '1668589120.483259',
        thread_ts: '1668589120.483259',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02FRGJHG5V',
        user_name: 'Itay Dressler',
        user_title: 'Founder & CTO',
        reactions: [],
        text: "Let's split the work on this. Posting eacn one as a message to split the work here.",
      },
      {
        ts: '1668589183.092649',
        thread_ts: '1668589130.769119',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02FRGJHG5V',
        user_name: 'Itay Dressler',
        user_title: 'Founder & CTO',
        reactions: [],
        text: '@Coby can you take this one?.',
      },
      {
        ts: '1668589252.595159',
        thread_ts: '1668589130.769119',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: 'Coby Benveniste',
        user_title: 'Dev Master',
        reactions: [],
        text: "yes, I'll take care of it. @Nir can you give me the old Slack Success page that we used to have as an HTML page? I'll use that and then redirect after a couple seconds to the Slack app.",
      },
      {
        ts: '1668592401.888329',
        thread_ts: '1668589130.769119',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U03JJF6RJ4S',
        user_name: 'Nir Kosover',
        user_title: 'Design',
        reactions: [],
        text: 'Done.',
      },
      {
        ts: '1668589312.615289',
        thread_ts: '1668589137.094289',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: 'Coby Benveniste',
        user_title: 'Dev Master',
        reactions: [],
        text: "Let's do an overview of all of our texts today. We should try to do the smart thing and extract all of the text constants to a single package (so that eventually we can do translations and shit for it as well) and then we can just make edits specifically to this package.",
      },
      {
        ts: '1668589359.344739',
        thread_ts: '1668589137.094289',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02FRGJHG5V',
        user_name: 'Itay Dressler',
        user_title: 'Founder & CTO',
        reactions: [],
        text: "I won't invest in this today, but would have been better to that in adbance yes.",
      },
      {
        ts: '1668589398.491099',
        thread_ts: '1668589137.094289',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: 'Coby Benveniste',
        user_title: 'Dev Master',
        reactions: [],
        text: "We should start extracting it now since this is the time to start reviewing all of the texts (if they're going to penalize us on it anyways).",
      },
      {
        ts: '1668589449.349239',
        thread_ts: '1668589137.094289',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: 'Coby Benveniste',
        user_title: 'Dev Master',
        reactions: [],
        text: 'Ah this is only on the Wix site, never mind. @Nir Can you take care of this.',
      },
      {
        ts: '1668589358.234209',
        thread_ts: '1668589144.919029',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: 'Coby Benveniste',
        user_title: 'Dev Master',
        reactions: [],
        text: 'Not sure how this falls under security and compliance but this can be within the last one.',
      },
      {
        ts: '1668589501.605289',
        thread_ts: '1668589144.919029',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: 'Coby Benveniste',
        user_title: 'Dev Master',
        reactions: [],
        text: '@Nir this too.',
      },
      {
        ts: '1668589548.946039',
        thread_ts: '1668589150.097419',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: 'Coby Benveniste',
        user_title: 'Dev Master',
        reactions: [],
        text: "No idea where they're getting this, we've validated multiple times. Might have been that they tried doing tests during our scheduled downtime. For now we'll just tell them it's fixed and see if it's happening again.",
      },
      {
        ts: '1668589572.422009',
        thread_ts: '1668589156.245149',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: 'Coby Benveniste',
        user_title: 'Dev Master',
        reactions: [],
        text: '@Nir this one as well, fixing up all the images (including website).',
      },
      {
        ts: '1668589605.698239',
        thread_ts: '1668589161.937409',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: 'Coby Benveniste',
        user_title: 'Dev Master',
        reactions: [],
        text: '@Nir this one as well.',
      },
      {
        ts: '1668607894.704049',
        thread_ts: '1668607894.704049',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: 'Coby Benveniste',
        user_title: 'Dev Master',
        reactions: [],
        text: 'A quick metric:. We were installed on 39 workspaces since yesterday. Out of those 39, 2 uninstalled so far (a VC and another AI company).',
      },
      {
        ts: '1668611369.200459',
        thread_ts: '1668611369.200459',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: 'Coby Benveniste',
        user_title: 'Dev Master',
        reactions: [],
        text: 'Very interesting situation just happened:. David King from cinnafilm.com installed us, tried summarizing a public channel, closed the modal without inviting, tried summarizing a private channel, closed the modal without inviting, and then uninstalled us. All within about 3 minutes.',
      },
      {
        ts: '1668611498.070419',
        thread_ts: '1668611369.200459',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02FRGJHG5V',
        user_name: 'Itay Dressler',
        user_title: 'Founder & CTO',
        reactions: [
          {
            name: '+1',
            count: 3,
          },
        ],
        text: 'We should join public channels automatically without modals.',
      },
      {
        ts: '1668617586.639969',
        thread_ts: '1668617586.639969',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02FRGJHG5V',
        user_name: 'Itay Dressler',
        user_title: 'Founder & CTO',
        reactions: [],
        text: '@Coby @Nir do we have anything still pending for the slack re submit? (From the tasks above) .',
      },
      {
        ts: '1668617857.763629',
        thread_ts: '1668617857.763629',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U03JJF6RJ4S',
        user_name: 'Nir Kosover',
        user_title: 'Design',
        reactions: [
          {
            name: '+1',
            count: 1,
          },
        ],
        text: "Me and Coby went over the things they say. But we didn't went together over all of our site (I did by myself ) but maybe it will be a good idea to have another set of eyes on it.",
      },
      {
        ts: '1668681549.788229',
        thread_ts: '1668617857.763629',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02FRGJHG5V',
        user_name: 'Itay Dressler',
        user_title: 'Founder & CTO',
        reactions: [],
        text: "There seem to lower case slack in sahar's blog, can you review them as well?.",
      },
      {
        ts: '1668681554.169539',
        thread_ts: '1668617857.763629',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02FRGJHG5V',
        user_name: 'Itay Dressler',
        user_title: 'Founder & CTO',
        reactions: [],
        text: '@Nir.',
      },
      {
        ts: '1668778886.540789',
        thread_ts: '1668617857.763629',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U03JJF6RJ4S',
        user_name: 'Nir Kosover',
        user_title: 'Design',
        reactions: [
          {
            name: '+1',
            count: 1,
          },
        ],
        text: "@Itay Fixed the lower capitals Slack, didn't go over it to fix potential grammar errors..",
      },
      {
        ts: '1669020037.500239',
        thread_ts: '1668617857.763629',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02FRGJHG5V',
        user_name: 'Itay Dressler',
        user_title: 'Founder & CTO',
        reactions: [],
        text: '@Thegist4.',
      },
      {
        ts: '1668679797.415899',
        thread_ts: '1668679797.415899',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: 'Coby Benveniste',
        user_title: 'Dev Master',
        reactions: [
          {
            name: '+1',
            count: 1,
          },
          {
            name: 'raised_hands',
            count: 2,
          },
        ],
        text: "Some insights after the activity yesterday:. We are currently on 61 Unique Teams (since our PR, overall we've got 84 total in the DB). Out of all of the installs that we got over the last two days, we've had 4 uninstalls:. - cinnefilm.com - within the span of 1 minute installed us, tried to use us, saw the invite to channel modals, and uninstalled us. see profile here. - worknet.ai - installed us, did nothing, and uninstalled us after a few hours. see profile here. - cym.bio - within the span of 3 minutes installed us, ran a summary (no feedback), and uninstalled us. see profile here. - lool.vc - within the span of 30 minutes installed us, ran a channel summary (feedback was not_good) and two thread summaries (no feedback), and uninstalled us. see profile here. Our current biggest team of users is from cafemedia.com, they have 7 unique users. That's followed by DoIt with 6 unique users, and University of Chicago with 5. Our most active user is Bill Winslow from the University of Chicago, who is our official and our first paying user! He's done 6 channel summaries since installing (no thread summaries).",
      },
      {
        ts: '1668800128.766509',
        thread_ts: '1668699379.129729',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U03JJF6RJ4S',
        user_name: 'Nir Kosover',
        user_title: 'Design',
        reactions: [],
        text: 'Fixed..',
      },
      {
        ts: '1668701354.048009',
        thread_ts: '1668701354.048009',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U03109A7BME',
        user_name: 'Itzik Ben Bassat',
        user_title: '',
        reactions: [],
        text: 'Yalla .',
      },
      {
        ts: '1668942679.241369',
        thread_ts: '1668942679.241369',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: 'Coby Benveniste',
        user_title: 'Dev Master',
        reactions: [
          {
            name: 'raised_hands',
            count: 2,
          },
          {
            name: 'star-struck',
            count: 1,
          },
        ],
        text: 'Analytics Dashboards:. - Daily Analytics - events in the last 1 day. - Weekly Analytics - events in the last 7 days. - Analytics Since Launch - events since November 15th (the day that we sent out the PR). All of these have the same graphs for now, just with different time frames.',
      },
      {
        ts: '1669051907.716469',
        thread_ts: '1669051907.716469',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02FRGJHG5V',
        user_name: 'Itay Dressler',
        user_title: 'Founder & CTO',
        reactions: [
          {
            name: 'call_me_hand',
            count: 3,
          },
        ],
        text: 'Resubmitted to slack now :crossed_fingers:.',
      },
      {
        ts: '1669107628.297889',
        thread_ts: '1669107628.297889',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: 'Coby Benveniste',
        user_title: 'Dev Master',
        reactions: [
          {
            name: 'chart_with_upwards_trend',
            count: 2,
          },
          {
            name: 'partying_face',
            count: 1,
          },
          {
            name: 'nice',
            count: 1,
          },
          {
            name: 'exploding_head',
            count: 2,
          },
        ],
        text: "@channel For anyone not looking actively at the analytics:. - We have been installed on 103 organizations (does not include uninstalls yet). - We've had 228 users so far. - Yesterdays Most Active Organizations:.     - Storytell.ai (a possible competitor) - 5 Channel Summaries.     - Oleshop.com (Don Neumark really liked us) - 5 Channel Summaries.",
      },
      {
        ts: '1669135227.756919',
        thread_ts: '1669135227.756919',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U03109A7BME',
        user_name: 'Itzik Ben Bassat',
        user_title: '',
        reactions: [],
        text: 'Thanks @Coby .',
      },
      {
        ts: '1669199744.523679',
        thread_ts: '1669199744.523679',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U03HE6E11GS',
        user_name: 'Sahar',
        user_title: 'Lead Data Scientist',
        reactions: [
          {
            name: 'eyes',
            count: 1,
          },
        ],
        text: 'FYI. On Sunday the 27th, . The staging is gonna have a big change. Please refer from planning any additional changes. Thanks.',
      },
      {
        ts: '1669206946.411499',
        thread_ts: '1669199744.523679',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'B02S82G983G',
        user_name: 'Giphy',
        user_title: 'Bot',
        reactions: [],
        text: 'do tell.',
      },
      {
        ts: '1669207042.030729',
        thread_ts: '1669199744.523679',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U03HE6E11GS',
        user_name: 'Sahar',
        user_title: 'Lead Data Scientist',
        reactions: [
          {
            name: '+1',
            count: 1,
          },
        ],
        text: 'Mostly tech changes, and a better way to deal with R-messages.  Nothing special to write about.',
      },
    ];

    const expected = [
      {
        ts: '1668444126.667779',
        thread_ts: '1668444126.667779',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02FRGJHG5V',
        user_name: '',
        user_title: '',
        reactions: [
          {
            name: 'eyes',
            count: 1,
          },
          {
            name: 'cool',
            count: 1,
          },
          {
            name: 'call_me_hand',
            count: 1,
          },
          {
            name: 'muscle',
            count: 1,
          },
        ],
        text: '',
      },
      {
        ts: '1668534344.636069',
        thread_ts: '1668534344.636069',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02FRGJHG5V',
        user_name: '',
        user_title: '',
        reactions: [],
        text: '',
      },
      {
        ts: '1668589120.483259',
        thread_ts: '1668589120.483259',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02FRGJHG5V',
        user_name: '',
        user_title: '',
        reactions: [],
        text: '',
      },
      {
        ts: '1668589183.092649',
        thread_ts: '1668589130.769119',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02FRGJHG5V',
        user_name: '',
        user_title: '',
        reactions: [],
        text: '',
      },
      {
        ts: '1668589252.595159',
        thread_ts: '1668589130.769119',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: '',
        user_title: '',
        reactions: [],
        text: '',
      },
      {
        ts: '1668592401.888329',
        thread_ts: '1668589130.769119',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U03JJF6RJ4S',
        user_name: '',
        user_title: '',
        reactions: [],
        text: '',
      },
      {
        ts: '1668589312.615289',
        thread_ts: '1668589137.094289',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: '',
        user_title: '',
        reactions: [],
        text: '',
      },
      {
        ts: '1668589359.344739',
        thread_ts: '1668589137.094289',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02FRGJHG5V',
        user_name: '',
        user_title: '',
        reactions: [],
        text: '',
      },
      {
        ts: '1668589398.491099',
        thread_ts: '1668589137.094289',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: '',
        user_title: '',
        reactions: [],
        text: '',
      },
      {
        ts: '1668589449.349239',
        thread_ts: '1668589137.094289',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: '',
        user_title: '',
        reactions: [],
        text: '',
      },
      {
        ts: '1668589358.234209',
        thread_ts: '1668589144.919029',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: '',
        user_title: '',
        reactions: [],
        text: '',
      },
      {
        ts: '1668589501.605289',
        thread_ts: '1668589144.919029',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: '',
        user_title: '',
        reactions: [],
        text: '',
      },
      {
        ts: '1668589548.946039',
        thread_ts: '1668589150.097419',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: '',
        user_title: '',
        reactions: [],
        text: '',
      },
      {
        ts: '1668589572.422009',
        thread_ts: '1668589156.245149',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: '',
        user_title: '',
        reactions: [],
        text: '',
      },
      {
        ts: '1668589605.698239',
        thread_ts: '1668589161.937409',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: '',
        user_title: '',
        reactions: [],
        text: '',
      },
      {
        ts: '1668607894.704049',
        thread_ts: '1668607894.704049',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: '',
        user_title: '',
        reactions: [],
        text: '',
      },
      {
        ts: '1668611369.200459',
        thread_ts: '1668611369.200459',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: '',
        user_title: '',
        reactions: [],
        text: '',
      },
      {
        ts: '1668611498.070419',
        thread_ts: '1668611369.200459',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02FRGJHG5V',
        user_name: '',
        user_title: '',
        reactions: [
          {
            name: '+1',
            count: 3,
          },
        ],
        text: '',
      },
      {
        ts: '1668617586.639969',
        thread_ts: '1668617586.639969',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02FRGJHG5V',
        user_name: '',
        user_title: '',
        reactions: [],
        text: '',
      },
      {
        ts: '1668617857.763629',
        thread_ts: '1668617857.763629',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U03JJF6RJ4S',
        user_name: '',
        user_title: '',
        reactions: [
          {
            name: '+1',
            count: 1,
          },
        ],
        text: '',
      },
      {
        ts: '1668681549.788229',
        thread_ts: '1668617857.763629',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02FRGJHG5V',
        user_name: '',
        user_title: '',
        reactions: [],
        text: '',
      },
      {
        ts: '1668681554.169539',
        thread_ts: '1668617857.763629',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02FRGJHG5V',
        user_name: '',
        user_title: '',
        reactions: [],
        text: '',
      },
      {
        ts: '1668778886.540789',
        thread_ts: '1668617857.763629',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U03JJF6RJ4S',
        user_name: '',
        user_title: '',
        reactions: [
          {
            name: '+1',
            count: 1,
          },
        ],
        text: '',
      },
      {
        ts: '1669020037.500239',
        thread_ts: '1668617857.763629',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02FRGJHG5V',
        user_name: '',
        user_title: '',
        reactions: [],
        text: '',
      },
      {
        ts: '1668679797.415899',
        thread_ts: '1668679797.415899',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: '',
        user_title: '',
        reactions: [
          {
            name: '+1',
            count: 1,
          },
          {
            name: 'raised_hands',
            count: 2,
          },
        ],
        text: '',
      },
      {
        ts: '1668800128.766509',
        thread_ts: '1668699379.129729',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U03JJF6RJ4S',
        user_name: '',
        user_title: '',
        reactions: [],
        text: '',
      },
      {
        ts: '1668701354.048009',
        thread_ts: '1668701354.048009',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U03109A7BME',
        user_name: '',
        user_title: '',
        reactions: [],
        text: '',
      },
      {
        ts: '1668942679.241369',
        thread_ts: '1668942679.241369',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: '',
        user_title: '',
        reactions: [
          {
            name: 'raised_hands',
            count: 2,
          },
          {
            name: 'star-struck',
            count: 1,
          },
        ],
        text: '',
      },
      {
        ts: '1669051907.716469',
        thread_ts: '1669051907.716469',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02FRGJHG5V',
        user_name: '',
        user_title: '',
        reactions: [
          {
            name: 'call_me_hand',
            count: 3,
          },
        ],
        text: '',
      },
      {
        ts: '1669107628.297889',
        thread_ts: '1669107628.297889',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U02RSMLRQQ6',
        user_name: '',
        user_title: '',
        reactions: [
          {
            name: 'chart_with_upwards_trend',
            count: 2,
          },
          {
            name: 'partying_face',
            count: 1,
          },
          {
            name: 'nice',
            count: 1,
          },
          {
            name: 'exploding_head',
            count: 2,
          },
        ],
        text: '',
      },
      {
        ts: '1669135227.756919',
        thread_ts: '1669135227.756919',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U03109A7BME',
        user_name: '',
        user_title: '',
        reactions: [],
        text: '',
      },
      {
        ts: '1669199744.523679',
        thread_ts: '1669199744.523679',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U03HE6E11GS',
        user_name: '',
        user_title: '',
        reactions: [
          {
            name: 'eyes',
            count: 1,
          },
        ],
        text: '',
      },
      {
        ts: '1669206946.411499',
        thread_ts: '1669199744.523679',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'B02S82G983G',
        user_name: '',
        user_title: '',
        reactions: [],
        text: '',
      },
      {
        ts: '1669207042.030729',
        thread_ts: '1669199744.523679',
        channel: 'summarizer-release',
        channel_id: 'C043C249WFN',
        user_id: 'U03HE6E11GS',
        user_name: '',
        user_title: '',
        reactions: [
          {
            name: '+1',
            count: 1,
          },
        ],
        text: '',
      },
    ];

    const inputSession: Session = {
      summaryType: 'channel',
      teamId: 'T123123123',
      channelId: 'C043C249WFN',
      requestingUserId: 'U03HE6E11GS',
      messages: input,
      response: 'this is some random stuff',
    };

    const expectedSession: Session = {
      summaryType: 'channel',
      teamId: 'T123123123',
      channelId: 'C043C249WFN',
      requestingUserId: 'U03HE6E11GS',
      messages: expected,
      response: 'this is some random stuff',
    };

    const anonymized = anonymizeSession(inputSession);
    expect(anonymized).toEqual(expectedSession);
  });
});
