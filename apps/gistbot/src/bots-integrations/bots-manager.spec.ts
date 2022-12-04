import { BotsManager } from './bots-manager';
import { BasicTesterBot, BasicTesterBot2 } from './bots/basic-tester.bot';

describe('BotsManager', () => {
  it('empty returns empty', async () => {
    const expected = [];
    const botsManager = new BotsManager(new BasicTesterBot());
    const botSummaries = botsManager.handleBots([]);
    expect(botSummaries).toEqual(expected);
  });

  it('detects single bot channel correctly', async () => {
    const input = [
      {
        bot_id: 'B01',
        bot_profile: {
          id: 'B01',
          name: 'BasicTesterBot',
        },
      },
    ];
    const expected = [
      {
        summary: 'random summary',
        botName: 'BasicTesterBot',
        numberOfMessages: 1,
        detectedAsSingleBotChannel: true,
      },
    ];
    const botsManager = new BotsManager(new BasicTesterBot());
    const botSummaries = botsManager.handleBots(input);
    expect(botSummaries).toEqual(expected);
  });

  it('detects not single bot channel correctly', async () => {
    const input = [
      {
        bot_id: 'B01',
        bot_profile: {
          id: 'B01',
          name: 'BasicTesterBot',
        },
      },
      {
        text: 'wow',
      },
    ];
    const expected = [
      {
        summary: 'random summary',
        botName: 'BasicTesterBot',
        numberOfMessages: 1,
        detectedAsSingleBotChannel: false,
      },
    ];
    const botsManager = new BotsManager(new BasicTesterBot());
    const botSummaries = botsManager.handleBots(input);
    expect(botSummaries).toEqual(expected);
  });

  it('detects not single bot channel correctly', async () => {
    const input = [
      {
        bot_id: 'B01',
        bot_profile: {
          id: 'B01',
          name: 'BasicTesterBot',
        },
      },
      {
        bot_id: 'B02',
        bot_profile: {
          id: 'B02',
          name: 'BasicTesterBot2',
        },
      },
    ];
    const expected = [
      {
        summary: 'random summary',
        botName: 'BasicTesterBot',
        numberOfMessages: 1,
        detectedAsSingleBotChannel: false,
      },
      {
        summary: 'random summary 2',
        botName: 'BasicTesterBot2',
        numberOfMessages: 1,
        detectedAsSingleBotChannel: false,
      },
    ];
    const botsManager = new BotsManager(
      new BasicTesterBot(),
      new BasicTesterBot2(),
    );
    const botSummaries = botsManager.handleBots(input);
    expect(botSummaries).toEqual(expected);
  });
});
