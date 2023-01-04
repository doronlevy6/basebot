// Before anything else runs, first we must load the environment that we are running
import { WebClient } from '@slack/web-api';
import { ChatGistMessageBlocks } from './chat-gist-message';
import { calculateUserDefaultHour } from '../../apps/gistbot/src/utils/time-utils';
import { ChatGistOutPutStore } from './chat-gist-output-store';
import { ChatGistDataStore } from './chat-gist-data-store';
import { parse } from 'csv-parse';
import * as fs from 'fs';

const THE_GIST_TEAM_ID = 'T02G37MUWJ1';
const isTheGistTeam = (teamId: string) => teamId === THE_GIST_TEAM_ID;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function chatGistNotify() {
  const usersToPush: Map<string, Set<string>> = new Map<string, Set<string>>();
  console.log('starting notifier');
  const chatGistDataStore = new ChatGistDataStore();
  const chatGistStore = new ChatGistOutPutStore();
  fs.createReadStream('./tools/chatgist//users_1.csv')
    .pipe(parse({ delimiter: ',', from_line: 2 }))
    .on('data', (row) => {
      if (row[0] && (row[0] as string).includes('_')) {
        const splited = (row[0] as string).split('_');
        if (splited.length === 2 && splited[1].toLowerCase() !== 'unknown') {
          let setOfUsers: Set<string> = new Set();
          if (usersToPush.has(splited[0])) {
            setOfUsers = usersToPush.get(splited[0]);
          }
          setOfUsers.add(splited[1]);
          usersToPush.set(splited[0], setOfUsers);
        }
      }
    })
    .on('error', function (error) {
      console.error(`error occured while reading csv ${error.message}`);
      process.exit(1);
    })
    .on('end', function () {
      sendMessageToUsers(usersToPush, chatGistStore, chatGistDataStore);
    });
}

export async function sendMessageToUsers(
  teamToUser: Map<string, Set<string>>,
  chatGistStore: ChatGistOutPutStore,
  chatGistDataStore: ChatGistDataStore,
) {
  try {
    const teamIds = Array.from(teamToUser.keys());
    const teamToToken = await chatGistDataStore.getTeamsTokens(teamIds);
    if (teamToToken.size === 0) {
      console.warn('no tokens, stopping');
      return;
    }
    const entries = Array.from(teamToUser.entries());
    for (const entry of entries) {
      const token = teamToToken.get(entry[0]);
      if (token) {
        try {
          sendMessageByTeam(
            entry[0],
            token,
            Array.from(entry[1]),
            chatGistStore,
          );
          console.info(
            `sent to team ${entry[0]} waiting 15 seconds to next team`,
          );
          await delay(1000 * 15);
        } catch (e) {
          console.warn(`error sending message to team ${entry[0]}, skipping`);
        }
      } else {
        console.warn(`no token for team ${entry[0]}, skipping`);
      }
    }
    console.info('sent to all users');
  } catch (e) {
    console.error(`error occurred sendMessageToUsers${e}`);
  }
  chatGistStore.writeSuccessfulUsers();
  process.exit(0);
}

const sendMessageByTeam = async (
  teamId: string,
  botToken: string,
  userIds: string[],
  chatGistStore: ChatGistOutPutStore,
) => {
  const webClient = new WebClient(botToken);
  chatGistStore.loadSuccessfulUsers();
  const results = userIds.map(async (uId) => {
    try {
      const alreadySentToUser = chatGistStore.isSuccessful(uId);
      if (alreadySentToUser && !isTheGistTeam(teamId)) {
        console.log(
          `already sent notification to user id:${uId} at team:${teamId} skipping`,
        );
        return;
      }
      const res = await webClient.users.info({ user: uId });
      if (res.error || !res.ok) {
        console.log(
          `user id:${uId} at team:${teamId} had an error, skipping ${
            res.error || 'unknown error'
          }`,
        );
        return;
      }
      if (res.user.is_bot) {
        console.log(
          `user id:${uId} is seems to be a bot id at team:${teamId} skipping`,
        );
        return;
      }
      if (!res.user.tz_offset) {
        console.log(
          `user id:${uId} at team:${teamId} does not have a timezone skipping`,
        );
        return;
      }
      const timeToSchedule = new Date();
      timeToSchedule.setDate(timeToSchedule.getDate() + 1);
      timeToSchedule.setUTCHours(
        calculateUserDefaultHour(res.user.tz_offset || 0, 9),
        0,
        0,
      );
      const post_at = (timeToSchedule.getTime() / 1000).toFixed(0);
      console.log(
        `time to scheduale for user ${uId} is: ${timeToSchedule} in unix:${timeToSchedule.getTime()} epoch:${post_at}`,
      );

      await chatGistStore.addNewSuccessfulUsers({
        userId: uId,
        teamId: teamId,
      });
      await webClient.chat.scheduleMessage({
        text: `Hi ${res.user.name}:wave:`,
        blocks: ChatGistMessageBlocks(res.user.name, res.user.profile.title),
        channel: uId,
        post_at: post_at,
      });

      console.log(
        `sent message to user ${uId} in team: ${teamId} at ${timeToSchedule}, alse set in redis cache for the next 24 hrs`,
      );
    } catch (e) {
      console.log(e);
    }
  });
  Promise.allSettled(results);
};

chatGistNotify();
